# User Guide

> **New (Sep 2026):** PDF rubric highlighting now works correctly for categories named with an "(LO1)"-style suffix. When a student is selected, the paragraph panel offers "Improve all with RAG" (runs RAG improvement across every category at once) and "Delete all student RAG comments" (clears every category's draft comment for that student — fixed to actually clear every visible textarea). PDF tables now get a 40px gap below them.

> **New:** PDF rubric export honors manual row → category mapping for marks and highlighting, matching UI selections without `undefined` cells.


## Version 3.2.9 - Manual Rubric Highlighting Reliability

### PDF Rubric Highlighting
- Row label is treated as the category (including manual row → category mappings); the highlighted column is chosen from the selected paragraph’s position (top-down) using your paragraph-position → column mapping.
- Row → category and position → column mappings persist with the assessment even when a student is selected.
- PDF mark text now falls back to `—` instead of `undefined`, and highlights match the checkbox selection order visible in the UI.
