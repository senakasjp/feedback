const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings'
const DEFAULT_MODEL = 'gpt-4o-mini'
const EMBEDDING_MODEL = 'text-embedding-3-small'
const MAX_RETRIEVED_CHUNKS = 8
const VECTOR_INDEX_VERSION = 1

function normaliseWhitespace(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-api-key-here') {
    throw new Error('OpenAI API key is not configured. Please add your API key to the .env file.')
  }

  if (!inputs.length) {
    return []
  }

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
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

export async function buildImproveFeedbackWithRagPromptPreview({ assessment, categoryName = '', shortFeedback = '', student = null, studentSubmission = '', evidenceNotes = '', assessmentParagraphs = [], priorEvaluations = [], vectorIndex = null, globalSystemInstructions = '', answerInstructions = '' }) {
  const retrievalQuery = [categoryName, answerInstructions, shortFeedback, studentSubmission].filter(Boolean).join('\n\n')
  const { retrievedContext, retrievalMode } = await buildAssessmentRagContext({
    assessment,
    assessmentParagraphs,
    priorEvaluations,
    studentSubmission: retrievalQuery,
    evidenceNotes,
    vectorIndex
  })

  return {
    retrievalMode,
    retrievedContext,
    messages: [
      ...buildSystemMessages(globalSystemInstructions, ''),
      ...buildPerAnswerSystemMessages(answerInstructions),
      {
        role: 'user',
        content: [
          `Assessment: ${assessment?.name || 'Unnamed assessment'}`,
          `Criterion or category: ${normaliseWhitespace(categoryName || 'General feedback')}`,
          `Academic level: ${normaliseWhitespace(assessment?.academicLevel || 'Not specified')}`,
          `Question: ${normaliseWhitespace(assessment?.questionText || 'Not provided')}`,
          `Assessment-specific instructions: ${normaliseWhitespace(assessment?.aiModerationNotes || 'Not provided')}`,
          `Student: ${student?.displayName || student?.id || 'Not specified'}`,
          `Retrieval mode: ${retrievalMode}`,
          '',
          'Assessor short draft:',
          shortFeedback || 'Not provided.',
          '',
          'Student submission or answer:',
          studentSubmission || 'Not provided.',
          '',
          'Assessor evidence notes:',
          evidenceNotes || 'Not provided.',
          '',
          'Retrieved context:',
          JSON.stringify(retrievedContext, null, 2),
          '',
          'Output instructions:',
          '- Rewrite and improve the assessor short draft using only the data above.',
          '- Prioritise evidence and references that match the selected criterion/category.',
          '- Keep the assessor intent and judgement aligned with the provided instructions.',
          '- Return plain feedback text only.'
        ].join('\n')
      }
    ]
  }
}

export async function buildAssessmentRagContext({ assessment, assessmentParagraphs = [], priorEvaluations = [], studentSubmission = '', evidenceNotes = '', vectorIndex = null }) {
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
      .slice(0, MAX_RETRIEVED_CHUNKS)

    return {
      criteria,
      retrievedContext: formatRetrievedContext(rankedChunks),
      retrievalMode: 'lexical'
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
      .slice(0, MAX_RETRIEVED_CHUNKS)

    return {
      criteria,
      retrievedContext: formatRetrievedContext(rankedChunks),
      retrievalMode: 'vector'
    }
  } catch {
    const rankedChunks = candidateChunks
      .map(chunk => ({ ...chunk, score: scoreTextMatch(queryTokens, chunk.text, chunk.type) }))
      .filter(chunk => chunk.score > 0 || chunk.type === 'rubric')
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RETRIEVED_CHUNKS)

    return {
      criteria,
      retrievedContext: formatRetrievedContext(rankedChunks),
      retrievalMode: 'lexical-fallback'
    }
  }
}

export async function improveFeedbackWithRag({ assessment, categoryName = '', shortFeedback = '', student = null, studentSubmission = '', evidenceNotes = '', assessmentParagraphs = [], priorEvaluations = [], vectorIndex = null, globalSystemInstructions = '', answerInstructions = '' }) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-api-key-here') {
    throw new Error('OpenAI API key is not configured. Please add your API key to the .env file.')
  }

  const { messages, retrievedContext, retrievalMode } = await buildImproveFeedbackWithRagPromptPreview({
    assessment,
    categoryName,
    shortFeedback,
    student,
    studentSubmission,
    evidenceNotes,
    assessmentParagraphs,
    priorEvaluations,
    vectorIndex,
    globalSystemInstructions,
    answerInstructions
  })

  const response = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.35,
      max_tokens: 900,
      messages,
    })
  })

  if (!response.ok) {
    const message = await getErrorMessage(response)
    throw new Error(message || `API request failed with status ${response.status}`)
  }

  const data = await response.json()
  const rawText = data.choices?.[0]?.message?.content || ''
  const improvedText = normaliseWhitespace(extractFeedbackTextFromPossibleJson(rawText))

  if (!improvedText) {
    throw new Error('No improved feedback was returned from OpenAI')
  }

  return {
    improvedText,
    retrievedContext,
    retrievalMode
  }
}

export async function generateEvidenceCheckReport({ assessment, categoryName = '', student = null, studentSubmission = '', evidenceNotes = '', assessmentParagraphs = [], priorEvaluations = [], vectorIndex = null, globalSystemInstructions = '', answerInstructions = '' }) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-api-key-here') {
    throw new Error('OpenAI API key is not configured. Please add your API key to the .env file.')
  }

  const retrievalQuery = [categoryName, answerInstructions, studentSubmission, evidenceNotes].filter(Boolean).join('\n\n')
  const { retrievedContext, retrievalMode } = await buildAssessmentRagContext({
    assessment,
    assessmentParagraphs,
    priorEvaluations,
    studentSubmission: retrievalQuery,
    evidenceNotes,
    vectorIndex
  })

  const response = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      max_tokens: 1000,
      messages: [
        ...buildSystemMessages(globalSystemInstructions, ''),
        ...buildPerAnswerSystemMessages(answerInstructions),
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
            'Retrieved context:',
            JSON.stringify(retrievedContext, null, 2),
            '',
            'Output instructions:',
            '- Focus on whether the student has demonstrated the expected evidence for this category.',
            '- Mention clear strengths and what evidence is missing or insufficient.',
            '- Keep the tone aligned with assessor instructions.',
            '- Do not invent evidence or claims.',
            '- Return plain feedback text only.'
          ].join('\n')
        }
      ]
    })
  })

  if (!response.ok) {
    const message = await getErrorMessage(response)
    throw new Error(message || `API request failed with status ${response.status}`)
  }

  const data = await response.json()
  const rawText = data.choices?.[0]?.message?.content || ''
  const reportText = normaliseWhitespace(extractFeedbackTextFromPossibleJson(rawText))

  if (!reportText) {
    throw new Error('No evidence-check feedback was returned from OpenAI')
  }

  return {
    reportText,
    retrievedContext,
    retrievalMode
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

export async function generateStructuredMarkingDraft({ assessment, student, studentSubmission = '', evidenceNotes = '', assessmentParagraphs = [], priorEvaluations = [], vectorIndex = null, globalSystemInstructions = '' }) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-api-key-here') {
    throw new Error('OpenAI API key is not configured. Please add your API key to the .env file.')
  }

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
  const response = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      max_tokens: 2200,
      messages: [
        ...buildSystemMessages(globalSystemInstructions, ''),
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
            'Retrieved context:',
            JSON.stringify(retrievedContext, null, 2),
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
            '- Return valid JSON only.'
          ].join('\n')
        }
      ]
    })
  })

  if (!response.ok) {
    const message = await getErrorMessage(response)
    throw new Error(message || `API request failed with status ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  const parsed = extractJson(content)

  return {
    criteria: Array.isArray(parsed.criteria) ? parsed.criteria : [],
    overall_feedback: normaliseWhitespace(parsed.overall_feedback || ''),
    retrievedContext,
    retrievalMode
  }
}

export function findCriterionByName(criteria = [], criterionName = '') {
  const target = normaliseKey(criterionName)
  return criteria.find(criterion => normaliseKey(criterion?.criterion_name || criterion?.name) === target) || null
}

export function isAssessmentVectorIndexCurrent(vectorIndex, payload) {
  return isVectorIndexCurrent(vectorIndex, payload)
}
