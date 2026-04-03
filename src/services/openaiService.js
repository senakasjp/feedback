/**
 * OpenAI Service
 * Handles all interactions with the OpenAI API
 */

import { DEFAULT_AI_CHAT_MODEL, DEFAULT_AI_REASONING_EFFORT, sanitizeAiChatModel, sanitizeReasoningEffort } from './aiModelService.js'

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions'

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

function normaliseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function extractTextFromContentPart(part) {
  if (typeof part === 'string') return part
  if (typeof part?.text === 'string') return part.text
  if (typeof part?.text?.value === 'string') return part.text.value
  if (typeof part?.content === 'string') return part.content
  if (typeof part?.value === 'string') return part.value
  if (typeof part?.output_text === 'string') return part.output_text
  if (Array.isArray(part?.content)) {
    return part.content.map(extractTextFromContentPart).filter(Boolean).join('\n')
  }
  return ''
}

function collectTextCandidates(value, results = [], seen = new WeakSet()) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) results.push(trimmed)
    return results
  }

  if (!value || typeof value !== 'object') {
    return results
  }

  if (seen.has(value)) {
    return results
  }
  seen.add(value)

  if (Array.isArray(value)) {
    value.forEach(item => collectTextCandidates(item, results, seen))
    return results
  }

  const preferredKeys = ['output_text', 'text', 'value', 'content', 'message', 'refusal']
  preferredKeys.forEach(key => {
    if (key in value) {
      collectTextCandidates(value[key], results, seen)
    }
  })

  Object.entries(value).forEach(([key, nestedValue]) => {
    if (!preferredKeys.includes(key)) {
      collectTextCandidates(nestedValue, results, seen)
    }
  })

  return results
}

function extractMessageText(payload = {}) {
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content === 'string') {
    return content.trim()
  }
  if (Array.isArray(content)) {
    return content.map(extractTextFromContentPart).filter(Boolean).join('\n').trim()
  }
  if (typeof content?.text === 'string') {
    return content.text.trim()
  }
  if (typeof content?.text?.value === 'string') {
    return content.text.value.trim()
  }
  if (typeof payload?.choices?.[0]?.message?.output_text === 'string') {
    return payload.choices[0].message.output_text.trim()
  }
  if (typeof payload?.choices?.[0]?.text === 'string') {
    return payload.choices[0].text.trim()
  }
  if (typeof payload?.output_text === 'string') {
    return payload.output_text.trim()
  }
  if (Array.isArray(payload?.output)) {
    return payload.output
      .map(item => extractTextFromContentPart(item))
      .filter(Boolean)
      .join('\n')
      .trim()
  }
  const recursiveText = collectTextCandidates(payload).join('\n').trim()
  if (recursiveText) {
    return recursiveText
  }
  return ''
}

function resolveTemperatureForModel(model = '', requestedTemperature = 1) {
  const normalizedModel = String(model || '').trim().toLowerCase()
  if (normalizedModel.startsWith('gpt-5')) {
    return 1
  }
  return requestedTemperature
}

function buildChatCompletionPayload({ modelPreference = {}, messages = [], temperature = 0.3, max_completion_tokens = 1000 }) {
  const model = sanitizeAiChatModel(modelPreference?.selectedModel || DEFAULT_AI_CHAT_MODEL)
  const reasoning_effort = sanitizeReasoningEffort(model, modelPreference?.reasoningEffort || DEFAULT_AI_REASONING_EFFORT)
  const resolvedTemperature = resolveTemperatureForModel(model, temperature)

  return {
    model,
    messages,
    temperature: resolvedTemperature,
    max_completion_tokens,
    reasoning_effort
  }
}

function buildImproveEnglishMessages(text, customInstructions = '') {
  const instructions = normaliseWhitespace(customInstructions)

  const messages = [
    {
      role: 'system',
      content: 'You are a helpful assistant that improves English text for clarity, grammar, and professionalism. IMPORTANT: Use British English spelling and conventions (e.g., "organise" not "organize", "colour" not "color"). Use simple, clear English that is easy to understand - avoid complex or advanced vocabulary. Write like a non-native English speaker would - use common, everyday words instead of sophisticated or academic language. CRITICAL: Preserve all scientific terms, technical vocabulary, domain-specific terminology, and specialist language exactly as written - do not simplify or replace these terms. Only simplify general language around the technical terms. Ensure the text is contextually correct and appropriate for educational feedback. Maintain the original meaning and tone. Only return the improved text without explanations or additional commentary.'
    },
  ]

  if (instructions) {
    messages.push({
      role: 'system',
      content: `Per-answer instructions from assessor:\n${instructions}`
    })
  }

  messages.push(
    {
      role: 'user',
      content: [
        'Please improve the following text using British English spelling and simple, easy-to-understand words. Avoid complex vocabulary - use normal, everyday English. IMPORTANT: Keep all scientific terms, technical words, and specialist terminology exactly as they are - do not change or simplify them.',
        text
      ].filter(Boolean).join('\n\n')
    }
  )

  return messages
}

/**
 * Improve the English grammar and clarity of the given text
 * @param {string} text - The text to improve
 * @param {string} customInstructions - Optional per-answer instructions
 * @returns {Promise<string>} - The improved text
 */
export async function improveEnglish(text, customInstructions = '', modelPreference = {}) {
  if (!text || text.trim() === '') {
    throw new Error('Text cannot be empty')
  }

  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-api-key-here') {
    throw new Error('OpenAI API key is not configured. Please add your API key to the .env file.')
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(buildChatCompletionPayload({
        modelPreference,
        messages: buildImproveEnglishMessages(text, customInstructions),
        temperature: 0.3,
        max_completion_tokens: 1000
      }))
    })

    if (!response.ok) {
      const message = await getErrorMessage(response)
      throw new Error(message || `API request failed with status ${response.status}`)
    }

    const data = await response.json()
    const improvedText = extractMessageText(data)

    if (!improvedText) {
      throw new Error('No response received from OpenAI')
    }

    return {
      improvedText,
      usedModel: sanitizeAiChatModel(modelPreference?.selectedModel || DEFAULT_AI_CHAT_MODEL),
      usedReasoningEffort: sanitizeReasoningEffort(
        modelPreference?.selectedModel || DEFAULT_AI_CHAT_MODEL,
        modelPreference?.reasoningEffort || DEFAULT_AI_REASONING_EFFORT
      )
    }
  } catch (error) {
    console.error('OpenAI API Error:', error)
    throw error
  }
}

/**
 * Check if the OpenAI API is properly configured
 * @returns {boolean} - True if API key is configured
 */
export function isOpenAIConfigured() {
  return Boolean(OPENAI_API_KEY && OPENAI_API_KEY !== 'your-api-key-here')
}

export function buildImproveEnglishPromptPreview(text, customInstructions = '') {
  return buildImproveEnglishMessages(text, customInstructions)
}

export async function transcribeAudioBlob(audioBlob) {
  if (!audioBlob) {
    throw new Error('Audio recording is empty')
  }

  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-api-key-here') {
    throw new Error('OpenAI API key is not configured. Please add your API key to the .env file.')
  }

  const formData = new FormData()
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'text')
  formData.append('file', audioBlob, 'speech.webm')

  const response = await fetch(OPENAI_TRANSCRIBE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: formData
  })

  if (!response.ok) {
    const message = await getErrorMessage(response)
    throw new Error(message || `Transcription request failed with status ${response.status}`)
  }

  const transcript = (await response.text()).trim()
  if (!transcript) {
    throw new Error('No transcription returned from OpenAI')
  }

  return transcript
}
