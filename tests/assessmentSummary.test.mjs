import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { getAssessmentForMarking } from '../src/utils/rubricMarks.js';
import { parseMark, getAssessmentMaximum, getGradeInfo, getMarkSummary } from '../src/utils/markingRules.js';

const source = readFileSync(new URL('../src/lib/AssessmentManager.svelte', import.meta.url), 'utf8');
const start = source.indexOf('function buildStudentSummaryCache()');
const end = source.indexOf('\n\t// Print marks table to PDF', start);
const builder = source.slice(start, end).replace(': StudentSummaryCache', '');
const assessment = (id, maximum, weight) => ({
  id, totalMarks: maximum, weight,
  categories: [{ name: 'Criterion', allocatedMarks: maximum }],
});
const summarize = (assessments, evaluations) => runInNewContext(`${builder}\nbuildStudentSummaryCache()`, {
  assessments,
  students: [{ id: 'student' }],
  studentEvaluations: { student: evaluations },
  parseMark, getAssessmentForMarking, getAssessmentMaximum, getMarkSummary,
  getGrade: percentage => getGradeInfo(percentage).grade,
});

test('normalizes assessment maxima and subject weights before assigning grades', () => {
  const result = summarize([assessment('a', 50, 20), assessment('b', 80, 30)], {
    a: { categoryMarks: { Criterion: 40 } },
    b: { categoryMarks: { Criterion: 40 } },
  });
  assert.equal(result.weightedByStudent.student.a.weightedMarks, 16);
  assert.equal(result.weightedByStudent.student.b.weightedMarks, 15);
  assert.equal(result.summaryByStudent.student.percentage, 62);
  assert.equal(result.gradeByStudent.student, 'C+');
});

test('zero is marked; blanks, missing criteria, invalid marks and allocation mismatches are incomplete', () => {
  const configured = assessment('a', 50, 100);
  const zero = summarize([configured], { a: { categoryMarks: { Criterion: 0 } } });
  assert.equal(zero.summaryByStudent.student.percentage, 0);
  assert.equal(zero.gradeByStudent.student, 'F');
  for (const value of ['', -1, 51, 'invalid', undefined]) {
    const result = summarize([configured], { a: { categoryMarks: { Criterion: value } } });
    assert.equal(result.summaryByStudent.student.isComplete, false);
    assert.equal(result.summaryByStudent.student.percentage, null);
    assert.equal(result.gradeByStudent.student, 'N/A');
  }
  const mismatch = summarize([{ ...configured, totalMarks: 100 }], { a: { categoryMarks: { Criterion: 40 } } });
  assert.equal(mismatch.summaryByStudent.student.isComplete, false);
});

test('a saved maximum is never awarded and a missing maximum is not fabricated', () => {
  const result = summarize([{ id: 'a', weight: 100, categories: [] }], {
    a: { manualTotalMarks: '100', categoryMarks: {} },
  });
  assert.equal(result.marksByStudent.student.a.total, 0);
  assert.equal(result.marksByStudent.student.a.hasMarks, false);
  assert.equal(result.maxRawMarksByAssessment.a, null);
  assert.equal(result.summaryByStudent.student.isComplete, false);
});

test('one missing weighted assessment prevents an overall result', () => {
  const result = summarize([assessment('a', 50, 20), assessment('b', 80, 30)], {
    a: { categoryMarks: { Criterion: 40 } },
  });
  assert.equal(result.summaryByStudent.student.percentage, null);
  assert.equal(result.gradeByStudent.student, 'N/A');
});
