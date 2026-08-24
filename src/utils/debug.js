const VERBOSE_DEBUG_STORAGE_KEY = 'feedback-verbose-logging'

export function isVerboseDebugEnabled() {
	try {
		return typeof localStorage !== 'undefined' && localStorage.getItem(VERBOSE_DEBUG_STORAGE_KEY) === 'true'
	} catch {
		return false
	}
}

export function debugLog(...args) {
	if (!isVerboseDebugEnabled()) return
	globalThis.console?.log(...args)
}

export function debugInfo(...args) {
	if (!isVerboseDebugEnabled()) return
	globalThis.console?.info(...args)
}

export { VERBOSE_DEBUG_STORAGE_KEY }
