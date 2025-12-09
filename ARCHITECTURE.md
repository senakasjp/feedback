# Architecture Documentation

> **New:** PDF rubric highlighting mirrors UI selections using row label + selected paragraph position with saved manual mappings.


## Version 3.2.6 - Manual Rubric Highlighting Reliability

- PDF rubric highlighting uses row label as the category and the selected paragraph’s position (top-down) to pick the target column via manual paragraph-position → column mapping.
- Row → category and position → column mappings persist with the assessment even when a student is selected, avoiding divergence between UI and exported PDF.
- Highlighting now mirrors the on-screen checkbox selection order.
