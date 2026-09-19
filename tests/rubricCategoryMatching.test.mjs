import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeCategoryLabel, resolveRubricCategory } from '../src/utils/rubricCategoryMatching.js'

const categories = [
  { id: 'analysis', name: 'Problem relevance and context definition (LO1)' },
  { id: 'design', name: 'System design and architecture (LO1, LO3)' }
]

test('preserves the normalization used by existing saved mapping keys', () => {
  assert.equal(normalizeCategoryLabel('  1.1\u00a0Problem   relevance (LO1)  '), '1.1 problem relevance')
  assert.equal(normalizeCategoryLabel(null), '')
})

test('resolves full category labels regardless of case and whitespace', () => {
  assert.equal(resolveRubricCategory('  SYSTEM  DESIGN AND ARCHITECTURE (LO1, LO3) ', categories), categories[1])
})

test('resolves a unique category after ignoring parenthetical learning outcomes', () => {
  assert.equal(resolveRubricCategory('Problem relevance and context definition', categories), categories[0])
})

test('resolves numbered rubric rows to uniquely named categories', () => {
  for (const prefix of ['1.1 ', '2. ', '1) ', '3 ']) {
    assert.equal(resolveRubricCategory(`${prefix}Problem relevance and context definition (LO1)`, categories), categories[0])
  }
  const numberedCategory = { name: '2.3 Data strategy and feasibility (LO3)' }
  assert.equal(resolveRubricCategory('Data strategy and feasibility', [numberedCategory]), numberedCategory)
})

test('manual mappings take priority and return the original category object', () => {
  const label = '1.1 Problem relevance and context definition (LO1)'
  const mapping = { [normalizeCategoryLabel(label)]: categories[1].name }
  assert.equal(resolveRubricCategory(label, categories, mapping), categories[1])
})

test('stale manual mappings stay unresolved instead of silently changing category', () => {
  const label = categories[0].name
  assert.equal(resolveRubricCategory(label, categories, { [normalizeCategoryLabel(label)]: 'Removed category' }), null)
})

test('full labels distinguish categories with different learning outcomes', () => {
  const similar = [{ name: 'Analysis (LO1)' }, { name: 'Analysis (LO2)' }]
  assert.equal(resolveRubricCategory('Analysis (LO2)', similar), similar[1])
  assert.equal(resolveRubricCategory('Analysis', similar), null)
})

test('ambiguous full, normalized, numbered and manual matches remain unresolved', () => {
  assert.equal(resolveRubricCategory('Analysis', [{ name: 'Analysis' }, { name: 'Analysis' }]), null)
  assert.equal(resolveRubricCategory('Analysis (LO3)', [{ name: 'Analysis (LO1)' }, { name: 'Analysis (LO2)' }]), null)
  assert.equal(resolveRubricCategory('3. Analysis', [{ name: '1. Analysis' }, { name: '2. Analysis' }]), null)
  assert.equal(resolveRubricCategory('A row', [{ name: 'Analysis' }, { name: 'Analysis' }], { 'a row': 'Analysis' }), null)
})

test('does not infer unrelated, partial, empty or numbering-only matches', () => {
  for (const label of ['', '   ', 'Problem relevance', 'Entirely different', '1.1', '1.1 (LO1)', 'Criterion / Sub-criterion (LO Link)']) {
    assert.equal(resolveRubricCategory(label, categories), null)
  }
  assert.equal(resolveRubricCategory('1.1', [{ name: '2.1' }]), null)
  assert.equal(resolveRubricCategory('1.1 2.2', [{ name: '3.1 2.2' }]), null)
  assert.equal(resolveRubricCategory('Any label', []), null)
})

test('matching does not mutate category names or saved manual mappings', () => {
  const mapping = { 'custom label': categories[0].name }
  const before = structuredClone({ categories, mapping })
  resolveRubricCategory('Custom label', categories, mapping)
  resolveRubricCategory('1.1 Problem relevance and context definition', categories, mapping)
  assert.deepEqual({ categories, mapping }, before)
})

test('does not auto-match a row to a category with conflicting learning outcomes', () => {
  const existing = [{ name: 'Evaluation (LO1)' }]
  assert.equal(resolveRubricCategory('Evaluation (LO2)', existing), null)
  assert.equal(resolveRubricCategory('1.1 Evaluation (LO2)', existing), null)
  assert.equal(resolveRubricCategory('Evaluation (LO2)', existing, { evaluation: 'Evaluation (LO1)' }), existing[0])
})
