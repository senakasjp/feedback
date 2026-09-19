import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCategoryMarkingRequest } from '../src/services/categoryMarkingService.js'
import { DEFAULT_GRADE_RANGES } from '../src/utils/markingRules.js'

const makeInput = () => ({
  assessment: {
    name: 'Synthetic assessment',
    categories: [
      { name: 'Analysis', allocatedMarks: '25', description: 'Explain the analysis.' },
      { name: 'Design', allocatedMarks: 75 }
    ],
    rubricHtml: '<p>Full rubric content</p>',
    aiReferenceDocuments: [{ name: 'Rubric', documentType: 'rubric', extractedText: 'Assessment criteria' }],
    percentageRanges: [{ color: 'red', lowerPercentage: 0, upperPercentage: 60 }, { color: 'green', lowerPercentage: 60, upperPercentage: 100 }]
  },
  categoryName: 'Analysis',
  studentSubmission: 'Full synthetic student submission.',
  priorEvaluations: [{ categoryMarks: { Analysis: 24 } }],
  vectorIndex: { chunks: [{ type: 'prior-feedback', text: 'Prior mark: 24' }] }
})

test('scopes marking to one criterion while retaining full submission and rubric', () => {
  const input = makeInput()
  input.studentSubmission = 'Start\n' + 'Detailed submission evidence.\n'.repeat(12000) + 'References at end'
  const original = structuredClone(input)
  const request = buildCategoryMarkingRequest(input)
  assert.deepEqual(input, original)
  assert.deepEqual(request.assessment.categories, [{ ...input.assessment.categories[0], allocatedMarks: 25, markingMode: 'none', colorMarks: {} }])
  assert.equal(request.studentSubmission, input.studentSubmission)
  assert.equal(request.assessment.rubricHtml, input.assessment.rubricHtml)
  assert.deepEqual(request.assessment.aiReferenceDocuments, input.assessment.aiReferenceDocuments)
  assert.deepEqual(request.assessment.percentageRanges, input.assessment.percentageRanges)
  assert.deepEqual(request.priorEvaluations, [])
  assert.equal(request.vectorIndex, null)
})

test('uses default percentage bands when assessment has none', () => {
  const input = makeInput()
  input.assessment.percentageRanges = []
  const request = buildCategoryMarkingRequest(input)
  assert.deepEqual(request.assessment.percentageRanges, DEFAULT_GRADE_RANGES)
  assert.notEqual(request.assessment.percentageRanges, DEFAULT_GRADE_RANGES)
})

test('accepts submission images when extracted text is absent', () => {
  const input = makeInput()
  input.studentSubmission = ''
  input.studentSubmissionDocuments = [{ name: 'diagram.png', images: [{ dataUrl: 'data:image/png;base64,c3ludGhldGlj' }] }]
  const request = buildCategoryMarkingRequest(input)
  assert.deepEqual(request.studentSubmissionDocuments, input.studentSubmissionDocuments)
})

test('rejects absent submission evidence even when assessor notes exist', () => {
  const input = makeInput()
  input.studentSubmission = '  '
  input.evidenceNotes = 'Existing feedback is not the student submission.'
  assert.throws(() => buildCategoryMarkingRequest(input), /student submission/)
})

test('rejects missing and ambiguous category names', () => {
  const input = makeInput()
  input.categoryName = 'Missing'
  assert.throws(() => buildCategoryMarkingRequest(input), /uniquely named/)
  input.categoryName = 'Analysis'
  input.assessment.categories.push({ name: ' analysis ', allocatedMarks: 25 })
  assert.throws(() => buildCategoryMarkingRequest(input), /uniquely named/)
})

test('rejects invalid and nonpositive category maxima', () => {
  for (const allocatedMarks of [null, '', 0, -1, Infinity, NaN, true, 'invalid']) {
    const input = makeInput()
    input.assessment.categories[0].allocatedMarks = allocatedMarks
    assert.throws(() => buildCategoryMarkingRequest(input), /maximum greater than zero/)
  }
})

test('rejects overlapping configured bands', () => {
  const input = makeInput()
  input.assessment.percentageRanges[0].upperPercentage = 70
  assert.throws(() => buildCategoryMarkingRequest(input), /percentage bands/)
})

test('normalizes fixed colour marks using the category mode override', () => {
  const input = makeInput()
  input.assessment.markingMode = 'percentage'
  input.assessment.categories[0].markingMode = 'fixed'
  input.assessment.categories[0].colorMarks = { green: '25', yellow: '12.5', red: 0, orange: '', lightgreen: 30 }
  const request = buildCategoryMarkingRequest(input)
  assert.equal(request.assessment.categories[0].markingMode, 'fixed')
  assert.deepEqual(request.assessment.categories[0].colorMarks, { green: 25, yellow: 12.5, red: 0 })
})

test('inherits fixed assessment mode when category has no override', () => {
  const input = makeInput()
  input.assessment.markingMode = 'fixed'
  input.assessment.categories[0].colorMarks = { green: 25 }
  const request = buildCategoryMarkingRequest(input)
  assert.equal(request.assessment.categories[0].markingMode, 'fixed')
  assert.deepEqual(request.assessment.categories[0].colorMarks, { green: 25 })
})

test('rejects fixed mode when no usable colour mark is configured', () => {
  for (const colorMarks of [{}, { green: 26, red: -1, yellow: 'invalid', orange: null }, { unknown: 10 }]) {
    const input = makeInput()
    input.assessment.markingMode = 'fixed'
    input.assessment.categories[0].colorMarks = colorMarks
    assert.throws(() => buildCategoryMarkingRequest(input), /valid fixed colour mark/)
  }
})
