// Loads the `senaka-marking-*` skills from `~/.agents/skills` so the same rules the
// agent follows are sent to the model with every marking and feedback prompt.
//
// The app never writes to the skills folder. Discovery happens in Rust
// (`list_marking_skills`) because the webview cannot read the home directory.

import { invoke } from '@tauri-apps/api/core'

export const MARKING_SKILL_PREFIX = 'senaka-marking-'
export const MARKING_SKILLS_FOLDER = '~/.agents/skills'

function normaliseNewlines(value) {
  return String(value || '').replace(/\r\n?/g, '\n')
}

function unquote(value) {
  return String(value || '').trim().replace(/^["']/, '').replace(/["']$/, '').trim()
}

/**
 * Splits a SKILL.md into its YAML front matter and body.
 * @param {string} raw
 * @returns {{ front: string, content: string }}
 */
export function splitMarkingSkillFrontMatter(raw) {
  const text = normaliseNewlines(raw)
  const lines = text.split('\n')

  if (lines.length === 0 || lines[0].trim() !== '---') {
    return { front: '', content: text.trim() }
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
  if (closingIndex === -1) {
    return { front: '', content: text.trim() }
  }

  const front = lines.slice(1, closingIndex).join('\n')
  const content = lines.slice(closingIndex + 1).join('\n').trim()

  if (!content) {
    return { front: '', content: text.trim() }
  }

  return { front, content }
}

/**
 * Reads one `name:` or `description:` style field, including `>` and `|` blocks.
 * @param {string} front
 * @param {string} key
 * @returns {string}
 */
export function readMarkingSkillField(front, key) {
  const prefix = `${key}:`
  const lines = normaliseNewlines(front).split('\n')
  let value = ''
  let joiner = ' '
  let collecting = false

  for (const line of lines) {
    if (line.startsWith(prefix)) {
      const rest = line.slice(prefix.length).trim()
      if (['>', '|', '>-', '|-'].includes(rest)) {
        value = ''
        joiner = rest.startsWith('>') ? ' ' : '\n'
        collecting = true
        continue
      }
      value = unquote(rest)
      collecting = false
      continue
    }

    if (collecting && /^[ \t]/.test(line)) {
      const extra = line.trim()
      if (extra) {
        value = value ? `${value}${joiner}${extra}` : extra
      }
      continue
    }

    if (collecting && line.trim()) {
      collecting = false
    }
  }

  return value.trim()
}

/**
 * Turns a SKILL.md file into a marking skill record.
 * @param {string} raw
 * @param {string} id Folder name, e.g. `senaka-marking-rubric-bands`.
 * @returns {{ id: string, name: string, description: string, content: string, characters: number }}
 */
export function parseMarkingSkillDocument(raw, id) {
  const folderId = String(id || '').trim()
  const { front, content } = splitMarkingSkillFrontMatter(raw)
  const name = readMarkingSkillField(front, 'name') || folderId
  const description = readMarkingSkillField(front, 'description')

  return {
    id: folderId,
    name,
    description,
    content,
    characters: Array.from(content).length
  }
}

export function isMarkingSkillId(value) {
  return String(value || '').startsWith(MARKING_SKILL_PREFIX)
}

function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__)
}

/**
 * Finds every `senaka-marking-*` skill that has a SKILL.md.
 * @returns {Promise<{ root: string, skills: Array<{ id: string, name: string, description: string, content: string, characters: number, path?: string }>, available: boolean, error: string }>}
 */
export async function listMarkingSkills() {
  if (!isTauriRuntime()) {
    return { root: MARKING_SKILLS_FOLDER, skills: [], available: false, error: '' }
  }

  try {
    const listing = await invoke('list_marking_skills')
    const skills = Array.isArray(listing?.skills) ? listing.skills : []

    return {
      root: listing?.root || MARKING_SKILLS_FOLDER,
      skills: skills
        .filter(skill => isMarkingSkillId(skill?.id))
        .map(skill => ({
          id: skill.id,
          name: skill.name || skill.id,
          description: skill.description || '',
          content: skill.content || '',
          characters: Number(skill.characters) || Array.from(String(skill.content || '')).length,
          path: skill.path || ''
        }))
        .filter(skill => skill.content.trim()),
      available: true,
      error: ''
    }
  } catch (error) {
    return {
      root: MARKING_SKILLS_FOLDER,
      skills: [],
      available: false,
      error: error?.message || String(error)
    }
  }
}

/**
 * Builds the system messages that carry the selected skills into a marking prompt.
 * Skill text is kept verbatim so rules, examples and tables survive intact.
 * @param {Array<{ id?: string, name?: string, description?: string, content?: string }>} skills
 * @returns {Array<{ role: 'system', content: string }>}
 */
export function buildMarkingSkillMessages(skills = []) {
  const list = Array.isArray(skills) ? skills : []

  return list
    .filter(skill => skill && String(skill.content || '').trim())
    .map(skill => ({
      role: 'system',
      content: [
        `Marking skill: ${skill.name || skill.id || 'Untitled skill'}`,
        skill.description ? `Purpose: ${skill.description}` : '',
        'Apply this skill to every mark, judgement and piece of feedback in this task.',
        'It sets how you mark. It does not override the rubric, the allocated mark, or the assessor comments marked as authoritative.',
        '',
        String(skill.content).trim()
      ].filter(Boolean).join('\n')
    }))
}
