# CLAUDE.md — Feedback Manager Orchestrator

You are the primary Claude Code agent for **Feedback Manager** — a Tauri v2 + Svelte 5 desktop app for managing student feedback and AI-assisted marking. This file defines orchestration: when to act inline vs. delegate.

## Stack
- **Frontend**: Svelte 5 (single large `src/App.svelte`, ~375K, plus components in `src/lib/` and `src/components/`), Vite 7, Bootstrap/sveltestrap. No React, no Chakra.
- **Backend**: Rust (`src-tauri/src/lib.rs`). No Firebase/Firestore — data persistence is plain JSON files via custom Tauri commands (`write_portable`, `read_portable`, `write_student_evaluation`, etc.).
- **Data storage**: a `FeedbackData` folder resolved by `portable_data_dir()` (src-tauri/src/lib.rs) as the **sibling directory next to the running `.app` bundle** (or next to the executable on non-macOS) — not a fixed OS app-support path. Moving/renaming the `.app` changes where it looks. Main store is `FeedbackData/feedback-data.json`; per-student evaluations are separate `student-evaluation-*.json` files in the same folder.
- **Dev**: `npm run dev` (Vite, http://localhost:5173) for frontend-only; `npm run tauri:dev` for the full desktop shell.
- **Build**: `npm run build` (frontend only) or `npm run tauri:build` (full bundle — Rust release compile ~1 min, then bundles to `src-tauri/target/release/bundle/macos/Feedback.app` and a `.dmg`).
- **Tests**: `npm run test:e2e` (Playwright).
- **Install/run a local build**: copy the built `.app` into `/Applications`, backing up the existing one first (this project already uses a `Feedback.app.backup-<timestamp>` convention there — follow it). Local builds are unsigned/ad-hoc — clear the quarantine flag with `xattr -cr` before `open`, otherwise Gatekeeper blocks or translocates it.
- **AI/LLM**: `src/services/aiMarkingService.js` + `src/services/openaiService.js` — multi-provider abstraction (API keys entered in-app GUI). Prompts are assembled from composable message-builder functions (`buildSystemMessages`, `buildPerAnswerSystemMessages`, `buildRetrievedContextMessages`, etc.), not one big template string.
- **Document extraction**: `src/services/documentTextExtractor.js` — mammoth for `.docx`, pdfjs-dist for `.pdf`. Text-only; embedded images are currently discarded (not yet sent to vision models).

## Delegation
Subagents self-describe in the Agent tool list — don't restate their roles here. **Default: work inline.** Delegate only when cheaper or safer.

**Delegate (score ≥ 3):**
- +2 multi-file / broad scope
- +2 specialist domain — **any design (architecture or UI)** → `serious-planner` to plan; UI then implemented by `frontend-specialist`
- +2 independent parallel subtasks → `batch-executor`
- +2 risky area (AI prompt construction affecting grading output, data-file persistence, deploy)
- +1 needs codebase search first → `contextscout`
- +1 > 5 min focused work
- −2 single-file + trivial + no search
- −1 delegation prompt longer than the fix

After code changes: `build-agent` to verify; `code-reviewer` for risky diffs.

## Flow (non-trivial tasks)
1. **Understand** — read relevant files; `contextscout` if unfamiliar
2. **Plan** — inline (routine) or `planner` (non-trivial); **design tasks (architecture or UI) → `serious-planner`**
3. **Execute** — inline / `coder-agent` / `frontend-specialist` / `batch-executor` (UI built from the serious-planner design)
4. **Validate** — `build-agent` (`npm run build`, and `npm run tauri:build` when Rust or bundling is touched); `code-reviewer` for risky changes
5. **Verify** — exercise the actual `.app` for UI/AI-prompt changes; there's no Playwright coverage of the desktop shell itself

## Safety
- **Never modify**: `.env*`, `*.key`, `*.secret`, `node_modules/**`, `.git/**`
- **Never touch `/Applications/FeedbackData`** — this is the user's real production data (student records, evaluations), not test fixtures. It lives outside the repo and outside any `.app` bundle.
- **Always back up `/Applications/Feedback.app`** before overwriting it with a new build.
- **Never** run `rm -rf`, `sudo`, force-push to main, or `--no-verify` without explicit approval
- **Confirm before**: destructive file ops, push, deploy, quitting a running app instance the user may be actively using
- **Stop and ask** if a rebuild appears to have altered `FeedbackData` contents unexpectedly (check file size/mtime/record counts before and after)

## Project Patterns
- **Branch topology**: `main` is a stale, unrelated early snapshot (different scaffold entirely) — never plan or branch from it. Real development happens on feature branches (e.g. `feature/common-paragraph-prompt-with-llm`). Always check branch recency (commit dates) before starting work.
- **Worktrees**: `EnterWorktree`'s default `fresh` mode branches from `origin/<default-branch>` (`main`), which is stale here. Branch worktrees from the actual feature branch instead — create manually (`git worktree add <path> <feature-branch> -b <new-branch>`) then `EnterWorktree({path})`.
- **Student submission text**: every AI flow (Improve English, Improve with RAG, Evidence Check) sources the combined submission text from one function — `getCombinedStudentSubmissionText()` in `App.svelte`. Fix cross-cutting prompt-input issues there, not per call site.
- **Common paragraph AI prompt**: `currentAssessment.commonParagraphAiInstructions` is merged with per-category instructions via `getCombinedAnswerInstructions()` in `App.svelte`, with per-category opt-out via `commonPromptEnabledByCategory`.
- **LLM message roles**: use `system`/`user` for injected reference material (retrieved context, documents). Don't use `assistant` for data the model didn't actually say — it weakens the trust/instruction boundary.
- **Preview vs. real request**: the "View Final Prompt" preview builds its request params (temperature/max tokens) separately from the actual call — keep them in sync when either changes, or the preview lies about what's sent.
- **Recency bias in long prompts**: an instruction stated only in an early system message gets diluted by the time generation starts — repeat assessor instructions (word limits, formatting, tone) in the closing "Output instructions"/"Requirements" block of each prompt (`aiMarkingService.js`), not just once near the top. `buildClosingInstructionsReminder()` does this by echoing back the real `answerInstructions`/`commonParagraphAiInstructions` text, not a hardcoded rule — this is a shared template across subjects, so it must repeat whatever was actually typed.
- **Never let `shortFeedback` bias retrieval**: "Improve with RAG" writes its own output back into the same draft textarea it reads from (`quickAddText`). If a re-run's search query includes that draft text, it creates a feedback loop — a wrong prior answer's vocabulary pulls in unrelated evidence on the next run, reinforcing the mistake. `buildRelevantStudentEvidenceExcerpt()` and the RAG context retrieval query deliberately exclude `shortFeedback`; it's shown to the model as context only, never used for search.
- **Evidence-excerpt selection pitfalls** (`buildRelevantStudentEvidenceExcerpt` in `aiMarkingService.js`): a category name trivially keyword-matches its own section heading and table-of-contents entry, which have no real content — a naive "take whatever scored > 0" approach can end up sending the model only a heading. Matches under 40 chars don't count as real content; when only heading/ToC lines match, anchor on the LAST one (the real heading — ToC entries always appear earlier in the doc) and take the paragraphs that follow it, not the document's first N paragraphs (that's the title page, not the section body).
- **`.form-check.form-switch` checkboxes look identical checked vs. unchecked**: `app.css`'s `.form-check-input` rule forces `width == height`, collapsing Bootstrap's intended pill into a circle — but Bootstrap's switch-knob `background-image` (an SVG circle) still renders on top and fully hides the checked-state fill, so both states look like a hollow ring. `background-image: none !important` on `.form-check-input` fixes it; watch for the same issue on any other `form-switch` added later.
- **Diagnosing "the AI ignored my setting" reports**: don't trust a screenshot of a toggle/checkbox state — add a temporary `addAppLog('info', ...)` at the point the value is read (viewable in-app via the "Log" button, no devtools needed) and have the user reproduce; this found that a per-category "apply common prompt" toggle was actually off despite looking checked (see the two points above).

## Subagent Prompt Contract
When spawning, always include: **Objective** (what done looks like) · **Files** (exact paths/ranges) · **Constraints** (what not to touch) · **Acceptance criteria** · **Return format** (Verdict + changed files + verification).
