// Checks that "Improve with RAG" still writes feedback when the embeddings service cannot be used,
// and that the assessment index is embedded in bounded batches instead of one oversized request.
// Run with: node tests/ragEmbeddingsFallback.check.mjs
//
// Uses Vite's ssrLoadModule because aiMarkingService.js references import.meta.env.
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const requestedBatches = []
let embeddingsMode = 'network-error'

globalThis.fetch = async (url, options = {}) => {
  if (String(url).includes('/embeddings')) {
    const body = JSON.parse(options.body || '{}')
    requestedBatches.push(Array.isArray(body.input) ? body.input : [body.input])
    if (embeddingsMode === 'network-error') {
      throw new TypeError('Failed to fetch')
    }
    return {
      ok: true,
      json: async () => ({ data: body.input.map((_, index) => ({ index, embedding: [1, 0, 0] })) })
    }
  }

  return {
    ok: true,
    json: async () => ({
      choices: [{ finish_reason: 'stop', message: { content: 'The response time was measured, but the limits were not discussed.' } }]
    })
  }
}

const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true } })

try {
  const { buildAssessmentVectorIndex, improveFeedbackWithRag } = await server.ssrLoadModule('/src/services/aiMarkingService.js')

  const assessment = {
    name: 'RAG fallback check',
    categories: [{ name: 'Safety', allocatedMarks: 10, description: 'Measure response time and discuss limits' }],
    rubricHtml: '<table><tr><td>Safety: require measurements</td></tr></table>'
  }

  // 1. Embeddings unreachable (missing access, blocked origin, offline) - feedback must still arrive.
  const fallbackResult = await improveFeedbackWithRag({
    assessment,
    categoryName: 'Safety',
    shortFeedback: 'The response time was measured at 2 ms but the limits were not discussed.',
    allocatedMark: 6,
    markMaximum: 10,
    studentSubmission: 'Measured response time: 2 ms.',
    modelPreference: { selectedModel: 'gpt-5.4-mini', reasoningEffort: 'low', provider: 'openai' }
  })

  assert.ok(fallbackResult.improvedText.includes('response time'), 'feedback text must be generated when embeddings fail')
  assert.match(fallbackResult.retrievalMode, /^lexical/, `retrieval must fall back to lexical, got "${fallbackResult.retrievalMode}"`)

  // 2. A large assessment is embedded in batches, never one oversized request.
  embeddingsMode = 'ok'
  requestedBatches.length = 0
  const manyParagraphs = Array.from({ length: 250 }, (_, index) => `Safety: template paragraph ${index + 1}`)
  const index = await buildAssessmentVectorIndex({ assessment, assessmentParagraphs: manyParagraphs })

  assert.ok(index.chunks.length > 96, 'index should cover every candidate chunk')
  assert.ok(requestedBatches.length > 1, 'a large assessment must be embedded in more than one request')
  assert.ok(requestedBatches.every(batch => batch.length <= 96), 'no embeddings request may exceed the batch size')
  assert.equal(
    requestedBatches.reduce((total, batch) => total + batch.length, 0),
    index.chunks.length,
    'every chunk must be embedded exactly once'
  )
  assert.ok(index.chunks.every(chunk => Array.isArray(chunk.embedding)), 'every chunk must carry its embedding')

  console.log('ragEmbeddingsFallback.check: all assertions passed')
} finally {
  await server.close()
}
