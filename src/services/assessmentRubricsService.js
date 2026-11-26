// Reads an assessment's marking rubric from `~/Documents/senaka-marking-rubric/<assessment>/`
// when the assessment is opened, and attaches it as a Rubric reference document.
//
// The folder is owned by the assessor; the app only reads. Discovery happens in Rust
// (`read_assessment_rubric`) because the webview cannot read the Documents folder.

import { invoke } from '@tauri-apps/api/core'
import { base64ToBytes, getStudentMaterialMimeType, isTauriRuntime } from './studentMaterialsService.js'

export const ASSESSMENT_RUBRICS_FOLDER = '~/Documents/senaka-marking-rubric'
export const RUBRIC_EXTENSIONS = ['docx', 'pdf', 'txt', 'md', 'csv']
export const RUBRIC_DOCUMENT_TYPE = 'rubric'
export const RUBRIC_SOURCE_KIND = 'assessment-rubric-folder'

function isSafeFolderName(value) {
  const name = String(value || '').trim()
  if (!name || name === '.' || name === '..') return false
  return !name.includes('/') && !name.includes('\\')
}

/**
 * Folder names to try, in order: the assessment name shown in the app, then its id.
 * @param {{ name?: string, id?: string }} assessment
 * @returns {string[]}
 */
export function buildAssessmentRubricCandidates(assessment) {
  if (!assessment) return []

  const values = [assessment.name, assessment.id]
  const candidates = []

  for (const value of values) {
    const name = String(value || '').trim()
    if (isSafeFolderName(name) && !candidates.includes(name)) {
      candidates.push(name)
    }
  }

  return candidates
}

/**
 * Folder path for one assessment's rubric.
 * @param {{ name?: string, id?: string }} assessment
 * @param {string} [root]
 * @returns {string}
 */
export function buildAssessmentRubricFolderPath(assessment, root = ASSESSMENT_RUBRICS_FOLDER) {
  const [primary] = buildAssessmentRubricCandidates(assessment)
  const base = String(root || ASSESSMENT_RUBRICS_FOLDER).replace(/\/+$/, '')
  return `${base}/${primary || '<assessment>'}/`
}

/**
 * Absolute rubric folder, used for the visible path and the copy button.
 * @returns {Promise<string>}
 */
export async function getAssessmentRubricsRoot() {
  if (!isTauriRuntime()) return ASSESSMENT_RUBRICS_FOLDER

  try {
    const root = await invoke('assessment_rubrics_dir')
    return typeof root === 'string' && root.trim() ? root : ASSESSMENT_RUBRICS_FOLDER
  } catch {
    return ASSESSMENT_RUBRICS_FOLDER
  }
}

/**
 * Decides what to do with a rubric found on disk.
 * - A rubric uploaded by the assessor is never touched.
 * - The same folder file is not re-attached.
 * - A newer file in the folder replaces the previous folder copy.
 * @param {Array<{ id?: string, documentType?: string, sourceKind?: string, sourcePath?: string, sourceModifiedMs?: number }>} documents
 * @param {{ path?: string, modifiedMs?: number }} rubric
 * @returns {{ action: 'add' | 'replace' | 'skip-manual' | 'skip-unchanged', existing: object | null }}
 */
export function decideRubricAttachment(documents, rubric) {
  const list = Array.isArray(documents) ? documents : []
  const existing = list.find(document => document?.documentType === RUBRIC_DOCUMENT_TYPE) || null
  const isFolderCopy = existing?.sourceKind === RUBRIC_SOURCE_KIND

  if (existing && !isFolderCopy) {
    return { action: 'skip-manual', existing }
  }

  if (
    isFolderCopy
    && existing.sourcePath === rubric?.path
    && Number(existing.sourceModifiedMs) === Number(rubric?.modifiedMs)
  ) {
    return { action: 'skip-unchanged', existing }
  }

  return { action: existing ? 'replace' : 'add', existing }
}

/**
 * Returns the newest supported rubric for the assessment, or null when there is none.
 * @param {{ name?: string, id?: string }} assessment
 * @returns {Promise<null | { name: string, path: string, extension: string, modifiedMs: number, size: number, file: File }>}
 */
export async function readAssessmentRubric(assessment) {
  if (!isTauriRuntime()) return null

  const candidates = buildAssessmentRubricCandidates(assessment)
  if (candidates.length === 0) return null

  const rubric = await invoke('read_assessment_rubric', { candidates })
  if (!rubric || !rubric.dataBase64) return null

  const bytes = base64ToBytes(rubric.dataBase64)
  if (bytes.length === 0) return null

  const extension = String(rubric.extension || '').toLowerCase()
  const file = new File([bytes], rubric.name || `rubric.${extension || 'txt'}`, {
    type: getStudentMaterialMimeType(extension) || 'text/csv'
  })

  return {
    name: file.name,
    path: rubric.path || '',
    extension,
    modifiedMs: Number(rubric.modifiedMs) || 0,
    size: bytes.length,
    file
  }
}
