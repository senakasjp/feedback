// Checks that the feedback paths write point form: one point per line in the comment box, with the
// model's own list marker removed because the app and the PDF draw their own bullet.
// Run with: node tests/pointFormFeedback.check.mjs
//
// Uses Vite's ssrLoadModule because the services reference import.meta.env.
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const POINT_FORM_REPLY = [
  'You compared cloud AI, a self-built analyser and Batfish with a local LLM.',
  '',
  '- You linked each strength and weakness to accuracy, privacy and feasibility.',
  '• Your research into JSX and Llama 3.1 is clear.',
  '2) Show the measured memory and processor use behind each score.'
].join('\n')

const requestedBodies = []

globalThis.fetch = async (url, options = {}) => {
  if (String(url).includes('/embeddings')) {
    return { ok: true, json: async () => ({ data: [{ index: 0, embedding: [1, 0, 0] }] }) }
  }

  requestedBodies.push(JSON.parse(options.body || '{}'))
  return {
    ok: true,
    json: async () => ({
      choices: [{ finish_reason: 'stop', message: { content: POINT_FORM_REPLY } }]
    })
  }
}

const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true } })

try {
  const { buildImproveFeedbackWithRagPromptPreview, improveFeedbackWithRag, normaliseFeedbackPointText } =
    await server.ssrLoadModule('/src/services/aiMarkingService.js')
  const { improveEnglish } = await server.ssrLoadModule('/src/services/openaiService.js')

  // 1. The normaliser keeps one point per line and strips the model's own marker.
  assert.equal(
    normaliseFeedbackPointText(POINT_FORM_REPLY),
    [
      'You compared cloud AI, a self-built analyser and Batfish with a local LLM.',
      'You linked each strength and weakness to accuracy, privacy and feasibility.',
      'Your research into JSX and Llama 3.1 is clear.',
      'Show the measured memory and processor use behind each score.'
    ].join('\n'),
    'points must stay on separate lines with no duplicate bullet'
  )

  // 2. Blank lines are dropped and stray spacing is trimmed, so a short reply does not leave gaps.
  assert.equal(normaliseFeedbackPointText('  First point.  \n\n\n   Second point. '), 'First point.\nSecond point.')

  const assessment = {
    name: 'Point form check',
    categories: [{ name: 'Hardware limitations', allocatedMarks: 10, description: 'Compare approaches' }],
    rubricHtml: '<table><tr><td>Hardware limitations: justify the choice</td></tr></table>'
  }

  const baseArgs = {
    assessment,
    categoryName: 'Hardware limitations',
    shortFeedback: 'Compared cloud AI with a local LLM and explained the hardware limits.',
    allocatedMark: 6,
    markMaximum: 10,
    markRationale: 'Clear comparison, weak measurements.',
    studentSubmission: 'Local Llama 3.1 used 5 GB of memory.',
    modelPreference: { selectedModel: 'gpt-5.4-mini', reasoningEffort: 'low', provider: 'openai' }
  }

  // 3. The RAG prompt asks for point form and forbids its own list markers.
  const preview = await buildImproveFeedbackWithRagPromptPreview(baseArgs)
  const promptText = preview.messages.map(message => message.content).join('\n')
  assert.match(promptText, /Write the feedback in point form/, 'RAG prompt must ask for point form')
  assert.match(promptText, /Do not add a bullet character, dash, number, heading/, 'RAG prompt must forbid duplicate markers')
  assert.match(promptText, /continuous prose/, 'an assessor prose instruction must still win')

  // 4. The RAG reply reaches the text box as separate points.
  const ragResult = await improveFeedbackWithRag(baseArgs)
  assert.equal(
    ragResult.improvedText,
    [
      'You compared cloud AI, a self-built analyser and Batfish with a local LLM.',
      'You linked each strength and weakness to accuracy, privacy and feasibility.',
      'Your research into JSX and Llama 3.1 is clear.',
      'Show the measured memory and processor use behind each score.'
    ].join('\n'),
    'Improve with RAG must return one point per line'
  )

  // 5. Improve with AI does the same from its own prompt.
  const englishResult = await improveEnglish(
    'Compared approaches. Hardware limits affected the choice.',
    '',
    { selectedModel: 'gpt-5.4-mini', reasoningEffort: 'low', provider: 'openai' }
  )
  assert.match(englishResult.improvedText, /\nYou linked each strength/, 'Improve with AI must keep points on separate lines')
  assert.doesNotMatch(englishResult.improvedText, /^\s*[-•]/m, 'Improve with AI must remove duplicate markers')
  const englishPrompt = JSON.stringify(requestedBodies[requestedBodies.length - 1])
  assert.match(englishPrompt, /point form/, 'Improve with AI prompt must ask for point form')

  // 6. The app puts one literal bullet on each point, so the box can be pasted into Moodle as a list.
  const { bulletiseFeedbackPoints } = await server.ssrLoadModule('/src/utils/helpers.js')
  assert.equal(
    bulletiseFeedbackPoints('A measured point.\n- A dashed point.\n• An already marked point.\n3) A numbered point.'),
    '• A measured point.\n• A dashed point.\n• An already marked point.\n• A numbered point.',
    'every point must carry exactly one bullet'
  )
  assert.equal(
    bulletiseFeedbackPoints(ragResult.improvedText),
    [
      '• You compared cloud AI, a self-built analyser and Batfish with a local LLM.',
      '• You linked each strength and weakness to accuracy, privacy and feasibility.',
      '• Your research into JSX and Llama 3.1 is clear.',
      '• Show the measured memory and processor use behind each score.'
    ].join('\n'),
    'the RAG reply must reach the box as a bullet list'
  )

  console.log('pointFormFeedback.check: all assertions passed')
} finally {
  await server.close()
}
