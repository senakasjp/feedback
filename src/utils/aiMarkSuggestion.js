import { validateCategoryMark } from './markingRules.js'

export function extractMarkSuggestion(text, maximum) {
  const source = String(text || '')
  const match = source.match(/\n{0,2}\s*Marks?\s*:\s*(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)\s*\.?\s*$/i)
  if (!match) return null
  const denominator = Number(match[2])
  if (!Number.isFinite(maximum) || maximum <= 0 || denominator !== maximum) {
    throw new Error(`AI mark denominator must match the category maximum (${maximum ?? 'not configured'}). No mark was applied.`)
  }
  const result = validateCategoryMark(Number(match[1]), maximum)
  if (!result.valid) throw new Error(`${result.error} No AI mark was applied.`)
  return { awarded: result.value, strippedText: source.slice(0, match.index).trim() }
}
