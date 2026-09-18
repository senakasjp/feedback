const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const normalizeName = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase()
const hasName = (value) => typeof value === 'string' && value.trim().length > 0

export function validateMarkingCriteria(criteria) {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    throw new Error('Assessment criteria must be a non-empty array. Add criteria before requesting AI marking.')
  }
  const names = new Map()
  for (const criterion of criteria) {
    if (!isRecord(criterion) || !hasName(criterion.criterion_name)) {
      throw new Error('Each assessment criterion must have a non-empty criterion_name. Check the assessment criteria.')
    }
    const name = normalizeName(criterion.criterion_name)
    if (names.has(name)) {
      throw new Error(`Duplicate assessment criterion "${names.get(name)}". Give each criterion a unique name.`)
    }
    names.set(name, criterion.criterion_name)
    if (typeof criterion.max_mark !== 'number' || !Number.isFinite(criterion.max_mark) || criterion.max_mark < 0) {
      throw new Error(`Assessment criterion "${criterion.criterion_name}" maximum must be a finite, non-negative number. Correct its maximum before requesting AI marking.`)
    }
  }
  return criteria
}

export function validateMarkingDraft(parsed, criteria) {
  validateMarkingCriteria(criteria)
  if (!isRecord(parsed) || !Array.isArray(parsed.criteria)) {
    throw new Error('AI marking draft must be an object containing a criteria array. Generate the draft again.')
  }
  if (typeof parsed.overall_feedback !== 'string') {
    throw new Error('AI marking draft overall_feedback must be a string. Generate the draft again.')
  }
  const expected = new Map(criteria.map((criterion) => [normalizeName(criterion.criterion_name), criterion]))
  const seen = new Set()
  const validated = parsed.criteria.map((item) => {
    if (!isRecord(item) || !hasName(item.criterion_name)) {
      throw new Error('Each AI marking criterion must be an object with a non-empty criterion_name. Generate the draft again.')
    }
    const name = normalizeName(item.criterion_name)
    const criterion = expected.get(name)
    if (!criterion) {
      throw new Error(`Unknown AI marking criterion "${item.criterion_name}". Generate a draft using only the assessment criteria.`)
    }
    if (seen.has(name)) {
      throw new Error(`Duplicate AI marking criterion "${criterion.criterion_name}". Generate a draft with exactly one entry per criterion.`)
    }
    seen.add(name)
    const label = `AI marking criterion "${criterion.criterion_name}"`
    if (typeof item.awarded_mark !== 'number' || !Number.isFinite(item.awarded_mark) || item.awarded_mark < 0 || item.awarded_mark > criterion.max_mark) {
      throw new Error(`${label} awarded_mark must be a finite number between 0 and ${criterion.max_mark}. Generate the draft again.`)
    }
    for (const field of ['judgement', 'improvement_advice', 'suggested_feedback']) {
      if (typeof item[field] !== 'string') {
        throw new Error(`${label} ${field} must be a string. Generate the draft again.`)
      }
    }
    if (!Array.isArray(item.evidence) || item.evidence.some((value) => typeof value !== 'string' || value.trim().length === 0)) {
      throw new Error(`${label} evidence must be an array of non-empty strings. Generate the draft again.`)
    }
    if (item.awarded_mark > 0 && item.evidence.length === 0) {
      throw new Error(`${label} requires evidence for a positive awarded_mark. Generate the draft again.`)
    }
    return {
      criterion_name: criterion.criterion_name,
      awarded_mark: item.awarded_mark,
      judgement: item.judgement,
      evidence: [...item.evidence],
      improvement_advice: item.improvement_advice,
      suggested_feedback: item.suggested_feedback
    }
  })
  const missing = criteria.filter((criterion) => !seen.has(normalizeName(criterion.criterion_name)))
  if (missing.length > 0) {
    throw new Error(`AI marking draft is missing criteria: ${missing.map((criterion) => criterion.criterion_name).join(', ')}. Generate a complete draft again.`)
  }
  return { criteria: validated, overall_feedback: parsed.overall_feedback }
}
