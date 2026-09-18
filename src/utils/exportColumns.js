// Helpers for hiding export columns in PDF/CSV outputs
export function normalizeColumnLabel(label = '') {
  if (!label) return '';

  return label
    .trim()
    .toLowerCase()
    .replace(/\(\s*\d+(\.\d+)?\s*%\s*\)/g, '(%)') // Normalize percentage placeholders
    .replace(/\s+/g, ' ');
}

export function buildHiddenColumnSet(input = '') {
  if (!input) {
    return new Set();
  }

  return new Set(
    input
      .split(',')
      .map(normalizeColumnLabel)
      .filter(Boolean)
  );
}

export function isColumnHidden(hiddenColumnsSet, ...candidates) {
  if (!hiddenColumnsSet || hiddenColumnsSet.size === 0) {
    return false;
  }

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (Array.isArray(candidate)) {
      for (const alias of candidate) {
        if (hiddenColumnsSet.has(normalizeColumnLabel(alias))) {
          return true;
        }
      }
    } else if (hiddenColumnsSet.has(normalizeColumnLabel(candidate))) {
      return true;
    }
  }

  return false;
}
