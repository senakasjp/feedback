// Checks the "Print to Download" report guardrail: wording that tells the assessor what to
// check, a note about missing assessor input, an unfilled placeholder, AI chat text, a
// spelling mistake or a grammar mistake must block the download and name the paragraph,
// while ordinary feedback to the student must pass.
// Run with: node tests/reportGuardrail.check.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import nspell from 'nspell'
import {
  findReportGuardrailIssues,
  describeGuardrailBlock,
  stripHtmlForReport
} from '../src/utils/reportGuardrail.js'

// The same British English dictionary the app serves from public/dictionary-en-gb.
const spell = nspell(
  fs.readFileSync(new URL('../public/dictionary-en-gb/index.aff', import.meta.url)),
  fs.readFileSync(new URL('../public/dictionary-en-gb/index.dic', import.meta.url))
)

const scan = (paragraphs, options = {}) =>
  findReportGuardrailIssues(paragraphs.map(text => ({ text })), { spell, ...options })

// 1. Instructions to the assessor are blocked.
for (const text of [
  'Assessor should check this before finalising the mark.',
  'Instructor should check other before deciding.',
  'The assessor may wish to verify the evidence in section two.',
  'Assessor: check the second paragraph again.',
  'Note to the assessor: the mark is provisional.'
]) {
  const result = await scan([text])
  assert.equal(result.blocked, true, `must block: ${text}`)
  assert.equal(result.findings[0].paragraphNumber, 1)
}

// 2. Unfilled placeholders, AI self-reference and chat wording are blocked.
for (const text of [
  'TODO: add the measured cost for this criterion.',
  'The analysis is [insert evidence here].',
  'I cannot access the student submission, so the mark is provisional.',
  'Here is the feedback for this criterion.',
  'Let me know if you need further changes to this report.'
]) {
  assert.equal((await scan([text])).blocked, true, `must block: ${text}`)
}

// 3. Notes about missing assessor input or the grading process are blocked. The model
// wrote these when it had no assessor comments, mark or rationale to work from.
for (const text of [
  'No authoritative assessor comments, allocated mark, or saved rationale were provided, so the grading decision cannot be explained or preserved.',
  'Since no assessor feedback was supplied, the mark could not be confirmed.',
  'No rubric was provided, so the criterion weight is unknown.',
  'This submission cannot be graded without the marking scheme.'
]) {
  const result = await scan([text])
  assert.equal(result.blocked, true, `must block: ${text}`)
}

// 4. Spelling mistakes are blocked, with a suggestion, wherever they sit in the paragraph.
for (const [text, word] of [
  ['You recieve a clear benefit from the automation.', 'recieve'],
  ['The report is definately stronger than the first draft.', 'definately'],
  ['Seperate each section with a heading.', 'Seperate'],
  ['The team needs to prioritise the work.', null]
]) {
  const result = await scan([text])
  if (word === null) {
    assert.equal(result.blocked, false, `must not block: ${text} -> ${JSON.stringify(result.findings)}`)
    continue
  }
  assert.equal(result.blocked, true, `must block: ${text}`)
  const finding = result.findings[0]
  assert.equal(finding.label, 'Spelling')
  assert.match(finding.match, new RegExp(word, 'i'))
  assert.match(finding.match, /→/)
}

// 5. Grammar mistakes are blocked.
for (const text of [
  'You should of measured the cost before the rollout.',
  'There is alot of detail in the second paragraph.',
  'i think the report needs a clearer conclusion.',
  'This is a improvement on the first draft.',
  'the report explains the migration clearly.',
  'The second option is more then twice the price.',
  'They was unsure how the data was stored.',
  'The team cannot dont measure the load.',
  'You need to check your references dont worry about the length.'
]) {
  assert.equal((await scan([text])).blocked, true, `must block: ${text}`)
}

// 6. Written feedback to the student passes, including advice that starts with "check".
for (const text of [
  'You compared two cloud platforms and measured their cost per month.',
  'Double-check your calculations before you submit the report.',
  'Your marker will review the evidence you supplied.',
  'Check your references against the APA 7 guide.',
  'Review the feedback before deciding on your next steps.',
  'No evidence of testing was provided in the report.',
  'The report does not follow the rubric provided in class.',
  'The analysis is good, and the recommendation is practical.',
  'You organise the sections well and summarise each finding.',
  'The team used an hour of downtime to test the rollback.',
  'Zig-zag: Recognizable zig-zag with generally consistent angles and clear back-and-forth motion.',
  'The robot completed the square zig-zag and the tick-tock movement.'
]) {
  const result = await scan([text])
  assert.equal(result.blocked, false, `must not block: ${text} -> ${JSON.stringify(result.findings)}`)
}

// 7. Accepted spelling variants, names and allowed words are left alone.
for (const text of [
  'You organize the evidence well and analyse the result.',
  'The center of the diagram is labelled correctly.',
  'You used Zylofon for the rollout plan.',
  'Twinpane is the tool you chose for the comparison.'
]) {
  const result = await scan([text], { allowedWords: ['Twinpane'] })
  assert.equal(result.blocked, false, `must not block: ${text} -> ${JSON.stringify(result.findings)}`)
}

// 8. The finding names the paragraph and its category, in report order.
const mixed = await findReportGuardrailIssues([
  { id: 'p1', category: 'Analysis', text: 'You compared two cloud platforms.' },
  { id: 'p2', category: 'Evaluation', text: '<p>Assessor should check this before deciding.</p>' },
  { id: 'p3', category: 'Evidence', text: 'Your evidence is limited to one source.' }
], { spell })
assert.equal(mixed.blocked, true)
assert.equal(mixed.findings.length, 1)
assert.equal(mixed.findings[0].paragraphNumber, 2)
assert.equal(mixed.findings[0].paragraphId, 'p2')
assert.equal(mixed.findings[0].category, 'Evaluation')
assert.equal(mixed.findings[0].ruleId, 'reviewer-instruction')
assert.match(mixed.findings[0].excerpt, /Assessor should check this/)
assert.match(describeGuardrailBlock(mixed.findings), /paragraph 2/)

// 9. HTML is reduced to readable text before scanning, so a phrase split by markup is found.
assert.equal(stripHtmlForReport('<p>Alpha</p><p>Beta</p>'), 'Alpha Beta')
assert.equal((await scan(['<div>Instructor <strong>should check</strong> this.</div>'])).blocked, true)
assert.equal((await scan(['Assessor should check<br>this before deciding.'])).blocked, true)

// 10. Spelling can be switched off for other checks, and a missing dictionary does not
// stop the wording checks.
assert.equal((await findReportGuardrailIssues([{ text: 'You recieve the result.' }], { spell: null })).blocked, false)
assert.equal((await findReportGuardrailIssues([{ text: 'Assessor should check this.' }], { spell: null })).blocked, true)

// 11. Skip ignores one finding at a time. The key is tied to the paragraph text and the
// student, so an edit or another student checks again.
const skipTarget = [
  { id: 'p1', category: 'Analysis', text: 'You recieve a clear benefit.' },
  { id: 'p2', category: 'Evidence', text: 'The second option is more then twice the price.' }
]
const skipScope = 'student|assessment'
const beforeSkip = await findReportGuardrailIssues(skipTarget, { spell, scope: skipScope })
assert.equal(beforeSkip.findings.length, 2)

const afterOneSkip = await findReportGuardrailIssues(skipTarget, {
  spell, scope: skipScope, skipKeys: [beforeSkip.findings[0].key]
})
assert.equal(afterOneSkip.blocked, true)
assert.equal(afterOneSkip.findings.length, 1)
assert.equal(afterOneSkip.findings[0].paragraphId, 'p2')
assert.equal(afterOneSkip.skippedFindings.length, 1)

const afterBothSkips = await findReportGuardrailIssues(skipTarget, {
  spell, scope: skipScope, skipKeys: beforeSkip.findings.map(finding => finding.key)
})
assert.equal(afterBothSkips.blocked, false)
assert.equal(afterBothSkips.skippedFindings.length, 2)

const editedParagraphs = skipTarget.map(item =>
  item.id === 'p1' ? { ...item, text: 'You receive a clear benefit.' } : item
)
const afterEdit = await findReportGuardrailIssues(editedParagraphs, {
  spell, scope: skipScope, skipKeys: [beforeSkip.findings[0].key]
})
assert.equal(afterEdit.findings.length, 1)
assert.equal(afterEdit.findings[0].paragraphId, 'p2')

const anotherStudent = await findReportGuardrailIssues(skipTarget, {
  spell, scope: 'other-student|assessment', skipKeys: [beforeSkip.findings[0].key]
})
assert.equal(anotherStudent.findings.length, 2)
assert.equal(anotherStudent.skippedFindings.length, 0)

console.log('Report guardrail checks passed')
