# Working Notes

This file is the quick reference for recent behavior changes.
Update this whenever logic is changed so it is easy to trace later.

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
