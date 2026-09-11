import fs from "node:fs"
import path from "node:path"
import type { Plugin } from "@opencode-ai/plugin"

// ── Config resolution ─────────────────────────────────────────────────────

const projectRoot = path.resolve(import.meta.dirname, "..", "..")
const configPathJsonc = path.join(projectRoot, ".opencode", "model-fallback.jsonc")
const configPathJson  = path.join(projectRoot, ".opencode", "model-fallback.json")
const configPath = fs.existsSync(configPathJsonc) ? configPathJsonc : configPathJson

// ── Types ─────────────────────────────────────────────────────────────────────

type RuntimeFallbackObject = {
  enabled?: boolean
  model?: string
  fallbackModel?: string
  cooldown_seconds?: number
  max_fallback_attempts?: number
  notify_on_fallback?: boolean
  retry_on_errors?: Array<number | string>
  timeout_seconds?: number
}

type AgentConfig = {
  model?: string
  fallback_models?: Array<string | { model: string; [key: string]: unknown }>
}

type FallbackConfig = {
  runtime_fallback?: boolean | RuntimeFallbackObject
  agents?: Record<string, AgentConfig>
}

type AgentConfigEntry = {
  configuredName: string
  config: AgentConfig
}

type PromptPartInput =
  | { type: "text"; text: string }
  | { type: "file"; mime: string; filename?: string; url: string }
  | { type: "agent"; name: string }

type SessionState = {
  pluginAbortedAt: number
  fallbackAttempts: number
  cooldownEndTime: number
  chain: string[]
}

const DEFAULT_RETRY_MESSAGE_PATTERNS = [
  "usage limit has been reached",
  "insufficient credits",
  "insufficient_quota",
  "out of credits",
  "quota exceeded",
  "payment required",
  "resource_exhausted",
]

// ── JSON parsing helpers ──────────────────────────────────────────────────────

function stripJsonComments(input: string): string {
  let result = ""
  let inString = false
  let stringQuote = '"'
  let escaped = false

  for (let index = 0; index < input.length; index += 1) {
    const current = input[index]
    const next = input[index + 1]

    if (inString) {
      result += current
      if (escaped) { escaped = false; continue }
      if (current === "\\") { escaped = true; continue }
      if (current === stringQuote) { inString = false }
      continue
    }

    if (current === '"' || current === "'") {
      inString = true
      stringQuote = current
      result += current
      continue
    }

    if (current === "/" && next === "/") {
      while (index < input.length && input[index] !== "\n") { index += 1 }
      if (index < input.length) { result += "\n" }
      continue
    }

    if (current === "/" && next === "*") {
      index += 2
      while (index < input.length && !(input[index] === "*" && input[index + 1] === "/")) { index += 1 }
      index += 1
      continue
    }

    result += current
  }

  return result
}

function stripTrailingCommas(input: string): string {
  let result = ""
  let inString = false
  let stringQuote = '"'
  let escaped = false

  for (let index = 0; index < input.length; index += 1) {
    const current = input[index]

    if (inString) {
      result += current
      if (escaped) { escaped = false; continue }
      if (current === "\\") { escaped = true; continue }
      if (current === stringQuote) { inString = false }
      continue
    }

    if (current === '"' || current === "'") {
      inString = true
      stringQuote = current
      result += current
      continue
    }

    if (current === ",") {
      let nextIndex = index + 1
      while (nextIndex < input.length && /\s/.test(input[nextIndex])) { nextIndex += 1 }
      if (input[nextIndex] === "}" || input[nextIndex] === "]") { continue }
    }

    result += current
  }

  return result
}

function readFallbackConfig(): FallbackConfig | null {
  if (!fs.existsSync(configPath)) {
    console.warn("[fallback] model-fallback config not found at", configPath)
    return null
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8")
    const normalized = stripTrailingCommas(stripJsonComments(raw))
    return JSON.parse(normalized) as FallbackConfig
  } catch (error) {
    console.warn("[fallback] Failed to parse model-fallback config", error)
    return null
  }
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function resolveModelString(entry: string | { model: string; [key: string]: unknown }): string {
  return typeof entry === "string" ? entry : entry.model
}

function parseModelKey(model: string): { providerID: string; modelID: string } {
  const slash = model.indexOf("/")
  if (slash === -1) return { providerID: model, modelID: model }
  return { providerID: model.substring(0, slash), modelID: model.substring(slash + 1) }
}

function modelKey(providerID: string, modelID: string): string {
  return `${providerID}/${modelID}`
}

function normalizeAgentName(name: string | undefined): string {
  return (name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

function buildAgentConfigIndex(agents: Record<string, AgentConfig> | undefined): Map<string, AgentConfigEntry> {
  const index = new Map<string, AgentConfigEntry>()
  if (!agents) return index

  for (const [configuredName, agentConfig] of Object.entries(agents)) {
    const normalized = normalizeAgentName(configuredName)
    if (!normalized) continue

    const existing = index.get(normalized)
    if (existing && existing.configuredName !== configuredName) {
      console.warn(`[fallback] agent model config collision: "${existing.configuredName}" and "${configuredName}" both normalize to "${normalized}"; keeping "${existing.configuredName}"`)
      continue
    }

    index.set(normalized, { configuredName, config: agentConfig })
  }

  return index
}

function resolveAgentConfig(agentIndex: Map<string, AgentConfigEntry>, agentName: string | undefined): AgentConfigEntry | null {
  const normalized = normalizeAgentName(agentName)
  if (!normalized) return null
  return agentIndex.get(normalized) ?? null
}

function buildPromptParts(parts: Array<{ type: string; text?: string; mime?: string; filename?: string; url?: string; name?: string; synthetic?: boolean }>): PromptPartInput[] {
  const result: PromptPartInput[] = []

  for (const part of parts) {
    if (part.synthetic) continue
    if (part.type === "text" && part.text) result.push({ type: "text", text: part.text })
    if (part.type === "file" && part.url && part.mime) result.push({ type: "file", mime: part.mime, filename: part.filename, url: part.url })
    if (part.type === "agent" && part.name) result.push({ type: "agent", name: part.name })
  }

  return result
}

/**
 * Build a map of primaryModel → ordered fallback chain.
 * Chains are recursively flattened so that transitive fallbacks are covered.
 * Multiple agents can share the same primary model; chains are merged+deduped.
 */
function buildFallbackChain(agents: Record<string, AgentConfig> | undefined): Map<string, string[]> {
  const chain = new Map<string, string[]>()
  if (!agents) return chain

  for (const [agentName, agentCfg] of Object.entries(agents)) {
    if (!agentCfg.model || !agentCfg.fallback_models?.length) continue
    const primary = agentCfg.model
    const fallbacks = agentCfg.fallback_models.map(resolveModelString)
    const existing = chain.get(primary) ?? []
    const merged = [...new Set([...existing, ...fallbacks])]
    chain.set(primary, merged)
    console.log(`[fallback] agent "${agentName}" fallback chain: ${primary} → ${fallbacks.join(", ")}`)
  }

  // Recursively flatten: each primary model's chain absorbs the chains of its fallbacks
  const flatten = (visited: Set<string>, model: string): string[] => {
    if (visited.has(model)) return []
    visited.add(model)
    const direct = chain.get(model)
    if (!direct || direct.length === 0) return []
    const result: string[] = []
    for (const fb of direct) {
      if (!result.includes(fb)) result.push(fb)
    }
    for (const fb of direct) {
      for (const transitive of flatten(visited, fb)) {
        if (!result.includes(transitive)) result.push(transitive)
      }
    }
    return result
  }

  for (const primary of chain.keys()) {
    const flat = flatten(new Set(), primary)
    if (flat.length > (chain.get(primary)?.length ?? 0)) {
      chain.set(primary, flat)
      console.log(`[fallback] agent chain flattened: ${primary} → ${flat.join(", ")}`)
    }
  }

  return chain
}

function classifyRetryCodes(codes: Array<number | string>): { rateLimitPatterns: string[]; disconnectPatterns: string[] } {
  const rateLimitCodes = new Set([401, 403, 404, 429])
  const disconnectCodes = new Set([500, 502, 503, 504, 529])

  return codes.reduce<{ rateLimitPatterns: string[]; disconnectPatterns: string[] }>((result, code) => {
    if (typeof code === "number") {
      const pattern = String(code)
      if (rateLimitCodes.has(code)) result.rateLimitPatterns.push(pattern)
      if (disconnectCodes.has(code)) result.disconnectPatterns.push(pattern)
      if (!rateLimitCodes.has(code) && !disconnectCodes.has(code)) result.rateLimitPatterns.push(pattern)
      return result
    }

    const trimmed = code.trim()
    if (trimmed.length > 0) {
      result.rateLimitPatterns.push(trimmed)
    }

    return result
  }, { rateLimitPatterns: [], disconnectPatterns: [] })
}

function createMatcher(patterns: string[]) {
  return (message: string): boolean => {
    const lower = message.toLowerCase()
    return patterns.some(p => lower.includes(p.toLowerCase()))
  }
}

function warnUnsupportedRuntimeFallback(rf: RuntimeFallbackObject) {
  const supported = new Set(["enabled", "model", "fallbackModel", "cooldown_seconds", "max_fallback_attempts", "notify_on_fallback", "retry_on_errors", "timeout_seconds"])
  for (const key of Object.keys(rf)) {
    if (!supported.has(key)) {
      console.warn(`[fallback] runtime_fallback.${key} is not a recognised field and will be ignored`)
    }
  }
  if (rf.notify_on_fallback !== undefined) {
    console.warn("[fallback] runtime_fallback.notify_on_fallback is not supported and will be ignored")
  }
  if (rf.timeout_seconds !== undefined) {
    console.warn("[fallback] runtime_fallback.timeout_seconds is not supported and will be ignored")
  }
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default (async (input) => {
  const config = readFallbackConfig()

  // ── Derive runtime_fallback settings ────────────────────────────────────────
  const rf = config?.runtime_fallback
  let fallbackEnabled = true
  let cooldownMs = 300_000
  let maxFallbackAttempts = 3
  let retryPatterns: { rateLimitPatterns: string[]; disconnectPatterns: string[] } = {
    rateLimitPatterns: [],
    disconnectPatterns: [],
  }

  if (rf === false) {
    fallbackEnabled = false
  } else if (rf !== undefined && rf !== true) {
    warnUnsupportedRuntimeFallback(rf)
    fallbackEnabled = rf.enabled ?? true
    cooldownMs = rf.cooldown_seconds !== undefined ? rf.cooldown_seconds * 1000 : cooldownMs
    maxFallbackAttempts = rf.max_fallback_attempts ?? maxFallbackAttempts
    retryPatterns = classifyRetryCodes(rf.retry_on_errors ?? [])
  }

  // Combine rate-limit and disconnect patterns into one matcher —
  // all retry_on_errors codes trigger the fallback chain.
  const allPatterns = [...new Set([
    ...DEFAULT_RETRY_MESSAGE_PATTERNS,
    ...retryPatterns.rateLimitPatterns,
    ...retryPatterns.disconnectPatterns,
  ])]
  const isRetryMessage = createMatcher(allPatterns)

  // ── Build fallback chain lookup ──────────────────────────────────────────────
  const fallbackChain = buildFallbackChain(config?.agents)
  const agentConfigIndex = buildAgentConfigIndex(config?.agents)
  console.log(
    `[fallback] effective chains: ${
      [...fallbackChain.entries()]
        .map(([primary, chain]) => `${primary} -> ${chain.join(" -> ")}`)
        .join(" | ") || "(none)"
    }`
  )

  // ── Session state ────────────────────────────────────────────────────────────
  const sessionStates = new Map<string, SessionState>()

  function getState(sessionID: string): SessionState {
    let state = sessionStates.get(sessionID)
    if (!state) {
      state = { pluginAbortedAt: 0, fallbackAttempts: 0, cooldownEndTime: 0, chain: [] }
      sessionStates.set(sessionID, state)
    }
    return state
  }

  console.log(`[fallback] plugin initialised — routing: ${config?.agents ? Object.keys(config.agents).length : 0} agents, fallback: ${fallbackEnabled ? "enabled" : "disabled"}`)

  return {
    // ── Hook 1: inject per-agent primary models into live config ──────
    config: async (cfg) => {
      if (!config?.agents) return

      for (const [agentName, agentCfg] of Object.entries(config.agents)) {
        if (!agentCfg.model) continue

        // cfg.agent is typed as the opencode AgentConfig map; cast via any to
        // avoid depending on the exact SDK shape at type-check time.
        const agentMap = (cfg as any).agent ?? {}
        const matchingAgentNames = new Set<string>([agentName])
        const normalizedAgentName = normalizeAgentName(agentName)

        for (const existingAgentName of Object.keys(agentMap)) {
          if (normalizeAgentName(existingAgentName) === normalizedAgentName) {
            matchingAgentNames.add(existingAgentName)
          }
        }

        for (const matchingAgentName of matchingAgentNames) {
          if (!agentMap[matchingAgentName]) agentMap[matchingAgentName] = {}
          agentMap[matchingAgentName].model = agentCfg.model
        }

        ;(cfg as any).agent = agentMap

        console.log(`[fallback] agent "${agentName}" model → ${agentCfg.model}${matchingAgentNames.size > 1 ? ` (aliases: ${[...matchingAgentNames].join(", ")})` : ""}`)
      }
    },

    // ── Hook 2: walk fallback chain on session retry events ───────────────────
    event: async ({ event }) => {
      if (!fallbackEnabled) return

      if (event.type === "session.deleted") {
        const props = event.properties as { info?: { id?: string } }
        if (props.info?.id) {
          sessionStates.delete(props.info.id)
        }
        return
      }

      if (event.type !== "session.status") return

      const props = event.properties as {
        sessionID: string
        status: {
          type: "idle" | "retry" | "busy"
          attempt?: number
          message?: string
          next?: number
        }
      }

      const { sessionID, status } = props

      // Reset cooldown on idle if expired
      if (status.type === "idle") {
        const state = sessionStates.get(sessionID)
        if (state && Date.now() >= state.cooldownEndTime) {
          state.fallbackAttempts = 0
          state.cooldownEndTime = 0
          state.chain = []
          console.log(`[fallback] session ${sessionID} idle — fallback state reset`)
        }
        return
      }

      if (status.type !== "retry" || !status.message) return

      const state = getState(sessionID)

      // Suppress stale retry events fired before our own abort settled
      const ABORT_GRACE_MS = 5_000
      if (state.pluginAbortedAt > 0 && Date.now() - state.pluginAbortedAt < ABORT_GRACE_MS) {
        console.log(`[fallback] ignoring stale retry event within abort grace window (session ${sessionID})`)
        return
      }

      // Pattern check
      if (!isRetryMessage(status.message)) {
        console.log(`[fallback] retry event has no matching pattern — not handled (session ${sessionID}): ${status.message}`)
        return
      }

      // Cooldown check
      if (Date.now() < state.cooldownEndTime) {
        console.log(`[fallback] cooldown active, skipping fallback (session ${sessionID}, remaining: ${state.cooldownEndTime - Date.now()}ms)`)
        return
      }

      // Max attempts check
      if (state.fallbackAttempts >= maxFallbackAttempts) {
        console.log(`[fallback] max fallback attempts (${maxFallbackAttempts}) reached for session ${sessionID} — giving up`)
        return
      }

      try {
        // Fetch messages to find the current (failing) model
        const messagesResponse = await input.client.session.messages({ path: { id: sessionID } })
        const messages = (messagesResponse.data ?? []) as Array<{
          info: { role: string; id: string; agent?: string; model?: { providerID: string; modelID: string } }
          parts: Array<{ type: string; text?: string; mime?: string; filename?: string; url?: string; name?: string; synthetic?: boolean }>
        }>

        if (messages.length === 0) {
          console.log(`[fallback] no messages found in session ${sessionID}`)
          return
        }

        const reversed = [...messages].reverse()
        const lastAssistant = reversed.find(m => m.info.role === "assistant")
        const lastUser = reversed.find(m => m.info.role === "user")

        if (!lastUser) {
          console.log(`[fallback] no user message found in session ${sessionID}`)
          return
        }

        // Determine failing model from freshest available metadata.
        // Retry events can arrive before a new assistant message is recorded,
        // so we probe user message model first, then last assistant, then
        // configured agent primary model.
        const lastUserModel = lastUser.info.model
          ? modelKey(lastUser.info.model.providerID, lastUser.info.model.modelID)
          : null
        const lastAssistantModel = lastAssistant?.info.model
          ? modelKey(lastAssistant.info.model.providerID, lastAssistant.info.model.modelID)
          : null
        const resolvedAgent = resolveAgentConfig(agentConfigIndex, lastUser.info.agent)
        const configuredAgentModel = resolvedAgent?.config.model ?? null

        const failingModel = lastUserModel ?? lastAssistantModel ?? configuredAgentModel

        if (!failingModel && state.chain.length === 0) {
          console.log(`[fallback] cannot determine failing model in session ${sessionID}`)
          return
        }

        if (!failingModel && state.chain.length > 0) {
          console.log(`[fallback] continuing existing fallback chain in session ${sessionID} despite missing model metadata`)
        }

        // Look up chain (persist in session state so cross-model traversal works)
        if (state.chain.length === 0) {
          const chain = failingModel ? fallbackChain.get(failingModel) : undefined
          if (!chain || chain.length === 0) {
            console.log(`[fallback] no fallback chain defined for model "${failingModel ?? "(unknown)"}" (session ${sessionID})`)
            return
          }
          state.chain = chain
        }

        const nextModelStr = state.chain[state.fallbackAttempts]
        if (!nextModelStr) {
          console.log(`[fallback] fallback chain exhausted for "${failingModel ?? "(unknown)"}" after ${state.fallbackAttempts} attempt(s) (session ${sessionID})`)
          return
        }

        const nextModel = parseModelKey(nextModelStr)
        console.log(`[fallback] session ${sessionID}: agent "${lastUser.info.agent ?? "(unknown)"}"${resolvedAgent ? ` (${resolvedAgent.configuredName})` : ""} model "${failingModel ?? "(unknown)"}" failed (attempt ${state.fallbackAttempts + 1}/${maxFallbackAttempts}) → falling back to "${nextModelStr}"`)

        // Update state before async ops to prevent re-entry
        state.fallbackAttempts += 1
        state.pluginAbortedAt = Date.now()
        state.cooldownEndTime = Date.now() + cooldownMs

        // Abort → wait → revert → wait → resend with next model
        await input.client.session.abort({ path: { id: sessionID } })
        await new Promise(resolve => setTimeout(resolve, 200))

        await input.client.session.revert({
          path: { id: sessionID },
          body: { messageID: lastUser.info.id },
        })
        await new Promise(resolve => setTimeout(resolve, 500))

        const parts = buildPromptParts(lastUser.parts)

        if (parts.length === 0) {
          console.log(`[fallback] no valid parts to resend in session ${sessionID}`)
          return
        }

        await input.client.session.prompt({
          path: { id: sessionID },
          body: {
            model: nextModel,
            agent: lastUser.info.agent,
            parts: parts as any,
          },
        })

        console.log(`[fallback] session ${sessionID}: fallback prompt sent with model "${nextModelStr}"`)
      } catch (err) {
        console.error(`[fallback] session ${sessionID}: fallback failed —`, err instanceof Error ? err.message : String(err))
      }
    },
  }
}) satisfies Plugin
