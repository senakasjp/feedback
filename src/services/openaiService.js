/**
 * OpenAI Service
 * Handles all interactions with the OpenAI API
 */

import { DEFAULT_AI_CHAT_MODEL, DEFAULT_AI_REASONING_EFFORT, getProviderForModel, sanitizeAiChatModel, sanitizeReasoningEffort } from './aiModelService.js'
import { callChatCompletion, getEffectiveApiKey } from './llmProviders.js'

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
 * @param {{ selectedModel?: string, reasoningEffort?: string, provider?: string }} [modelPreference] - AI model preferences
 * @returns {Promise<{ improvedText: string, usedModel: string, usedReasoningEffort: string }>} - Result object
 */
export async function improveEnglish(text, customInstructions = '', modelPreference = {}) {
  if (!text || text.trim() === '') {
    throw new Error('Text cannot be empty')
  }

  const model = sanitizeAiChatModel(modelPreference?.selectedModel || DEFAULT_AI_CHAT_MODEL)
  const reasoningEffort = sanitizeReasoningEffort(model, modelPreference?.reasoningEffort || DEFAULT_AI_REASONING_EFFORT)
  const providerId = modelPreference?.provider || getProviderForModel(model)

  try {
    const { text: improvedText } = await callChatCompletion({
      providerId,
      model,
      messages: buildImproveEnglishMessages(text, customInstructions),
      temperature: 0.3,
      maxTokens: 1000,
      reasoningEffort
    })

    if (!improvedText) {
      throw new Error('No response received from the AI provider')
    }

    return {
      improvedText,
      usedModel: model,
      usedReasoningEffort: reasoningEffort
    }
  } catch (error) {
    console.error('AI provider error:', error)
    throw error
  }
}

/**
 * Check if the OpenAI API is properly configured
 * @returns {boolean} - True if API key is configured
 */
export function isOpenAIConfigured() {
  const apiKey = getEffectiveApiKey('openai')
  return Boolean(apiKey && apiKey !== 'your-api-key-here')
}

export function buildImproveEnglishPromptPreview(text, customInstructions = '') {
  return buildImproveEnglishMessages(text, customInstructions)
}

export async function transcribeAudioBlob(audioBlob) {
  if (!audioBlob) {
    throw new Error('Audio recording is empty')
  }

  const apiKey = getEffectiveApiKey('openai')
  if (!apiKey || apiKey === 'your-api-key-here') {
    throw new Error('OpenAI API key is not configured. Add it in Settings > API Keys, or in the .env file.')
  }

  const formData = new FormData()
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'text')
  formData.append('file', audioBlob, 'speech.webm')

  const response = await fetch(OPENAI_TRANSCRIBE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
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
