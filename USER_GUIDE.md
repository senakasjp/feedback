# User Guide

> **Fix (Sep 2026):** "Improve with RAG", "View RAG Prompt", and "AI Draft" now see a student's full submission including the reference list — a referencing/APA category could previously be marked down for a "missing" reference list that was actually just cut before the AI saw it.

> **Simplified (Sep 2026):** "Improve with RAG" now sends the student's full submission text for every category — no excerpting, so nothing (a bibliography, a claim in another chapter) can be silently left out because it didn't match the category's wording. Student submissions no longer accept PDF uploads (use DOCX, TXT, MD, HTML, CSV, or JSON) — PDF text extraction had no OCR fallback and could silently miss content in scanned files.

> **Fix (Sep 2026):** PDF exports now correctly print macrons (Māori, Ngāti, Tūhoe, etc.) instead of showing `?` in their place.

> **New (Sep 2026):** PDF rubric highlighting now works correctly for categories named with an "(LO1)"-style suffix. When a student is selected, the paragraph panel offers "Improve all with RAG" (runs RAG improvement across every category at once) and "Delete all student RAG comments" (clears every category's draft comment for that student — fixed to actually clear every visible textarea). PDF tables now get a 40px gap below them.

> **New:** PDF rubric export honors manual row → category mapping for marks and highlighting, matching UI selections without `undefined` cells.


## Version 3.2.9 - Manual Rubric Highlighting Reliability

### PDF Rubric Highlighting
- Row label is treated as the category (including manual row → category mappings); the highlighted column is chosen from the selected paragraph’s position (top-down) using your paragraph-position → column mapping.
- Row → category and position → column mappings persist with the assessment even when a student is selected.
- PDF mark text now falls back to `—` instead of `undefined`, and highlights match the checkbox selection order visible in the UI.
