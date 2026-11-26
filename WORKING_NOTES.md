# Working Notes

This file is the quick reference for recent behavior changes.
Update this whenever logic is changed so it is easy to trace later.

## Latest (Nov 2026)

### Print to Download is not stopped by a mark allocation mismatch
- A student report is feedback first. `generatePDF()` in `App.svelte` used to stop with "❌ Correct invalid marks or mismatched category allocations before exporting a marking report." and nothing was downloaded. The check now shows a warning and the PDF is still built and saved. A mismatched allocation only means the percentage and grade are left out, which is what the report already does by printing "Marks so far (incomplete)".
- Invalid category marks are named in the warning and left out of the total, and the PDF still downloads. The allocation warning stays visible in the Paragraphs panel, so the mismatch is still noticed and can be fixed.
- `tests/e2e/report-guardrail.spec.js` covers a download with a category maximum of 10 and Total Marks of 20.
- The report guardrail is more forgiving about real spellings: the British dictionary lacks "zig"/"zag" and "tock", so a valid "zig-zag" or "tick-tock" paragraph was blocked as a spelling mistake. Those everyday compounds are now accepted, and the "-izable"/"-isable" Oxford form is accepted alongside "-isable" (for example "recognizable" → "recognisable"). Genuine typos such as "steright" are still blocked with a suggestion.

### Print to Download shows a guardrail pass or fail before downloading
- `generatePDF()` in `App.svelte` now stops at a guardrail checkpoint before any PDF is created. The result is always shown: green **Guardrail passed** with the number of paragraphs checked, or red **Guardrail failed** with each failing paragraph. On a pass, Print to Download is already the download action, so the PDF carries on building and saving behind the green message, which has a single **OK** button. There is no second download button.
- On fail, a paragraph tells the assessor what to check, for example "Assessor should check this" or "Instructor should check other before deciding". Unfilled placeholders such as `TODO` or `[insert evidence]`, AI self-reference such as "I cannot access", and chat wording such as "Here is the feedback" fail for the same reason: they make a student report look like a working note. The pass result clears the red paragraph outlines.
- `src/utils/reportGuardrail.js` holds the rules and returns a finding per paragraph with the report paragraph number, category, the words that matched and a short excerpt. The rules are narrow on purpose, so normal advice to the student still passes, for example "Double-check your calculations before you submit the report."
- A note about the grading process fails too. The rules `missing-assessor-input` and `grading-process-note` block a sentence that says assessor comments, an allocated mark, a saved rationale or a rubric were not provided, and a sentence such as "the grading decision cannot be explained" or "this submission cannot be graded". This catches the text a model writes when it was given no assessor input. Student-facing feedback such as "No evidence of testing was provided in the report" still passes, because it needs a reviewer word, a rubric, a mark or a grading decision before the missing item counts.
- The fail result lists each failing paragraph and quotes the surrounding text. The same paragraph cards are outlined red in the editor with a short warning, so the fix is in the same place as the report preview. Nothing is saved or downloaded while the guardrail fails.
- Spelling and grammar are checked on the same paragraphs. `src/utils/reportLanguage.js` runs the checks and `findReportGuardrailIssues()` merges them with the wording rules. A spelling finding shows the word and a suggestion, for example `recieve → receive`. The grammar rules cover a repeated word, "could of", "alot", a lowercase pronoun, "a/an", a lowercase sentence start, a space before punctuation, a missing space after a comma or colon, "more then", "they was", "he don't", "your the", "its clear", "their is" and "to loose".
- The spelling check uses the bundled British English dictionary from `dictionary-en-gb` with `nspell`, served from `public/dictionary-en-gb`. The text never leaves the machine. The dictionary is fetched once when the app mounts, so the first download does not wait for it. It is deliberately forgiving: words of one or two letters, acronyms, URLs, emails, file names, code, names (an unknown capitalised word inside a sentence) and accepted American variants such as "organize" or "center" are left alone. A capitalised word at the start of a sentence is only reported when it is a known misspelling such as "Definately", so "Smith (2024) argues" and "PowerPoint is" still pass. A closed compound such as "rollout" is allowed when both halves are real words. The student name, subject, assessment and category names are passed as allowed words.
- A spelling or grammar finding uses the same modal, the same paragraph outline and the same block. The modal says what was found, for example `Spelling: “recieve → receive”`, and the download does not start.
- The fail modal has a **Skip** button before **Go back and fix**. It skips one finding at a time, in report order. The check runs again straight away, so the modal shows the next one, and the PDF downloads only when nothing is left. In the pass modal, the number skipped is listed. A skip is tied to the student, the assessment and the paragraph text, so editing the paragraph checks it again, and another student is never covered by a skip. Each skip is written to the application log as a warning.
- To keep the paragraph order and wording identical to the PDF, `getSelectedTextInVisualOrder()` now builds structured entries through `buildSelectedReportEntries()`. `getSelectedReportParagraphs()` returns the same entries with paragraph ids and categories for the guardrail. The text join and the PDF output are unchanged.
- Checks: `node tests/reportGuardrail.check.mjs`, `npx playwright test tests/e2e/report-guardrail.spec.js`, plus the existing rubric report specs.

### AI feedback is written in point form
- Improve with RAG, Improve with AI and AI Draft now ask the model for one point per line, and the reply is kept as separate lines instead of being flattened into one paragraph. The PDF export already prints each paragraph as a bullet, so the feedback now reads as a list in the text box and in the report.
- `normaliseFeedbackPointText()` in `aiMarkingService.js` keeps one point per line, drops blank lines and strips the model's own list marker, so a reply of `- point` does not print two markers under the app's drawn bullet. `normalisePointLines()` in `openaiService.js` does the same for Improve with AI.
- `bulletiseFeedbackPoints()` in `utils/helpers.js` puts a literal `• ` on each point before the text reaches the comment box, so the comment can be pasted into Moodle and still read as a list. The PDF export takes the category name off the first line and strips that marker before drawing its own bullet, so the report never shows two bullets.
- Marking skills still run on both paths. A per-answer instruction that asks for continuous prose still wins, because the prompt tells the model to follow it and the closing reminder repeats the instruction verbatim.
- Checks: `node tests/pointFormFeedback.check.mjs`.

### Improve with RAG no longer fails when embeddings fail
- The assessment vector index is now optional. A missing OpenAI key (for example when marking runs on Anthropic), an OpenAI key without embeddings access, a refused embeddings request or a dropped network no longer stops "Improve with RAG": retrieval falls back to the lexical path and the feedback text is still written. The success message reports the mode actually used.
- Side effect: the OpenAI key is only required for embeddings when one is configured. Previously the run stopped at the index build, before the chat call, and the comment box stayed empty.
- Embeddings are sent in batches of 96 instead of one request per index, so a large cohort cannot produce an oversized embeddings request and a half-built index.
- `canBuildAssessmentVectorIndex()` in `aiMarkingService.js` reports whether the embeddings key exists; `ensureAssessmentVectorIndex` in `App.svelte` uses it.
- A chat request that cannot reach the provider now says which provider was unreachable and points at Settings > API Keys, instead of the bare `Failed to fetch`. A rejected key and a blocked origin both surface as that network error in the browser.
- Checks: `node tests/ragEmbeddingsFallback.check.mjs`, `tests/e2e/rag-embeddings-fallback.spec.js`.
- The stale `B: Good` assertion in `tests/e2e/marking-draft.spec.js` now expects the plus-minus grade the app has shown since `7ef65f4` (`B+: Good`).

## Latest (Aug 2026)

### Multi-provider LLM support
- Added `src/services/llmProviders.js`: a small provider registry (`openai`, `anthropic`) that adapts the shared chat-completion call shape to each provider's actual API (OpenAI Chat Completions vs. Anthropic Messages), including per-provider auth headers, request body shape, and response parsing.
- `improveEnglish` (openaiService.js) and `improveFeedbackWithRag` / `generateEvidenceCheckReport` / `generateStructuredMarkingDraft` (aiMarkingService.js) now route through `callChatCompletion` instead of each hand-rolling an OpenAI-specific `fetch` call.
- `aiModelService.js` models now carry a `provider` field; `AI_PROVIDER_OPTIONS` lists available providers, `getModelsForProvider` / `getProviderForModel` map between them.
- Claude models (`claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5-20251001`) are wired in as the second provider, gated behind a new `VITE_ANTHROPIC_API_KEY` env var (optional).
- AI Settings menu now has a Provider selector above the model list; the model list and "manual model" field are scoped to whichever provider is selected. Missing API keys show a warning icon on the provider button instead of only failing at request time.
- Speech-to-text transcription (Whisper) and the RAG embeddings index remain OpenAI-only — those APIs have no equivalent shape in the other provider, so they still call OpenAI directly.
- To add another provider later: add an entry to `PROVIDERS` in `llmProviders.js` (chatUrl/headers/buildBody/parseResponse) and list its models in `aiModelService.js` with `provider: '<id>'`.

## Latest (Mar 2026)

### Evidence-check AI output handling
- Evidence-check requests now use a larger completion budget (`2200`) and force `low` reasoning effort to reduce GPT-5 truncation cases where the model spends the whole budget reasoning and returns no visible text.
- Evidence-check logging now records `finish_reason` so token-limit failures are easier to diagnose.
- If OpenAI stops with `finish_reason: length` before producing visible output, the app now throws a specific token-limit error instead of the generic "no feedback returned" message.

### RAG feedback AI output handling
- RAG feedback improvement requests now also use a larger completion budget (`2200`) and force `low` reasoning effort to reduce GPT-5 truncation cases where the model spends the whole budget reasoning and returns no visible text.
- RAG feedback logging now records `finish_reason` plus a payload preview when parsing yields no visible text.
- If OpenAI stops with `finish_reason: length` before producing visible improved feedback, the app now throws a specific token-limit error instead of the generic "no feedback returned" message.

### Multi-paragraph AI feedback preservation
- AI evidence-check and RAG-improved feedback now preserve blank-line paragraph breaks instead of flattening all whitespace into a single paragraph.
- Paragraph normalization now keeps paragraph-level spacing while still collapsing extra internal spaces inside each paragraph.

### PDF paragraph spacing
- PDF export now adds a small vertical gap after each rendered paragraph block so multi-paragraph feedback is easier to read in generated reports.

### PDF table vs content below table
- Category headers are detected as both `Category:` and `Category: [N MARKS]`.
- If a selected paragraph is covered by table mapping position (`tableColumnMarkMap`), that paragraph is skipped below the table.
- If selected paragraphs exist beyond covered positions, those extra paragraphs are still printed below the table.
- Category header is hidden only when all selected paragraphs for that category are covered by table mapping.
- Coverage suppression is enforced by paragraph ID before final PDF text render (`getSelectedTextInVisualOrder({ skipParagraphIds })`) to prevent duplicate leakage.
- For table-covered categories, header marks are suppressed in the body section (prints as `Category:` instead of `Category: [N MARKS]`).

### Student/assignment paragraph isolation
- Assessment saves persist assignment-owned paragraphs only (`_source: 'assignment'`).
- Student-owned paragraphs are excluded from assessment storage.
- Student paragraph saves persist student-owned paragraphs only (`_source: 'student'`).
- Legacy paragraph records are normalized on load/save to include source/context fields.

### Legacy paragraph migration
- Paragraph normalization stamps missing fields:
  - `id`
  - `_source`
  - `createdAt`
  - `originalIndex`
  - `fullText`

### Paragraph metadata in UI
- Each paragraph shows a UI-only `Saved: <date time>` value from `createdAt`.
- This date is not rendered in PDF output.

### Student uploads
- Student uploads are saved under student evaluation data, not assignment data.

### Known bundling note
- DMG bundling may intermittently fail at `bundle_dmg.sh`.
- `BULD_DEPLOY.SH` currently builds app bundle only (`--bundles app`) and deploys to `/Applications`.
