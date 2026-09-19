import assert from 'node:assert/strict'
import test from 'node:test'
import { getRubricCategoryMarks, isRubricSummaryRow, parseRubricMaximum } from '../src/utils/rubricMarks.js'

function rubric(tables) {
  const nodes = tables.map(rows => ({
    rows: rows.map(({ cells, header = false, footer = false }, rowIndex) => ({
      rowIndex,
      closest: selector => (selector === 'thead' && header) || (selector === 'tfoot' && footer) ? {} : null,
      cells: cells.map(value => ({
        tagName: header ? 'TH' : 'TD', rowSpan: 1, colSpan: 1,
        ...(typeof value === 'object' ? value : { textContent: value })
      }))
    }))
  }))
  return { querySelectorAll: selector => selector === 'table' ? nodes : [], matches: () => false }
}

const categories = [{ name: 'Analysis (LO1)' }, { name: 'Design (LO3)' }]
const header = { header: true, cells: ['Criterion', 'Excellent', 'Fail', 'Marks'] }

test('parses positive rubric maxima and explicit out-of scores', () => {
  const cases = [
    [20, 20], [' 20 ', 20], ['2.5 marks', 2.5], ['.5 points', 0.5], ['10 pts', 10],
    ['/20', 20], ['out of20', 20], ['out of 25 marks', 25], ['8 / 20', 20],
    ['0/20 points', 20], ['20 / 20', 20], ['2.5 out of 4.5 marks', 4.5]
  ]
  for (const [input, expected] of cases) assert.equal(parseRubricMaximum(input), expected, String(input))
})

test('rejects percentages, ranges, non-finite values, malformed or impossible scores', () => {
  for (const value of [null, undefined, true, {}, '', ' ', 0, -1, NaN, Infinity, '0', '-20',
    '20%', '20 percent', '10–20', '10-20', 'NaN', 'Infinity', '1e3', '0x20', 'twenty',
    '20 marks available', 'up to 20', '20/0', '-1/20', '21/20', '10 / 20 / 30', '20.5.1']) {
    assert.equal(parseRubricMaximum(value), null, String(value))
  }
})

test('uses the last marks column and respects numbered category and learning-outcome matching', () => {
  const root = rubric([[header,
    { cells: ['1.1 Analysis (LO1)', 'Clear evidence', 'No evidence', '20'] },
    { cells: ['2.1 Design (LO3)', 'Strong design', 'Missing design', '12.5 marks'] },
    { cells: ['Analysis (LO2)', 'Different outcome', 'Missing', '100'] }
  ]])
  assert.deepEqual([...getRubricCategoryMarks(root, categories)], [['Analysis (LO1)', 20], ['Design (LO3)', 12.5]])
})

test('accepts common marks and maximum-score headings but never a final grade-band column', () => {
  for (const title of ['MARKS', 'Points', 'Maximum marks', 'Max. Score', 'Marks allocated', 'Total Marks']) {
    const root = rubric([[{ header: true, cells: ['Criterion', 'Excellent', title] },
      { cells: ['Analysis (LO1)', 'Strong', '20'] }]])
    assert.equal(getRubricCategoryMarks(root, categories).get('Analysis (LO1)'), 20, title)
  }
  for (const title of ['Fail', '0–49 marks', 'Poor (0–25%)', 'Weight (%)', 'Marks (%)', 'Marks percentage', 'Weighting marks', 'Score']) {
    const root = rubric([[{ header: true, cells: ['Criterion', 'Excellent', title] },
      { cells: ['Analysis (LO1)', 'Strong', '20'] }]])
    assert.equal(getRubricCategoryMarks(root, categories).size, 0, title)
  }
})

test('recognizes text-only header rows and reads headerless numeric last cells', () => {
  const headed = rubric([[{ cells: ['Criterion', 'Excellent', 'Marks'] },
    { cells: ['Analysis (LO1)', 'Strong', '/20'] }]])
  const headerless = rubric([[{ cells: ['Analysis (LO1)', 'Strong', '8/20'] },
    { cells: ['Design (LO3)', 'Good', '10'] }]])
  assert.equal(getRubricCategoryMarks(headed, categories).get('Analysis (LO1)'), 20)
  assert.deepEqual([...getRubricCategoryMarks(headerless, categories)], [['Analysis (LO1)', 20], ['Design (LO3)', 10]])
})

test('manual mapping overrides names without mutating categories or saved mappings', () => {
  const root = rubric([[header, { cells: ['External wording', 'Strong', 'Weak', '20'] }]])
  const mapping = { 'external wording': 'Design (LO3)' }
  const before = structuredClone({ categories, mapping })
  assert.deepEqual([...getRubricCategoryMarks(root, categories, mapping)], [['Design (LO3)', 20]])
  assert.deepEqual({ categories, mapping }, before)
  assert.equal(getRubricCategoryMarks(root, categories, { 'external wording': 'Deleted' }).size, 0)
})

test('does not infer a category maximum when multiple rows map to that category', () => {
  const root = rubric([[header,
    { cells: ['Analysis (LO1)', 'Strong', 'Weak', '10'] },
    { cells: ['Other part', 'Strong', 'Weak', '10'] },
    { cells: ['Design (LO3)', 'Strong', 'Weak', '5'] }
  ]])
  const map = { 'other part': 'Analysis (LO1)' }
  assert.deepEqual([...getRubricCategoryMarks(root, categories, map)], [['Design (LO3)', 5]])
})

test('a second matching row with invalid marks still makes the category ambiguous', () => {
  const root = rubric([[header,
    { cells: ['Analysis (LO1)', 'Strong', 'Weak', '10'] },
    { cells: ['Analysis (LO1)', 'Strong', 'Weak', ''] }
  ]])
  assert.equal(getRubricCategoryMarks(root, categories).size, 0)
})

test('skips total rows and table footers even when manually mapped to a category', () => {
  const root = rubric([[header,
    { cells: ['Analysis (LO1)', 'Strong', 'Weak', '10'] },
    { cells: ['Total marks', '', '', '100'] },
    { footer: true, cells: ['Design (LO3)', '', '', '20'] }
  ]])
  assert.deepEqual([...getRubricCategoryMarks(root, categories, { 'total marks': 'Analysis (LO1)' })], [['Analysis (LO1)', 10]])
})

test('rejects merged marks that span criteria instead of repeating the shared maximum', () => {
  const root = rubric([[header,
    { cells: ['Analysis (LO1)', 'Strong', 'Weak', { textContent: '20', rowSpan: 2 }] },
    { cells: ['Design (LO3)', 'Strong', 'Weak'] }
  ]])
  assert.equal(getRubricCategoryMarks(root, categories).size, 0)
})

test('rejects rows with a merged descriptor in place of marks or an extra trailing cell', () => {
  const root = rubric([[header,
    { cells: ['Analysis (LO1)', 'Strong', { textContent: '20', colSpan: 2 }] },
    { cells: ['Design (LO3)', 'Strong', 'Weak', '10', '100'] }
  ]])
  assert.equal(getRubricCategoryMarks(root, categories).size, 0)
})

test('reads marks through a multi-row header without treating a group header as the final label', () => {
  const root = rubric([[
    { header: true, cells: [{ textContent: 'Criterion', rowSpan: 2 }, { textContent: 'Performance', colSpan: 2 }, { textContent: 'Marks', rowSpan: 2 }] },
    { header: true, cells: ['Excellent', 'Fail'] },
    { cells: ['Analysis (LO1)', 'Strong', 'Weak', '20'] }
  ]])
  assert.equal(getRubricCategoryMarks(root, categories).get('Analysis (LO1)'), 20)
})

test('requires unique category evidence across multiple tables', () => {
  const root = rubric([
    [header, { cells: ['Analysis (LO1)', 'Strong', 'Weak', '10'] }],
    [header, { cells: ['Analysis (LO1)', 'Strong', 'Weak', '20'] }, { cells: ['Design (LO3)', 'Strong', 'Weak', '15'] }]
  ])
  assert.deepEqual([...getRubricCategoryMarks(root, categories)], [['Design (LO3)', 15]])
})

test('rejects percentage or weighting group headings above a marks subheading', () => {
  const root = rubric([[
    { header: true, cells: [{ textContent: 'Criterion', rowSpan: 2 }, { textContent: 'Performance', colSpan: 2 }, 'Weight (%)'] },
    { header: true, cells: ['Excellent', 'Fail', 'Marks'] },
    { cells: ['Analysis (LO1)', 'Strong', 'Weak', '20'] }
  ]])
  assert.equal(getRubricCategoryMarks(root, categories).size, 0)
})

test('summary detection recognizes totals and footers without discarding ordinary criteria', () => {
  const root = rubric([[
    { cells: ['Total', '100'] }, { cells: ['Subtotal marks', '40'] }, { cells: ['Grand total (100 marks)', '100'] },
    { cells: ['Total system design', '20'] }, { footer: true, cells: ['Final result', '100'] }
  ]])
  const rows = root.querySelectorAll('table')[0].rows
  assert.deepEqual(rows.map(isRubricSummaryRow), [true, true, true, false, true])
})
