# RAG marking safeguards

The marking assistant produces suggestions for assessor review. These changes do not establish grading accuracy or automatically verify external references.

## Retrieval

All category descriptors, rubric HTML text, question text, and uploaded documents classified as Assignment Brief or Rubric Support are mandatory prompt context. They are not subject to the eight-chunk supporting-reference quota. Correctly classify required marking documents when uploading them.

Supporting sources are ranked with category matches first, without deleting other relevant sources. Distinct passages from the same document can be selected. Identical passages are deduplicated. Template paragraphs and prior-feedback examples retain their per-type limits. Lexical, vector, and embedding-query fallback paths share these rules. The vector index version changes so old indexes are rebuilt.

Student submission text remains complete. Very large submissions or mandatory context can exceed a provider's context limit; these changes do not silently shorten either. A provider failure requires assessor action, not assuming missing material was assessed.

## Draft validation and citations

Structured drafts must contain exactly one entry per criterion, numeric finite marks within each maximum, textual feedback fields, and an evidence array. Positive marks require at least one evidence entry. Null, empty-string, duplicate, missing, unknown, and out-of-range marks/results are rejected rather than coerced or clamped. Parseable drafts flagged as token-limited are also rejected. Evidence text is not automatically proven authentic: assessors must check it against the submission.

The shared instructions distinguish unavailable verification from demonstrated citation errors. The model is instructed to flag unverified sources for assessor checking, not deduct solely because it lacks external access, and not claim external verification. This is a prompt policy, not an external citation checker or a guarantee of model compliance.

The existing review screen remains the point where the assessor chooses whether to apply structured suggestions. Existing per-category marking workflows remain available.

## Verification

```sh
node --test tests/aiMarkingService.safety.test.mjs tests/markingDraftValidation.test.mjs tests/markingCalibration.test.mjs
node tests/aiMarkingService.fullSubmissionText.check.mjs
npm run test:e2e
npm run build
```

Provider-response tests use synthetic HTTP responses. They verify request handling and rejection behavior, not model judgement. Browser tests cover the successful draft review/application path and rejection of incomplete drafts. See [marking-calibration.md](marking-calibration.md) for the offline comparison tool and the human-marked data needed to evaluate accuracy.
