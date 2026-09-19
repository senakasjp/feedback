export function normalizeCategoryLabel(value) {
  return (value || '')
    .toString()
    .replace(/\u00a0/g, ' ')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function normalizeFullLabel(value) {
  return (value || '').toString().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

function withoutNumberedPrefix(value) {
  const label = normalizeCategoryLabel(value)
  const match = label.match(/^\d+(?:\.\d+)*(?:[.)])?\s+(.+)$/u)
  return match && /\p{L}/u.test(match[1]) ? match[1].trim() : label
}

function learningOutcomes(value) {
  const labels = normalizeFullLabel(value).match(/\blo\s*\d+(?:\s*[-–]\s*\d+)?/g) || []
  return [...new Set(labels.map(label => label.replace(/\s+/g, '').replace(/–/g, '-')))].sort().join(',')
}

export function resolveRubricCategory(label, categories = [], manualMap = {}) {
  const normalizedLabel = normalizeCategoryLabel(label)
  if (!normalizedLabel) return null

  const available = categories.filter(category => typeof category?.name === 'string' && category.name.trim())
  if (Object.prototype.hasOwnProperty.call(manualMap || {}, normalizedLabel)) {
    const mapped = available.filter(category => category.name === manualMap[normalizedLabel])
    return mapped.length === 1 ? mapped[0] : null
  }

  const rowOutcomes = learningOutcomes(label)
  const compatible = available.filter(category => {
    const categoryOutcomes = learningOutcomes(category.name)
    return !rowOutcomes || !categoryOutcomes || rowOutcomes === categoryOutcomes
  })

  for (const normalize of [normalizeFullLabel, normalizeCategoryLabel, withoutNumberedPrefix]) {
    const target = normalize(label)
    const matches = compatible.filter(category => normalize(category.name) === target)
    if (matches.length) return matches.length === 1 ? matches[0] : null
  }

  return null
}
