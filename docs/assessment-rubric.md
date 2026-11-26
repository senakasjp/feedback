# Assessment rubric

When an assessment is opened, the app looks for its marking rubric on disk and attaches
it as a **Rubric** reference document, so RAG marking and feedback use it. The assessor
keeps the file; the app only reads it.

## Where it looks

```
~/Documents/senaka-marking-rubric/
  Research and Communication/
    rubric-2026.docx
  Studio 5/
    marking-schedule.csv
```

Each assessment gets one folder. The folder name is matched in this order:

1. the assessment name shown in the app
2. the internal assessment id

Names containing `/`, `\`, `.` or `..` are rejected, so a folder name cannot point
outside the rubric folder.

Inside the folder the **newest** supported file is used. Older versions are ignored.

## Supported files

`DOCX`, `PDF`, `TXT`, `MD` and `CSV`, up to 25 MB. CSV is included because rubric marks
are often exported from a spreadsheet. Extraction uses the same pipeline as a manual
upload.

## What happens on opening an assessment

1. The assessment's saved reference documents load first.
2. The newest rubric file is read and attached as a document with type **Rubric**.
3. The RAG vector index is invalidated, so the next marking run rebuilds it with the new
   rubric.
4. Assessment data is saved, and a notice names the rubric file.

Rules that protect your own work:

- A rubric you uploaded yourself is never replaced. If one exists, the folder file is
  ignored.
- The same folder file is not attached twice. Name and modified time are compared.
- A newer file in the folder replaces the previous folder copy, including its extracted
  text and images.

If the folder is missing, empty or has no supported file, opening the assessment is
unchanged. If extraction fails, the reason appears in a notice and no document is added.

## Settings

**Settings → AI Marking Context → Assessment Reference Uploads** shows:

```
📘 Rubric folder: /Users/<you>/Documents/senaka-marking-rubric/<assessment name>/   [Copy path]
Put the marking rubric there. When this assessment opens, the newest DOCX, PDF, TXT,
MD or CSV file is attached as a Rubric document for RAG. A rubric you uploaded
yourself is never replaced.
```

**Copy path** copies the absolute path for Finder or Terminal. In the browser preview the
path falls back to `~/Documents/senaka-marking-rubric/<assessment>/`.

## Checks

```bash
node tests/assessmentRubrics.check.mjs
cargo test --manifest-path src-tauri/Cargo.toml
```

The Node check proves folder candidates, path-escape rejection, the attach rules (add,
skip manual, skip unchanged, replace newer) and the App.svelte wiring. The Rust tests
prove discovery, CSV acceptance, PPTX rejection and traversal rejection.

## Files

- `src-tauri/src/lib.rs`: `read_assessment_rubric`, `assessment_rubrics_dir`
- `src/services/assessmentRubricsService.js`: candidates, attach rules, decoding
- `src/App.svelte`: `loadAssessmentRubricFromFolder`, called from `loadAssessmentData`
