import assert from 'node:assert/strict'
import test from 'node:test'
import { validateMarkingCriteria, validateMarkingDraft } from '../src/services/markingDraftValidation.js'

const criteria = [
  { criterion_name: 'Critical Thinking', max_mark: 4.5, description: '', knowledge_area: '' },
  { criterion_name: 'Presentation', max_mark: 0, description: '', knowledge_area: '' }
]
const entry = (criterion_name, awarded_mark, evidence = []) => ({
  criterion_name, awarded_mark, evidence, judgement: 'Judgement',
  improvement_advice: 'Advice', suggested_feedback: 'Feedback'
})
const draft = () => ({
  criteria: [entry('Critical Thinking', 2.75, ['A concrete example']), entry('Presentation', 0)],
  overall_feedback: 'Overall feedback'
})

test('preserves decimals, canonical names and zero maxima while removing extra properties', () => {
  const input = draft()
  input.criteria[0].criterion_name = '  CRITICAL   thinking  '
  input.criteria[0].untrusted = true
  input.untrusted = true
  const result = validateMarkingDraft(input, criteria)
  assert.deepEqual(result, draft())
  assert.notEqual(result, input)
  assert.notEqual(result.criteria[0].evidence, input.criteria[0].evidence)
  assert.equal(input.criteria[0].criterion_name, '  CRITICAL   thinking  ')
})

test('validates assessment criteria before a provider request', () => {
  assert.doesNotThrow(() => validateMarkingCriteria(criteria))
  for (const max_mark of [null, undefined, '', '4', true, NaN, Infinity, -1]) {
    assert.throws(() => validateMarkingCriteria([{ ...criteria[0], max_mark }]), /maximum.*finite.*non-negative/i)
  }
  for (const invalid of [null, {}, [], [null], [{ max_mark: 1 }]]) {
    assert.throws(() => validateMarkingCriteria(invalid), /criteri/i)
  }
  assert.throws(() => validateMarkingCriteria([criteria[0], { ...criteria[0], criterion_name: ' critical  THINKING ' }]), /duplicate.*Critical Thinking/i)
})

test('rejects malformed envelopes and missing overall feedback', () => {
  for (const invalid of [null, [], 'text', {}, { criteria: {} }, { ...draft(), overall_feedback: null }]) {
    assert.throws(() => validateMarkingDraft(invalid, criteria), /draft|criteria|overall_feedback/i)
  }
})

test('requires exactly one response per known criterion', () => {
  const missing = draft()
  missing.criteria.pop()
  assert.throws(() => validateMarkingDraft(missing, criteria), /missing.*Presentation/i)
  const unknown = draft()
  unknown.criteria.push(entry('Invented', 0))
  assert.throws(() => validateMarkingDraft(unknown, criteria), /unknown.*Invented/i)
  const duplicate = draft()
  duplicate.criteria.push(entry(' critical  THINKING ', 0))
  assert.throws(() => validateMarkingDraft(duplicate, criteria), /duplicate.*Critical Thinking/i)
  for (const invalid of [null, [], {}, { ...entry('', 0) }]) {
    const input = draft()
    input.criteria[0] = invalid
    assert.throws(() => validateMarkingDraft(input, criteria), /criteri/i)
  }
})

test('rejects coercible, non-finite and out-of-range marks', () => {
  for (const awarded_mark of [null, undefined, '', '2', true, NaN, Infinity, -Infinity, -0.1, 4.51]) {
    const input = draft()
    input.criteria[0].awarded_mark = awarded_mark
    assert.throws(() => validateMarkingDraft(input, criteria), /Critical Thinking.*mark/i)
  }
  const input = draft()
  input.criteria[1].awarded_mark = 0.01
  assert.throws(() => validateMarkingDraft(input, criteria), /Presentation.*mark/i)
})

test('requires textual feedback fields without coercion', () => {
  for (const field of ['judgement', 'improvement_advice', 'suggested_feedback']) {
    for (const invalid of [undefined, null, false, 42, {}, []]) {
      const input = draft()
      input.criteria[0][field] = invalid
      assert.throws(() => validateMarkingDraft(input, criteria), new RegExp(field))
    }
  }
})

test('requires nonempty evidence strings and evidence for positive marks only', () => {
  for (const evidence of [undefined, null, '', {}, [''], ['  '], [null], [12], []]) {
    const input = draft()
    input.criteria[0].evidence = evidence
    assert.throws(() => validateMarkingDraft(input, criteria), /Critical Thinking.*evidence/i)
  }
  const input = draft()
  input.criteria[0].awarded_mark = 0
  input.criteria[0].evidence = []
  assert.doesNotThrow(() => validateMarkingDraft(input, criteria))
})
