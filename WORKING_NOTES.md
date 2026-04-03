# Working Notes

This file is the quick reference for recent behavior changes.
Update this whenever logic is changed so it is easy to trace later.

## Latest (Mar 2026)

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
