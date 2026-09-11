// Runnable self-check for the student-submission RAG pipeline (chunking, hybrid retrieval,
// rerank+expand, iterative sufficiency check). Exercises only the no-API-key lexical path
// (buildAssessmentRagContext skips embeddings when no vectorIndex is supplied), so it runs offline.
// Plain `node` can't run this directly - llmProviders.js reads `import.meta.env` at module scope,
// which only Vite's bundler defines; esbuild stubs it here. Run with:
//   npx esbuild src/services/aiMarkingService.selfcheck.js --bundle --platform=node --format=esm \
//     --define:import.meta.env={} --outfile=/tmp/selfcheck.bundle.mjs && node /tmp/selfcheck.bundle.mjs
import assert from 'node:assert/strict'
import { buildAssessmentRagContext } from './aiMarkingService.js'

const studentSubmission = `Page 1: Introduction

This report investigates the effect of temperature variation on dissolved oxygen levels in local streams during Term 2.

Methodology

We collected samples using calibrated dissolved oxygen sensors at five separate locations along the stream. Water temperature was recorded at hourly intervals across the sampling period, and each sensor was cross-checked against a calibrated thermometer before use.

Page 2: Results

The dissolved oxygen concentration decreased as water temperature increased, consistent with the expected inverse relationship. At 12 degrees Celsius the mean dissolved oxygen level was 9.8 mg/L, falling to 6.1 mg/L at 22 degrees Celsius.

Conclusion

Overall the results support the hypothesis of an inverse relationship between temperature and dissolved oxygen.`

const assessment = {
  name: 'Water quality investigation',
  categories: [
    { name: 'Methodology', allocatedMarks: 10, description: 'Describes the experimental method and data collection process' },
    { name: 'Referencing', allocatedMarks: 5, description: 'Cites sources using APA style with a full reference list' }
  ]
}

async function main() {
  const whole = await buildAssessmentRagContext({ assessment, studentSubmission })

  assert.equal(whole.retrievalSufficient, false, 'expected overall retrieval to be flagged insufficient (no referencing evidence exists)')
  assert.deepEqual(whole.insufficientCriteria, ['Referencing'], 'expected only Referencing to be flagged insufficient')

  const methodologyChunk = whole.retrievedContext.find(item => item.type === 'submission' && item.source.includes('Methodology'))
  assert.ok(methodologyChunk, 'expected a submission chunk citing the Methodology heading')
  assert.match(methodologyChunk.text, /calibrated dissolved oxygen sensors/, 'expected the matched chunk to contain the actual methodology evidence, not just the heading')

  const perCriterion = await buildAssessmentRagContext({ assessment, studentSubmission, categoryName: 'Methodology' })
  assert.equal(perCriterion.retrievalSufficient, true, 'expected a single well-evidenced criterion to be marked sufficient')
  assert.deepEqual(perCriterion.insufficientCriteria, [])

  const noEvidence = await buildAssessmentRagContext({ assessment, studentSubmission, categoryName: 'Referencing' })
  assert.equal(noEvidence.retrievalSufficient, false, 'expected an uncovered criterion to be marked insufficient')

  const empty = await buildAssessmentRagContext({ assessment, studentSubmission: '' })
  assert.equal(empty.retrievalSufficient, true, 'expected no-submission case to not falsely flag missing evidence')
  assert.deepEqual(empty.insufficientCriteria, [])

  console.log('aiMarkingService self-check: all assertions passed')
}

main().catch(error => {
  console.error('aiMarkingService self-check FAILED:', error)
  process.exit(1)
})
