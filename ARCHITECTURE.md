# Architecture Documentation

> **New:** PDF rubric export honors manual row → category mapping for marks/highlighting so mapped rows stay in sync with the UI.


## Version 3.2.8 - Manual Rubric Highlighting Reliability

- PDF rubric highlighting uses row label as the category (including manual row → category mappings) and the selected paragraph’s position (top-down) to pick the target column via manual paragraph-position → column mapping.
- Row → category and position → column mappings persist with the assessment even when a student is selected, avoiding divergence between UI and exported PDF.
- Highlighting now mirrors the on-screen checkbox selection order, and missing marks show `—` instead of `undefined`.
