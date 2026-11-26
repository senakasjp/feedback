/**
 * Spelling and grammar checks for the "Print to Download" report guardrail.
 *
 * A student report is read by a student. A misspelling, a missing apostrophe or a
 * broken sentence makes written feedback look careless, so the same paragraphs
 * that are about to be printed are checked here.
 *
 * The spelling check runs on the bundled British English dictionary
 * (`public/dictionary-en-gb`, from `dictionary-en-gb` and `nspell`), so no text
 * leaves the machine. It is deliberately forgiving:
 * - words of one or two letters are ignored
 * - acronyms such as `API` or `AWS` are ignored
 * - an unknown word that is capitalised inside a sentence is treated as a name
 * - accepted American variants such as "organize" or "center" are allowed
 * - names, subject, assessment and category words passed in `allowedWords` are allowed
 */

const ACCEPTED_WORDS = new Set([
  // British / New Zealand and Māori words the dictionary does not carry
  'aotearoa', 'marae', 'pākehā', 'pakeha', 'whānau', 'whanau', 'hapū', 'hapu',
  'iwi', 'kaupapa', 'kōrero', 'korero', 'mihi', 'pasifika', 'tamariki',
  'te', 'reo', 'wānanga', 'wananga', 'whakapapa', 'maori', 'māori',
  // Everyday hyphenated or closed compounds the British dictionary leaves out.
  // The hyphen is split before checking, so "zig" and "zag" are needed as well.
  'zig', 'zag', 'zags', 'zagging', 'zig-zag', 'zig-zags', 'zigzag', 'zigzags',
  'zigzagging', 'zig-zagging',
  'tick', 'tock', 'tick-tock', 'ticktock', 'ping', 'pong', 'ping-pong',
  'pingpong', 'flip-flop', 'flipflop',
  // Systems and tools used in marking
  'moodle', 'canvas', 'panopto', 'echo360', 'turnitin', 'teams', 'outlook',
  'sharepoint', 'onedrive', 'github', 'gitlab', 'bitbucket', 'jira',
  'confluence', 'slack', 'discord', 'figma', 'trello', 'notion', 'chatgpt',
  'openai', 'anthropic', 'claude', 'copilot', 'microsoft', 'google',
  // Lower-case technical vocabulary
  'api', 'apis', 'sdk', 'cli', 'gui', 'ui', 'ux', 'url', 'urls', 'json',
  'yaml', 'csv', 'html', 'css', 'javascript', 'typescript', 'python', 'npm',
  'pip', 'git', 'repo', 'repos', 'backend', 'frontend', 'fullstack', 'devops',
  'saas', 'iaas', 'paas', 'oauth', 'jwt', 'sql', 'nosql', 'mysql', 'postgres',
  'postgresql', 'mongodb', 'redis', 'docker', 'kubernetes', 'terraform',
  'ansible', 'jenkins', 'nginx', 'apache', 'aws', 'azure', 'gcp', 'firebase',
  'supabase', 'lambda', 'serverless', 'containerisation', 'containerization',
  'virtualisation', 'virtualization', 'cybersecurity', 'microservices',
  'onboarding', 'scalability', 'uptime', 'downtime', 'endpoint', 'endpoints',
  'middleware', 'runtime', 'refactor', 'refactoring', 'deploy', 'deployed',
  'deployment', 'deployments', 'config', 'configs', 'dataset', 'datasets',
  'workflow', 'workflows', 'wireframe', 'wireframes', 'mockup', 'mockups',
  'localhost', 'npm', 'nodejs', 'macos', 'ios', 'linux', 'ubuntu', 'debian',
  'centos', 'wordpress', 'shopify', 'stripe', 'paypal', 'xero', 'linkedin'
])

const REPEATED_WORD_EXCEPTIONS = new Set(['had', 'that'])

// A capitalised word at the start of a sentence is normally a name, so it is only
// reported when it appears in this list. This keeps "Smith (2024) argues ..." and
// "PowerPoint is ..." out of the report while still catching "Definately".
const COMMON_MISSPELLINGS = new Set([
  'accomodate', 'acheive', 'acknowledgement', 'adress', 'agressive', 'alot',
  'arguement', 'assessement', 'begining', 'beleive', 'briliant', 'calender',
  'carribean', 'comming', 'commitee', 'concensus', 'definately', 'dependancy',
  'descision', 'dissappear', 'enviroment', 'existance', 'experiance',
  'familar', 'fourty', 'freind', 'gaurd', 'goverment', 'grammer', 'harrass',
  'immediatly', 'independant', 'knowlege', 'liason', 'maintainance',
  'managment', 'neccessary', 'noticable', 'occassion', 'occured', 'occuring',
  'persue', 'posession', 'prefered', 'prevelant', 'publically', 'recieve',
  'recomend', 'refered', 'relevent', 'religous', 'remeber', 'responsability',
  'seperate', 'succesful', 'supercede', 'suprise', 'tommorow', 'truely',
  'untill', 'vacume', 'wierd', 'wich', 'writting', 'thier', 'teh', 'adn',
  'becuase', 'becasue', 'beleif', 'buisness', 'buisnesses', 'comittee',
  'competant', 'concious', 'dilemna', 'embarass', 'excersise', 'existance',
  'foriegn', 'goverment', 'happend', 'indispensible', 'liesure', 'mediteranean',
  'millenium', 'occassionally', 'paralel', 'peice', 'posession', 'priviledge',
  'questionaire', 'refrence', 'seperately', 'sieze', 'similiar', 'speach',
  'successfull', 'wether', 'withold'
])

const ARTICLE_A_EXCEPTIONS = new Set([
  'unique', 'uniquely', 'university', 'universities', 'user', 'users', 'use',
  'used', 'uses', 'using', 'useful', 'usual', 'usually', 'utility',
  'utilities', 'one', 'once', 'european', 'euro', 'euros', 'ubiquitous',
  'union', 'unit', 'units', 'uniform', 'universal', 'utopia', 'ewe',
  'eulogy', 'ukulele', 'urinal', 'uranium', 'usability', 'us', 'url', 'urls',
  'usb', 'ui', 'ux', 'uml', 'un', 'ups', 'usb-c'
])

const ARTICLE_AN_EXCEPTIONS = new Set([
  'hour', 'hours', 'honest', 'honestly', 'honour', 'honours', 'honourable',
  'heir', 'mba', 'msc', 'llb', 'sql', 'api', 'apis', 'html', 'xml', 'faq',
  'mri', 'fbi', 'mp3', 'mp4', 'eu', 'historic', 'historical', 'hotel', 'rpa'
])

const ABBREVIATION_BEFORE_PERIOD = /(?:^|[\s("'“‘])(?:e\.g|i\.e|etc|vs|mr|mrs|ms|dr|prof|fig|no|vol|ch|approx)\.\s*$/i

function isCompoundWord(word, spell) {
  const lower = word.toLowerCase()
  const candidates = [lower]
  if (lower.endsWith('s') && lower.length > 6) candidates.push(lower.slice(0, -1))
  for (const candidate of candidates) {
    for (let index = 3; index <= candidate.length - 3; index += 1) {
      if (spell.correct(candidate.slice(0, index)) && spell.correct(candidate.slice(index))) return true
    }
  }
  return false
}

/**
 * Words that are correct in American English but absent from the British
 * dictionary. They are allowed rather than reported, because the spelling is a
 * convention, not an error. A closed compound such as "rollout" is allowed when
 * both halves are real words.
 */
function isAcceptedVariant(word, spell) {
  const lower = word.toLowerCase()
  const candidates = []

  const add = (value) => {
    if (value && value !== lower) candidates.push(value)
  }

  add(lower.replace(/iz(e|es|ed|ing|er|ers|ation|ations|able|ables|ably|ability)$/, 'is$1'))
  add(lower.replace(/yz(e|es|ed|ing)$/, 'ys$1'))
  add(lower.replace(/(?:ter|ters|tered|tering)$/, match => match.replace('ter', 'tre')))
  add(lower.replace(/(?:or|ors|ored|oring)$/, match => match.replace('or', 'our')))
  add(lower.replace(/(?:ense|enses)$/, match => match.replace('ense', 'ence')))
  add(lower.replace(/eled$/, 'elled'))
  add(lower.replace(/eling$/, 'elling'))
  add(lower.replace(/^fulfill/, 'fulfil'))
  add(lower.replace(/^enroll/, 'enrol'))
  add(lower.replace(/^installment/, 'instalment'))
  add(lower.replace(/^skillful/, 'skilful'))
  add(lower.replace(/^aging$/, 'ageing'))
  add(lower.replace(/^gray/, 'grey'))

  return candidates.some(candidate => spell.correct(candidate)) || isCompoundWord(lower, spell)
}

function isSentenceStart(text, index) {
  const before = text.slice(0, index).replace(/[\s"'“”‘’([{]+$/, '')
  if (!before) return true
  if (/[.!?]$/.test(before)) return !ABBREVIATION_BEFORE_PERIOD.test(before)
  if (/[•*–—]$/.test(before)) return true
  return false
}

function collectProperNouns(text) {
  const names = new Set()
  const wordPattern = /[\p{L}][\p{L}'’]*/gu
  let match
  while ((match = wordPattern.exec(text)) !== null) {
    const word = match[0]
    if (word.length < 2) continue
    if (!/^[A-Z][a-z]/.test(word)) continue
    if (isSentenceStart(text, match.index)) continue
    names.add(word.toLowerCase())
  }
  return names
}

const MASKED_PATTERNS = [
  /https?:\/\/\S+/g,
  /www\.\S+/g,
  /\S+@\S+/g,
  /[~./\\][\w./\\~-]*\//g,
  /\b[\w-]+\.(?:docx?|pdf|pptx?|xlsx?|csv|txt|md|png|jpe?g|gif|svg|zip|mp4|mov|py|js|ts|html|css|json)\b/gi,
  /`[^`]*`/g
]

function maskUncheckable(text) {
  let masked = text
  for (const pattern of MASKED_PATTERNS) {
    masked = masked.replace(pattern, match => ' '.repeat(match.length))
  }
  return masked
}

function firstMeaningfulLength(word) {
  return word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').length
}

/**
 * @param {string} text
 * @param {{correct: (word: string) => boolean, suggest?: (word: string) => string[]}} spell
 * @param {Iterable<string>} [allowedWords]
 * @returns {Array<{ruleId: string, label: string, match: string, index: number}>}
 */
export function findSpellingIssues(text, spell, allowedWords = []) {
  if (!text || !spell || typeof spell.correct !== 'function') return []

  const allowed = new Set([
    ...ACCEPTED_WORDS,
    ...collectProperNouns(text),
    ...[...allowedWords].flatMap(value => String(value || '')
      .toLowerCase()
      .split(/[^a-zāēīōū'’-]+/i)
      .filter(Boolean))
  ])

  const masked = maskUncheckable(text)
  const issues = []
  const wordPattern = /[\p{L}][\p{L}'’]*/gu
  let match

  while ((match = wordPattern.exec(masked)) !== null) {
    const raw = match[0].replace(/['’]+$/, '')
    if (!raw || firstMeaningfulLength(raw) < 3) continue
    if (/^[A-Z]{2,}$/.test(raw)) continue

    const atStart = isSentenceStart(masked, match.index)
    const isCapitalised = /^[A-Z]/.test(raw)
    if (isCapitalised) {
      if (!atStart) continue
      if (!COMMON_MISSPELLINGS.has(raw.toLowerCase())) continue
    }

    const parts = raw.split(/[-–—]/).filter(part => part.length > 0)
    const base = parts.map(part => part.replace(/['’]s$/i, '')).join(' ')

    const words = base.split(' ')
    for (const word of words) {
      if (word.length < 3) continue
      const lower = word.toLowerCase()
      if (allowed.has(lower)) continue
      if (spell.correct(word)) continue
      if (isAcceptedVariant(word, spell)) continue
      const suggestion = typeof spell.suggest === 'function' ? (spell.suggest(word)[0] || '') : ''
      issues.push({
        ruleId: 'spelling',
        label: 'Spelling',
        match: suggestion ? `${word} → ${suggestion}` : word,
        index: match.index
      })
      break
    }
  }

  return issues
}

function findLowercasePronoun(text) {
  const pattern = /\bi\b/g
  let match
  while ((match = pattern.exec(text)) !== null) {
    if (/\.\s?e\./i.test(text.slice(match.index, match.index + 4))) continue
    return match
  }
  return null
}

function findArticleMisuse(text) {
  const pattern = /\b(a|an)\s+([A-Za-z][A-Za-z'-]*)/gi
  let match
  while ((match = pattern.exec(text)) !== null) {
    const article = match[1].toLowerCase()
    const word = match[2]
    const lower = word.toLowerCase()
    const startsWithVowelSound = /^[aeiou]/i.test(word)
    if (article === 'a' && startsWithVowelSound) {
      if (ARTICLE_A_EXCEPTIONS.has(lower)) continue
      return match
    }
    if (article === 'an' && !startsWithVowelSound) {
      if (ARTICLE_AN_EXCEPTIONS.has(lower)) continue
      return match
    }
  }
  return null
}

function findSentenceStartCase(text) {
  const masked = maskUncheckable(text)
  const pattern = /[\p{L}][\p{L}'’]*/gu
  let match
  while ((match = pattern.exec(masked)) !== null) {
    if (match[0].length === 1) continue
    // Brand names such as macOS, iOS or eBay keep an inner capital.
    if (/[A-Z]/.test(match[0].slice(1))) continue
    if (!isSentenceStart(masked, match.index)) continue
    if (!/^[a-z]/.test(match[0])) continue
    if (/^(?:e\.g|i\.e)\./i.test(masked.slice(match.index, match.index + 5))) continue
    return match
  }
  return null
}

const GRAMMAR_RULES = [
  {
    id: 'repeated-word',
    label: 'Grammar',
    find(text) {
      const pattern = /\b([A-Za-z]{2,})\s+\1\b/i
      const match = pattern.exec(text)
      if (!match) return null
      if (REPEATED_WORD_EXCEPTIONS.has(match[1].toLowerCase())) return null
      return match
    }
  },
  {
    id: 'of-have',
    label: 'Grammar',
    find: text => /\b(?:could|should|would|must|might|may)\s+of\b/i.exec(text)
  },
  {
    id: 'a-lot',
    label: 'Grammar',
    find: text => /\balot\b/i.exec(text)
  },
  {
    id: 'missing-apostrophe',
    label: 'Missing apostrophe',
    find: text => /\b(?:dont|cant|wont|isnt|arent|wasnt|werent|hasnt|havent|hadnt|couldnt|shouldnt|wouldnt|doesnt|didnt|mustnt)\b/i.exec(text)
  },
  {
    id: 'lowercase-pronoun',
    label: 'Grammar',
    find: findLowercasePronoun
  },
  {
    id: 'article-a-an',
    label: 'Grammar',
    find: findArticleMisuse
  },
  {
    id: 'sentence-start-case',
    label: 'Capital letter',
    find: findSentenceStartCase
  },
  {
    id: 'space-before-punctuation',
    label: 'Punctuation',
    find: text => /[^\s]\s+[,;:!?]/.exec(text)
  },
  {
    id: 'missing-space-after-punctuation',
    label: 'Punctuation',
    find: text => /[,;:][A-Za-z]/.exec(text)
  },
  {
    id: 'then-than',
    label: 'Grammar',
    find: text => /\b(?:more|less|better|worse|rather|other|greater|fewer|older|younger|bigger|smaller|faster|slower|cheaper|higher|lower)\s+then\b/i.exec(text)
  },
  {
    id: 'was-were',
    label: 'Grammar',
    find: text => /\b(?:they|we|you)\s+was\b/i.exec(text)
  },
  {
    id: 'dont-agreement',
    label: 'Grammar',
    find: text => /\b(?:he|she|it)\s+don['’]t\b/i.exec(text)
  },
  {
    id: 'your-youre',
    label: 'Grammar',
    find: text => /\byour\s+(?:the|a|an|welcome|going|doing)\b/i.exec(text)
  },
  {
    id: 'its-its',
    label: 'Grammar',
    find: text => /\bits\s+(?:a|an|the|been|not|clear|obvious|important|difficult|easy|possible|likely|true|wrong|correct)\b/i.exec(text)
  },
  {
    id: 'their-theyre',
    label: 'Grammar',
    find: text => /\btheir\s+(?:is|are|was|were|be)\b/i.exec(text)
  },
  {
    id: 'there-their',
    label: 'Grammar',
    find: text => /\bthere\s+(?:own)\b/i.exec(text)
  },
  {
    id: 'loose-lose',
    label: 'Grammar',
    find: text => /\b(?:will|would|could|may|might|to|don['’]t|doesn['’]t|didn['’]t)\s+loose\b/i.exec(text)
  }
]

/**
 * @param {string} text
 * @returns {Array<{ruleId: string, label: string, match: string, index: number}>}
 */
export function findGrammarIssues(text) {
  if (!text) return []
  const issues = []
  for (const rule of GRAMMAR_RULES) {
    const match = rule.find(text)
    if (!match) continue
    issues.push({
      ruleId: rule.id,
      label: rule.label,
      match: String(match[0] || '').replace(/\s+/g, ' ').trim(),
      index: match.index
    })
  }
  return issues
}
