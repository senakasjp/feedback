import assert from 'node:assert/strict'
import test from 'node:test'
import { inferRubricBandColumns, resolveRubricBandColumns } from '../src/utils/rubricBandColumns.js'
import { getMarkBands } from '../src/utils/markingRules.js'

const headers = labels => labels.map((text, index) => ({ index, text }))
const ascending = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }

test('recognizes five grade headings and preserves their actual cell indexes', () => {
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', 'Excellent', 'Very Good', 'Good', 'Satisfactory', 'Needs Improvement'])), ascending)
  assert.deepEqual(inferRubricBandColumns(headers(['Criterion', 'Poor', 'Satisfactory', 'Good', 'Very good', 'Excellent'])), { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 })
  assert.deepEqual(inferRubricBandColumns([
    { index: 8, text: 'Excellent' }, { index: 7, text: 'Very Good' }, { index: 6, text: 'Good' },
    { index: 5, text: 'Satisfactory' }, { index: 4, text: 'Poor' }
  ]), { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4 })
})

test('recognizes complete alternative grade families', () => {
  for (const labels of [
    ['High Distinction', 'Distinction', 'Credit', 'Pass', 'Fail'],
    ['Exemplary', 'Accomplished', 'Proficient', 'Developing', 'Beginning'],
    ['Outstanding', 'Excellent', 'Good', 'Satisfactory', 'Poor']
  ]) assert.deepEqual(inferRubricBandColumns(headers(['Criterion', ...labels])), ascending)
})

test('recognizes color names without confusing light green and green', () => {
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', 'Red', 'Orange', 'Yellow', 'Light-green', 'Green'])), { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 })
  assert.deepEqual(inferRubricBandColumns(headers(['Criterion', ' light\u00a0green ', 'GREEN', 'RED'])), { 1: 2, 2: 1, 5: 3 })
})

test('excludes score, weight, marks and learning outcome metadata columns', () => {
  const labels = ['Criteria', 'Weight (80–100%)', 'Score (60–79%)', 'Max marks (40–59%)', 'LO1', 'Excellent', 'Very Good', 'Good', 'Satisfactory', 'Poor']
  assert.deepEqual(inferRubricBandColumns(headers(labels)), { 1: 5, 2: 6, 3: 7, 4: 8, 5: 9 })
})

test('orders nonoverlapping numeric and percentage ranges highest first', () => {
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', '0–19%', '20—39%', '40-59%', '60 to 79%', '80–100%'])), { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 })
  assert.deepEqual(inferRubricBandColumns(headers(['Criterion', '8–10', '6–7', '4–5', '2–3', '0–1'])), ascending)
  assert.deepEqual(inferRubricBandColumns(headers(['Criterion', '≥80%', '60–79%', '40–59%', '20–39%', '<20%'])), ascending)
  assert.deepEqual(inferRubricBandColumns(headers(['Criterion', '>80', '61–80', '41–60', '21–40', '≤20'])), ascending)
})

test('accepts recognized grade names annotated with numeric ranges', () => {
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', 'Excellent (80–100%)', 'Very Good (60–79%)', 'Good (40–59%)', 'Satisfactory (20–39%)', 'Needs Improvement (0–19%)'])), ascending)
})

test('recognizes Fail through Excellent headings used by imported rubric tables', () => {
  const expected = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 }
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', 'Fail (0–39%)', 'Weak (40–49%)', 'Adequate (50–64%)', 'Good (65–79%)', 'Excellent (80–100%)'])), expected)
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', 'Fail', 'Weak', 'Adequate', 'Good', 'Excellent'])), expected)
})

test('uses explicit percentage ranges with descriptive labels without inventing their named ranks', () => {
  const labels = ['Advanced mastery (80–100%)', 'Secure understanding (60–79%)', 'Basic understanding (40–59%)', 'Limited understanding (20–39%)', 'Insufficient evidence (0–19%)']
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', ...labels])), ascending)
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', ...labels.map(label => label.replace(/ \(.*\)/, ''))])), {})
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', ...labels.map(label => label.replace(/%/g, ''))])), {})
})

test('maps unique partial endpoint labels without inventing middle positions', () => {
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', 'Needs Improvement', 'Excellent'])), { 1: 2, 5: 1 })
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', 'Good', 'Very Good'])), {})
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', 'Outstanding', 'Excellent'])), {})
})

test('recognizes four clear grade columns without inventing a fifth descriptor', () => {
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', 'Excellent', 'Good', 'Satisfactory', 'Poor'])), { 1: 1, 2: 2, 3: 3, 5: 4 })
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', 'Poor', 'Satisfactory', 'Good', 'Excellent'])), { 1: 4, 2: 3, 3: 2, 5: 1 })
})

const fourBands = [
  { position: 5, lower: 0, upper: 25 }, { position: 4, lower: 25, upper: 50 },
  { position: 2, lower: 50, upper: 75 }, { position: 1, lower: 75, upper: 100 }
]

test('recognizes Fail as the lowest descriptor in a complete four-band grade family', () => {
  for (const labels of [
    ['Excellent', 'Good', 'Satisfactory', 'Fail'],
    ['Excellent (75–100%)', 'Good (50–74%)', 'Satisfactory (25–49%)', 'Fail (0–24%)']
  ]) {
    const rubric = headers(['Criteria', ...labels])
    assert.deepEqual(inferRubricBandColumns(rubric), { 1: 1, 2: 2, 3: 3, 5: 4 })
    assert.deepEqual(inferRubricBandColumns(rubric, fourBands), { 1: 1, 2: 2, 4: 3, 5: 4 })
  }
})

test('aligns four grade or numeric columns with the active four configured positions', () => {
  const expected = { 1: 1, 2: 2, 4: 3, 5: 4 }
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', 'Excellent', 'Good', 'Satisfactory', 'Poor']), fourBands), expected)
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', '≥75%', '50–74%', '25–49%', '<25%']), fourBands), expected)
  assert.deepEqual(resolveRubricBandColumns(headers(['Criteria', '≥75%', '50–74%', '25–49%', '<25%']), { 4: '' }, fourBands), { 1: 1, 2: 2, 5: 4 })
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', '75–100', '50–75', '25–50', '0–25']), fourBands), {})
})

test('maps four of five configured numeric bands only when their exact bounds match', () => {
  const fiveBands = [
    { position: 1, lower: 80, upper: 100 }, { position: 2, lower: 60, upper: 79 },
    { position: 3, lower: 40, upper: 59 }, { position: 4, lower: 20, upper: 39 }, { position: 5, lower: 0, upper: 19 }
  ]
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', '80–100', '40–59', '20–39', '0–19']), fiveBands), { 1: 1, 3: 2, 4: 3, 5: 4 })
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', '75–100', '50–74', '25–49', '0–24']), fiveBands), {})
})

test('matches inclusive whole-percentage ranges to actual normalized application band boundaries', () => {
  const positions = { green: 1, lightgreen: 2, yellow: 3, orange: 4, red: 5 }
  const bands = getMarkBands().map(band => ({ position: positions[band.color], lower: band.lower * 100, upper: band.upper * 100 }))
  const rubric = headers(['Criteria', '80–100%', '65–79%', '50–64%', '0–39%'])
  assert.deepEqual(inferRubricBandColumns(rubric, bands), { 1: 1, 2: 2, 3: 3, 5: 4 })
  assert.deepEqual(inferRubricBandColumns(rubric), {})
  for (const labels of [
    ['75–100%', '50–74%', '25–49%', '0–24%'],
    ['80–99%', '65–79%', '50–64%', '0–39%'],
    ['80–100%', '65–79.5%', '50–64%', '0–39%'],
    ['80–100%', '65–79%', '50–64%', '1–39%']
  ]) assert.deepEqual(inferRubricBandColumns(headers(['Criteria', ...labels]), bands), {})
})

test('explicit colors stay authoritative when numeric annotations or active positions disagree', () => {
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', 'Green (0–19)', 'Light Green (20–39)', 'Yellow (40–59)', 'Orange (60–79)', 'Red (80–100)'])), ascending)
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', 'Green', 'Yellow', 'Red']), fourBands), { 1: 1, 3: 2, 5: 3 })
  assert.deepEqual(inferRubricBandColumns(headers(['Criteria', 'Green', 'Excellent', 'Excellent', 'Red'])), { 1: 1, 5: 4 })
})

test('leaves unknown, duplicate, contradictory and incomplete numeric headings unresolved', () => {
  for (const labels of [
    ['Criteria', 'Band 1', 'Band 2', 'Band 3', 'Band 4', 'Band 5'],
    ['Criteria', 'One', 'Two', 'Three', 'Four', 'Five'],
    ['Criteria', 'Excellent', 'Excellent', 'Needs Improvement'],
    ['Criteria', 'Green', 'Green', 'Red'],
    ['Criteria', '80–100', '60–80', '40–60', '20–40', '0–20'],
    ['Criteria', '80–100', '60–79', '40–59', '20–39'],
    ['Criteria', 'Excellent (0–19)', 'Very Good (20–39)', 'Good (40–59)', 'Satisfactory (60–79)', 'Poor (80–100)'],
    ['Criteria', 'Red flags', 'Orange juice', 'Yellow notes', 'Light Green leaf', 'Green field']
  ]) assert.deepEqual(inferRubricBandColumns(headers(labels)), {}, labels.join(', '))
  assert.deepEqual(inferRubricBandColumns([]), {})
})

test('manual columns override inference and allow explicit unmapped choices', () => {
  const rubric = headers(['Criteria', 'Excellent', 'Very Good', 'Good', 'Satisfactory', 'Poor', 'Custom'])
  assert.deepEqual(resolveRubricBandColumns(rubric, { 1: '6', 2: '', 3: null, 4: undefined }), { 1: 6, 4: 4, 5: 5 })
  assert.deepEqual(resolveRubricBandColumns(rubric, { 1: 99, 2: -1, 3: 0, 4: 1.5, 5: 'bad' }), {})
  assert.deepEqual(resolveRubricBandColumns(rubric, Object.create({ 1: '' })), ascending)
})

test('does not mutate headers or saved mappings', () => {
  const rubric = headers(['Criteria', 'Excellent', 'Needs Improvement'])
  const manual = { 1: '2', 5: '' }
  const before = structuredClone({ rubric, manual })
  resolveRubricBandColumns(rubric, manual)
  assert.deepEqual({ rubric, manual }, before)
})
