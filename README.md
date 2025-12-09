# Feedback Manager v3.2.6

> **New:** PDF rubric highlighting now uses row label + selected paragraph position, with manual row/column mappings saved to the assessment.


A comprehensive desktop application built with Tauri and Svelte for managing student feedback with hierarchical organization, professional PDF generation, advanced assessment management capabilities, comprehensive grade distribution analysis, automatic data saving, intelligent paragraph merging, strict data separation policy, contamination prevention, visual debugging tools, real-time total marks display, and enhanced text formatting capabilities.

## 📄 PDF Table / Paragraph Rendering Logic (Manual Mapping)

### Row and Column Mapping
The system uses **manual mapping only** - no automatic detection:

#### **Row Mapping** (Table Rows → Categories)
- Maps table row labels to assessment categories
- Example: "Target system details" (table row) → "Target system details" (category)
- Only manually mapped rows will be matched

#### **Column Mapping** (Paragraph Position → Table Columns)
- Maps paragraph position (1st, 2nd, 3rd, etc.) to table columns
- Based on **which paragraph checkbox is selected**
- Example setup:
  - 1st paragraph (top) → Column A (highest performance)
  - 2nd paragraph → Column B
  - 3rd paragraph → Column C
  - 4th paragraph → Column D
  - 5th paragraph (bottom) → Column O (lowest performance)

### How Highlighting Works
1. For each category row in the PDF rubric table:
   - Check which paragraph is selected (via checkbox)
   - Find the position of that paragraph (1st, 2nd, 3rd, etc.)
   - Look up which column that position maps to
   - Highlight that column in yellow

### Configuration
Set up mappings in the Assessment HTML card:
- **Map table rows**: Choose which category each row label corresponds to
- **Map paragraph position to table columns**: Choose which column each paragraph position highlights

### Rendering Logic
- A category is considered "covered by the table" when it matches/mapped to a rubric row, or when that category has marks
- Selected paragraphs for a category covered by the table:
  - Paragraphs with marks/ranges are **skipped** under the table (to avoid duplication)
  - Paragraphs without marks/ranges are **printed** under the table (so unmarked feedback still appears)

## 🎉 Version 3.2.6 - Manual Rubric Highlighting Reliability

This release tightens PDF rubric highlighting so it always reflects your selections and mappings:

### 🟨 **Accurate Column Highlighting**
- Row label is the category; column is chosen from the selected paragraph’s position within that category (top-down)
- Uses only your manual row/column mappings—no auto-detection

### 💾 **Mapping Persistence**
- Row → category and paragraph-position → column mappings persist with the assessment (even with a student selected)

### ✅ **PDF Parity With UI**
- Selected paragraph determines the highlighted cell; matches the on-screen checkboxes and order

## Release Notes
- For full history, see `CHANGELOG.md`. This README highlights the current release (v3.2.6) focused on reliable manual rubric highlighting.
