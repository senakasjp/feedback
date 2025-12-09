# Feature Implementation Summary - Version 3.2.6

> **New:** PDF rubric highlighting now mirrors the UI using row label + selected paragraph position, backed by saved manual mappings.


## Overview
This document summarizes the major features implemented in Feedback Manager version 3.2.6. This update focuses on reliable PDF rubric highlighting that aligns with on-screen selections while keeping manual mappings authoritative.

## Version 3.2.6 - Manual Rubric Highlighting Reliability

### 🟨 **Accurate Column Highlighting**
- Row label is treated as the category; highlighted column is chosen from the selected paragraph’s position (top-down) using manual paragraph-position → column mapping.
- Row → category and position → column mappings persist with the assessment even when a student is selected.
- PDF highlight now mirrors the checkbox selection order seen in the UI.
