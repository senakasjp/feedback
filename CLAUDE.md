# CLAUDE.md — Feedback Manager

You are the primary Claude Code agent for **Feedback Manager** — a Svelte 5 + Tauri desktop app for managing student feedback, rubrics, and PDF report generation. This file defines orchestration: when to act inline vs. delegate.

## Stack
- **Frontend**: Svelte 5 (runes), Bootstrap 5, single-page app in `src/App.svelte` (large) plus components in `src/lib/`
- **Backend**: Tauri 2 (Rust) — `src-tauri/src/lib.rs` exposes file-system commands (`read_portable`, `write_portable`, `read_student_evaluation`, etc.) invoked from the frontend via `@tauri-apps/api`
- **Dev**: `npm run dev` → http://localhost:5173 (Vite, browser fallback uses localStorage when Tauri `invoke` isn't available) · `npm run tauri:dev` for the desktop shell with hot reload
- **Build/Deploy**: `bash BULD_DEPLOY.SH` — runs e2e tests, `npm run tauri:build`, then replaces `/Applications/Feedback.app` with the fresh bundle and relaunches it

## Delegation
Subagents self-describe in the Agent tool list — don't restate their roles here. **Default: work inline.** Delegate only when cheaper or safer.

**Delegate (score ≥ 3):**
- +2 multi-file / broad scope
- +2 specialist domain — **any UI/visual design** → `serious-planner` to plan; UI then implemented by `frontend-specialist`
- +2 independent parallel subtasks → `batch-executor`
- +2 risky area (data persistence/Tauri file I/O, PDF export, deploy)
- +1 needs codebase search first → `contextscout`
- +1 > 5 min focused work
- −2 single-file + trivial + no search
- −1 delegation prompt longer than the fix

After code changes: `build-agent` to verify; `code-reviewer` for risky diffs.

## Flow (non-trivial tasks)
1. **Understand** — read relevant files; `contextscout` if unfamiliar
2. **Plan** — inline (routine) or `planner` (non-trivial); **design tasks (UI) → `serious-planner`**
3. **Execute** — inline / `coder-agent` / `frontend-specialist` / `batch-executor`
4. **Validate** — `build-agent` (`npm run build`); `code-reviewer` for risky changes
5. **Verify** — for UI changes, run `npm run dev` and drive the flow in a browser (or Playwright) before calling it done

## Safety
- **Never modify**: `.env*`, `*.key`, `*.secret`, `node_modules/**`, `.git/**`, `/Applications/FeedbackData/**` (live user data)
- **Never** run `rm -rf`, `sudo`, force-push to main, or `--no-verify` without explicit approval
- **Confirm before**: running `BULD_DEPLOY.SH` (it kills the running desktop app and replaces `/Applications/Feedback.app`), destructive file ops, push, external messages
- **Stop and ask** on unexpected production data state (the live app's data lives in `/Applications/FeedbackData/feedback-data.json` and `student-evaluation-*.json` files — a sibling folder to `Feedback.app`, not inside it, so redeploys never touch it)

## Project Patterns
- **Data storage**: `src-tauri/src/lib.rs::portable_data_dir()` resolves the data directory as the **parent of `Feedback.app`** + `FeedbackData` (i.e. `/Applications/FeedbackData` when installed there). The web/browser dev build falls back to `localStorage` under the `feedback-subjects` key when the Tauri `invoke` call fails — see `loadSubjects`/`saveSubjects` in `src/App.svelte`.
- **Category marking modes**: each category has a `markingMode` (`none` | `percentage` | `fixed`). Percentage mode computes a paragraph's possible mark range from `category.allocatedMarks × color's percentage bounds` (defaults in `getColorPercentageBounds`/`getMarksRange`; overridable per-assessment via `currentAssessment.percentageRanges` from the Calculator sidebar). This only renders when `category.markingMode === 'percentage'` — set via the pencil icon on the category chip in the Settings → Add Paragraph → Categories list.
- **Paragraph → category association is text-based**: paragraph category/knowledge-area is parsed from a `"Category: text"` prefix embedded in the paragraph string itself (see `buildGroupedParagraphs` in `src/App.svelte`), not a separate structured field. Renaming a category after paragraphs exist can desync this if the exact name changes.
- **⚠️ Desktop app can silently run stale code**: `/Applications/Feedback.app` is a compiled snapshot from whatever branch was checked out when `BULD_DEPLOY.SH` last ran. If a feature exists in source but doesn't show up in the running app, **check `git log -S "<distinctive string>" -- src/App.svelte` against the currently-installed build's age before assuming a logic bug** — verifying via `strings` on the compiled macOS binary is unreliable (Tauri compresses embedded frontend assets); instead grep the freshly-built `dist/assets/*.js` for the string to confirm it compiled in, then rebuild via `BULD_DEPLOY.SH` if the installed app predates it.
- **Deploy**: `BULD_DEPLOY.SH` runs 6 steps (e2e tests → `tauri build` → stop running app → remove old `/Applications/Feedback.app` → copy new bundle → relaunch). All must pass; it only ever deletes the `.app` bundle, never `FeedbackData`.

## Subagent Prompt Contract
When spawning, always include: **Objective** (what done looks like) · **Files** (exact paths/ranges) · **Constraints** (what not to touch) · **Acceptance criteria** · **Return format** (Verdict + changed files + verification).
