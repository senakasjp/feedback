# Student materials

When a student is selected, the app looks for that student's report on disk and puts its
text in **Student Submission or Evidence Notes**. The assessor keeps the files; the app
only reads them.

## Where it looks

```
~/Documents/senaka-marking-materials/
  QA-001/
    Ankeet_Patel_report.docx
  QA-002/
    2026-semester-1-report.pdf
```

Each student gets one folder. The folder name is matched in this order:

1. the student ID shown in the app (for example `QA-001`)
2. the internal student record id
3. the student name

Names containing `/`, `\`, `.` or `..` are rejected, so a folder name cannot point
outside the materials folder.

Inside the folder, the **newest** supported file is used. Older drafts, screenshots and
other files are ignored.

## Supported files

`DOCX`, `PDF`, `TXT`, `MD` and `PPTX`, up to 25 MB. Extraction uses the same pipeline as
a manual upload, including PDF page text, DOCX body text and cached PPTX slide text.

## What happens on selection

The Student Information card shows the exact folder for the selected student, for example
`/Users/<you>/Documents/senaka-marking-materials/QA-001/`, with a **Copy path** button and
a short instruction. The path uses the student's visible ID.

1. The saved student evaluation loads first. If it already has submission text, that
   text is kept and nothing is read from the folder.
2. If the box is empty, the newest report is read and extracted.
3. The extracted text fills the box, and a notice says which file was loaded.
4. If a file is found but the box already has text, a notice says so and the text is not
   replaced.
5. Nothing is written to the data file until the assessor saves student data.

If the folder is missing, empty, or has no supported file, selection continues normally
with no message. If extraction fails, the reason appears in a notice and the box is left
unchanged.

Switching student or assessment while a read is in progress cancels the result, so a slow
file cannot fill the wrong student's box.

## Where it does not run

The browser preview cannot read the Documents folder, so auto-load is desktop only. The
hint under the submission box still explains the folder.

## Checks

```bash
node tests/studentMaterials.check.mjs
cargo test --manifest-path src-tauri/Cargo.toml
```

The Node check proves the folder candidate order, path-escape rejection, base64 decoding,
MIME types, the browser fallback and the App.svelte wiring. The Rust tests prove folder
matching, newest-file selection, unsupported-file skipping and traversal rejection.

## Files

- `src-tauri/src/lib.rs`: `read_student_material_report`, `find_student_material_path`
- `src/services/studentMaterialsService.js`: candidates, decoding, `File` construction
- `src/App.svelte`: `loadStudentMaterialReport`, called from `selectStudent`
