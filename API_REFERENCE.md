# API Reference

> **New:** PDF rubric highlighting mirrors UI selections using row label + selected paragraph position with saved manual mappings.


## Version 3.2.6 - Manual Rubric Highlighting Reliability

PDF rubric highlighting respects manual mappings and UI selections:
- Row label is treated as the category; the highlighted column is chosen from the selected paragraph’s position (top-down) via paragraph-position → column mapping.
- Row → category and position → column mappings persist with the assessment even when a student is selected.
- Ensures PDF highlight matches checkbox selection order.
