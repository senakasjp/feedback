import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMark, validateCategoryMark, getAssessmentMaximum, getMarkSummary, getGradeInfo, getMarkBands } from '../src/utils/markingRules.js';

test('strict marks distinguish zero, blank and malformed values', () => {
  for (const value of [null, undefined, '', ' ', true, false, NaN, Infinity, '7oops', '0x10', {}, []]) assert.equal(parseMark(value), null);
  for (const [value, expected] of [[0, 0], ['0', 0], [' 2.75 ', 2.75], ['1e2', 100]]) assert.equal(parseMark(value), expected);
  assert.equal(validateCategoryMark('', 10).valid, true);
  assert.equal(validateCategoryMark(0, 10).value, 0);
  for (const value of [-1, 11, 'bad', true]) assert.equal(validateCategoryMark(value, 10).valid, false);
  assert.equal(validateCategoryMark(12, null).valid, true);
});

const assessment = { totalMarks: 20, categories: [{ name: 'A', allocatedMarks: 10 }, { name: 'B', allocatedMarks: 10 }] };
test('maximum uses configuration or category allocation without a fake default', () => {
  assert.equal(getAssessmentMaximum(assessment), 20);
  assert.equal(getAssessmentMaximum({ categories: assessment.categories }), 20);
  assert.equal(getAssessmentMaximum({}), null);
  assert.equal(getAssessmentMaximum({ totalMarks: 0 }), null);
});

test('summaries exclude stale keys and distinguish zero, missing and invalid marks', () => {
  assert.deepEqual(getMarkSummary(assessment, { A: 0, B: 0, stale: 99 }), { total: 0, hasMarks: true, isComplete: true, maximum: 20, percentage: 0, allocationMismatch: false, invalidCategories: [] });
  assert.equal(getMarkSummary(assessment, { A: 10 }).percentage, null);
  const invalid = getMarkSummary(assessment, { A: 11, B: 5 });
  assert.equal(invalid.total, 5);
  assert.equal(invalid.isComplete, false);
  assert.deepEqual(invalid.invalidCategories, ['A']);
  assert.equal(getMarkSummary({ ...assessment, totalMarks: 25 }, { A: 10, B: 10 }).allocationMismatch, true);
  assert.equal(getMarkSummary({}, { old: 3 }).percentage, null);
  assert.equal(getMarkSummary({ totalMarks: -1, categories: assessment.categories }, { A: 10, B: 10 }).isComplete, false);
});

test('default grading handles fractional boundaries and invalid values', () => {
  for (const [score, grade] of [[0, 'F'], [39.99, 'F'], [40, 'D'], [49.99, 'D'], [50, 'C'], [64.99, 'C'], [65, 'B'], [79.99, 'B'], [80, 'A'], [100, 'A']]) assert.equal(getGradeInfo(score).grade, grade);
  for (const score of [null, '', NaN, Infinity, -1, 101]) assert.equal(getGradeInfo(score).grade, 'N/A');
});

test('fixed categories, invalid maxima and legacy marks cannot create false completion', () => {
  const fixed = { totalMarks: 10, categories: [{ name: 'Fixed', markingMode: 'fixed' }, { name: 'A', allocatedMarks: 10 }] };
  assert.equal(getMarkSummary(fixed, { A: 5 }).isComplete, false);
  const invalid = { totalMarks: 10, categories: [{ name: 'A', allocatedMarks: 'invalid' }] };
  assert.deepEqual(getMarkSummary(invalid, { A: 4 }).invalidCategories, ['A']);
  assert.equal(getMarkSummary({ totalMarks: 10 }, { legacy: 5 }).percentage, 50);
  assert.equal(getMarkSummary({ totalMarks: 10 }, { legacy: 11 }).percentage, null);
  const marks = Object.freeze({ A: '2.5', B: '' });
  getMarkSummary(assessment, marks);
  assert.deepEqual(marks, { A: '2.5', B: '' });
});

test('custom bands normalize legacy adjacency but preserve gaps and reject overlaps', () => {
  const ranges = [{ color: 'red', lowerPercentage: 0, upperPercentage: 79 }, { color: 'green', label: 'Mastery', lowerPercentage: 80, upperPercentage: 100 }];
  assert.deepEqual(getMarkBands(ranges), [{ color: 'red', lower: 0, upper: 0.8, upperInclusive: false }, { color: 'green', lower: 0.8, upper: 1, upperInclusive: true }]);
  assert.equal(getGradeInfo(79.5, ranges).color, 'red');
  assert.equal(getGradeInfo(80, ranges).label, 'Mastery');
  const gaps = [{ color: 'red', lowerPercentage: 0, upperPercentage: 40 }, { color: 'green', lowerPercentage: 60, upperPercentage: 100 }];
  assert.equal(getGradeInfo(50, gaps).grade, 'N/A');
  assert.deepEqual(getMarkBands([{ ...gaps[0], upperPercentage: 70 }, gaps[1]]), []);
  assert.equal(getGradeInfo(75, [{ color: 'green', lowerPercentage: 'bad', upperPercentage: 100 }]).grade, 'N/A');
});

test('decimal allocation totals do not exceed their maximum through floating point error', () => {
  const decimal = { totalMarks: 0.3, categories: [{ name: 'A', allocatedMarks: 0.1 }, { name: 'B', allocatedMarks: 0.2 }] };
  const summary = getMarkSummary(decimal, { A: 0.1, B: 0.2 });
  assert.equal(summary.total, 0.3);
  assert.equal(summary.isComplete, true);
  assert.equal(summary.percentage, 100);
  assert.equal(getAssessmentMaximum({ categories: decimal.categories }), 0.3);
});

test('duplicate category names invalidate completion without double counting', () => {
  const duplicate = { totalMarks: 20, categories: [{ name: 'A', allocatedMarks: 10 }, { name: 'A', allocatedMarks: 10 }] };
  const summary = getMarkSummary(duplicate, { A: 8 });
  assert.equal(summary.total, 8);
  assert.equal(summary.isComplete, false);
  assert.equal(summary.percentage, null);
  assert.deepEqual(summary.invalidCategories, ['A']);
});
