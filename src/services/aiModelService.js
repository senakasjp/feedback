export const AI_CHAT_MODEL_OPTIONS = [
  { value: 'gpt-5.4', label: 'GPT-5.4' },
  { value: 'gpt-5.4-mini', label: 'GPT-5.4-Mini' },
  { value: 'gpt-5.3-codex', label: 'GPT-5.3-Codex' },
  { value: 'gpt-5.2-codex', label: 'GPT-5.2-Codex' },
  { value: 'gpt-5.2', label: 'GPT-5.2' },
  { value: 'gpt-5.1-codex-max', label: 'GPT-5.1-Codex-Max' },
  { value: 'gpt-5.1-codex-mini', label: 'GPT-5.1-Codex-Mini' }
]

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
  return isSupportedAiChatModel(model) ? model : DEFAULT_AI_CHAT_MODEL
}

export function getSupportedReasoningEfforts(model = '') {
  const normalizedModel = sanitizeAiChatModel(model)

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
  return AI_CHAT_MODEL_OPTIONS.find(option => option.value === model)?.label || model
}

export function getReasoningEffortLabel(reasoningEffort = '') {
  return AI_REASONING_EFFORT_OPTIONS.find(option => option.value === reasoningEffort)?.label || reasoningEffort
}
