const colorNames = [['green', 'dark green'], ['light green', 'lightgreen'], ['yellow'], ['orange'], ['red']]
const gradeFamilies = [
  [['excellent'], ['very good'], ['good'], ['satisfactory', 'adequate'], ['needs improvement', 'poor', 'unsatisfactory']],
  [['high distinction'], ['distinction'], ['credit'], ['pass'], ['fail']],
  [['exemplary'], ['accomplished'], ['proficient'], ['developing'], ['beginning']],
  [['outstanding'], ['excellent'], ['good'], ['satisfactory'], ['poor']],
  [['excellent'], ['good'], ['adequate'], ['weak'], ['fail']],
  [['excellent'], ['good'], ['satisfactory'], ['needs improvement', 'poor', 'unsatisfactory', 'fail']]
]
const knownNames = new Set([...colorNames.flat(), ...gradeFamilies.flat(2)])
const metadata = /\b(?:criteria|criterion|weight(?:ing|age)?|weighted|max(?:imum)?\s*marks?|score|learning\s*outcomes?|lo\s*\d*)\b/u
const number = '(?:\\d+(?:\\.\\d+)?)'
const rangePattern = new RegExp(`(>=|<=|>|<)\\s*(${number})\\s*(%)?|(${number})\\s*(%)?\\s*(?:-|to)\\s*(${number})\\s*(%)?`, 'u')

function normalize(text) {
  return String(text ?? '').toLowerCase().replace(/[–—−]/g, '-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/\s+/g, ' ').trim()
}

function cleanName(text) {
  return text.replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseHeading(header) {
  const text = normalize(header.text)
  const match = text.match(rangePattern)
  const remainder = match ? text.replace(match[0], '').replace(/[()[\]:]/g, '').replace(/^\s*-|\s*-\s*$/g, '').trim() : text
  const name = cleanName(remainder)
  const percentage = Boolean(match?.[3] || match?.[5] || match?.[7])
  const descriptivePercentage = percentage && /^[\p{L}\s'’]+$/u.test(name)
  if (!match || (name && !knownNames.has(name) && !descriptivePercentage)) return { index: header.index, name: cleanName(text), range: null }
  const comparison = match[1]
  const value = Number(match[2])
  const low = comparison ? (comparison.startsWith('>') ? value : -Infinity) : Number(match[4])
  const high = comparison ? (comparison.startsWith('<') ? value : Infinity) : Number(match[6])
  const invalid = low >= high || (percentage && ((Number.isFinite(low) && low > 100) || (Number.isFinite(high) && high > 100)))
  return {
    index: header.index,
    name,
    range: invalid ? null : { low, high, lowClosed: !comparison || comparison === '>=', highClosed: !comparison || comparison === '<=' }
  }
}

function namedMapping(entries, family, complete = false, positions = [1, 2, 3, 4, 5]) {
  const matched = entries.flatMap(entry => {
    const position = family.findIndex(names => names.includes(entry.name)) + 1
    return position ? [[positions[position - 1], entry.index]] : []
  })
  if (new Set(matched.map(([position]) => position)).size !== matched.length) return null
  return complete && matched.length !== family.length ? {} : Object.fromEntries(matched)
}

function rangeMapping(entries, bands, configured) {
  const sorted = entries.filter(entry => entry.range).sort((a, b) => b.range.low - a.range.low)
  if (sorted.length < 2 || !bands.length) return {}
  for (let index = 1; index < sorted.length; index += 1) {
    const higher = sorted[index - 1].range
    const lower = sorted[index].range
    if (lower.high > higher.low || (lower.high === higher.low && lower.highClosed && higher.lowClosed)) return {}
  }
  if (sorted.length === bands.length) return Object.fromEntries(sorted.map((entry, index) => [bands[index].position, entry.index]))
  if (!configured) return {}
  const exact = sorted.map(entry => {
    const matches = bands.filter(band => {
      const { low, high, highClosed } = entry.range
      const sameUpper = band.upper === high || (highClosed && Number.isInteger(high) && band.upper < 100 && band.upper === high + 1)
      return band.lower === low && sameUpper
    })
    return matches.length === 1 ? [matches[0].position, entry.index] : null
  })
  return exact.every(Boolean) ? Object.fromEntries(exact) : {}
}

function orderedBands(configuredBands) {
  if (!configuredBands) return [1, 2, 3, 4, 5].map(position => ({ position }))
  const valid = configuredBands.every(band => Number.isInteger(band.position) && band.position >= 1 && band.position <= 5 &&
    Number.isFinite(band.lower) && Number.isFinite(band.upper) && band.lower >= 0 && band.upper <= 100 && band.lower < band.upper)
  if (!valid || new Set(configuredBands.map(band => band.position)).size !== configuredBands.length) return []
  return [...configuredBands].sort((a, b) => b.upper - a.upper)
}

export function inferRubricBandColumns(headers = [], configuredBands) {
  const eligible = headers.filter(header => Number.isInteger(header.index) && header.index >= 0 && !metadata.test(normalize(header.text)))
  if (new Set(eligible.map(header => header.index)).size !== eligible.length) return {}
  const entries = eligible.map(parseHeading)
  const colors = namedMapping(entries, colorNames)
  if (!colors) return {}
  const bands = orderedBands(configuredBands)
  const gradeNames = new Set(gradeFamilies.flat(2))
  const grades = entries.filter(entry => gradeNames.has(entry.name))
  if (new Set(grades.map(entry => entry.name)).size !== grades.length) return colors
  const families = gradeFamilies.filter(family => family.length === grades.length).map(family => {
    const positions = family.length === bands.length ? bands.map(band => band.position) : family.length === 4 ? [1, 2, 3, 5] : [1, 2, 3, 4, 5]
    return namedMapping(entries, family, true, positions)
  })
  const complete = families.filter(mapping => mapping && Object.keys(mapping).length)
  const ranges = rangeMapping(entries, bands, Boolean(configuredBands))
  const sources = [...complete, ranges]
  if (!complete.length && !Object.keys(ranges).length) {
    const endpoints = namedMapping(entries, [['excellent'], [], [], [], ['needs improvement', 'poor', 'unsatisfactory']])
    if (!endpoints) return colors
    const basicNames = new Set(gradeFamilies[0].flat())
    const alternateNames = new Set(gradeFamilies.slice(1).flat(2).filter(name => !basicNames.has(name)))
    if (!entries.some(entry => alternateNames.has(entry.name))) sources.push(endpoints)
  }
  const mapping = {}
  for (const source of sources) {
    for (const [position, index] of Object.entries(source)) {
      if (Object.hasOwn(colors, position) || Object.values(colors).includes(index)) continue
      if (Object.hasOwn(mapping, position) && mapping[position] !== index) return colors
      if (Object.entries(mapping).some(([other, column]) => other !== position && column === index)) return colors
      mapping[position] = index
    }
  }
  return { ...mapping, ...colors }
}

export function resolveRubricBandColumns(headers = [], manualMap = {}, configuredBands) {
  const mapping = inferRubricBandColumns(headers, configuredBands)
  const available = new Set(headers.map(header => header.index))
  for (let position = 1; position <= 5; position += 1) {
    if (!Object.hasOwn(manualMap ?? {}, position) || manualMap[position] === undefined) continue
    delete mapping[position]
    const value = manualMap[position]
    if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') continue
    const index = Number(value)
    if (Number.isInteger(index) && index > 0 && available.has(index)) mapping[position] = index
  }
  return mapping
}
