// Checks the assessment rubric auto-attach contract: folder candidates, decoding,
// the manual-rubric rule, the browser fallback and the App.svelte wiring.
// Run with: node tests/assessmentRubrics.check.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const {
  buildAssessmentRubricCandidates,
  buildAssessmentRubricFolderPath,
  decideRubricAttachment,
  getAssessmentRubricsRoot,
  readAssessmentRubric,
  ASSESSMENT_RUBRICS_FOLDER,
  RUBRIC_EXTENSIONS,
  RUBRIC_DOCUMENT_TYPE,
  RUBRIC_SOURCE_KIND
} = await import('../src/services/assessmentRubricsService.js')

// 1. Folder and supported types.
assert.equal(ASSESSMENT_RUBRICS_FOLDER, '~/Documents/senaka-marking-rubric')
assert.deepEqual(RUBRIC_EXTENSIONS, ['docx', 'pdf', 'txt', 'md', 'csv'])
assert.equal(RUBRIC_DOCUMENT_TYPE, 'rubric')
assert.equal(RUBRIC_SOURCE_KIND, 'assessment-rubric-folder')

// 2. Assessment name first, then id, no duplicates, no path escapes.
const assessment = { name: 'Research and Communication', id: 'assessment-1' }
assert.deepEqual(buildAssessmentRubricCandidates(assessment), ['Research and Communication', 'assessment-1'])
assert.deepEqual(buildAssessmentRubricCandidates({ name: 'Same', id: 'Same' }), ['Same'])
assert.deepEqual(buildAssessmentRubricCandidates({ name: '../etc', id: 'a/b' }), [])
assert.deepEqual(buildAssessmentRubricCandidates(null), [])
assert.deepEqual(buildAssessmentRubricCandidates({ name: '  Studio 5  ' }), ['Studio 5'])

// 3. The visible folder path names the assessment's own folder.
assert.equal(
  buildAssessmentRubricFolderPath(assessment),
  '~/Documents/senaka-marking-rubric/Research and Communication/'
)
assert.equal(
  buildAssessmentRubricFolderPath(assessment, '/Users/example/Documents/senaka-marking-rubric/'),
  '/Users/example/Documents/senaka-marking-rubric/Research and Communication/'
)
assert.equal(buildAssessmentRubricFolderPath(null), '~/Documents/senaka-marking-rubric/<assessment>/')

// 4. Outside the desktop app the root falls back to the readable path.
assert.equal(await getAssessmentRubricsRoot(), '~/Documents/senaka-marking-rubric')

// 5. The browser cannot read the Documents folder, so it must return null, never throw.
assert.equal(await readAssessmentRubric(assessment), null)
assert.equal(await readAssessmentRubric(null), null)

// 6. Attachment rules: add, skip a manual rubric, skip the same file, replace a newer one.
const folderDoc = { id: 'd1', documentType: 'rubric', sourceKind: RUBRIC_SOURCE_KIND, sourcePath: '/r/old.docx', sourceModifiedMs: 100 }
const manualDoc = { id: 'd2', documentType: 'rubric', name: 'manual.docx' }
const otherDoc = { id: 'd3', documentType: 'assignment-brief' }

assert.deepEqual(decideRubricAttachment([], { path: '/r/new.docx', modifiedMs: 200 }).action, 'add')
assert.deepEqual(decideRubricAttachment([otherDoc], { path: '/r/new.docx', modifiedMs: 200 }).action, 'add')
assert.deepEqual(decideRubricAttachment([manualDoc], { path: '/r/new.docx', modifiedMs: 200 }).action, 'skip-manual')
assert.deepEqual(decideRubricAttachment([folderDoc], { path: '/r/old.docx', modifiedMs: 100 }).action, 'skip-unchanged')
assert.deepEqual(decideRubricAttachment([folderDoc], { path: '/r/old.docx', modifiedMs: 300 }).action, 'replace')
assert.deepEqual(decideRubricAttachment([folderDoc], { path: '/r/newer.docx', modifiedMs: 300 }).action, 'replace')
assert.equal(decideRubricAttachment([folderDoc], { path: '/r/old.docx', modifiedMs: 100 }).existing.id, 'd1')

// 7. Wiring in App.svelte.
const appSource = await readFile(new URL('../src/App.svelte', import.meta.url), 'utf8')
assert.ok(appSource.includes('Rubric folder:'), 'Settings must show the rubric folder')
assert.ok(appSource.includes('copyAssessmentRubricFolderPath'), 'the rubric folder must be copyable')
assert.ok(
  /if \(currentAssessmentId === assessmentId\) \{\s*\n\s*await loadAssessmentRubricFromFolder\(\)/.test(appSource),
  'opening an assessment must load its rubric'
)
assert.ok(
  appSource.includes('const { action, existing: existingRubric } = decideRubricAttachment(documents, rubric)'),
  'the rubric attach rule must come from the tested helper'
)
assert.ok(
  appSource.includes("if (action === 'skip-manual') return"),
  'a manually uploaded rubric must never be replaced'
)
assert.ok(
  appSource.includes('documentType: RUBRIC_DOCUMENT_TYPE'),
  'the folder rubric must be attached as a Rubric document'
)
assert.ok(
  appSource.includes('updateAssessmentReferenceDocuments(nextDocuments)'),
  'attaching the rubric must invalidate the RAG index'
)

console.log('assessment rubric checks passed')
