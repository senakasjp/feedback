// Checks that `senaka-marking-*` skills from ~/.agents/skills reach the marking prompts.
// Run with: node tests/markingSkills.check.mjs
//
// Uses Vite's ssrLoadModule because aiMarkingService.js references import.meta.env.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

globalThis.fetch = async (url) => {
  throw new Error(`Unexpected fetch to ${url} - this check must not call a model or embeddings endpoint`)
}

const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true } })

try {
  const {
    parseMarkingSkillDocument,
    splitMarkingSkillFrontMatter,
    buildMarkingSkillMessages,
    MARKING_SKILLS_FOLDER,
    MARKING_SKILL_PREFIX
  } = await server.ssrLoadModule('/src/services/markingSkillsService.js')
  const { buildImproveFeedbackWithRagPromptPreview } = await server.ssrLoadModule('/src/services/aiMarkingService.js')
  const { buildImproveEnglishPromptPreview } = await server.ssrLoadModule('/src/services/openaiService.js')

  assert.equal(MARKING_SKILL_PREFIX, 'senaka-marking-', 'loader must only select senaka-marking-* folders')
  assert.equal(MARKING_SKILLS_FOLDER, '~/.agents/skills', 'skills folder must match the agent skills folder')

  // 1. Front matter is removed from the rules, name and description are kept.
  const standard = [
    '---',
    'name: "senaka-marking-evidence"',
    'description: "Require quoted evidence for every awarded mark."',
    '---',
    '',
    '# Evidence rule',
    '',
    'Quote the submission for every mark above zero.'
  ].join('\n')

  const parsed = parseMarkingSkillDocument(standard, 'senaka-marking-evidence')
  assert.equal(parsed.name, 'senaka-marking-evidence')
  assert.equal(parsed.description, 'Require quoted evidence for every awarded mark.')
  assert.ok(!parsed.content.includes('---'), 'front matter must not leak into the prompt text')
  assert.ok(parsed.content.startsWith('# Evidence rule'), 'body starts after the front matter')
  assert.ok(parsed.content.includes('Quote the submission for every mark above zero.'))
  assert.equal(parsed.characters, parsed.content.length)

  // 2. `>` block descriptions are joined with spaces; `|` keeps line breaks.
  const folded = parseMarkingSkillDocument(
    ['---', 'name: senaka-marking-bands', 'description: >', '  First line', '  second line', '---', 'Body.'].join('\n'),
    'senaka-marking-bands'
  )
  assert.equal(folded.description, 'First line second line')

  const literal = parseMarkingSkillDocument(
    ['---', 'name: senaka-marking-bands', 'description: |', '  First line', '  second line', '---', 'Body.'].join('\n'),
    'senaka-marking-bands'
  )
  assert.equal(literal.description, 'First line\nsecond line')

  // 3. A file without front matter still loads, using the folder name.
  const plain = parseMarkingSkillDocument('Plain rules only.', 'senaka-marking-plain')
  assert.equal(plain.name, 'senaka-marking-plain')
  assert.equal(plain.content, 'Plain rules only.')

  // 4. An unclosed front matter block must not swallow the rules.
  const unclosed = parseMarkingSkillDocument('---\nname: broken\nRules stay visible.', 'senaka-marking-broken')
  assert.ok(unclosed.content.includes('Rules stay visible.'), 'unclosed front matter keeps the text')

  assert.equal(splitMarkingSkillFrontMatter('no fence here').content, 'no fence here')

  // 5. Each skill becomes one system message that keeps its text verbatim.
  const skillMessages = buildMarkingSkillMessages([parsed, { id: 'senaka-marking-empty', content: '   ' }])
  assert.equal(skillMessages.length, 1, 'blank skills are skipped')
  assert.equal(skillMessages[0].role, 'system')
  assert.ok(skillMessages[0].content.includes('Marking skill: senaka-marking-evidence'))
  assert.ok(skillMessages[0].content.includes('Quote the submission for every mark above zero.'))
  assert.ok(skillMessages[0].content.includes('does not override the rubric'), 'skill must not outrank the rubric')

  // 6. The skill reaches the real prompt, before the assessor global instructions.
  const assessment = { name: 'Test assessment', categories: [] }
  const withSkill = await buildImproveFeedbackWithRagPromptPreview({
    assessment,
    categoryName: 'Evidence',
    shortFeedback: 'The report is missing a safety check.',
    studentSubmission: 'Chapter 1 describes the build.',
    globalSystemInstructions: 'Be strict.',
    markingSkills: [parsed]
  })

  const systemContents = withSkill.messages.filter(message => message.role === 'system').map(message => String(message.content))
  const skillIndex = systemContents.findIndex(content => content.includes('Marking skill: senaka-marking-evidence'))
  const assessorIndex = systemContents.findIndex(content => content.includes('Be strict.'))

  assert.ok(skillIndex >= 0, 'enabled skill must reach the prompt as a system message')
  assert.ok(skillIndex < assessorIndex, 'assessor instructions must follow the skill')
  assert.ok(systemContents[0].includes('Assess task compliance'), 'rigor rule stays first')
  assert.ok(withSkill.messages.some(message => JSON.stringify(message.content).includes('Quote the submission for every mark above zero.')))

  // 7. No skills means no skill message (no phantom rules).
  const withoutSkill = await buildImproveFeedbackWithRagPromptPreview({ assessment, categoryName: 'Evidence', shortFeedback: 'x' })
  assert.ok(!withoutSkill.messages.some(message => JSON.stringify(message.content).includes('Marking skill:')), 'prompt must not claim a skill was used when none was selected')

  // 8. Every paragraph-generation path must carry the skills, not just the RAG one.
  const englishPreview = buildImproveEnglishPromptPreview('The report is weak.', 'Keep it short.', [parsed])
  const englishText = englishPreview.map(message => String(message.content)).join('\n')
  assert.ok(englishText.includes('Marking skill: senaka-marking-evidence'), 'paragraph polish must carry the skill')
  assert.ok(englishText.includes('Quote the submission for every mark above zero.'), 'paragraph polish keeps the skill text')
  assert.ok(englishText.includes('Keep it short.'), 'assessor instructions still reach paragraph polish')

  const noSkillsEnglish = buildImproveEnglishPromptPreview('The report is weak.', 'Keep it short.')
  assert.ok(!noSkillsEnglish.map(message => String(message.content)).join('\n').includes('Marking skill:'), 'paragraph polish must not claim a skill when none is enabled')

  // 9. Every marking and paragraph entry point in App.svelte must forward the active skills.
  const appSource = await readFile(new URL('../src/App.svelte', import.meta.url), 'utf8')
  const forwardedMarking = appSource.match(/markingSkills:\s*activeMarkingSkills/g) || []
  assert.equal(forwardedMarking.length, 5, `expected 5 marking call sites to forward skills, found ${forwardedMarking.length}`)

  const forwardedPreview = appSource.match(/buildImproveEnglishPromptPreview\([^)]*activeMarkingSkills/g) || []
  assert.equal(forwardedPreview.length, 2, `expected both paragraph previews to forward skills, found ${forwardedPreview.length}`)

  const forwardedPolish = appSource.match(/improveEnglish\([^\n]*activeMarkingSkills/g) || []
  assert.equal(forwardedPolish.length, 1, `expected paragraph polish to forward skills, found ${forwardedPolish.length}`)

  console.log('marking skills checks passed')
} finally {
  await server.close()
}
