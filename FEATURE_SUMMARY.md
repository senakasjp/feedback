# Feature Implementation Summary - Version 3.2.9

> **Fix (Sep 2026):** PDF exports now embed the NotoSans font so macrons render correctly (Māori, Ngāti, Tūhoe, etc.) instead of being replaced with `?` — jsPDF's built-in fonts only support WinAnsi/Latin-1, which excludes Latin Extended-A.

> **New (Sep 2026):** Added a whole-document "Check Citations" check (reference entries with no in-text citation, and vice versa). Fixed "Evidence Check" reading a version of the submission with everything past the References/Appendix heading deleted — it now sees the full document, so it no longer falsely reports a missing reference list.

> **New (Sep 2026):** Fixed PDF rubric highlighting for categories named with an "(LO1)"-style suffix (a category-name normalization mismatch). Added "Improve all with RAG" (runs RAG improvement across every category for the selected student) and "Delete all student RAG comments" (clears every category's draft comment — fixed a key mismatch that left the textareas uncleared) to the paragraph panel. Reduced embedded-image size cap (1600px → 1024px) to cut vision-API cost. PDF tables now get a 40px gap below them.

> **New:** PDF rubric export honors manual row → category mapping for marks/highlighting so mapped rows never show `undefined` and highlight the correct column.


## Overview
This document summarizes the major features implemented in Feedback Manager version 3.2.9. This update focuses on reliable PDF rubric highlighting that aligns with on-screen selections while keeping manual mappings authoritative.

## Version 3.2.9 - Manual Rubric Highlighting Reliability

### 🟨 **Accurate Column Highlighting**
- Row label is treated as the category; highlighted column is chosen from the selected paragraph’s position (top-down) using manual paragraph-position → column mapping and mapped row → category names.
- Row → category and position → column mappings persist with the assessment even when a student is selected.
- PDF mark text now falls back to `—` instead of `undefined`, and highlights mirror the checkbox selection order seen in the UI.
