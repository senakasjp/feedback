import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluate } from '../scripts/evaluate-marking.mjs';

function dataset() {
  return {
    metadata: { rubricVersion: 'synthetic-v1', model: 'synthetic', promptVersion: 'v1' },
    tolerance: 0.1,
    criteria: [{ id: 'a', maxMarks: 10 }, { id: 'b', maxMarks: 20 }],
    examples: [{ id: 'weak', human: { a: 2, b: 4 } }, { id: 'strong', human: { a: 8, b: 16 } }],
    runs: [{ id: 'first', predictions: [
      { id: 'weak', scores: { a: 3, b: 6 } }, { id: 'strong', scores: { a: 7, b: 14 } }
    ] }]
  };
}

test('calculates normalized errors, signed bias, criterion errors and agreement', () => {
  const result = evaluate(dataset());
  assert.equal(result.metrics.normalizedAbsoluteError, 0.1);
  assert.equal(result.metrics.signedBias, 0);
  assert.equal(result.metrics.withinToleranceAgreement, 1);
  assert.equal(result.perCriterion.a.normalizedAbsoluteError, 0.1);
  assert.equal(result.coverage.fraction, 1);
  assert.equal(result.repeatedRunVariation, null);
  assert.equal(evaluate(dataset(), 0).metrics.withinToleranceAgreement, 0);
});

test('missing predictions remain explicit and reduce coverage', () => {
  const input = dataset();
  input.runs[0].predictions.pop();
  const result = evaluate(input);
  assert.equal(result.complete, false);
  assert.equal(result.coverage.fraction, 0.5);
  assert.deepEqual(result.coverage.missing, [{ runId: 'first', exampleId: 'strong' }]);
  input.runs[0].predictions = [];
  assert.equal(evaluate(input).metrics.normalizedAbsoluteError, null);
});

test('repeated runs report normalized ranges and availability', () => {
  const input = dataset();
  input.runs.push({ id: 'second', predictions: [{ id: 'weak', scores: { a: 5, b: 10 } }] });
  const variation = evaluate(input).repeatedRunVariation;
  assert.equal(variation.meanNormalizedRange, 0.2);
  assert.equal(variation.comparedExampleCriteria, 2);
  assert.equal(variation.expectedExampleCriteria, 4);
});

for (const [name, mutate] of [
  ['duplicate example', d => d.examples.push(d.examples[0])],
  ['duplicate criterion', d => d.criteria.push(d.criteria[0])],
  ['duplicate run', d => d.runs.push(d.runs[0])],
  ['duplicate prediction', d => d.runs[0].predictions.push(d.runs[0].predictions[0])],
  ['unknown example', d => { d.runs[0].predictions[0].id = 'unknown'; }],
  ['missing criterion', d => { delete d.runs[0].predictions[0].scores.a; }],
  ['unknown criterion', d => { d.examples[0].human.c = 2; }],
  ['zero maximum', d => { d.criteria[0].maxMarks = 0; }],
  ['negative mark', d => { d.examples[0].human.a = -1; }],
  ['out of range', d => { d.runs[0].predictions[0].scores.a = 11; }],
  ['numeric string', d => { d.examples[0].human.a = '2'; }],
  ['invalid tolerance', d => { d.tolerance = 2; }],
  ['missing metadata', d => { delete d.metadata; }],
  ['empty examples', d => { d.examples = []; }]
]) {
  test(`rejects ${name}`, () => {
    const input = dataset();
    mutate(input);
    assert.throws(() => evaluate(input));
  });
}

const cli = new URL('../scripts/evaluate-marking.mjs', import.meta.url);
function run(...args) {
  return spawnSync(process.execPath, [cli.pathname, ...args], { encoding: 'utf8' });
}
test('CLI help, fixture and invalid arguments', () => {
  assert.equal(run('--help').status, 0);
  const happy = run('tests/fixtures/marking-calibration.example.json', '--tolerance', '0.05');
  assert.equal(happy.status, 0, happy.stderr);
  assert.equal(JSON.parse(happy.stdout).tolerance, 0.05);
  assert.match(happy.stdout, /synthetic/i);
  assert.notEqual(run('--tolerance', 'abc').status, 0);
  assert.notEqual(run('missing.json').status, 0);
  assert.notEqual(run('--unknown').status, 0);
});


test('CLI reports incomplete predictions with exit 2 and malformed JSON with exit 1', () => {
  const directory = mkdtempSync(join(tmpdir(), 'marking-calibration-'));
  const path = join(directory, 'input.json');
  try {
    const input = dataset();
    input.runs[0].predictions.pop();
    writeFileSync(path, JSON.stringify(input));
    const incomplete = run(path);
    assert.equal(incomplete.status, 2);
    assert.equal(JSON.parse(incomplete.stdout).coverage.missing.length, 1);
    writeFileSync(path, '{');
    assert.equal(run(path).status, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
