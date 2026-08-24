import fs from "node:fs"
import path from "node:path"
import type { Plugin } from "@opencode-ai/plugin"

// ── Config resolution ───────────────────────────────────────────────────────

const projectRoot = path.resolve(import.meta.dirname, "..", "..")
const configPathJsonc = path.join(projectRoot, ".opencode", "model-fallback.jsonc")
const configPathJson = path.join(projectRoot, ".opencode", "model-fallback.json")
const configPath = fs.existsSync(configPathJsonc) ? configPathJsonc : configPathJson

type AgentConfig = {
  model?: string
  fallback_models?: Array<string | { model: string; [key: string]: unknown }>
}

type FallbackConfig = {
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
      if (escaped) {
        escaped = false
        continue
      }
      if (current === "\\") {
        escaped = true
        continue
      }
      if (current === stringQuote) {
        inString = false
      }
      continue
    }

    if (current === '"' || current === "'") {
      inString = true
      stringQuote = current
      result += current
      continue
    }

    if (current === "/" && next === "/") {
      while (index < input.length && input[index] !== "\n") {
        index += 1
      }
      if (index < input.length) {
        result += "\n"
      }
      continue
    }

    if (current === "/" && next === "*") {
      index += 2
      while (index < input.length && !(input[index] === "*" && input[index + 1] === "/")) {
        index += 1
      }
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
      if (escaped) {
        escaped = false
        continue
      }
      if (current === "\\") {
        escaped = true
        continue
      }
      if (current === stringQuote) {
        inString = false
      }
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
      while (nextIndex < input.length && /\s/.test(input[nextIndex])) {
        nextIndex += 1
      }
      if (input[nextIndex] === "}" || input[nextIndex] === "]") {
        continue
      }
    }

    result += current
  }

  return result
}

function readFallbackConfig(): FallbackConfig | null {
  if (!fs.existsSync(configPath)) {
    console.warn("[credit-fallback] model-fallback config not found at", configPath)
    return null
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8")
    const normalized = stripTrailingCommas(stripJsonComments(raw))
    return JSON.parse(normalized) as FallbackConfig
  } catch (error) {
    console.warn("[credit-fallback] failed to parse model-fallback config", error)
    return null
  }
}

function resolveModelString(entry: string | { model: string; [key: string]: unknown }): string {
  return typeof entry === "string" ? entry : entry.model
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
      console.warn(`[credit-fallback] agent model config collision: "${existing.configuredName}" and "${configuredName}" both normalize to "${normalized}"; keeping "${existing.configuredName}"`)
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

function buildPromptParts(parts: any[]): PromptPartInput[] {
  const result: PromptPartInput[] = []

  for (const part of parts) {
    if (part?.synthetic) continue
    if (part?.type === "text" && part.text) result.push({ type: "text", text: part.text })
    if (part?.type === "file" && part.url && part.mime) result.push({ type: "file", mime: part.mime, filename: part.filename, url: part.url })
    if (part?.type === "agent" && part.name) result.push({ type: "agent", name: part.name })
  }

  return result
}

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
    console.log(`[credit-fallback] agent "${agentName}" fallback chain: ${primary} -> ${fallbacks.join(", ")}`)
  }

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
      console.log(`[credit-fallback] agent chain flattened: ${primary} -> ${flat.join(", ")}`)
    }
  }

  return chain
}

// ── Credit-exhaustion patterns ─────────────────────────────────────────────
//
// Providers signal "no credits left" in different ways.  Some return a 402 or
// 429 with a specific message; others return a 200 with an error object in the
// body.  The existing project-fallback plugin catches HTTP-level retries
// (session.status → retry events), but credit errors that arrive as a 200 with
// an error payload never trigger that path.
//
// This plugin watches every assistant message for known credit-exhaustion
// strings and, when found, walks the same abort → revert → resend cycle used
// by project-fallback — but driven from the message content itself.
//
// Covered providers (extend CREDIT_PATTERNS to add more):
//   Anthropic  – "credit balance is too low", "insufficient credits"
//   OpenAI     – "insufficient_quota", "you exceeded your current quota"
//   DeepSeek   – "insufficient balance", "account balance"
//   Generic    – "billing", "out of credits", "no credits", "credit limit"
//               "payment required", "upgrade your plan", "quota exceeded"

const CREDIT_PATTERNS = [
  "credit balance is too low",
  "insufficient credits",
  "insufficient_quota",
  "you exceeded your current quota",
   "usage_limit_reached",              
  "the usage limit has been reached", 
  "insufficient balance",
  "account balance",
  "out of credits",
  "no credits",
  "credit limit",
  "payment required",
  "upgrade your plan",
  "quota exceeded",
  "billing_hard_limit",
  "rate limit exceeded",        // some providers reuse this for credit cap
  "resource_exhausted",         // Google / Gemini
  "402",                        // raw status string sometimes surfaced in body
]

function isCreditError(text: string): boolean {
  const lower = text.toLowerCase()
  return CREDIT_PATTERNS.some(p => lower.includes(p.toLowerCase()))
}

function parseModelKey(model: string): { providerID: string; modelID: string } {
  const slash = model.indexOf("/")
  if (slash === -1) return { providerID: model, modelID: model }
  return { providerID: model.substring(0, slash), modelID: model.substring(slash + 1) }
}

// ── Fallback chain ─────────────────────────────────────────────────────────
//
// Chains are read from .opencode/model-fallback.jsonc (or .json) and mirror
// the same per-agent routing used by project-fallback.

// ── Per-session state ──────────────────────────────────────────────────────

type CreditState = {
  attempts: number
  exhausted: Set<string>
  locked: boolean
  chain: string[]
}

const states = new Map<string, CreditState>()

function getState(id: string): CreditState {
  let s = states.get(id)
  if (!s) {
    s = { attempts: 0, exhausted: new Set(), locked: false, chain: [] }
    states.set(id, s)
  }
  return s
}

// ── Plugin ─────────────────────────────────────────────────────────────────

export default (async (input) => {
  const config = readFallbackConfig()
  const fallbackChain = buildFallbackChain(config?.agents)
  const agentConfigIndex = buildAgentConfigIndex(config?.agents)

  console.log(
    `[credit-fallback] effective chains: ${
      [...fallbackChain.entries()]
        .map(([primary, chain]) => `${primary} -> ${chain.join(" -> ")}`)
        .join(" | ") || "(none)"
    }`
  )
  console.log("[credit-fallback] plugin loaded")

  return {
    event: async ({ event }) => {
      // Clean up state for deleted sessions
      if (event.type === "session.deleted") {
        const id = (event.properties as any).info?.id
        if (id) states.delete(id)
        return
      }

      if (event.type !== "session.status") return

      const props = event.properties as {
        sessionID: string
        status: { type: string; message?: string }
      }

      // We only care about the message content, not the status type here —
      // but we use idle to reset the lock so a new user turn starts clean.
      if (props.status.type === "idle") {
        const s = states.get(props.sessionID)
        if (s) s.locked = false
        return
      }

      // We do NOT handle "retry" here — that's project-fallback's job.
      // We only act when a message arrives (see chat.message hook below).
    },

    // The key hook: inspect every assistant message for credit-error text.
    "chat.message": async (input2, output) => {
      const sessionID: string | undefined = (input2 as any)?.sessionID
      const message = output?.message as any
      const role: string | undefined = message?.role
      const content: unknown = message?.content

      if (!sessionID || role !== "assistant") return

      // Extract text from content (string or parts array)
      let text = ""
      if (typeof content === "string") {
        text = content
      } else if (Array.isArray(content)) {
        text = content
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text ?? "")
          .join(" ")
      }

      if (!text || !isCreditError(text)) return

      const state = getState(sessionID)
      if (state.locked) return

      // Determine which model just failed
      const messagesResponse = await input.client.session.messages({ path: { id: sessionID } }).catch(() => null)
      const messages: any[] = (messagesResponse?.data ?? []) as any[]

      const reversed = [...messages].reverse()
      const lastAssistant = reversed.find((m: any) => m.info?.role === "assistant")
      const lastUser = reversed.find((m: any) => m.info?.role === "user")

      if (!lastUser) {
        console.warn(`[credit-fallback] no user message in session ${sessionID}`)
        return
      }

      const lastUserModel = lastUser.info?.model
        ? `${lastUser.info.model.providerID}/${lastUser.info.model.modelID}`
        : null
      const lastAssistantModel = lastAssistant?.info?.model
        ? `${lastAssistant.info.model.providerID}/${lastAssistant.info.model.modelID}`
        : null
      const resolvedAgent = resolveAgentConfig(agentConfigIndex, lastUser.info?.agent)
      const configuredAgentModel = resolvedAgent?.config.model ?? null

      const failingModel = lastUserModel ?? lastAssistantModel ?? configuredAgentModel

      if (!failingModel && state.chain.length === 0) {
        console.warn(`[credit-fallback] cannot determine failing model in session ${sessionID}`)
        return
      }

      if (!failingModel && state.chain.length > 0) {
        console.log(`[credit-fallback] continuing existing fallback chain in session ${sessionID} despite missing model metadata`)
      }

      if (failingModel) {
        state.exhausted.add(failingModel)
      }

      console.log(`[credit-fallback] credit error detected in session ${sessionID} — agent "${lastUser.info?.agent ?? "(unknown)"}"${resolvedAgent ? ` (${resolvedAgent.configuredName})` : ""} model "${failingModel ?? "(unknown)"}" exhausted`)

      if (state.chain.length === 0) {
        const chain = failingModel ? fallbackChain.get(failingModel) : undefined
        if (!chain || chain.length === 0) {
          console.error(`[credit-fallback] no fallback chain defined for model "${failingModel ?? "(unknown)"}" in ${configPath}`)
          return
        }
        state.chain = chain
      }

      // Find next model in chain that hasn't been exhausted yet
      const nextModelStr = state.chain.find(m => !state.exhausted.has(m))
      if (!nextModelStr) {
        console.error(`[credit-fallback] all fallback models exhausted in session ${sessionID} — cannot continue (chain: ${state.chain.join(" -> ")})`)
        return
      }

      state.locked = true
      state.attempts += 1
      console.log(`[credit-fallback] session ${sessionID}: agent "${lastUser.info?.agent ?? "(unknown)"}" attempt ${state.attempts} — falling back to "${nextModelStr}"`)

      try {
        await input.client.session.abort({ path: { id: sessionID } })
        await new Promise(r => setTimeout(r, 200))

        await input.client.session.revert({
          path: { id: sessionID },
          body: { messageID: lastUser.info.id },
        })
        await new Promise(r => setTimeout(r, 500))

        const parts = buildPromptParts(lastUser.parts ?? [])

        if (parts.length === 0) {
          console.warn(`[credit-fallback] no parts to resend in session ${sessionID}`)
          state.locked = false
          return
        }

        const nextModel = parseModelKey(nextModelStr)

        await input.client.session.prompt({
          path: { id: sessionID },
          body: {
            model: nextModel,
            agent: lastUser.info?.agent,
            parts: parts as any,
          },
        })

        console.log(`[credit-fallback] session ${sessionID}: prompt resent with model "${nextModelStr}"`)
      } catch (err) {
        console.error(`[credit-fallback] session ${sessionID}: fallback failed —`, err instanceof Error ? err.message : String(err))
        state.locked = false
      }
    },
  }
}) satisfies Plugin
