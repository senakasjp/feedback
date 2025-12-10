# Feature Implementation Summary - Version 3.2.9

> **New:** PDF rubric export honors manual row → category mapping for marks/highlighting so mapped rows never show `undefined` and highlight the correct column.


## Overview
This document summarizes the major features implemented in Feedback Manager version 3.2.9. This update focuses on reliable PDF rubric highlighting that aligns with on-screen selections while keeping manual mappings authoritative.

## Version 3.2.9 - Manual Rubric Highlighting Reliability

### 🟨 **Accurate Column Highlighting**
- Row label is treated as the category; highlighted column is chosen from the selected paragraph’s position (top-down) using manual paragraph-position → column mapping and mapped row → category names.
- Row → category and position → column mappings persist with the assessment even when a student is selected.
- PDF mark text now falls back to `—` instead of `undefined`, and highlights mirror the checkbox selection order seen in the UI.
