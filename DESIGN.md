# Feedback Manager UI contract

## 1. Identity
Polish of the full v3.3.4 application at bd540f0, not the early main-branch prototype. Keep the existing sidebar, subject/assessment managers, feedback tools, AI settings, report actions and light/dark modes. The sidebar contains navigation; assessment Settings owns mark percentages, shared by feedback ranges and grades. Use a restrained navy application bar, clear content panels, readable typography, and compact purposeful controls.

## 2. Color
Tokens live in `src/styles/ui-polish.css`. Light/dark pairs: `--ui-canvas` #f4f6fa/#141b27; `--ui-surface` #ffffff/#1d2736; `--ui-soft` #edf2fa/#28364b; `--ui-ink` #243247/#e5edf8; `--ui-muted` #58677d/#acbcd2; `--ui-border` #dce3ed/#3c4d65; `--ui-accent` #244a87/#9fc4ff; `--ui-accent-hover` #193968/#c5dcff; `--ui-primary-fill` #244a87/#315da2. Header #182b49, header text #f4f7fc. Retain Bootstrap semantic success/warning/danger colors, rubric band colors, AI-improved text and validation states. These have functional meanings.

## 3. Typography
System sans-serif, no new webfont. `--ui-body` 14px; `--ui-caption` 12px; `--ui-card-title` 18px; `--ui-title` 28px. Body line height 1.55; titles 1.25 and weight 600. Metadata 12px. Preserve user-authored report formatting. Titles wrap, never ellipsize important subject names.

## 4. Layout
4px spacing scale: `--ui-space-1/2/3/4/5/6/8` = 4/8/12/16/20/24/32px. Max shell 1800px; sidebar 344px from 992px. Below 992px, sidebar is full width above content; existing mobile disclosure remains. Toolbar wraps and stays accessible at all widths. Cards use an intrinsic grid with minimum min(240px, 100%) and content-driven height. Narrow page headings and action groups wrap. No viewport-height expansion on the sidebar or generic row. Document scrolling owns the shell; existing editor/sidebar internal scrolling retained only where needed.

## 5. Reusable components
Desktop Navigation stays sticky with a 16px (`--ui-space-4`) viewport inset. Its height is capped to the dynamic viewport minus the top and bottom insets; its body scrolls when necessary while its header remains visible. Body horizontal clipping must not create a scroll container that traps sticky positioning. Below 992px, Navigation retains its in-flow collapsible layout.

### Navigation panel specification

The final desktop column width is **344px**, increased from 248px in 32px steps (280px, 312px, then 344px). This is the whole Bootstrap column width, including its gutter padding, rather than the inner card width. Keep the main column paired with it using `width: calc(100% - 344px)` and retain the 24px (`--ui-space-6`) row gutter.

| Layout condition | Required behavior |
| --- | --- |
| Viewport at least 992px wide | Navigation follows document scrolling using `position: sticky`, with `top: var(--ui-space-4)` and the existing stacking level of 1020. |
| Short desktop window or long navigation content | Cap the card at `calc(100dvh - 2 * var(--ui-space-4))`. Keep its height content-driven; do not stretch it to fill the window. |
| Navigation content exceeds the height cap | Scroll the card body with `overflow-y: auto` and `min-height: 0`. Keep the Navigation header visible with `flex-shrink: 0`, and allow access to every action at the bottom. |
| Viewport below 992px wide | Both columns use 100% width. Navigation sits above content with `position: relative`, no height cap, and its existing Show/Hide Navigation disclosure. |
| Viewport at most 575px wide | Retain 16px workspace padding and navigation buttons at least 40px high. |

The document remains the page scroll owner. The `html body` override uses `height: auto` and `overflow-x: clip` so horizontal clipping does not create an intermediate scrolling ancestor that prevents the card from sticking. Retain `min-height: 100dvh` on the body.

Panel appearance continues to use the shared light/dark tokens: surface background, 1px border, 12px radius, subtle shadow, and soft header background. Header padding is 16px vertically and 20px horizontally; body padding is 20px. Action labels are left-aligned and wrap naturally. Navigation, session details, and save/load/export/print actions keep their existing order and behavior. No new animation accompanies scrolling.

Implementation: `src/lib/Sidebar.svelte` provides the card and scrollable body; `src/styles/ui-polish.css` owns the final width, responsive rules, theme styling, and sticky overrides.

Verification for this change: headless Chrome checks passed at 1280px, 768px, and 375px widths in both themes, including a 480px-high window. Desktop scrolling retained 16px top and bottom clearance, internal scrolling exposed the bottom actions, and no horizontal page overflow was observed. Native packaging and launch were verified separately; browser layout checks do not verify native storage.

Existing Bootstrap button, form, card and modal primitives remain. New CSS codifies their shell presentation; no replacement data model/components. Subject and assessment cards share `workspace-card-grid` layout, wrapping titles, left-aligned content, and bottom-aligned actions. Main page headings share `workspace-page-heading`. Focus rings stay visible even on destructive controls. Mobile navigation exposes expanded state. All existing callbacks and labels remain. AI, saving, importing, exporting, duplication, marking and reports retain their existing behavior.

## 6. Interaction
No new decorative motion. Keyboard focus: 3px accent outline, 3px offset. Buttons show meaningful hover/pressed states. Reduced-motion disables inherited animation/transitions. New styling does not hide controls or change disabled conditions. Preserve current data and all themes.

## 7. Surfaces
Thin borders plus subtle `--ui-shadow` (0 2px 8px rgb(24 43 73 / 5%)). `--ui-radius-sm` 6px; `--ui-radius` 12px. Panel headers and field groups establish hierarchy; keep feedback marking colors intact. Existing dark-mode selectors are overridden only for the polished shell and shared controls.

## 8. Accessibility and scope
Target readable contrast, keyboard focus, wrapped long names, narrow-screen controls, semantic page landmarks. Persona: educators using dense assessment tools repeatedly. This is a focused polish; maintain existing feature affordances. Existing broad `!important` rules require scoped overrides under #app; do not expand this into a styling rewrite. No new accepted accessibility debt. Verify subject → assessment → feedback, light/dark, forms, settings, help, and report actions with disposable browser data. Mark-percentage rows use wrapping Bootstrap form controls with accessible labels, colour assignments and an explicit save action. Native storage and live AI calls remain outside UI QA; never touch /Applications/FeedbackData.

Shared panel refinement: remove inherited starter-template outer card padding in the main column; retain inner 20px padding except explicitly flush table bodies. Informational/secondary panel headers use the soft surface and ink tokens; warning, danger, rubric, and AI result colors remain unchanged.

## Cross-page consistency
The same surface, border, typography, field, and action tokens apply to subjects, assessments, feedback, assessment Settings, Help, AI settings, and dialogs. Shared styles live in `ui-consistency.css`, loaded after the existing polish layer. Ordinary section headers use the soft surface; warning/danger alerts and confirmation headers retain semantic colours. Primary actions use the navy fill in pages and dialogs; secondary actions use the soft surface, and outline actions use theme-aware ink. Compact controls are at least 32px high, page-heading actions 36px; icon actions use a 32px square. All toolbar groups wrap with 8px gaps. Modal titles use the 18px card-title scale, modal sections the existing 20px padding, and fields share the surface/border tokens. Disabled states and validation colours remain meaningful. Category and knowledge-area tags wrap and expose named, full-size edit/delete controls. Dense data tables scroll within their containers. These rules do not restyle user-authored report HTML or change marking logic.

Semantic action foregrounds retain their red/green meaning with readable theme variants: `--ui-success-ink` #146c43/#75b798 and `--ui-danger-ink` #b02a37/#ea868f. These apply to action labels and assessment summaries, not rubric band fills or user-authored feedback.

Mandatory marking requirement: AI mark allocation must include a substantive rubric-based rationale for every mark, including zero and full marks, with specific evidence and reasons for credit and withheld marks. Show the complete saved rationale adjacent to the mark controls in a wrapping, theme-aware panel; never require opening a modal to read it. Reject AI allocations with an empty judgement or gap explanation before applying marks.

## DOCX viewer and mark-entry navigation

The feedback screen has Enter Data, Settings, and DOCX Viewer tabs. Navigation also provides full-width Marks and DOCX Viewer buttons directly below Back to Subjects. Both routes use the same tab-switch handler; the sidebar buttons expose the active view with `aria-pressed` and existing primary/outline styles.

### Original Word documents

- Preserve original DOCX bytes as `docxBase64` alongside the extracted text and images used for marking, for both assessment-reference and student uploads.
- Render originals with locally bundled `docx-preview`, preserving supported page sizes, margins, fonts, tables, images, headers, footers, and page breaks. Do not substitute extracted text or Mammoth HTML. Complex Word layouts and pagination may differ from Microsoft Word.
- Group file choices into assessment references and selected-student uploads. Changing assessment or student resets the viewer and excludes the previous student's files.
- Older uploads offer Attach original DOCX directly in the viewer. Require the expected filename, validate rendering, and persist the source without changing awarded marks. Show loading and error states.
- Render pages on a gray canvas inside an empty-sandbox iframe with restrictive CSP. Disable embedded HTML chunks, active content, and external links. Document colors remain intact in either app theme.
- Provide Fit width and 75%, 100%, 125%, and 150% zoom. The viewing area is 75vh with a 320px minimum height and internal scrolling. Controls use shared spacing, border, radius, and surface tokens.

### Returning to marks

Remember the outer page scroll position separately for each subject, assessment, student, and feedback tab for the current app session. Restore it after the destination panel renders. Returning with Marks resumes the previous mark-entry location without resetting entered marks. This does not promise restoration of the document iframe's internal page or zoom after leaving the viewer. On narrow screens the buttons remain inside the existing Show Navigation disclosure.

### Implementation and verification

`src/lib/UploadedDocuments.svelte` owns selection and original-file attachment; `src/lib/DocxDocument.svelte` owns rendering states and zoom; `src/utils/docxPreview.js` reads and renders originals. `src/App.svelte` connects uploads, persistence and scroll restoration; `src/lib/Sidebar.svelte` supplies Navigation buttons.

Headless browser checks cover original DOCX page breaks, margins, colors, bold text, tables, saved previews, legacy attachment, invalid files, student isolation, zoom and the marks-scroll round trip. Visual checks cover 375px, 768px and 1280px in light and dark themes with synthetic data. Native packaging and process launch were verified separately; browser checks do not verify native storage or all complex Word layouts.
