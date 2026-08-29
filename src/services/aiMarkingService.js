import { DEFAULT_AI_CHAT_MODEL, DEFAULT_AI_REASONING_EFFORT, getProviderForModel, sanitizeAiChatModel, sanitizeReasoningEffort } from './aiModelService.js'
import { callChatCompletion, getEffectiveApiKey } from './llmProviders.js'

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings'
const EMBEDDING_MODEL = 'text-embedding-3-small'
const MAX_RETRIEVED_CHUNKS = 8
const VECTOR_INDEX_VERSION = 1
// Repeated in each prompt's closing instructions block (not just the earlier system message) because
// models weight instructions closest to generation far more heavily - a rule stated once near the top
// of a long prompt gets diluted by the time generation starts.
const NO_MARKDOWN_INSTRUCTION = '- No markdown formatting (no **, no #, no bullet/numbered lists unless explicitly requested).'

function normaliseWhitespace(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normaliseParagraphText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\n{2,}/)
    .map(paragraph => paragraph.replace(/[ \t\f\v]+/g, ' ').replace(/\n+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Resolves the model/provider/reasoning-effort triple for a chat-completion call
 * and routes it through the shared provider registry.
 * @param {{ modelPreference?: { selectedModel?: string; reasoningEffort?: string; provider?: string }; messages?: any[]; temperature?: number; maxTokens?: number; reasoningEffortOverride?: string }} params
 */
async function runChatCompletion({ modelPreference = {}, messages = [], temperature = 0.2, maxTokens = 1000, reasoningEffortOverride = '' }) {
  const model = sanitizeAiChatModel(modelPreference?.selectedModel || DEFAULT_AI_CHAT_MODEL)
  const reasoningEffort = sanitizeReasoningEffort(
    model,
    reasoningEffortOverride || modelPreference?.reasoningEffort || DEFAULT_AI_REASONING_EFFORT
  )
  const providerId = modelPreference?.provider || getProviderForModel(model)

  const { text, finishReason, raw } = await callChatCompletion({
    providerId,
    model,
    messages,
    temperature,
    maxTokens,
    reasoningEffort
  })

  return { model, reasoningEffort, rawText: text, finishReason, raw }
}

function normaliseKey(value) {
  return normaliseWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenize(value) {
  return Array.from(new Set(normaliseKey(value).split(' ').filter(token => token.length > 2)))
}

function unique(items = []) {
  return Array.from(new Set(items.filter(Boolean)))
}

function scoreTextMatch(queryTokens, candidateText, sourceType = '') {
  const candidateTokens = new Set(tokenize(candidateText))
  let score = 0

  queryTokens.forEach(token => {
    if (candidateTokens.has(token)) {
      score += token.length > 6 ? 3 : 2
    }
  })

  if (sourceType === 'rubric') {
    score += 2
  }

  return score
}

function cosineSimilarity(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    return null
  }

  let dot = 0
  let normA = 0
  let normB = 0

  for (let index = 0; index < a.length; index += 1) {
    const valueA = Number(a[index]) || 0
    const valueB = Number(b[index]) || 0
    dot += valueA * valueB
    normA += valueA * valueA
    normB += valueB * valueB
  }

  if (!normA || !normB) {
    return null
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function splitLongText(text, maxLength = 900) {
  const cleanText = normaliseWhitespace(text)
  if (!cleanText) {
    return []
  }

  if (cleanText.length <= maxLength) {
    return [cleanText]
  }

  const sentences = cleanText.split(/(?<=[.!?])\s+/)
  const chunks = []
  let currentChunk = ''

  sentences.forEach(sentence => {
    const nextChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence
    if (nextChunk.length > maxLength && currentChunk) {
      chunks.push(currentChunk)
      currentChunk = sentence
    } else {
      currentChunk = nextChunk
    }
  })

  if (currentChunk) {
    chunks.push(currentChunk)
  }

  return chunks
}

function buildCriteriaList(assessment) {
  return (assessment?.categories || []).map(category => ({
    criterion_name: category.name,
    max_mark: Number(category.allocatedMarks) || null,
    description: normaliseWhitespace(category.description || ''),
    knowledge_area: normaliseWhitespace(category.knowledgeArea || '')
  }))
}

function buildRubricChunks(assessment) {
  const chunks = []
  const criteria = buildCriteriaList(assessment)

  criteria.forEach((criterion, index) => {
    const parts = [
      `Criterion ${index + 1}: ${criterion.criterion_name}`,
      criterion.max_mark !== null ? `Max mark: ${criterion.max_mark}` : '',
      criterion.description ? `Descriptor: ${criterion.description}` : '',
      criterion.knowledge_area ? `Knowledge area: ${criterion.knowledge_area}` : ''
    ].filter(Boolean)

    if (parts.length > 0) {
      chunks.push({
        id: `rubric-${index + 1}`,
        type: 'rubric',
        label: `Rubric - ${criterion.criterion_name}`,
        text: parts.join('. ')
      })
    }
  })

  splitLongText(assessment?.rubricHtml || '').forEach((chunk, index) => {
    chunks.push({
      id: `rubric-html-${index + 1}`,
      type: 'rubric',
      label: `Rubric HTML ${index + 1}`,
      text: chunk
    })
  })

  splitLongText(assessment?.questionText || '').forEach((chunk, index) => {
    chunks.push({
      id: `brief-${index + 1}`,
      type: 'brief',
      label: `Question ${index + 1}`,
      text: chunk
    })
  })

  return chunks
}

function buildParagraphChunks(paragraphs = []) {
  return paragraphs
    .map((paragraph, index) => {
      const text = normaliseWhitespace(typeof paragraph === 'string' ? paragraph : paragraph?.text)
      if (!text) {
        return null
      }

      const categoryPrefix = text.includes(':') ? text.split(':')[0].trim() : 'General'
      return {
        id: `paragraph-${index + 1}`,
        type: 'paragraph',
        label: `Template paragraph - ${categoryPrefix}`,
        text
      }
    })
    .filter(Boolean)
}

function buildPriorFeedbackChunks(priorEvaluations = []) {
  const chunks = []

  priorEvaluations.forEach((evaluation, evaluationIndex) => {
    const studentLabel = evaluation.studentDisplayName || evaluation.studentId || 'Unknown student'
    const criteriaEntries = Object.entries(evaluation.categoryMarks || {})

    criteriaEntries.forEach(([criterionName, mark], criterionIndex) => {
      const relatedParagraphs = (evaluation.paragraphs || [])
        .map(paragraph => normaliseWhitespace(typeof paragraph === 'string' ? paragraph : paragraph?.text))
        .filter(text => text && normaliseKey(text).includes(normaliseKey(criterionName)))
        .slice(0, 2)

      const combinedText = [
        `Past feedback example for ${criterionName}.`,
        `Awarded mark: ${mark}.`,
        relatedParagraphs.length > 0 ? `Example wording: ${relatedParagraphs.join(' ')}` : ''
      ].filter(Boolean).join(' ')

      chunks.push({
        id: `prior-${evaluationIndex + 1}-${criterionIndex + 1}`,
        type: 'prior-feedback',
        label: `Previous feedback - ${criterionName} (${studentLabel})`,
        text: combinedText
      })
    })
  })

  return chunks
}

function buildAssessmentDocumentChunks(documents = []) {
  const chunks = []

  documents.forEach((document, documentIndex) => {
    splitLongText(document?.extractedText || '').forEach((chunk, chunkIndex) => {
      chunks.push({
        id: `assessment-doc-${documentIndex + 1}-${chunkIndex + 1}`,
        type: document?.documentType || 'reference',
        label: `${document?.documentType || 'Reference'} - ${document?.name || `Document ${documentIndex + 1}`}`,
        text: chunk
      })
    })
  })

  return chunks
}

function buildCandidateChunks({ assessment, assessmentParagraphs = [], priorEvaluations = [] }) {
  return [
    ...buildRubricChunks(assessment),
    ...buildAssessmentDocumentChunks(assessment?.aiReferenceDocuments || []),
    ...buildParagraphChunks(assessmentParagraphs),
    ...buildPriorFeedbackChunks(priorEvaluations)
  ]
}

function buildQueryText({ assessment, studentSubmission = '', evidenceNotes = '', criteria = [] }) {
  return [
    assessment?.name,
    assessment?.questionText,
    studentSubmission,
    evidenceNotes,
    criteria.map(criterion => criterion.criterion_name).join(' ')
  ].filter(Boolean).join(' ')
}

function buildRelevantStudentEvidenceExcerpt({ studentSubmission = '', categoryName = '', evidenceNotes = '', shortFeedback = '', maxParagraphs = 6, maxChars = 2200 }) {
  const sourceText = String(studentSubmission || '').trim()
  if (!sourceText) {
    return ''
  }

  const paragraphs = sourceText
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(paragraph => paragraph.replace(/[ \t\f\v]+/g, ' ').trim())
    .filter(Boolean)

  if (paragraphs.length === 0) {
    return ''
  }

  const queryTokens = unique([
    ...tokenize(categoryName),
    ...tokenize(evidenceNotes),
    ...tokenize(shortFeedback)
  ])

  const scored = paragraphs
    .map((paragraph, index) => ({
      paragraph,
      index,
      score: queryTokens.length > 0 ? scoreTextMatch(queryTokens, paragraph, 'submission') : 0
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)

  const selected = (scored.length > 0 ? scored : paragraphs.slice(0, Math.min(maxParagraphs, paragraphs.length)).map((paragraph, index) => ({
    paragraph,
    index,
    score: 0
  })))
    .slice(0, maxParagraphs)
    .sort((a, b) => a.index - b.index)

  let excerpt = selected.map(item => item.paragraph).join('\n\n').trim()
  if (excerpt.length > maxChars) {
    excerpt = `${excerpt.slice(0, maxChars).trim()}...`
  }

  return excerpt
}

function hashChunkSource({ assessment, candidateChunks = [], priorEvaluations = [] }) {
  return JSON.stringify({
    assessmentId: assessment?.id || null,
    assessmentName: assessment?.name || '',
    categories: (assessment?.categories || []).map(category => ({
      name: category.name,
      allocatedMarks: category.allocatedMarks || null,
      description: category.description || '',
      knowledgeArea: category.knowledgeArea || ''
    })),
    rubricHtml: assessment?.rubricHtml || '',
    questionText: assessment?.questionText || '',
    aiReferenceDocuments: (assessment?.aiReferenceDocuments || []).map(document => ({
      id: document.id,
      name: document.name,
      documentType: document.documentType,
      extractedText: document.extractedText
    })),
    candidateChunks: candidateChunks.map(chunk => ({ id: chunk.id, type: chunk.type, label: chunk.label, text: chunk.text })),
    priorEvaluations: priorEvaluations.map(evaluation => ({
      studentId: evaluation.studentId,
      categoryMarks: evaluation.categoryMarks || {},
      paragraphs: (evaluation.paragraphs || []).map(paragraph => typeof paragraph === 'string' ? paragraph : paragraph?.text)
    }))
  })
}

async function getErrorMessage(response) {
  try {
    const error = await response.json()
    return error.error?.message || error.message || null
  } catch {
    try {
      const text = await response.text()
      return text || null
    } catch {
      return null
    }
  }
}

async function createEmbeddings(inputs = []) {
  const apiKey = getEffectiveApiKey('openai')
  if (!apiKey || apiKey === 'your-api-key-here') {
    throw new Error('OpenAI API key is not configured. Add it in Settings > API Keys, or in the .env file.')
  }

  if (!inputs.length) {
    return []
  }

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: inputs
    })
  })

  if (!response.ok) {
    const message = await getErrorMessage(response)
    throw new Error(message || `Embedding request failed with status ${response.status}`)
  }

  const data = await response.json()
  return (data.data || []).map(item => item.embedding)
}

export async function buildAssessmentVectorIndex({ assessment, assessmentParagraphs = [], priorEvaluations = [] }) {
  const candidateChunks = buildCandidateChunks({ assessment, assessmentParagraphs, priorEvaluations })
  const texts = candidateChunks.map(chunk => chunk.text)
  const embeddings = await createEmbeddings(texts)

  return {
    version: VECTOR_INDEX_VERSION,
    embeddingModel: EMBEDDING_MODEL,
    createdAt: new Date().toISOString(),
    sourceHash: hashChunkSource({ assessment, candidateChunks, priorEvaluations }),
    chunks: candidateChunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index] || null
    }))
  }
}

function isVectorIndexCurrent(vectorIndex, { assessment, assessmentParagraphs = [], priorEvaluations = [] }) {
  if (!vectorIndex || vectorIndex.version !== VECTOR_INDEX_VERSION || !Array.isArray(vectorIndex.chunks)) {
    return false
  }

  const candidateChunks = buildCandidateChunks({ assessment, assessmentParagraphs, priorEvaluations })
  const expectedHash = hashChunkSource({ assessment, candidateChunks, priorEvaluations })
  return vectorIndex.sourceHash === expectedHash
}

function formatRetrievedContext(chunks = []) {
  return chunks.map(chunk => ({
    source: chunk.label,
    type: chunk.type,
    text: chunk.text
  }))
}

function selectRetrievedChunks(chunks = [], maxChunks = MAX_RETRIEVED_CHUNKS) {
  const selected = []
  const labelCounts = new Map()
  const typeCounts = new Map()

  const typeCaps = {
    rubric: 2,
    brief: 2,
    paragraph: 1,
    'prior-feedback': 1
  }

  for (const chunk of chunks) {
    if (!chunk || !chunk.text) {
      continue
    }

    const normalizedLabel = normaliseKey(chunk.label || chunk.id || '')
    const labelCount = labelCounts.get(normalizedLabel) || 0
    const typeCount = typeCounts.get(chunk.type) || 0
    const typeCap = typeCaps[chunk.type] || maxChunks

    if (normalizedLabel && labelCount >= 1) {
      continue
    }

    if (typeCount >= typeCap) {
      continue
    }

    selected.push(chunk)
    if (normalizedLabel) {
      labelCounts.set(normalizedLabel, labelCount + 1)
    }
    typeCounts.set(chunk.type, typeCount + 1)

    if (selected.length >= maxChunks) {
      break
    }
  }

  return selected
}

function isChunkCategoryMatch(chunk, categoryName = '') {
  const target = normaliseKey(categoryName)
  if (!target) return true

  const label = normaliseKey(chunk?.label || '')
  const text = normaliseKey(chunk?.text || '')

  if (label.includes(target)) return true
  if (text.startsWith(`${target}:`) || text.startsWith(`${target} `)) return true

  return false
}

function applyCategoryPriority(rankedChunks = [], categoryName = '') {
  const matches = rankedChunks.filter(chunk => isChunkCategoryMatch(chunk, categoryName))
  return {
    chunks: matches.length > 0 ? matches : rankedChunks,
    hasCategoryMatch: matches.length > 0
  }
}

function buildSystemMessages(globalSystemInstructions = '', baseSystemPrompt = '') {
  const messages = []

  const basePrompt = normaliseWhitespace(baseSystemPrompt)
  if (basePrompt) {
    messages.push({
      role: 'system',
      content: basePrompt
    })
  }

  const extraSystemInstructions = normaliseWhitespace(globalSystemInstructions)
  if (extraSystemInstructions) {
    messages.push({
      role: 'system',
      content: `Additional global marking instructions from the assessor:\n${extraSystemInstructions}`
    })
  }

  return messages
}

function buildPerAnswerSystemMessages(answerInstructions = '') {
  const perAnswer = normaliseWhitespace(answerInstructions)
  if (!perAnswer) {
    return []
  }

  return [
    {
      role: 'system',
      content: `Per-answer instructions from assessor:\n${perAnswer}`
    }
  ]
}

function buildRetrievedContextMessages(retrievedContext = [], retrievalMode = '') {
  const normalizedMode = normaliseWhitespace(retrievalMode || 'not-specified')
  const compactContext = Array.isArray(retrievedContext)
    ? retrievedContext
      .map((item, index) => {
        const source = normaliseWhitespace(item?.source || `Context ${index + 1}`)
        const type = normaliseWhitespace(item?.type || 'reference')
        const text = normaliseWhitespace(item?.text || '')

        if (!text) {
          return ''
        }

        return [
          `Context ${index + 1}`,
          `Source: ${source}`,
          `Type: ${type}`,
          `Text: ${text}`
        ].join('\n')
      })
      .filter(Boolean)
      .join('\n\n')
    : ''

  return [
    {
      role: 'system',
      content: [
        `Retrieved context mode: ${normalizedMode}`,
        'Use the retrieved context as supporting reference material only.',
        'Prioritise the student submission, assessor notes, and explicit rubric criteria when they conflict with generic examples.',
        'Do not claim to have used sources that are not present in the retrieved context block.'
      ].join('\n')
    },
    {
      role: 'user',
      content: compactContext
        ? `Retrieved context block:\n\n${compactContext}`
        : 'Retrieved context block:\n\nNo retrieved context was available.'
    }
  ]
}

function extractFeedbackTextFromPossibleJson(rawText) {
  const trimmed = String(rawText || '').trim()
  if (!trimmed) return ''

  const cleaned = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  if (!cleaned.startsWith('{')) {
    return cleaned
  }

  try {
    const parsed = JSON.parse(cleaned)
    if (typeof parsed === 'string') return parsed
    if (typeof parsed?.feedback === 'string') return parsed.feedback
    if (typeof parsed?.improvedText === 'string') return parsed.improvedText
    if (typeof parsed?.text === 'string') return parsed.text
    if (typeof parsed?.content === 'string') return parsed.content
    return cleaned
  } catch {
    return cleaned
  }
}

// Vision content blocks are provider-agnostic here ({ type: 'image', mimeType, data }) - each
// provider in llmProviders.js adapts them to its own wire format (OpenAI image_url vs Anthropic source).
function collectSubmissionImages(documents = []) {
  return (Array.isArray(documents) ? documents : [])
    .flatMap(document => (Array.isArray(document?.images) ? document.images : []).map(image => ({ ...image, documentName: document?.name })))
}

function buildStudentSubmissionImageMessages(images = []) {
  if (!Array.isArray(images) || images.length === 0) {
    return []
  }

  return [
    {
      role: 'user',
      content: [
        { type: 'text', text: `Student submission images (${images.length}) - visual evidence from uploaded documents (diagrams, screenshots, charts):` },
        ...images.map(image => ({ type: 'image', mimeType: image.mimeType || 'image/png', data: image.dataUrl }))
      ]
    }
  ]
}

export async function buildImproveFeedbackWithRagPromptPreview({ assessment, categoryName = '', shortFeedback = '', student = null, studentSubmission = '', studentSubmissionDocuments = [], evidenceNotes = '', assessmentParagraphs = [], priorEvaluations = [], vectorIndex = null, globalSystemInstructions = '', answerInstructions = '' }) {
  const submissionExcerpt = buildRelevantStudentEvidenceExcerpt({
    studentSubmission,
    categoryName,
    evidenceNotes,
    shortFeedback
  })
  const retrievalQuery = [categoryName, answerInstructions, shortFeedback, evidenceNotes, submissionExcerpt].filter(Boolean).join('\n\n')
  const { retrievedContext, retrievalMode } = await buildAssessmentRagContext({
    assessment,
    assessmentParagraphs,
    priorEvaluations,
    studentSubmission: retrievalQuery,
    evidenceNotes,
    vectorIndex,
    categoryName
  })

  return {
    retrievalMode,
    retrievedContext,
    messages: [
      ...buildSystemMessages(globalSystemInstructions, ''),
      ...buildPerAnswerSystemMessages(answerInstructions),
      ...buildRetrievedContextMessages(retrievedContext, retrievalMode),
      ...buildStudentSubmissionImageMessages(collectSubmissionImages(studentSubmissionDocuments)),
      {
        role: 'user',
        content: [
          `Assessment: ${assessment?.name || 'Unnamed assessment'}`,
          `Criterion or category: ${normaliseWhitespace(categoryName || 'General feedback')}`,
          student?.displayName || student?.id ? `Student: ${student?.displayName || student?.id}` : '',
          `Retrieval mode: ${retrievalMode}`,
          '',
          'Assessor short draft:',
          shortFeedback || 'Not provided.',
          '',
          'Relevant student evidence excerpt:',
          submissionExcerpt || 'Not provided.',
          '',
          'Assessor evidence notes:',
          evidenceNotes || 'Not provided.',
          '',
          'Output instructions:',
          '- Rewrite and improve the assessor short draft using only the data above.',
          '- Prioritise evidence and references that match the selected criterion/category.',
          '- Keep the assessor intent and judgement aligned with the provided instructions.',
          '- Return plain feedback text only.',
          NO_MARKDOWN_INSTRUCTION
        ].filter(Boolean).join('\n')
      }
    ]
  }
}

export async function buildAssessmentRagContext({ assessment, assessmentParagraphs = [], priorEvaluations = [], studentSubmission = '', evidenceNotes = '', vectorIndex = null, categoryName = '' }) {
  const criteria = buildCriteriaList(assessment)
  const queryText = buildQueryText({ assessment, studentSubmission, evidenceNotes, criteria })
  const queryTokens = tokenize(queryText)
  const candidateChunks = buildCandidateChunks({ assessment, assessmentParagraphs, priorEvaluations })
  const currentIndex = isVectorIndexCurrent(vectorIndex, { assessment, assessmentParagraphs, priorEvaluations })
    ? vectorIndex
    : null

  if (!currentIndex) {
    const rankedChunks = candidateChunks
      .map(chunk => ({ ...chunk, score: scoreTextMatch(queryTokens, chunk.text, chunk.type) }))
      .filter(chunk => chunk.score > 0 || chunk.type === 'rubric')
      .sort((a, b) => b.score - a.score)

    const { chunks: categoryPrioritised, hasCategoryMatch } = applyCategoryPriority(rankedChunks, categoryName)

    return {
      criteria,
      retrievedContext: formatRetrievedContext(selectRetrievedChunks(categoryPrioritised, MAX_RETRIEVED_CHUNKS)),
      retrievalMode: hasCategoryMatch ? 'lexical-category' : 'lexical'
    }
  }

  try {
    const [queryEmbedding] = await createEmbeddings([queryText || assessment?.name || 'assessment'])
    const rankedChunks = currentIndex.chunks
      .map(chunk => {
        const lexicalScore = scoreTextMatch(queryTokens, chunk.text, chunk.type)
        const semanticScore = cosineSimilarity(queryEmbedding, chunk.embedding) ?? 0
        const combinedScore = lexicalScore + (semanticScore * 20)
        return {
          ...chunk,
          lexicalScore,
          semanticScore,
          combinedScore
        }
      })
      .filter(chunk => chunk.combinedScore > 0 || chunk.type === 'rubric')
      .sort((a, b) => b.combinedScore - a.combinedScore)

    const { chunks: categoryPrioritised, hasCategoryMatch } = applyCategoryPriority(rankedChunks, categoryName)

    return {
      criteria,
      retrievedContext: formatRetrievedContext(selectRetrievedChunks(categoryPrioritised, MAX_RETRIEVED_CHUNKS)),
      retrievalMode: hasCategoryMatch ? 'vector-category' : 'vector'
    }
  } catch {
    const rankedChunks = candidateChunks
      .map(chunk => ({ ...chunk, score: scoreTextMatch(queryTokens, chunk.text, chunk.type) }))
      .filter(chunk => chunk.score > 0 || chunk.type === 'rubric')
      .sort((a, b) => b.score - a.score)

    const { chunks: categoryPrioritised, hasCategoryMatch } = applyCategoryPriority(rankedChunks, categoryName)

    return {
      criteria,
      retrievedContext: formatRetrievedContext(selectRetrievedChunks(categoryPrioritised, MAX_RETRIEVED_CHUNKS)),
      retrievalMode: hasCategoryMatch ? 'lexical-fallback-category' : 'lexical-fallback'
    }
  }
}

export async function improveFeedbackWithRag({ assessment, categoryName = '', shortFeedback = '', student = null, studentSubmission = '', studentSubmissionDocuments = [], evidenceNotes = '', assessmentParagraphs = [], priorEvaluations = [], vectorIndex = null, globalSystemInstructions = '', answerInstructions = '', modelPreference = /** @type {{ selectedModel?: string, reasoningEffort?: string, provider?: string }} */ ({}) }) {
  const { messages, retrievedContext, retrievalMode } = await buildImproveFeedbackWithRagPromptPreview({
    assessment,
    categoryName,
    shortFeedback,
    student,
    studentSubmission,
    studentSubmissionDocuments,
    evidenceNotes,
    assessmentParagraphs,
    priorEvaluations,
    vectorIndex,
    globalSystemInstructions,
    answerInstructions
  })

  const { model, reasoningEffort, rawText, finishReason } = await runChatCompletion({
    modelPreference,
    temperature: 0.35,
    maxTokens: 2200,
    reasoningEffortOverride: 'low',
    messages
  })

  const improvedText = normaliseParagraphText(extractFeedbackTextFromPossibleJson(rawText))

  console.info('RAG feedback improvement response parsed', {
    retrievalMode,
    finishReason,
    rawTextLength: rawText.length,
    improvedTextLength: improvedText.length,
    rawTextPreview: rawText.slice(0, 500)
  })

  if (!improvedText) {
    console.error('RAG feedback improvement returned no usable text', { rawText, finishReason })
    if (finishReason === 'length') {
      throw new Error('The AI provider stopped before producing visible improved feedback. The response hit the token limit.')
    }
    throw new Error('No improved feedback was returned from the AI provider')
  }

  return {
    improvedText,
    retrievedContext,
    retrievalMode,
    usedModel: model,
    usedReasoningEffort: reasoningEffort
  }
}

export async function generateEvidenceCheckReport({ assessment, categoryName = '', student = null, studentSubmission = '', studentSubmissionDocuments = [], evidenceNotes = '', assessmentParagraphs = [], priorEvaluations = [], vectorIndex = null, globalSystemInstructions = '', answerInstructions = '', modelPreference = /** @type {{ selectedModel?: string, reasoningEffort?: string, provider?: string }} */ ({}) }) {
  console.info('Evidence check request started', {
    assessment: assessment?.name || 'Unnamed assessment',
    categoryName: normaliseWhitespace(categoryName || 'General feedback'),
    student: student?.displayName || student?.id || 'Not specified',
    submissionLength: String(studentSubmission || '').length,
    evidenceNotesLength: String(evidenceNotes || '').length
  })

  const retrievalQuery = [categoryName, answerInstructions, studentSubmission, evidenceNotes].filter(Boolean).join('\n\n')
  const { retrievedContext, retrievalMode } = await buildAssessmentRagContext({
    assessment,
    assessmentParagraphs,
    priorEvaluations,
    studentSubmission: retrievalQuery,
    evidenceNotes,
    vectorIndex,
    categoryName
  })

  const { model, reasoningEffort, rawText, finishReason } = await runChatCompletion({
    modelPreference,
    temperature: 0.2,
    maxTokens: 2200,
    reasoningEffortOverride: 'low',
    messages: [
      ...buildSystemMessages(globalSystemInstructions, ''),
      ...buildPerAnswerSystemMessages(answerInstructions),
      ...buildRetrievedContextMessages(retrievedContext, retrievalMode),
      ...buildStudentSubmissionImageMessages(collectSubmissionImages(studentSubmissionDocuments)),
      {
        role: 'user',
        content: [
          'Task: Create an evidence-check feedback report for the selected criterion/category using only the provided student notes, uploaded student documents, and retrieved context.',
          `Assessment: ${assessment?.name || 'Unnamed assessment'}`,
          `Criterion or category: ${normaliseWhitespace(categoryName || 'General feedback')}`,
          `Academic level: ${normaliseWhitespace(assessment?.academicLevel || 'Not specified')}`,
          `Question: ${normaliseWhitespace(assessment?.questionText || 'Not provided')}`,
          `Assessment-specific instructions: ${normaliseWhitespace(assessment?.aiModerationNotes || 'Not provided')}`,
          `Student: ${student?.displayName || student?.id || 'Not specified'}`,
          `Retrieval mode: ${retrievalMode}`,
          '',
          'Student submission and uploaded student documents:',
          studentSubmission || 'Not provided.',
          '',
          'Selected evidence notes:',
          evidenceNotes || 'Not provided.',
          '',
          'Output instructions:',
          '- Focus on whether the student has demonstrated the expected evidence for this category.',
          '- Mention clear strengths and what evidence is missing or insufficient.',
          '- Keep the tone aligned with assessor instructions.',
          '- Do not invent evidence or claims.',
          '- Return plain feedback text only.',
          NO_MARKDOWN_INSTRUCTION
        ].join('\n')
      }
    ]
  })

  const reportText = normaliseParagraphText(extractFeedbackTextFromPossibleJson(rawText))

  console.info('Evidence check response parsed', {
    retrievalMode,
    finishReason,
    rawTextLength: rawText.length,
    reportTextLength: reportText.length,
    rawTextPreview: rawText.slice(0, 500)
  })

  if (!reportText) {
    console.error('Evidence check returned no usable text', { rawText, finishReason })
    if (finishReason === 'length') {
      throw new Error('The AI provider stopped before producing visible evidence-check text. The response hit the token limit.')
    }
    throw new Error('No evidence-check feedback was returned from the AI provider')
  }

  return {
    reportText,
    retrievedContext,
    retrievalMode,
    usedModel: model,
    usedReasoningEffort: reasoningEffort
  }
}

function extractJson(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) {
    throw new Error('No response received from OpenAI')
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) {
      throw new Error('OpenAI did not return valid JSON')
    }
    return JSON.parse(match[0])
  }
}

export async function generateStructuredMarkingDraft({ assessment, student, studentSubmission = '', studentSubmissionDocuments = [], evidenceNotes = '', assessmentParagraphs = [], priorEvaluations = [], vectorIndex = null, globalSystemInstructions = '', modelPreference = /** @type {{ selectedModel?: string, reasoningEffort?: string, provider?: string }} */ ({}) }) {
  const { criteria, retrievedContext, retrievalMode } = await buildAssessmentRagContext({
    assessment,
    assessmentParagraphs,
    priorEvaluations,
    studentSubmission,
    evidenceNotes,
    vectorIndex
  })

  if (criteria.length === 0) {
    throw new Error('Add at least one assessment category before using AI marking.')
  }

  const maxMarks = criteria.reduce((total, criterion) => total + (Number(criterion.max_mark) || 0), 0)
  const { model, reasoningEffort, rawText } = await runChatCompletion({
    modelPreference,
    temperature: 0.2,
    maxTokens: 2200,
    messages: [
      ...buildSystemMessages(globalSystemInstructions, ''),
      ...buildRetrievedContextMessages(retrievedContext, retrievalMode),
      ...buildStudentSubmissionImageMessages(collectSubmissionImages(studentSubmissionDocuments)),
      {
        role: 'user',
        content: [
          'Task: Assess the student answer against the supplied rubric, criteria, evidence notes, and retrieved context.',
          `Assessment: ${assessment?.name || 'Unnamed assessment'}`,
          `Academic level: ${normaliseWhitespace(assessment?.academicLevel || 'Not specified')}`,
          `Question: ${normaliseWhitespace(assessment?.questionText || 'Not provided')}`,
          `Assessment-specific instructions: ${normaliseWhitespace(assessment?.aiModerationNotes || 'Not provided')}`,
          `Maximum marks: ${maxMarks || 'Not specified'}`,
          `Student: ${student?.displayName || student?.id || 'Unknown student'}`,
          `Retrieval mode: ${retrievalMode}`,
          '',
          'Criteria:',
          JSON.stringify(criteria, null, 2),
          '',
          'Student submission or answer:',
          studentSubmission || 'Not provided.',
          '',
          'Assessor evidence notes:',
          evidenceNotes || 'Not provided.',
          '',
          'Return valid JSON with this exact shape:',
          JSON.stringify({
            criteria: [
              {
                criterion_name: 'string',
                awarded_mark: 0,
                judgement: 'string',
                evidence: ['string'],
                improvement_advice: 'string',
                suggested_feedback: 'string'
              }
            ],
            overall_feedback: 'string'
          }, null, 2),
          '',
          'Requirements:',
          '- Use only the supplied criterion names.',
          '- Keep awarded marks within each criterion maximum.',
          '- Base judgements only on the provided submission, notes, and retrieved context.',
          '- Do not invent evidence or achievement claims.',
          '- Keep suggested_feedback ready to paste into the feedback app.',
          NO_MARKDOWN_INSTRUCTION,
          '- Return valid JSON only.'
        ].join('\n')
      }
    ]
  })

  const parsed = extractJson(rawText)

  return {
    criteria: Array.isArray(parsed.criteria) ? parsed.criteria : [],
    overall_feedback: normaliseWhitespace(parsed.overall_feedback || ''),
    retrievedContext,
    retrievalMode,
    usedModel: model,
    usedReasoningEffort: reasoningEffort
  }
}

export function findCriterionByName(criteria = [], criterionName = '') {
  const target = normaliseKey(criterionName)
  return criteria.find(criterion => normaliseKey(criterion?.criterion_name || criterion?.name) === target) || null
}

export function isAssessmentVectorIndexCurrent(vectorIndex, payload) {
  return isVectorIndexCurrent(vectorIndex, payload)
}
