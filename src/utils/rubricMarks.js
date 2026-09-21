import { normalizeCategoryLabel, resolveRubricCategory } from './rubricCategoryMatching.js'
import { getRubricTableGrid, isRubricHeaderRow } from './rubricTable.js'

const decimal = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)'
const plainMaximum = new RegExp(`^${decimal}$`)
const fractionMaximum = new RegExp(`^(?:(${decimal})\\s*)?/\\s*(${decimal})$`)
const outOfMaximum = new RegExp(`^(?:(${decimal})\\s+)?out\\s+of\\s*(${decimal})$`, 'i')

export function parseRubricMaximum(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null
  if (typeof value !== 'string') return null
  const text = value.trim().replace(/\s*(?:marks?|points?|pts?)$/i, '').trim()
  if (plainMaximum.test(text)) {
    const maximum = Number(text)
    return Number.isFinite(maximum) && maximum > 0 ? maximum : null
  }
  const fraction = text.match(fractionMaximum) || text.match(outOfMaximum)
  if (!fraction) return null
  const maximum = Number(fraction[2])
  const awarded = fraction[1] === undefined ? 0 : Number(fraction[1])
  return Number.isFinite(maximum) && maximum > 0 && Number.isFinite(awarded) && awarded <= maximum ? maximum : null
}

function isMarksHeader(value) {
  const text = (value || '').replace(/\s+/g, ' ').trim().replace(/:$/, '')
  return /^(?:(?:max(?:imum)?\.?|total|available|allocated|possible)\s+)?(?:marks?|points?|pts?)$|^(?:marks?|points?)\s+(?:allocated|available|possible|maximum)$|^mark\s+allocation$|^max(?:imum)?\.?\s+score$/i.test(text)
}

export function isRubricSummaryRow(row) {
  const label = normalizeCategoryLabel(row.cells?.[0]?.textContent)
  return Boolean(row.closest('tfoot')) || /^(?:(?:grand|overall|sub)\s*)?total(?:\s+(?:marks?|points?|score|allocated|available))?:?$/.test(label)
}

export function getRubricCategoryMarks(root, categories = [], manualMap = {}) {
  const marks = new Map()
  const matched = new Set()
  const tables = root?.matches?.('table') ? [root] : Array.from(root?.querySelectorAll('table') || [])
  for (const table of tables) {
    const grid = getRubricTableGrid(table)
    const headers = grid.filter(({ row }) => isRubricHeaderRow(row))
    const width = Math.max(0, ...(headers.length ? headers : grid).map(({ cells }) => cells.length))
    if (width < 2) continue
    if (headers.length) {
      if (headers.some(({ cells }) => /%|percent|weight/i.test(cells[width - 1]?.textContent || ''))) continue
      const lastHeader = headers.at(-1).cells[width - 1]
      if (!lastHeader || lastHeader.colSpan !== 1 || !isMarksHeader(lastHeader.textContent)) continue
    }
    for (const { row, cells } of grid) {
      if (isRubricHeaderRow(row) || isRubricSummaryRow(row)) continue
      const category = resolveRubricCategory(cells[0]?.textContent, categories, manualMap)
      if (!category) continue
      if (matched.has(category.name)) {
        marks.delete(category.name)
        continue
      }
      matched.add(category.name)
      const lastCell = cells[width - 1]
      if (cells.length !== width || !lastCell || lastCell.colSpan !== 1 || lastCell.rowSpan !== 1) continue
      const maximum = parseRubricMaximum(lastCell.textContent)
      if (maximum !== null) marks.set(category.name, maximum)
    }
  }
  return marks
}

export function getAssessmentForMarking(assessment) {
  if (!assessment?.rubricHtml) return assessment
  const root = document.createElement('div')
  root.innerHTML = assessment.rubricHtml
  const maxima = getRubricCategoryMarks(root, assessment.categories || [], assessment.tableRowCategoryMap || {})
  return {
    ...assessment,
    categories: (assessment.categories || []).map(category => maxima.has(category.name)
      ? { ...category, allocatedMarks: maxima.get(category.name) }
      : category)
  }
}
