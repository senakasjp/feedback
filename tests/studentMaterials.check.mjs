// Checks the student report auto-load contract: folder candidates, decoding, MIME types,
// the browser fallback, and the wiring in App.svelte.
// Run with: node tests/studentMaterials.check.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const {
  buildStudentMaterialCandidates,
  base64ToBytes,
  getStudentMaterialMimeType,
  readStudentMaterialReport,
  buildStudentScriptFolderPath,
  getStudentMaterialsRoot,
  STUDENT_MATERIALS_FOLDER,
  STUDENT_MATERIAL_EXTENSIONS
} = await import('../src/services/studentMaterialsService.js')

// 1. The folder name is the location the owner chose.
assert.equal(STUDENT_MATERIALS_FOLDER, '~/Documents/senaka-marking-materials')
assert.deepEqual(STUDENT_MATERIAL_EXTENSIONS, ['docx', 'pdf', 'txt', 'md', 'pptx'])

// 2. Visible student ID first, then internal id, then name. No duplicates, no path escapes.
const student = { studentId: 'QA-001', id: 'internal-uuid', name: 'Ankeet Patel' }
assert.deepEqual(buildStudentMaterialCandidates(student), ['QA-001', 'internal-uuid', 'Ankeet Patel'])
assert.deepEqual(buildStudentMaterialCandidates({ studentId: 'QA-001', id: 'QA-001', name: '' }), ['QA-001'])
assert.deepEqual(buildStudentMaterialCandidates({ studentId: '../etc', id: 'a/b', name: '..' }), [])
assert.deepEqual(buildStudentMaterialCandidates(null), [])
assert.deepEqual(buildStudentMaterialCandidates({ studentId: '  QA-002  ' }), ['QA-002'])

// 3. Base64 decoding round-trips the bytes Rust sends.
const source = new TextEncoder().encode('Report body: 7.95/10')
const base64 = Buffer.from(source).toString('base64')
assert.deepEqual(Array.from(base64ToBytes(base64)), Array.from(source))
assert.equal(base64ToBytes('').length, 0)

// 4. MIME types match what the extractors expect.
assert.equal(getStudentMaterialMimeType('DOCX'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
assert.equal(getStudentMaterialMimeType('pdf'), 'application/pdf')
assert.equal(getStudentMaterialMimeType('pptx'), 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
assert.equal(getStudentMaterialMimeType('md'), 'text/markdown')
assert.equal(getStudentMaterialMimeType('txt'), 'text/plain')
assert.equal(getStudentMaterialMimeType('png'), 'application/octet-stream')

// 5. The browser cannot read the Documents folder, so it must return null, never throw.
assert.equal(await readStudentMaterialReport(student), null)

// 6. The visible script folder path names the student's own folder.
assert.equal(
  buildStudentScriptFolderPath(student),
  '~/Documents/senaka-marking-materials/QA-001/'
)
assert.equal(
  buildStudentScriptFolderPath(student, '/Users/example/Documents/senaka-marking-materials/'),
  '/Users/example/Documents/senaka-marking-materials/QA-001/'
)
assert.equal(
  buildStudentScriptFolderPath(null),
  '~/Documents/senaka-marking-materials/<student id>/'
)

// 7. Outside the desktop app the root falls back to the readable path.
assert.equal(await getStudentMaterialsRoot(), '~/Documents/senaka-marking-materials')

// 8. App.svelte must show and copy the script folder for the selected student.
const appSource = await readFile(new URL('../src/App.svelte', import.meta.url), 'utf8')
assert.ok(appSource.includes('Script folder:'), 'the selected student must show the script folder')
assert.ok(appSource.includes('Copy path'), 'the script folder must be copyable')
assert.ok(appSource.includes('copyStudentScriptFolderPath'), 'the copy handler must be wired')
assert.ok(
  /await loadStudentEvaluation\(\)\s*\n\s*await loadStudentMaterialReport\(student\)/.test(appSource),
  'student selection must load the report after the saved evaluation'
)
assert.ok(appSource.includes('const cleanText = String(text || \'\').trim()'), 'extracted text must be trimmed')
assert.ok(appSource.includes('Nothing was replaced.'), 'existing typed text must never be overwritten silently')
assert.ok(appSource.includes('studentSubmissionText = cleanText'), 'the report must fill the submission box')

console.log('student material checks passed')
