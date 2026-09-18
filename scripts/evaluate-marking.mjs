#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function object(value, label) {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}
function text(value, label) {
  requireValue(typeof value === 'string' && value.trim().length > 0, `${label} must be a nonempty string`);
}
function indexed(items, label, allowEmpty = false) {
  requireValue(Array.isArray(items) && (allowEmpty || items.length > 0), `${label} must be ${allowEmpty ? 'an' : 'a nonempty'} array`);
  const map = new Map();
  for (const item of items) {
    object(item, label);
    text(item.id, `${label} id`);
    requireValue(!map.has(item.id), `Duplicate ${label} id: ${item.id}`);
    map.set(item.id, item);
  }
  return map;
}
function scores(values, criteria, label) {
  object(values, label);
  requireValue(Object.keys(values).length === criteria.size && Object.keys(values).every(id => criteria.has(id)), `${label}: criterion IDs must exactly match rubric`);
  for (const [id, criterion] of criteria) {
    requireValue(Object.hasOwn(values, id) && Number.isFinite(values[id]) && values[id] >= 0 && values[id] <= criterion.maxMarks, `${label}: invalid score for ${id}`);
  }
}
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
function metrics(errors, tolerance) {
  return {
    comparedScores: errors.length,
    normalizedAbsoluteError: mean(errors.map(Math.abs)),
    signedBias: mean(errors),
    withinToleranceAgreement: tolerance === null ? null : mean(errors.map(error => Number(Math.abs(error) <= tolerance)))
  };
}

export function evaluate(input, toleranceOverride) {
  object(input, 'Input');
  object(input.metadata, 'metadata');
  for (const key of ['rubricVersion', 'model', 'promptVersion']) text(input.metadata[key], `metadata.${key}`);
  const tolerance = toleranceOverride ?? input.tolerance ?? null;
  requireValue(tolerance === null || (Number.isFinite(tolerance) && tolerance >= 0 && tolerance <= 1), 'Tolerance must be a number between 0 and 1');
  const criteria = indexed(input.criteria, 'criterion');
  for (const criterion of criteria.values()) {
    requireValue(Number.isFinite(criterion.maxMarks) && criterion.maxMarks > 0, `Invalid maximum for ${criterion.id}`);
  }
  const examples = indexed(input.examples, 'example');
  for (const example of examples.values()) scores(example.human, criteria, `Human ${example.id}`);
  const runs = indexed(input.runs, 'run');
  const errors = [];
  const byCriterion = new Map([...criteria.keys()].map(id => [id, []]));
  const predictionsByExample = new Map([...examples.keys()].map(id => [id, []]));
  const missing = [];
  const perRun = [];
  let predicted = 0;
  for (const run of runs.values()) {
    const predictions = indexed(run.predictions, `prediction in ${run.id}`, true);
    const runErrors = [];
    for (const prediction of predictions.values()) {
      requireValue(examples.has(prediction.id), `Unknown example ID: ${prediction.id}`);
      scores(prediction.scores, criteria, `Prediction ${run.id}/${prediction.id}`);
    }
    for (const example of examples.values()) {
      const prediction = predictions.get(example.id);
      if (!prediction) {
        missing.push({ runId: run.id, exampleId: example.id });
        continue;
      }
      predicted++;
      predictionsByExample.get(example.id).push(prediction.scores);
      for (const [id, criterion] of criteria) {
        const error = (prediction.scores[id] - example.human[id]) / criterion.maxMarks;
        errors.push(error);
        runErrors.push(error);
        byCriterion.get(id).push(error);
      }
    }
    perRun.push({ id: run.id, predictedExamples: predictions.size, expectedExamples: examples.size, ...metrics(runErrors, tolerance) });
  }
  const ranges = [];
  for (const predictions of predictionsByExample.values()) {
    if (predictions.length < 2) continue;
    for (const [id, criterion] of criteria) {
      const values = predictions.map(prediction => prediction[id]);
      ranges.push((Math.max(...values) - Math.min(...values)) / criterion.maxMarks);
    }
  }
  const expected = examples.size * runs.size;
  return {
    notice: 'Offline descriptive comparison only; synthetic fixtures are not accuracy evidence. No validated grading accuracy is claimed.',
    metadata: input.metadata,
    tolerance,
    complete: missing.length === 0,
    coverage: { predicted, expected, fraction: predicted / expected, missing },
    metrics: metrics(errors, tolerance),
    perCriterion: Object.fromEntries([...byCriterion].map(([id, values]) => [id, metrics(values, tolerance)])),
    perRun,
    repeatedRunVariation: runs.size < 2 ? null : {
      meanNormalizedRange: mean(ranges),
      comparedExampleCriteria: ranges.length,
      expectedExampleCriteria: examples.size * criteria.size
    }
  };
}

function main(args) {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    console.log(`Usage: node scripts/evaluate-marking.mjs INPUT.json [--tolerance 0..1]
Offline comparison of independent human marks and saved AI predictions; no network calls.
Outputs JSON: normalized errors, bias (AI minus human), coverage, criterion errors,
within-tolerance agreement, and repeated-run normalized ranges.
Tolerance is a fraction of each criterion maximum, inclusive; CLI overrides input.
No default quality threshold. See docs/marking-calibration.md for schema and limits.
Exit codes: 0 complete, 1 invalid input/arguments, 2 missing predictions.`);
    return;
  }
  requireValue(args.length === 1 || (args.length === 3 && args[1] === '--tolerance'), 'Expected INPUT.json [--tolerance 0..1]; use --help');
  requireValue(!args[0].startsWith('-'), 'Expected input path; use --help');
  let tolerance;
  if (args.length === 3) {
    requireValue(args[2].trim().length > 0, 'Tolerance must not be empty');
    tolerance = Number(args[2]);
  }
  const result = evaluate(JSON.parse(readFileSync(args[0], 'utf8')), tolerance);
  console.log(JSON.stringify(result, null, 2));
  if (!result.complete) process.exitCode = 2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`Calibration error: ${error.message}`);
    process.exitCode = 1;
  }
}
