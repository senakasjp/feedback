/**
 * LLM Provider Registry
 * Each provider adapts the shared chat-completion call shape to its own API.
 * To add a provider: add an entry to PROVIDERS with envApiKey/chatUrl/headers/buildBody/parseResponse,
 * then list its models in aiModelService.js with `provider: '<id>'`.
 * API keys can be entered in-app (Settings > API Keys, stored in localStorage) and take
 * priority over the build-time VITE_*_API_KEY env var — see getEffectiveApiKey().
 */

const PLACEHOLDER = 'your-api-key-here'
const API_KEY_STORAGE_PREFIX = 'feedback-ai-apikey-'

function isConfiguredKey(key) {
  return Boolean(key && key !== PLACEHOLDER)
}

/** A key entered in the GUI (Settings > API Keys) overrides the .env value at runtime. */
export function getStoredApiKey(providerId = '') {
  try {
    return localStorage.getItem(API_KEY_STORAGE_PREFIX + providerId) || ''
  } catch {
    return ''
  }
}

export function setStoredApiKey(providerId = '', apiKey = '') {
  const trimmed = String(apiKey || '').trim()
  if (trimmed) {
    localStorage.setItem(API_KEY_STORAGE_PREFIX + providerId, trimmed)
  } else {
    localStorage.removeItem(API_KEY_STORAGE_PREFIX + providerId)
  }
}

export function getEffectiveApiKey(providerId = '') {
  return getStoredApiKey(providerId) || getProvider(providerId).envApiKey
}

async function readErrorMessage(response) {
  try {
    const error = await response.json()
    return error.error?.message || error.message || null
  } catch {
    try {
      return (await response.text()) || null
    } catch {
      return null
    }
  }
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

function extractOpenAiMessageText(payload = {}) {
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content.map(extractTextFromContentPart).filter(Boolean).join('\n').trim()
  }
  if (typeof content?.text === 'string') return content.text.trim()
  if (typeof content?.text?.value === 'string') return content.text.value.trim()
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
    const outputText = payload.output.map(extractTextFromContentPart).filter(Boolean).join('\n').trim()
    if (outputText) return outputText
  }
  return collectTextCandidates(payload).join('\n').trim()
}

function splitSystemAndTurns(messages = []) {
  const systemText = messages.filter(m => m.role === 'system').map(m => m.content).filter(Boolean).join('\n\n')
  const turns = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
  return { systemText, turns }
}

const PROVIDERS = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    envApiKey: import.meta.env.VITE_OPENAI_API_KEY,
    chatUrl: 'https://api.openai.com/v1/chat/completions',
    headers(apiKey) {
      return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }
    },
    buildBody({ model, messages, temperature, maxTokens, reasoningEffort }) {
      const resolvedTemperature = String(model || '').toLowerCase().startsWith('gpt-5') ? 1 : temperature
      return { model, messages, temperature: resolvedTemperature, max_completion_tokens: maxTokens, reasoning_effort: reasoningEffort }
    },
    parseResponse(data) {
      const text = extractOpenAiMessageText(data)
      const finishReason = data?.choices?.[0]?.finish_reason || ''
      return { text, finishReason: finishReason === 'length' ? 'length' : (finishReason ? 'stop' : ''), raw: data }
    }
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    envApiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    chatUrl: 'https://api.anthropic.com/v1/messages',
    headers(apiKey) {
      return {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      }
    },
    buildBody({ model, messages, temperature, maxTokens }) {
      const { systemText, turns } = splitSystemAndTurns(messages)
      return {
        model,
        system: systemText || undefined,
        messages: turns,
        temperature,
        max_tokens: maxTokens
      }
    },
    parseResponse(data) {
      const text = Array.isArray(data?.content)
        ? data.content.map(part => part?.text || '').filter(Boolean).join('\n').trim()
        : ''
      const stopReason = data?.stop_reason || ''
      return { text, finishReason: stopReason === 'max_tokens' ? 'length' : (stopReason ? 'stop' : ''), raw: data }
    }
  }
}

export const DEFAULT_PROVIDER_ID = 'openai'

export function getProvider(providerId = '') {
  return PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER_ID]
}

export function isProviderConfigured(providerId = '') {
  return isConfiguredKey(getEffectiveApiKey(providerId))
}

export function getProviderLabel(providerId = '') {
  return getProvider(providerId).label
}

/**
 * @param {{ providerId?: string, model: string, messages: any[], temperature?: number, maxTokens?: number, reasoningEffort?: string }} params
 * @returns {Promise<{ text: string, finishReason: string, raw: any }>}
 */
export async function callChatCompletion({ providerId = DEFAULT_PROVIDER_ID, model, messages = [], temperature = 0.3, maxTokens = 1000, reasoningEffort = '' }) {
  const provider = getProvider(providerId)
  const apiKey = getEffectiveApiKey(providerId)

  if (!isConfiguredKey(apiKey)) {
    throw new Error(`${provider.label} API key is not configured. Add it in Settings > API Keys, or in the .env file.`)
  }

  const response = await fetch(provider.chatUrl, {
    method: 'POST',
    headers: provider.headers(apiKey),
    body: JSON.stringify(provider.buildBody({ model, messages, temperature, maxTokens, reasoningEffort }))
  })

  if (!response.ok) {
    const message = await readErrorMessage(response)
    throw new Error(message || `${provider.label} request failed with status ${response.status}`)
  }

  const data = await response.json()
  return provider.parseResponse(data)
}
