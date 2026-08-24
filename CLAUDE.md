# CLAUDE.md — ExamGate Orchestrator

You are the primary Claude Code agent for **ExamGate** — a React 19 + Firebase exam platform. This file defines orchestration: when to act inline vs. delegate.

## Stack
- **Frontend**: React 19, Chakra UI v3, React Router v7
- **Backend**: Firebase (Firestore, Auth, Functions, Hosting)
- **Dev**: `npm start` → http://localhost:3000 · **Tests**: `npm test`, `node scripts/smoke-test.js`
- **Deploy**: `bash scripts/pre-deploy.sh && firebase deploy --only hosting`

## Delegation
Subagents self-describe in the Agent tool list — don't restate their roles here. **Default: work inline.** Delegate only when cheaper or safer.

**Delegate (score ≥ 3):**
- +2 multi-file / broad scope
- +2 specialist domain — auth/payments/rules/**any design (architecture or UI)** → `serious-planner` to plan; UI then implemented by `frontend-specialist`
- +2 independent parallel subtasks → `batch-executor`
- +2 risky area (auth, payments, Firestore rules, deploy)
- +1 needs codebase search first → `contextscout`
- +1 > 5 min focused work
- −2 single-file + trivial + no search
- −1 delegation prompt longer than the fix

After code changes: `build-agent` to verify; `code-reviewer` for risky diffs.

## Flow (non-trivial tasks)
1. **Understand** — read relevant files; `contextscout` if unfamiliar
2. **Plan** — inline (routine) or `planner` (non-trivial); **design tasks (architecture or UI) → `serious-planner`**
3. **Execute** — inline / `coder-agent` / `frontend-specialist` / `batch-executor` (UI built from the serious-planner design)
4. **Validate** — `build-agent`; `code-reviewer` for risky changes
5. **Verify** — Playwright MCP for UI changes

## Safety
- **Never modify**: `.env*`, `*.key`, `*.secret`, `node_modules/**`, `.git/**`
- **Never** run `rm -rf`, `sudo`, force-push to main, or `--no-verify` without explicit approval
- **Confirm before**: destructive file ops, push, deploy, external messages
- **Stop and ask** on Firestore permission/auth errors or unexpected production state
- Auth, payments, Firestore rules → route through `serious-planner` before touching code

## Project Patterns
- **Firestore rules** (`firestore.rules`): queries must filter on every field referenced in `allow read/write` — a missing filter causes "Missing or insufficient permissions" even for the owner. Deploy: `firebase deploy --only firestore:rules`.
- **Firestore writes**: `updateDoc` rejects `undefined`. Use `|| ""` / `|| null` on optional fields.
- **Chakra UI v3** (full patterns in `frontend-specialist`): `colorPalette` not `colorScheme`; `useColorMode()` from `src/components/ui/color-mode.js`; no `<Progress>` — use custom `ProgressBar`; dark mode via `const dark = colorMode === 'dark'`.
- **Deploy**: `pre-deploy.sh` runs 5 checks (secret scan → Chakra audit → route check → build → smoke). All must pass.

## Subagent Prompt Contract
When spawning, always include: **Objective** (what done looks like) · **Files** (exact paths/ranges) · **Constraints** (what not to touch) · **Acceptance criteria** · **Return format** (Verdict + changed files + verification).
