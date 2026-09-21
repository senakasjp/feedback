const isBlank = value => value == null || (typeof value === 'string' && value.trim() === '');

export function parseMark(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function validateCategoryMark(value, max) {
  if (isBlank(value)) return { valid: true, value: null, error: '' };
  const parsed = parseMark(value);
  const maximum = parseMark(max);
  let error = '';
  if (parsed === null) error = 'Enter a finite numeric mark.';
  else if (parsed < 0) error = 'Marks cannot be negative.';
  else if (max != null && (maximum === null || maximum < 0)) error = 'The category maximum is invalid.';
  else if (maximum !== null && parsed > maximum) error = `Mark must not exceed ${maximum}.`;
  return { valid: !error, value: parsed, error };
}

const categoriesOf = assessment => Array.isArray(assessment?.categories) ? assessment.categories : [];
const roundedTotal = value => Number(value.toPrecision(15));

export function getAssessmentMaximum(assessment) {
  const configured = parseMark(assessment?.totalMarks);
  if (configured !== null && configured > 0) return configured;
  const allocated = categoriesOf(assessment).reduce((sum, category) => {
    const value = parseMark(category.allocatedMarks);
    return sum + (value !== null && value >= 0 ? value : 0);
  }, 0);
  return Number.isFinite(allocated) && allocated > 0 ? roundedTotal(allocated) : null;
}

export function getMarkSummary(assessment, marks = {}) {
  const categories = categoriesOf(assessment);
  const maximum = getAssessmentMaximum(assessment);
  const configured = parseMark(assessment?.totalMarks);
  const invalidTotal = !isBlank(assessment?.totalMarks) && (configured === null || configured < 0);
  const allocated = roundedTotal(categories.reduce((sum, category) => sum + (parseMark(category.allocatedMarks) ?? 0), 0));
  const allocationMismatch = categories.length > 0 && configured > 0 && Math.abs(allocated - configured) > 1e-8;
  const entries = categories.length ? categories : Object.keys(marks ?? {}).map(name => ({ name }));
  let total = 0;
  let hasMarks = false;
  let missing = false;
  const invalidCategories = [];
  const seenNames = new Set();
  for (const category of entries) {
    if (seenNames.has(category.name)) {
      if (!invalidCategories.includes(category.name)) invalidCategories.push(category.name);
      continue;
    }
    seenNames.add(category.name);
    const allocation = parseMark(category.allocatedMarks);
    const invalidMaximum = !isBlank(category.allocatedMarks) && (allocation === null || allocation < 0);
    const value = marks?.[category.name];
    const checked = validateCategoryMark(value, allocation);
    if (invalidMaximum || !checked.valid) invalidCategories.push(category.name);
    const required = allocation > 0 || category.markingMode === 'fixed';
    if (required && checked.value === null) missing = true;
    if (!invalidMaximum && checked.valid && checked.value !== null) {
      total += checked.value;
      hasMarks = true;
    }
  }
  total = roundedTotal(total);
  const isComplete = hasMarks && !missing && !invalidTotal && !allocationMismatch && !invalidCategories.length && maximum !== null && Number.isFinite(total) && total <= maximum;
  return { total, hasMarks, isComplete, maximum, percentage: isComplete ? total / maximum * 100 : null, allocationMismatch, invalidCategories };
}

export const DEFAULT_MARK_RANGES = Object.freeze([
  { color: 'red', lowerPercentage: 0, upperPercentage: 40, grade: 'F', label: 'Fail' },
  { color: 'orange', lowerPercentage: 40, upperPercentage: 50, grade: 'D', label: 'Pass' },
  { color: 'yellow', lowerPercentage: 50, upperPercentage: 65, grade: 'C', label: 'Satisfactory' },
  { color: 'lightgreen', lowerPercentage: 65, upperPercentage: 80, grade: 'B', label: 'Good' },
  { color: 'green', lowerPercentage: 80, upperPercentage: 100, grade: 'A', label: 'Excellent' }
].map(Object.freeze));

export const DEFAULT_GRADE_RANGES = Object.freeze([
  { color: 'red', lowerPercentage: 0, upperPercentage: 40, grade: 'F', label: 'Fail' },
  { color: 'orange', lowerPercentage: 40, upperPercentage: 50, grade: 'D', label: 'Fail' },
  { color: 'yellow', lowerPercentage: 50, upperPercentage: 55, grade: 'C-', label: 'Pass' },
  { color: 'yellow', lowerPercentage: 55, upperPercentage: 60, grade: 'C', label: 'Pass' },
  { color: 'yellow', lowerPercentage: 60, upperPercentage: 65, grade: 'C+', label: 'Pass' },
  { color: 'lightgreen', lowerPercentage: 65, upperPercentage: 70, grade: 'B-', label: 'Good' },
  { color: 'lightgreen', lowerPercentage: 70, upperPercentage: 75, grade: 'B', label: 'Good' },
  { color: 'lightgreen', lowerPercentage: 75, upperPercentage: 80, grade: 'B+', label: 'Good' },
  { color: 'green', lowerPercentage: 80, upperPercentage: 85, grade: 'A-', label: 'Excellent' },
  { color: 'green', lowerPercentage: 85, upperPercentage: 90, grade: 'A', label: 'Excellent' },
  { color: 'green', lowerPercentage: 90, upperPercentage: 100, grade: 'A+', label: 'Excellent' }
].map(Object.freeze));

function normalizedRanges(ranges) {
  if (!Array.isArray(ranges)) return [];
  const source = ranges.length ? ranges : DEFAULT_MARK_RANGES;
  const normalized = source.map(range => ({ ...range, lower: parseMark(range?.lowerPercentage), upper: parseMark(range?.upperPercentage) }));
  if (normalized.some(range => range.lower === null || range.upper === null || range.lower < 0 || range.upper > 100 || range.lower >= range.upper || typeof range.color !== 'string' || !range.color.trim())) return [];
  normalized.sort((a, b) => a.lower - b.lower);
  for (let index = 0; index < normalized.length - 1; index++) {
    const range = normalized[index];
    const next = normalized[index + 1];
    if (range.upper > next.lower) return [];
    if (Number.isInteger(range.upper) && Number.isInteger(next.lower) && range.upper === next.lower - 1) range.upper = next.lower;
  }
  return normalized;
}

export function getMarkBands(ranges = []) {
  return normalizedRanges(ranges).map(range => ({ color: range.color, lower: range.lower / 100, upper: range.upper / 100, upperInclusive: range.upper === 100 }));
}

export function getGradeInfo(percentage, ranges = []) {
  const number = parseMark(percentage);
  const unclassified = { grade: 'N/A', label: 'Unclassified', color: 'secondary' };
  if (number === null || number < 0 || number > 100) return unclassified;
  const range = normalizedRanges(Array.isArray(ranges) && ranges.length === 0 ? DEFAULT_GRADE_RANGES : ranges).find(band => number >= band.lower && (number < band.upper || (band.upper === 100 && number === 100)));
  if (!range) return unclassified;
  const colorLabel = range.color === 'lightgreen' ? 'Light green' : range.color.charAt(0).toUpperCase() + range.color.slice(1);
  return { grade: range.grade || colorLabel, label: range.label || colorLabel, color: range.color };
}
