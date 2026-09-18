# Offline marking calibration

This tool compares saved AI predictions with independently human-marked examples. It makes no AI or network calls and does not establish validated grading accuracy. The bundled fixture is **entirely synthetic and is not accuracy evidence**.

```sh
node scripts/evaluate-marking.mjs --help
node scripts/evaluate-marking.mjs tests/fixtures/marking-calibration.example.json
node scripts/evaluate-marking.mjs /path/to/anonymized-held-out.json --tolerance 0.05
node --test tests/markingCalibration.test.mjs
```

The output is JSON. Exit status is 0 for complete valid inputs, 1 for invalid inputs/arguments, and 2 for valid inputs with missing predictions. A low error does not itself imply a pass: this tool supplies no production quality threshold.

## Assemble a defensible dataset

1. Obtain permission to use an appropriately representative sample, with weak, strong, and borderline work across the intended assessments. Anonymize student identities and use stable pseudonymous example IDs. Keep real submissions and private marks outside this repository; the evaluator needs scores, not submission text.
2. Have qualified humans mark independently against a frozen rubric, without seeing AI predictions. Record criterion marks and resolve disagreements through a documented moderation process. Retain annotator agreement and uncertainty separately: human marks are a reference, not an infallible truth.
3. Record the rubric version, model identifier/version, and prompt version. Also retain model settings, date, retrieval configuration, dataset provenance, and human moderation protocol in metadata. Use a separate file for each distinct model/prompt/rubric configuration.
4. Reserve a held-out set before tuning prompts or retrieval. Tune using a separate development set. Evaluate the held-out set only after freezing the configuration; do not repeatedly tune to it and still call it held out.
5. Save predictions from the existing authorized marking workflow, matching every example and criterion ID. To assess repeatability, collect several independent runs with the same frozen configuration, recording run IDs and settings. The CLI itself never calls a live provider.
6. Decide any tolerance with educators before inspecting results. A tolerance expresses a comparison preference, not an established safe deployment threshold. Review actual disagreements, criterion coverage, group-specific performance, and borderline decisions alongside aggregate numbers.

## JSON schema

See `tests/fixtures/marking-calibration.example.json` for a complete, prominently synthetic example.

- `metadata`: object with nonempty strings `rubricVersion`, `model`, and `promptVersion`; extra provenance fields are preserved in output.
- `criteria`: nonempty array of `{ "id": "reasoning", "maxMarks": 10 }`. IDs are nonempty, case-sensitive, unique strings; maxima must be finite positive numbers.
- `examples`: nonempty array of `{ "id": "anonymous-001", "human": { "reasoning": 7 } }`. IDs must be unique.
- `runs`: nonempty array of `{ "id": "run-1", "predictions": [{ "id": "anonymous-001", "scores": { "reasoning": 6 } }] }`. Run IDs and prediction IDs within each run must be unique. Each prediction must match a known example. An empty prediction array is allowed and reported as zero coverage.
- Optional `tolerance`: a number from 0 through 1, inclusive. `--tolerance` overrides this value. When neither is supplied, agreement is `null`.

Human and predicted score objects must contain exactly the rubric criterion IDs. Scores must be finite numbers between zero and that criterion's maximum, inclusive; numeric strings are rejected. Partial score objects are invalid. An absent whole-example prediction is explicitly listed in coverage and triggers exit 2. IDs are matched literally, without trimming or coercion.

## Metric definitions and limitations

For every observed example/run/criterion, normalized signed error is `(AI mark − human mark) / criterion maximum`. Each observed criterion score receives equal weight, regardless of its maximum. Repeated runs add observations; examples with more available runs therefore have more weight when coverage is incomplete.

- `metrics.normalizedAbsoluteError`: mean absolute normalized error, from 0 to 1.
- `metrics.signedBias`: mean normalized signed error, from −1 to 1. Positive means AI awards more marks; opposing errors can cancel.
- `metrics.withinToleranceAgreement`: fraction with absolute normalized error less than or equal to tolerance. For example, 0.05 permits a difference of 0.5 marks on a 10-mark criterion. This is criterion-score agreement, not total-grade or classification agreement.
- `perCriterion` and `perRun`: the same descriptive metrics for each criterion and run, including observed score counts.
- `coverage`: expected example/run pairs, observed pairs, fraction, and every missing pair. All present predictions have complete criteria. Metrics use observed scores only and must always be read with coverage. Zero observations yield `null` metrics rather than misleading zero error.
- `repeatedRunVariation`: mean normalized range `(maximum predicted mark − minimum predicted mark) / criterion maximum`, across example/criterion cells with at least two observed runs. Reports compared and expected cell counts. This is `null` for one run; with multiple runs but no overlapping predictions its mean is `null`. It measures observed repeatability, not confidence intervals or grading accuracy. Different numbers of runs can change ranges.

These are descriptive point estimates. Synthetic tests check implementation arithmetic only. Small or selected samples, unequal missingness, shared marking biases, rubric ambiguity, and repeated tuning can all mislead; retain human oversight and analyze the original disagreements before making deployment decisions.
