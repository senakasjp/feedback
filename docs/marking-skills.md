# Marking skills

The app can send the same skills the agent uses to the model with every paragraph it
generates. A skill is a folder in `~/.agents/skills` whose name starts with
`senaka-marking-` and which contains a `SKILL.md`.

Nothing is copied into the repository. The app reads the folder at runtime, so editing a
skill changes the next prompt without rebuilding the app.

## Folder layout

```
~/.agents/skills/
  senaka-marking-evidence/
    SKILL.md
  senaka-marking-feedback-tone/
    SKILL.md
```

Only folders with the `senaka-marking-` prefix are read. `moodle-*`, `cloudbridge-*` and
every other skill in that folder is ignored. A folder without `SKILL.md` is skipped, and
so is a file larger than 256 KB.

## SKILL.md format

```markdown
---
name: "senaka-marking-evidence"
description: "Require quoted evidence for every awarded mark."
---

# Evidence rule

Quote the submission for every mark above zero.
```

- The YAML front matter is removed before sending, so `---` never reaches the model.
- `name` and `description` are optional. Without them the folder name is used and the
  description is left blank.
- `description: >` joins the indented lines with spaces. `description: |` keeps the line
  breaks.
- A file with no front matter is sent in full.
- If the closing `---` is missing, the whole file is sent rather than being dropped.

The body is the part that matters. Write it as standing marking rules, not as a request.

## Where skills are used

Every enabled skill is sent as a system message on all five AI paths:

| Path | What it produces |
| --- | --- |
| Improve text with AI | Rephrases one feedback entry in point form |
| Improve with RAG | Expands the assessor comment into points, using the submission and rubric |
| Reports check | Writes the evidence-check report for one category |
| AI Draft | Marks every criterion and writes each paragraph |
| Assign marks | Marks one category and writes its rationale |

The order in the prompt is fixed:

1. Rigour rule (topic coverage is not task compliance)
2. Marking skill text
3. Global assessor instructions
4. Per-answer instructions
5. Assessor paragraph comments marked as authoritative
6. Retrieved rubric and brief context, then the student submission

The skill sets how to mark and how to write. It does not override the rubric, the
allocated mark, or the assessor comments marked as authoritative.

## Enabling and disabling

Settings shows a **Marking Skills** panel under **AI Marking Context**.

- Every discovered skill starts enabled. The selection is stored in the data file as
  `appSettings.aiMarkingSkillIds`; `null` means "all skills".
- Use **Reload skills** after adding or editing a folder. No restart is needed.
- The panel shows each skill's character count and the total characters added to each
  prompt. Above 20,000 characters a warning appears, because every prompt carries the
  full text.
- If the skills folder is missing, the panel says so and marking continues with no
  skills. A failed read never blocks marking.

The panel is only visible in the desktop app. The browser preview cannot read the home
directory, so it shows a notice instead.

## Checks

```bash
node tests/markingSkills.check.mjs
cargo test --manifest-path src-tauri/Cargo.toml marking_skill
```

The Node check proves front matter parsing, the prompt order, that every AI path is
wired, and that a prompt without skills does not claim one was used. The Rust tests
prove folder discovery, the prefix filter and block descriptions, using a scratch folder
under the system temp directory that is deleted afterwards.

## Files

- `src-tauri/src/lib.rs`: `list_marking_skills` and `collect_marking_skills`
- `src/services/markingSkillsService.js`: parsing, loading, prompt messages
- `src/services/aiMarkingService.js`: marking and feedback prompts
- `src/services/openaiService.js`: paragraph polish prompt
- `src/services/categoryMarkingService.js`: category mark prompt
- `src/App.svelte`: panel, state, persistence, call sites
