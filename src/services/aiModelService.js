export const AI_PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' }
]

export const DEFAULT_AI_PROVIDER = 'openai'

export function isSupportedAiProvider(provider = '') {
  return AI_PROVIDER_OPTIONS.some(option => option.value === provider)
}

export function sanitizeAiProvider(provider = '') {
  return isSupportedAiProvider(provider) ? provider : DEFAULT_AI_PROVIDER
}

export const AI_CHAT_MODEL_OPTIONS = [
  { value: 'gpt-5.4', label: 'GPT-5.4', provider: 'openai' },
  { value: 'gpt-5.4-mini', label: 'GPT-5.4-Mini', provider: 'openai' },
  { value: 'gpt-5.3-codex', label: 'GPT-5.3-Codex', provider: 'openai' },
  { value: 'gpt-5.2-codex', label: 'GPT-5.2-Codex', provider: 'openai' },
  { value: 'gpt-5.2', label: 'GPT-5.2', provider: 'openai' },
  { value: 'gpt-5.1-codex-max', label: 'GPT-5.1-Codex-Max', provider: 'openai' },
  { value: 'gpt-5.1-codex-mini', label: 'GPT-5.1-Codex-Mini', provider: 'openai' },
  { value: 'claude-opus-4-8', label: 'Claude Opus 4.8', provider: 'anthropic' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5', provider: 'anthropic' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', provider: 'anthropic' }
]

export function getModelsForProvider(provider = DEFAULT_AI_PROVIDER) {
  return AI_CHAT_MODEL_OPTIONS.filter(option => option.provider === sanitizeAiProvider(provider))
}

export function getProviderForModel(model = '') {
  return AI_CHAT_MODEL_OPTIONS.find(option => option.value === model)?.provider || DEFAULT_AI_PROVIDER
}

export const AI_REASONING_EFFORT_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Deep Thinking' }
]

export const DEFAULT_AI_CHAT_MODEL = 'gpt-5.4-mini'
export const DEFAULT_AI_REASONING_EFFORT = 'medium'

export function isSupportedAiChatModel(model = '') {
  return AI_CHAT_MODEL_OPTIONS.some(option => option.value === model)
}

export function sanitizeAiChatModel(model = '') {
  const trimmedModel = String(model || '').trim()
  return trimmedModel || DEFAULT_AI_CHAT_MODEL
}

export function getSupportedReasoningEfforts(model = '') {
  const normalizedModel = sanitizeAiChatModel(model).toLowerCase()

  if (normalizedModel.startsWith('gpt-5')) {
    return AI_REASONING_EFFORT_OPTIONS.map(option => option.value)
  }

  return [DEFAULT_AI_REASONING_EFFORT]
}

export function sanitizeReasoningEffort(model = '', reasoningEffort = '') {
  const supportedEfforts = getSupportedReasoningEfforts(model)
  return supportedEfforts.includes(reasoningEffort) ? reasoningEffort : supportedEfforts[0]
}

export function getAiModelLabel(model = '') {
  const normalizedModel = sanitizeAiChatModel(model)
  return AI_CHAT_MODEL_OPTIONS.find(option => option.value === normalizedModel)?.label || normalizedModel
}

export function getReasoningEffortLabel(reasoningEffort = '') {
  return AI_REASONING_EFFORT_OPTIONS.find(option => option.value === reasoningEffort)?.label || reasoningEffort
}
