// Minimal runnable check for the student-submission embedding index (no framework, no fixtures -
// this file is the whole test). Run with: node tests/aiMarkingService.studentVectorIndex.check.mjs
//
// Uses Vite's ssrLoadModule (rather than a plain Node import) because aiMarkingService.js/
// llmProviders.js reference import.meta.env, which only exists under Vite's transform.
import assert from 'node:assert/strict'
import { createServer } from 'vite'

globalThis.fetch = async (url, options) => {
  if (String(url).includes('/embeddings')) {
    const body = JSON.parse(options.body)
    return {
      ok: true,
      json: async () => ({
        data: body.input.map(text => ({ embedding: [text.length, [...text].filter(c => c === 'e').length] }))
      })
    }
  }
  throw new Error(`Unexpected fetch to ${url}`)
}

const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true } })

try {
  const {
    buildStudentSubmissionVectorIndex,
    isStudentSubmissionVectorIndexCurrent,
    buildImproveFeedbackWithRagPromptPreview
  } = await server.ssrLoadModule('/src/services/aiMarkingService.js')

  const submission = [
    'Introduction paragraph about the project overview and scope.',
    'This section discusses ethical considerations around biometric data and privacy legislation in depth.',
    'A closing paragraph wrapping up the report with recommendations.'
  ].join('\n\n')

  const index = await buildStudentSubmissionVectorIndex({ studentSubmission: submission })

  assert.equal(index.chunks.length, 3, 'should produce one chunk per paragraph')
  assert.ok(index.chunks.every(chunk => Array.isArray(chunk.embedding)), 'every chunk should have an embedding')
  assert.equal(index.chunks[1].text.includes('ethical considerations'), true, 'chunk text preserved verbatim')

  assert.equal(isStudentSubmissionVectorIndexCurrent(index, submission), true, 'index should be current for the same text')
  assert.equal(isStudentSubmissionVectorIndexCurrent(index, submission + ' extra'), false, 'index should be stale once text changes')
  assert.equal(isStudentSubmissionVectorIndexCurrent(null, submission), false, 'null index is never current')
  assert.equal(isStudentSubmissionVectorIndexCurrent({ ...index, version: 999 }, submission), false, 'version mismatch is never current')

  console.log('OK: student submission vector index builds, hashes, and invalidates correctly')

  // The notification/preview-title "evidence: semantic match" vs "keyword match" depends on this
  // mode value making it all the way back out of buildImproveFeedbackWithRagPromptPreview - assert
  // the plumbing, not just the index itself.
  const minimalAssessment = { name: 'Test assessment', categories: [] }
  const withIndex = await buildImproveFeedbackWithRagPromptPreview({
    assessment: minimalAssessment,
    categoryName: 'Ethical Considerations',
    studentSubmission: submission,
    studentVectorIndex: index
  })
  assert.equal(withIndex.submissionRetrievalMode, 'vector', 'should report vector mode when a current student index is supplied')

  const withoutIndex = await buildImproveFeedbackWithRagPromptPreview({
    assessment: minimalAssessment,
    categoryName: 'Ethical Considerations',
    studentSubmission: submission,
    studentVectorIndex: null
  })
  assert.equal(withoutIndex.submissionRetrievalMode, 'lexical', 'should fall back to lexical mode with no student index')

  console.log('OK: submissionRetrievalMode propagates through buildImproveFeedbackWithRagPromptPreview')
} finally {
  await server.close()
}
