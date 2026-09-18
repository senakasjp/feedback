# API Reference

> **New:** PDF rubric export honors manual row → category mapping for marks/highlighting so mapped rows no longer show `undefined`.


## Version 3.2.9 - Manual Rubric Highlighting Reliability

PDF rubric highlighting respects manual mappings and UI selections:
- Row label is treated as the category (including manual row → category mappings); the highlighted column is chosen from the selected paragraph’s position (top-down) via paragraph-position → column mapping.
- Row → category and position → column mappings persist with the assessment even when a student is selected.
- Marks column now shows `—` instead of `undefined`, and highlights match checkbox selection order.
