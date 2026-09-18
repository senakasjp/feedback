// Minimal runnable check that "Improve with RAG" sends the student's FULL submission text to the
// AI for every category - no excerpting, no per-category filtering - so nothing (a reference list,
// a contradicting later chapter, anything) can be silently dropped before the model sees it.
// Run with: node tests/aiMarkingService.fullSubmissionText.check.mjs
//
// Uses Vite's ssrLoadModule (rather than a plain Node import) because aiMarkingService.js/
// llmProviders.js reference import.meta.env, which only exists under Vite's transform.
import assert from 'node:assert/strict'
import { createServer } from 'vite'

globalThis.fetch = async (url) => {
  throw new Error(`Unexpected fetch to ${url} - this check should not need embeddings or a chat call`)
}

const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true } })

try {
  const { buildImproveFeedbackWithRagPromptPreview } = await server.ssrLoadModule('/src/services/aiMarkingService.js')

  const submission = [
    'Chapter 1: Introduction paragraph about the overall project scope and objectives.',
    'Chapter 5: Ethical Considerations discusses biometric data and privacy legislation in depth.',
    'References',
    'Kūkūtai, T., et al. (2023). Māori data sovereignty and privacy. Journal of Indigenous Studies.'
  ].join('\n\n')

  const minimalAssessment = { name: 'Test assessment', categories: [] }

  for (const categoryName of ['Ethical Considerations', 'Technical Architecture', 'APA Referencing']) {
    const preview = await buildImproveFeedbackWithRagPromptPreview({
      assessment: minimalAssessment,
      categoryName,
      studentSubmission: submission
    })
    const promptText = preview.messages.map(m => JSON.stringify(m.content)).join('\n')

    assert.ok(promptText.includes('Kūkūtai'), `full submission (incl. references) should reach the prompt for category "${categoryName}"`)
    assert.ok(promptText.includes('Chapter 1'), `full submission (incl. earlier chapters) should reach the prompt for category "${categoryName}"`)
  }

  console.log('OK: Improve with RAG sends the full, unexcerpted student submission for every category')
} finally {
  await server.close()
}
