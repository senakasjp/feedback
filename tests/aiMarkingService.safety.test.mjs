import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

// No credentials, stored data, or real network requests are used by these checks.
const server = await createServer({ configFile: false, envFile: false,
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } })
const service = await server.ssrLoadModule('/src/services/aiMarkingService.js')
after(() => server.close())
const category = { name: 'Safety', allocatedMarks: 10, description: 'Evaluate sensor measurements.' }

test('category retrieval retains a relevant supporting document', async () => {
  const assessment = { name: 'Review', categories: [category], aiReferenceDocuments: [
    { id: 'guide', name: 'Guide', documentType: 'reference', extractedText: 'Sensor measurements require response times and error rates.' }
  ] }
  const result = await service.buildAssessmentRagContext({ assessment, categoryName: 'Safety', studentSubmission: 'Sensor measurements and response times' })
  assert.ok(result.retrievedContext.some(item => item.text.includes('error rates')))
})

test('retrieval keeps distinct relevant passages from the same document', async () => {
  const assessment = { categories: [], aiReferenceDocuments: [{ id: 'guide', name: 'Guide', documentType: 'reference',
    extractedText: Array.from({ length: 4 }, (_, index) => `Requirement ${index}: ${'measurement response safety '.repeat(22)}.`).join(' ') }] }
  const result = await service.buildAssessmentRagContext({ assessment, studentSubmission: 'measurement response safety' })
  assert.equal(result.retrievedContext.length, 4)
})

test('all rubric descriptors and brief remain available beyond retrieval quota', async () => {
  const categories = Array.from({ length: 12 }, (_, index) => ({ name: `Criterion ${index}`, allocatedMarks: 10, description: `Unique obligation ${index}` }))
  const assessment = { categories, questionText: 'Mandatory project deliverables.', rubricHtml: '<table><tr><td>Band boundary: 75 percent</td></tr></table>' }
  const result = await service.buildAssessmentRagContext({ assessment, categoryName: 'Criterion 0' })
  for (const item of categories) assert.ok(result.retrievedContext.some(chunk => chunk.text.includes(item.description)))
  assert.ok(result.retrievedContext.some(chunk => chunk.text.includes('75 percent')))
  assert.ok(result.retrievedContext.some(chunk => chunk.text.includes('Mandatory project deliverables')))
})

const validCriterion = { criterion_name: 'Safety', awarded_mark: 5, judgement: 'Partial coverage', evidence: ['Measured response time: 2 ms'], improvement_advice: 'Measure error rate', suggested_feedback: 'Add error measurements.' }
async function withResponse(parsed, action, finishReason = 'stop') {
  const previousFetch = globalThis.fetch
  const previousStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => 'synthetic-test-key' }
  globalThis.fetch = async (url) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions')
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(parsed) }, finish_reason: finishReason }] }), { status: 200 })
  }
  try { return await action() } finally { globalThis.fetch = previousFetch; globalThis.localStorage = previousStorage }
}
const draftArgs = { assessment: { name: 'Review', categories: [category] }, student: { id: 'synthetic' }, studentSubmission: 'Measured response time: 2 ms' }

test('valid provider response reaches assessor review without changing marks', async () => {
  const result = await withResponse({ criteria: [validCriterion], overall_feedback: 'Partial evidence.' }, () => service.generateStructuredMarkingDraft(draftArgs))
  assert.equal(result.criteria[0].awarded_mark, 5)
})
for (const [name, criteria] of [
  ['missing criterion', []],
  ['duplicate criterion', [validCriterion, validCriterion]],
  ['null mark', [{ ...validCriterion, awarded_mark: null }]],
  ['out of range mark', [{ ...validCriterion, awarded_mark: 11 }]]
]) test(`rejects ${name} from provider before review`, async () => {
  await assert.rejects(withResponse({ criteria, overall_feedback: 'Partial evidence.' }, () => service.generateStructuredMarkingDraft(draftArgs)))
})

test('rejects token-limited response even when its JSON is parseable', async () => {
  await assert.rejects(withResponse({ criteria: [validCriterion], overall_feedback: 'Partial evidence.' }, () => service.generateStructuredMarkingDraft(draftArgs), 'length'))
})

for (const embeddingFails of [false, true]) test(`preserves rubric and supporting sources with ${embeddingFails ? 'failed' : 'working'} query embeddings`, async () => {
  const previousFetch = globalThis.fetch
  const previousStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => 'synthetic-test-key' }
  let indexBuilt = false
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/embeddings')
    if (indexBuilt && embeddingFails) throw new Error('Synthetic embedding outage')
    return new Response(JSON.stringify({ data: JSON.parse(options.body).input.map(() => ({ embedding: [1, 0] })) }), { status: 200 })
  }
  try {
    const assessment = { categories: [category], aiReferenceDocuments: [{ name: 'Guide', documentType: 'reference', extractedText: 'Sensor measurements require error rates.' }] }
    const vectorIndex = await service.buildAssessmentVectorIndex({ assessment })
    indexBuilt = true
    const result = await service.buildAssessmentRagContext({ assessment, vectorIndex, categoryName: 'Safety', studentSubmission: 'Sensor measurements' })
    assert.equal(result.retrievalMode, embeddingFails ? 'lexical-fallback-category' : 'vector-category')
    assert.equal(result.retrievedContext.length, 2)
    assert.equal(new Set(result.retrievedContext.map(item => item.sourceId)).size, 2)
  } finally { globalThis.fetch = previousFetch; globalThis.localStorage = previousStorage }
})

test('rejects invalid assessment maxima before any provider call', async () => {
  let called = false
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => { called = true; throw new Error('Unexpected network call') }
  try {
    await assert.rejects(service.generateStructuredMarkingDraft({ ...draftArgs, assessment: { categories: [{ ...category, allocatedMarks: '' }] } }))
    assert.equal(called, false)
  } finally { globalThis.fetch = previousFetch }
})

test('uploaded assignment briefs and rubric support are mandatory even without query overlap', async () => {
  const assessment = { categories: [category], aiReferenceDocuments: [
    { name: 'Uploaded brief', documentType: 'assignment-brief', extractedText: 'Submit appendix Z.' },
    { name: 'Uploaded rubric', documentType: 'rubric-support', extractedText: 'Band X requires artifact Q.' }
  ] }
  const result = await service.buildAssessmentRagContext({ assessment, categoryName: 'Safety', studentSubmission: 'Sensor measurements' })
  assert.ok(result.retrievedContext.some(item => item.type === 'assignment-brief'))
  assert.ok(result.retrievedContext.some(item => item.type === 'rubric-support'))
})
