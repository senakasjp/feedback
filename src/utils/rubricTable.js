import { normalizeCategoryLabel } from './rubricCategoryMatching.js'

export function isRubricHeaderRow(row) {
  const cells = Array.from(row.cells || [])
  if (!cells.length) return false
  if (row.closest('thead') || cells.every(cell => cell.tagName === 'TH')) return true
  const label = normalizeCategoryLabel(cells[0].textContent)
  return row.rowIndex === 0 && /^(?:criterion|criteria|category|assessment criteria|criterion\s*\/\s*sub[- ]criterion)$/.test(label)
}

export function getRubricTableGrid(table) {
  const rows = Array.from(table.rows)
  const grid = rows.map(row => ({ row, cells: [] }))
  rows.forEach((row, rowIndex) => {
    let column = 0
    for (const cell of row.cells) {
      while (grid[rowIndex].cells[column]) column++
      const rowEnd = Math.min(rows.length, rowIndex + Math.max(1, cell.rowSpan))
      for (let r = rowIndex; r < rowEnd; r++) {
        for (let c = column; c < column + cell.colSpan; c++) grid[r].cells[c] = cell
      }
      column += cell.colSpan
    }
  })
  return grid
}

export function getRubricColumnHeaders(table) {
  const grid = getRubricTableGrid(table)
  const headerRows = grid.filter(({ row }) => isRubricHeaderRow(row))
  const sourceRows = headerRows.length ? headerRows : grid.slice(0, 1)
  const columnCount = Math.max(0, ...sourceRows.map(({ cells }) => cells.length))
  const headers = []
  for (let index = 1; index < columnCount; index++) {
    const parts = sourceRows.map(({ cells }) => (cells[index]?.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    const text = parts.at(-1)
    if (text) headers.push({ index, text })
  }
  return headers
}
