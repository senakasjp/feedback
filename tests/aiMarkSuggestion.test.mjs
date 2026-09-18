import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractMarkSuggestion } from '../src/utils/aiMarkSuggestion.js'

test('extracts a valid score including zero and decimals', () => {
  for (const mark of [0, 7.5, 10]) assert.deepEqual(extractMarkSuggestion(`Evidence.\nMarks: ${mark}/10`, 10), { awarded: mark, strippedText: 'Evidence.' })
})
test('leaves text without a trailing score unchanged', () => {
  assert.equal(extractMarkSuggestion('Evidence only.', 10), null)
})
test('rejects a different or invalid denominator and out-of-range marks', () => {
  for (const line of ['7/20','11/10','-1/10','5/0','5/-10']) assert.throws(() => extractMarkSuggestion(`Evidence.\nMarks: ${line}`, 10))
})
test('does not invent a maximum for an unconfigured category', () => {
  for (const max of [null, undefined, 0]) assert.throws(() => extractMarkSuggestion('Evidence.\nMarks: 5/10', max))
})
