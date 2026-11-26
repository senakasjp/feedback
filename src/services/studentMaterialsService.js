// Reads a student's report from `~/Documents/senaka-marking-materials/<student id>/`
// when the student is selected. The folder is owned by the assessor; the app only reads.
//
// Discovery happens in Rust (`read_student_material_report`) because the webview cannot
// read the Documents folder. Extraction reuses the same pipeline as a manual upload.

import { invoke } from '@tauri-apps/api/core'

export const STUDENT_MATERIALS_FOLDER = '~/Documents/senaka-marking-materials'
export const STUDENT_MATERIAL_EXTENSIONS = ['docx', 'pdf', 'txt', 'md', 'pptx']
export const MAX_STUDENT_MATERIAL_BYTES = 25 * 1024 * 1024

const MIME_TYPES = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv'
}

function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__)
}

export { isTauriRuntime }

function isSafeFolderName(value) {
  const name = String(value || '').trim()
  if (!name || name === '.' || name === '..') return false
  return !name.includes('/') && !name.includes('\\')
}

/**
 * Folder names to try, in order. The visible student ID wins over the internal one,
 * so a folder named after what the assessor sees is found first.
 * @param {{ studentId?: string, id?: string, name?: string }} student
 * @returns {string[]}
 */
export function buildStudentMaterialCandidates(student) {
  if (!student) return []

  const values = [student.studentId, student.id, student.name]
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
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function base64ToBytes(base64) {
  const binary = atob(String(base64 || ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function getStudentMaterialMimeType(extension = '') {
  return MIME_TYPES[String(extension || '').toLowerCase()] || 'application/octet-stream'
}

/**
 * Absolute or readable folder path for one student's script.
 * @param {{ studentId?: string, id?: string, name?: string }} student
 * @param {string} [root]
 * @returns {string}
 */
export function buildStudentScriptFolderPath(student, root = STUDENT_MATERIALS_FOLDER) {
  const [primary] = buildStudentMaterialCandidates(student)
  const base = String(root || STUDENT_MATERIALS_FOLDER).replace(/\/+$/, '')
  return `${base}/${primary || '<student id>'}/`
}

/**
 * Absolute materials folder, used for the visible path and the copy button.
 * Falls back to the readable `~/Documents/...` form outside the desktop app.
 * @returns {Promise<string>}
 */
export async function getStudentMaterialsRoot() {
  if (!isTauriRuntime()) return STUDENT_MATERIALS_FOLDER

  try {
    const root = await invoke('student_materials_dir')
    return typeof root === 'string' && root.trim() ? root : STUDENT_MATERIALS_FOLDER
  } catch {
    return STUDENT_MATERIALS_FOLDER
  }
}

/**
 * Returns the newest supported report for the student, or null when there is none.
 * @param {{ studentId?: string, id?: string, name?: string }} student
 * @returns {Promise<null | { name: string, path: string, extension: string, modifiedMs: number, size: number, file: File }>}
 */
export async function readStudentMaterialReport(student) {
  if (!isTauriRuntime()) return null

  const candidates = buildStudentMaterialCandidates(student)
  if (candidates.length === 0) return null

  const report = await invoke('read_student_material_report', { candidates })
  if (!report || !report.dataBase64) return null

  const bytes = base64ToBytes(report.dataBase64)
  if (bytes.length === 0) return null

  const extension = String(report.extension || '').toLowerCase()
  const file = new File([bytes], report.name || `report.${extension || 'txt'}`, {
    type: getStudentMaterialMimeType(extension)
  })

  return {
    name: file.name,
    path: report.path || '',
    extension,
    modifiedMs: Number(report.modifiedMs) || 0,
    size: bytes.length,
    file
  }
}
