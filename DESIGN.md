# Feedback Manager UI contract

## 1. Identity
Polish of the full v3.3.4 application at bd540f0, not the early main-branch prototype. Keep the existing sidebar, subject/assessment managers, feedback tools, AI settings, report actions and light/dark modes. The sidebar contains navigation; assessment Settings owns mark percentages, shared by feedback ranges and grades. Use a restrained navy application bar, clear content panels, readable typography, and compact purposeful controls.

## 2. Color
Tokens live in `src/styles/ui-polish.css`. Light/dark pairs: `--ui-canvas` #f4f6fa/#141b27; `--ui-surface` #ffffff/#1d2736; `--ui-soft` #edf2fa/#28364b; `--ui-ink` #243247/#e5edf8; `--ui-muted` #58677d/#acbcd2; `--ui-border` #dce3ed/#3c4d65; `--ui-accent` #244a87/#9fc4ff; `--ui-accent-hover` #193968/#c5dcff; `--ui-primary-fill` #244a87/#315da2. Header #182b49, header text #f4f7fc. Retain Bootstrap semantic success/warning/danger colors, rubric band colors, AI-improved text and validation states. These have functional meanings.

## 3. Typography
System sans-serif, no new webfont. `--ui-body` 14px; `--ui-caption` 12px; `--ui-card-title` 18px; `--ui-title` 28px. Body line height 1.55; titles 1.25 and weight 600. Metadata 12px. Preserve user-authored report formatting. Titles wrap, never ellipsize important subject names.

## 4. Layout
4px spacing scale: `--ui-space-1/2/3/4/5/6/8` = 4/8/12/16/20/24/32px. Max shell 1800px; sidebar 248px from 992px. Below 992px, sidebar is full width above content; existing mobile disclosure remains. Toolbar wraps and stays accessible at all widths. Cards use an intrinsic grid with minimum min(240px, 100%) and content-driven height. Narrow page headings and action groups wrap. No viewport-height expansion on the sidebar or generic row. Document scrolling owns the shell; existing editor/sidebar internal scrolling retained only where needed.

## 5. Reusable components
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
