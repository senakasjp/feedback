/**
 * Report guardrail for "Print to Download".
 *
 * A feedback report goes to a student. It must read as the assessor's written
 * feedback, not as a working note. Wording such as "Assessor should check this"
 * or "Instructor should check other before deciding" is an instruction to the
 * marker that leaked into the paragraph, and it makes the report look generated
 * rather than written. The same is true of a note about the grading process, such
 * as "No assessor comments or saved rationale were provided". A misspelling or a
 * grammar slip is caught as well, because a report with "recieve" or "alot" reads
 * as unfinished. This module scans the selected report paragraphs and reports the
 * paragraph number, its category and the words that failed.
 */

import { findGrammarIssues, findSpellingIssues } from './reportLanguage.js'

const REVIEWER = '(?:assessor|instructor|lecturer|teacher|marker|tutor|grader|moderator|reviewer|examiner)'

export const REPORT_GUARDRAIL_RULES = Object.freeze([
  {
    id: 'reviewer-instruction',
    label: 'Instruction to the assessor',
    pattern: new RegExp(
      `\\b${REVIEWER}\\b[^.!?\\n]{0,80}?\\b(?:should|must|needs? to|has to|is required to|may wish to|might want to|please)\\b[^.!?\\n]{0,60}?\\b(?:check|verify|review|confirm|decide|determine|ensure|revisit|double-check|inspect|look at)\\b`,
      'i'
    )
  },
  {
    id: 'reviewer-task',
    label: 'Unfinished task left for the assessor',
    pattern: new RegExp(
      `\\b${REVIEWER}\\b\\s*(?::\\s*)?(?:please\\s+)?(?:to\\s+)?(?:check|verify|review|confirm|decide|determine|revisit|update|adjust|finalise|finalize|complete)\\b`,
      'i'
    )
  },
  {
    id: 'check-before-sending',
    label: 'Check-this-before instruction',
    pattern:
      /\b(?:check|verify|review|confirm|double-check)\s+(?:this|these|it|them|the\s+(?:above|mark|marks|result|results))\b[^.!?\n]{0,40}\bbefore\b/i
  },
  {
    id: 'note-to-reviewer',
    label: 'Note addressed to the assessor',
    pattern: new RegExp(`\\bnote\\s+(?:to|for)\\s+(?:the\\s+)?${REVIEWER}\\b`, 'i')
  },
  {
    id: 'placeholder',
    label: 'Unfilled placeholder',
    pattern:
      /(?:\b(?:TODO|TBD|FIXME|PLACEHOLDER)\b|\{\{[^}\n]*\}\}|\[(?:insert|add|todo|tbd|placeholder|note|assessor|instructor)[^\]\n]*\]|\((?:insert|todo|note to)[^)\n]*\))/i
  },
  {
    id: 'missing-assessor-input',
    label: 'Comment about missing assessor input',
    pattern: new RegExp(
      `\\b(?:no|none|without|absence of)\\b[^.!?\\n]{0,100}?\\b(?:${REVIEWER}\\s+(?:comments?|feedback|notes?|marks?|rationale|judg(?:e)?ment)|allocated\\s+marks?|saved\\s+rationale|rubric|grading\\s+decision|marking\\s+decision)\\b[^.!?\\n]{0,80}?\\b(?:were|was|is|are|been|being)?\\s*(?:provided|supplied|given|available|included|recorded|saved|submitted)\\b`,
      'i'
    )
  },
  {
    id: 'grading-process-note',
    label: 'Note about the grading process',
    pattern:
      /\b(?:grading|marking)\s+decision\b|\b(?:submission|answer|work|report)\s+(?:cannot|can't|could not|couldn't)\s+be\s+(?:graded|marked|scored)\b/i
  },
  {
    id: 'ai-self-reference',
    label: 'AI self-reference',
    pattern:
      /\b(?:as an AI\b|I(?:'m| am) an AI\b|as a (?:large )?language model\b|I (?:cannot|can't|do not|don't) (?:access|see|view|read|open|verify)\b|I (?:cannot|can't) assist\b)/i
  },
  {
    id: 'prompt-leak',
    label: 'Prompt or chat wording',
    pattern:
      /\b(?:here(?:'s| is) (?:the|your|a) (?:feedback|report|summary|response)\b|let me know if\b|feel free to (?:ask|adjust|change|modify|let me know)\b|I hope (?:this|that) helps\b|if you (?:need|want) (?:any )?(?:further|more) (?:help|assistance|changes|adjustments)\b)/i
  }
])

const NAMED_ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'"
}

/**
 * Turns paragraph HTML into the plain text a student would read in the PDF, so a
 * phrase split by markup is still found and the excerpt is readable.
 */
export function stripHtmlForReport(value) {
  let text = String(value ?? '')
  if (!text) return ''
  text = text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(?:p|div|li|h[1-6]|tr|td|th|blockquote)>/gi, ' $& ')
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const container = document.createElement('div')
    container.innerHTML = text
    text = container.textContent || container.innerText || ''
  } else {
    text = text.replace(/<[^>]+>/g, ' ')
  }
  text = text.replace(/&(?:nbsp|amp|lt|gt|quot|apos);|&#39;/gi, entity => NAMED_ENTITIES[entity.toLowerCase()] ?? entity)
  return text.replace(/\s+/g, ' ').trim()
}

function buildExcerpt(text, index, length, radius = 70) {
  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + length + radius)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return `${prefix}${text.slice(start, end).trim()}${suffix}`
}

/**
 * Loads the bundled British English dictionary once. A missing dictionary only
 * turns the spelling check off; the wording checks still run.
 *
 * @returns {Promise<{correct: (word: string) => boolean, suggest: (word: string) => string[]} | null>}
 */
let spellCheckerPromise = null
export function loadSpellChecker() {
  if (!spellCheckerPromise) {
    spellCheckerPromise = (async () => {
      try {
        const [{ default: nspell }] = await Promise.all([import('nspell')])
        const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
        const [affResponse, dicResponse] = await Promise.all([
          fetch(`${base}dictionary-en-gb/index.aff`),
          fetch(`${base}dictionary-en-gb/index.dic`)
        ])
        if (!affResponse.ok || !dicResponse.ok) {
          throw new Error(`dictionary request failed (${affResponse.status}/${dicResponse.status})`)
        }
        const [aff, dic] = await Promise.all([affResponse.text(), dicResponse.text()])
        return nspell(aff, dic)
      } catch (error) {
        console.warn('Report guardrail: spelling check unavailable.', error)
        return null
      }
    })()
  }
  return spellCheckerPromise
}

function hashText(value) {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0
  }
  return (hash >>> 0).toString(36)
}

/**
 * Scans the paragraphs that will be printed in the report.
 *
 * @param {Array<{id?: string, category?: string, text?: string}>} paragraphs
 *   Paragraphs in report order, exactly as they will appear in the PDF.
 * @param {{ spell?: any, allowedWords?: string[], skipKeys?: Iterable<string>, scope?: string }} [options]
 *   `spell` overrides the dictionary (a test passes one, `null` turns spelling off).
 *   `allowedWords` are names, subject, assessment and category words to leave alone.
 *   `skipKeys` are findings the user chose to skip. `scope` keeps a skip with one
 *   student and assessment, and the key includes the text, so an edit checks again.
 * @returns {Promise<{ blocked: boolean, findings: Array<{key: string, paragraphNumber: number, paragraphId: string|null, category: string, ruleId: string, label: string, match: string, excerpt: string}>, skippedFindings: Array<object> }>}
 */
export async function findReportGuardrailIssues(paragraphs = [], options = {}) {
  const findings = []
  const skippedFindings = []
  const list = Array.isArray(paragraphs) ? paragraphs : []
  const allowedWords = Array.isArray(options.allowedWords) ? options.allowedWords : []
  const skipKeys = new Set(options.skipKeys || [])
  const scope = String(options.scope || '')
  const spell = options.spell === undefined ? await loadSpellChecker() : options.spell

  list.forEach((paragraph, index) => {
    const text = stripHtmlForReport(paragraph?.text)
    if (!text) return
    const issues = []
    for (const rule of REPORT_GUARDRAIL_RULES) {
      const match = rule.pattern.exec(text)
      if (match) {
        issues.push({ ruleId: rule.id, label: rule.label, match: match[0].trim(), index: match.index })
      }
    }
    issues.push(...findGrammarIssues(text))
    if (spell) {
      // A spelling suggestion adds nothing when a grammar rule already names the
      // same word, for example "alot" or "dont". A lowercase sentence start is kept,
      // because the misspelt word there still needs its suggestion.
      const blockedIndexes = new Set(
        issues.filter(issue => issue.ruleId !== 'sentence-start-case').map(issue => issue.index)
      )
      for (const issue of findSpellingIssues(text, spell, allowedWords)) {
        if (!blockedIndexes.has(issue.index)) issues.push(issue)
      }
    }
    if (issues.length === 0) return

    issues.sort((left, right) => left.index - right.index)
    const first = issues[0]
    const labels = [...new Set(issues.map(issue => issue.label))]
    const matches = issues.map(issue => issue.match).filter(Boolean)
    const matchText = matches.join(' / ')
    const key = `${scope}::${paragraph?.id ?? `p${index}`}::${hashText(text)}`

    const finding = {
      key,
      paragraphNumber: index + 1,
      paragraphId: paragraph?.id ?? null,
      category: String(paragraph?.category || '').trim(),
      ruleId: first.ruleId,
      label: labels.join('; '),
      match: matchText.length > 300 ? `${matchText.slice(0, 297)}…` : matchText,
      excerpt: buildExcerpt(text, first.index, Math.max(1, Math.min(first.match.length, 80)))
    }

    if (skipKeys.has(key)) {
      skippedFindings.push(finding)
      return
    }
    findings.push(finding)
  })

  return { blocked: findings.length > 0, findings, skippedFindings }
}

/**
 * A plain sentence for a log line or a notification.
 */
export function describeGuardrailBlock(findings = []) {
  const paragraphNumbers = [...new Set(findings.map(finding => finding.paragraphNumber))]
  if (paragraphNumbers.length === 0) return ''
  const single = paragraphNumbers.length === 1
  const label = single ? 'paragraph' : 'paragraphs'
  const verb = single ? 'contains' : 'contain'
  return `Download blocked: ${label} ${paragraphNumbers.join(', ')} ${verb} wording that cannot go in a student report. Fix the highlighted text and try again.`
}
