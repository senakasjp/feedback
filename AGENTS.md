# Feedback Manager

Tauri 2 + Svelte 5 desktop app (v3.3.4) for student feedback, AI-assisted marking, and PDF/HTML reports. Uses Bootstrap, jsPDF, mammoth, PDF.js, and Tesseract.

## Check the version first

- Before edits, inspect the branch, commit date, working-tree changes, and remote branch heads. Do not assume the default branch is current without checking.
- The UI polish was developed on `codex/ui-polish-latest`, based on `worktree-reports-check-marks` at `bd540f0` (September 12, 2026), and merged into local `main`. Verify remote and local versions again for later tasks.
- Preserve unrelated edits, untracked files, and existing worktrees. Never overwrite a newer implementation with files from older branches. Earlier UI draft is backed up in `.ui-polish-backups/2026-09-17/`.
- If the macOS git shim fails, use `/Library/Developer/CommandLineTools/usr/bin/git`.

## Project map

- `src/App.svelte`: active application composition and workflows; large file, read targeted sections.
- `src/lib/Sidebar.svelte`, `SubjectManager.svelte`, `AssessmentManager.svelte`: active navigation and management surfaces. Verify imports/render paths; some older components are unused.
- `src/styles/`, `src/app.css`: styles, including dark mode. Read `DESIGN.md` for UI changes.
- `src/services/aiMarkingService.js`, `openaiService.js`: AI providers and prompt construction.
- `src/services/documentTextExtractor.js`: DOCX/PDF extraction and OCR.
- `src-tauri/src/lib.rs`: native storage and desktop commands.
- `CLAUDE.md`: detailed architecture and behavioral context; check facts against code.

## Working efficiently and safely

- Search the relevant area; avoid scanning nested worktrees and generated dependencies. Load guides only when relevant; use parallel agents for substantial independent work.
- Keep fixes focused and follow nearby conventions. Preserve AI marking, category prompts, existing marks, report exports, and student/assessment isolation.
- Never expose or edit `.env*`, API keys, or real student data for UI work. Never touch `/Applications/FeedbackData`; it contains production records. Use disposable browser data on a separate local port.
- Student submissions are intentionally sent in full to the model; do not reintroduce excerpting. UI polishing must not change prompt or marking logic.

## Commands and verification

- `npm ci --legacy-peer-deps`: install locked dependencies (legacy Sveltestrap peer range).
- `npm run dev`: browser preview; `npm run tauri:dev`: desktop shell.
- `npm run build`: frontend production build.
- `npm run test:e2e`: existing Playwright navigation checks.
- `node tests/aiMarkingService.fullSubmissionText.check.mjs`: full-submission regression checks.
- `cargo check --manifest-path src-tauri/Cargo.toml`: Rust checks when needed; `npm run tauri:build`: packaging when in scope.
- Exercise changed behavior in the browser, including light/dark and narrow layouts. Browser checks do not verify native storage. Do not call live AI providers during UI QA.
- Report changes, checks, and actual limitations concisely. Documentation-only edits do not need an application build.

<!-- SEMBLE_START -->
## Semble Code Search

A `semble` MCP server is available with two tools:
- `mcp__semble__search` — search the codebase with a natural-language or code query.
- `mcp__semble__find_related` — find code similar to a specific file and line.

Always call `mcp__semble__search` before using Grep, Glob, or Read to explore the codebase. Use Grep/Glob/Read only for exact path lookup, exhaustive literal matches, or when the returned chunk lacks enough context.

Pass `--content docs` to search documentation and prose, `--content config` for config files, or `--content all` to search code, docs, and config together.

For CLI fallback or sub-agents without MCP access, use:

```bash
semble search "authentication flow" ./my-project
semble search "deployment guide" ./my-project --content docs
semble search "database host port" ./my-project --content config
semble find-related src/auth.py 42 ./my-project
semble search "save model to disk" ./my-project --top-k 10
```

The index is built on first run and cached automatically. If `semble` is not on `$PATH`, use `uvx --from "semble[mcp]" semble`.

### Workflow

1. Start with `mcp__semble__search` to find relevant chunks.
2. Use `--content docs` for documentation, `--content config` for config files, or `--content all` for everything.
3. Inspect full files only when the returned chunk does not give enough context.
4. Optionally use `mcp__semble__find_related` with a promising result's `file_path` and `line` to discover related implementations.
5. Use Grep/Glob/Read only when you need exhaustive literal matches or quick confirmation of an exact string.
<!-- SEMBLE_END -->

## Browser tests and AeroSpace

- Run automated browser checks headlessly. Do not add `--headed`, `--ui`, or `PWDEBUG=1` unless the user explicitly requests visible browser debugging. Visible Chrome test windows trigger AeroSpace workspace rules and desktop flickering.
- The Playwright config uses installed Google Chrome (`channel: 'chrome'`); ensure Chrome is installed on test machines.
- Headless Playwright still supports screenshots and visual checks. Use one worker for local checks and avoid simultaneous browser test runs.
