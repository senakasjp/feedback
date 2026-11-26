mod open_document;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            open_document::open_uploaded_docx,
            portable_data_dir,
            write_portable,
            read_portable,
            write_subject_data,
            read_subject_data,
            list_marking_skills,
            read_student_material_report,
            student_materials_dir,
            read_assessment_rubric,
            assessment_rubrics_dir,
            generate_pdf_file,
            write_student_evaluation,
            read_student_evaluation,
            write_student_paragraphs,
            read_student_paragraphs,
            delete_student_evaluation,
            delete_student_paragraphs,
            delete_all_student_files,
            export_csv_file,
            save_pdf_to_folder
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn portable_data_dir() -> Result<String, String> {
    // Resolve a portable data directory next to the `.app` bundle (macOS) or executable (other OSes)
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    let base = exe
        .parent() // .../Feedback.app/Contents/MacOS
        .and_then(|p| p.parent()) // .../Feedback.app/Contents
        .and_then(|p| p.parent()) // .../Feedback.app
        .and_then(|p| p.parent()) // directory containing Feedback.app
        .ok_or("failed to resolve app parent directory")?
        .to_path_buf();

    #[cfg(not(target_os = "macos"))]
    let base = exe
        .parent()
        .ok_or("failed to resolve executable directory")?
        .to_path_buf();

    let data_dir = base.join("FeedbackData");
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    Ok(data_dir
        .to_str()
        .ok_or("invalid data directory path")?
        .to_string())
}

#[tauri::command]
fn write_portable(data: String) -> Result<(), String> {
    let dir = portable_data_dir()?;
    let path = std::path::Path::new(&dir).join("feedback-data.json");
    std::fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_portable() -> Result<String, String> {
    let dir = portable_data_dir()?;
    let path = std::path::Path::new(&dir).join("feedback-data.json");
    match std::fs::read_to_string(&path) {
        Ok(s) => Ok(s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn write_subject_data(subject_id: String, data: String) -> Result<(), String> {
    let dir = portable_data_dir()?;
    let filename = format!("subject-{}.json", subject_id);
    let path = std::path::Path::new(&dir).join(filename);
    std::fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_subject_data(subject_id: String) -> Result<String, String> {
    let dir = portable_data_dir()?;
    let filename = format!("subject-{}.json", subject_id);
    let path = std::path::Path::new(&dir).join(filename);
    match std::fs::read_to_string(&path) {
        Ok(s) => Ok(s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

const MARKING_SKILL_PREFIX: &str = "senaka-marking-";
const MAX_MARKING_SKILL_BYTES: u64 = 262_144;

#[derive(serde::Serialize)]
struct MarkingSkill {
    id: String,
    name: String,
    description: String,
    path: String,
    content: String,
    characters: usize,
}

#[derive(serde::Serialize)]
struct MarkingSkillListing {
    root: String,
    skills: Vec<MarkingSkill>,
}

fn split_skill_front_matter(raw: &str) -> (String, String) {
    let normalized = raw.replace("\r\n", "\n");
    let mut lines = normalized.lines();
    if lines.next().map(str::trim) != Some("---") {
        return (String::new(), normalized.trim().to_string());
    }

    let mut front = String::new();
    let mut body = String::new();
    let mut in_body = false;

    for line in normalized.lines().skip(1) {
        if in_body {
            body.push_str(line);
            body.push('\n');
            continue;
        }
        if line.trim() == "---" {
            in_body = true;
            continue;
        }
        front.push_str(line);
        front.push('\n');
    }

    if body.trim().is_empty() {
        return (String::new(), normalized.trim().to_string());
    }

    (front, body.trim().to_string())
}

fn front_matter_field(front: &str, key: &str) -> Option<String> {
    let prefix = format!("{}:", key);
    let mut value: Option<String> = None;
    let mut block_style: Option<char> = None;

    for line in front.lines() {
        if let Some(rest) = line.strip_prefix(&prefix) {
            let rest = rest.trim();
            if rest == ">" || rest == "|" || rest == ">-" || rest == "|-" {
                block_style = Some(if rest.starts_with('>') { ' ' } else { '\n' });
                value = Some(String::new());
                continue;
            }
            value = Some(rest.trim_matches('"').trim_matches('\'').to_string());
            block_style = None;
            continue;
        }

        let indented = line.starts_with(' ') || line.starts_with('\t');
        if indented {
            if let (Some(current), Some(joiner)) = (value.as_mut(), block_style) {
                let extra = line.trim();
                if !extra.is_empty() {
                    if !current.is_empty() {
                        current.push(joiner);
                    }
                    current.push_str(extra);
                }
            }
        } else if !line.trim().is_empty() {
            block_style = None;
        }
    }

    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

fn collect_marking_skills(root: &std::path::Path) -> Result<Vec<MarkingSkill>, String> {
    if !root.is_dir() {
        return Ok(Vec::new());
    }

    let entries = std::fs::read_dir(root).map_err(|e| e.to_string())?;
    let mut skills = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let id = match path.file_name().and_then(|name| name.to_str()) {
            Some(name) if name.starts_with(MARKING_SKILL_PREFIX) => name.to_string(),
            _ => continue,
        };

        let skill_file = ["SKILL.md", "skill.md", "Skill.md"]
            .iter()
            .map(|name| path.join(name))
            .find(|candidate| candidate.is_file());

        let skill_file = match skill_file {
            Some(file) => file,
            None => continue,
        };

        if std::fs::metadata(&skill_file)
            .map(|meta| meta.len() > MAX_MARKING_SKILL_BYTES)
            .unwrap_or(true)
        {
            continue;
        }

        let raw = match std::fs::read_to_string(&skill_file) {
            Ok(text) => text,
            Err(_) => continue,
        };

        let (front, content) = split_skill_front_matter(&raw);
        if content.trim().is_empty() {
            continue;
        }

        let name = front_matter_field(&front, "name").unwrap_or_else(|| id.clone());
        let description = front_matter_field(&front, "description").unwrap_or_default();

        skills.push(MarkingSkill {
            id,
            name,
            description,
            path: skill_file.to_string_lossy().to_string(),
            characters: content.chars().count(),
            content,
        });
    }

    skills.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(skills)
}

/// Lists `senaka-marking-*` skills from `~/.agents/skills` so the marking prompts
/// can include the same rules the agent uses. Missing folder is not an error: the
/// app simply reports no skills.
#[tauri::command]
fn list_marking_skills() -> Result<MarkingSkillListing, String> {
    let home = dirs::home_dir().ok_or("Unable to resolve the home directory")?;
    let root = home.join(".agents").join("skills");

    Ok(MarkingSkillListing {
        root: root.to_string_lossy().to_string(),
        skills: collect_marking_skills(&root)?,
    })
}

const STUDENT_MATERIALS_FOLDER: &str = "senaka-marking-materials";
const STUDENT_MATERIAL_EXTENSIONS: [&str; 5] = ["docx", "pdf", "txt", "md", "pptx"];
const RUBRICS_FOLDER: &str = "senaka-marking-rubric";
const RUBRIC_EXTENSIONS: [&str; 5] = ["docx", "pdf", "txt", "md", "csv"];
const MAX_MATERIAL_BYTES: u64 = 25 * 1024 * 1024;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct MaterialFile {
    name: String,
    path: String,
    extension: String,
    modified_ms: i64,
    data_base64: String,
}

fn safe_folder_name(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed == "." || trimmed == ".." {
        return None;
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains('\0') {
        return None;
    }
    Some(trimmed.to_string())
}

fn has_extension(path: &std::path::Path, extensions: &[&str]) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| extensions.contains(&ext.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

/// Finds the newest supported file inside the first matching folder.
/// Candidates are tried in order, so a visible ID or name wins over an internal one.
fn find_newest_supported_file(
    root: &std::path::Path,
    candidates: &[String],
    extensions: &[&str],
) -> Option<std::path::PathBuf> {
    for candidate in candidates {
        let folder = match safe_folder_name(candidate) {
            Some(name) => root.join(name),
            None => continue,
        };
        if !folder.is_dir() {
            continue;
        }

        let entries = match std::fs::read_dir(&folder) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        let mut newest: Option<(std::time::SystemTime, std::path::PathBuf)> = None;

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() || !has_extension(&path, extensions) {
                continue;
            }
            let metadata = match std::fs::metadata(&path) {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };
            if metadata.len() > MAX_MATERIAL_BYTES {
                continue;
            }
            let modified = metadata.modified().unwrap_or(std::time::UNIX_EPOCH);
            if newest
                .as_ref()
                .map(|(time, _)| modified > *time)
                .unwrap_or(true)
            {
                newest = Some((modified, path));
            }
        }

        if let Some((_, path)) = newest {
            return Some(path);
        }
    }

    None
}

fn documents_root() -> Option<std::path::PathBuf> {
    dirs::document_dir().or_else(|| dirs::home_dir().map(|home| home.join("Documents")))
}

fn student_materials_root() -> Option<std::path::PathBuf> {
    documents_root().map(|documents| documents.join(STUDENT_MATERIALS_FOLDER))
}

fn assessment_rubrics_root() -> Option<std::path::PathBuf> {
    documents_root().map(|documents| documents.join(RUBRICS_FOLDER))
}

fn read_material_file(
    root: Option<std::path::PathBuf>,
    candidates: &[String],
    extensions: &[&str],
) -> Result<Option<MaterialFile>, String> {
    use base64::Engine;

    let root = match root {
        Some(root) => root,
        None => return Ok(None),
    };

    let path = match find_newest_supported_file(&root, candidates, extensions) {
        Some(path) => path,
        None => return Ok(None),
    };

    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let modified_ms = std::fs::metadata(&path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0);

    Ok(Some(MaterialFile {
        name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("document")
            .to_string(),
        path: path.to_string_lossy().to_string(),
        extension: path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_ascii_lowercase(),
        modified_ms,
        data_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
    }))
}

/// Returns the absolute student materials folder so the app can show and copy a real path.
/// The folder is not created here; reading is the only thing the app needs.
#[tauri::command]
fn student_materials_dir() -> Result<String, String> {
    student_materials_root()
        .map(|root| root.to_string_lossy().to_string())
        .ok_or_else(|| "Unable to resolve the Documents folder".to_string())
}

/// Returns the absolute rubric folder, for the visible path and the copy button.
#[tauri::command]
fn assessment_rubrics_dir() -> Result<String, String> {
    assessment_rubrics_root()
        .map(|root| root.to_string_lossy().to_string())
        .ok_or_else(|| "Unable to resolve the Documents folder".to_string())
}

/// Reads the newest report for a student from `~/Documents/senaka-marking-materials/<id>/`.
/// A missing folder or an unsupported file returns `None`; reading never writes to disk.
#[tauri::command]
fn read_student_material_report(candidates: Vec<String>) -> Result<Option<MaterialFile>, String> {
    read_material_file(
        student_materials_root(),
        &candidates,
        &STUDENT_MATERIAL_EXTENSIONS,
    )
}

/// Reads the newest rubric for an assessment from `~/Documents/senaka-marking-rubric/<assessment>/`.
#[tauri::command]
fn read_assessment_rubric(candidates: Vec<String>) -> Result<Option<MaterialFile>, String> {
    read_material_file(assessment_rubrics_root(), &candidates, &RUBRIC_EXTENSIONS)
}

#[cfg(test)]
mod marking_skill_tests {
    use super::*;

    fn scratch_dir(label: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "feedback-marking-skills-{}-{}",
            label,
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("create scratch dir");
        dir
    }

    #[test]
    fn reads_only_prefixed_folders_with_skill_files() {
        let root = scratch_dir("discovery");
        let wanted = root.join("senaka-marking-evidence");
        let ignored = root.join("moodle-reading-notes");
        let empty = root.join("senaka-marking-empty");
        std::fs::create_dir_all(&wanted).unwrap();
        std::fs::create_dir_all(&ignored).unwrap();
        std::fs::create_dir_all(&empty).unwrap();
        std::fs::write(
            wanted.join("SKILL.md"),
            "---\nname: \"senaka-marking-evidence\"\ndescription: \"Quote evidence.\"\n---\n\nQuote evidence for every mark.",
        )
        .unwrap();
        std::fs::write(ignored.join("SKILL.md"), "Not a marking skill.").unwrap();

        let skills = collect_marking_skills(&root).expect("list skills");
        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].id, "senaka-marking-evidence");
        assert_eq!(skills[0].name, "senaka-marking-evidence");
        assert_eq!(skills[0].description, "Quote evidence.");
        assert!(!skills[0].content.contains("---"));
        assert!(skills[0]
            .content
            .starts_with("Quote evidence for every mark."));

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn missing_folder_is_not_an_error() {
        let missing = std::env::temp_dir().join("feedback-marking-skills-missing-does-not-exist");
        assert_eq!(collect_marking_skills(&missing).unwrap().len(), 0);
    }

    #[test]
    fn keeps_text_when_front_matter_is_unclosed() {
        let (front, content) = split_skill_front_matter("---\nname: broken\nRules stay visible.");
        assert!(front.is_empty());
        assert!(content.contains("Rules stay visible."));
    }

    #[test]
    fn reads_folded_and_literal_block_descriptions() {
        let folded = "name: a\ndescription: >\n  first line\n  second line";
        assert_eq!(
            front_matter_field(folded, "description").unwrap(),
            "first line second line"
        );

        let literal = "name: a\ndescription: |\n  first line\n  second line";
        assert_eq!(
            front_matter_field(literal, "description").unwrap(),
            "first line\nsecond line"
        );
    }

    fn material_dir(label: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "feedback-student-materials-{}-{}",
            label,
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("create materials root");
        dir
    }

    #[test]
    fn picks_newest_supported_report_in_the_first_matching_folder() {
        let root = material_dir("newest");
        let student = root.join("QA-001");
        std::fs::create_dir_all(&student).unwrap();

        std::fs::write(student.join("older.txt"), "old report").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        std::fs::write(student.join("newer.docx"), "new report").unwrap();
        std::fs::write(student.join("notes.pages"), "unsupported").unwrap();

        let candidates = vec!["QA-001".to_string()];
        let found = find_newest_supported_file(&root, &candidates, &STUDENT_MATERIAL_EXTENSIONS).expect("report path");
        assert_eq!(found.file_name().unwrap(), "newer.docx");

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn falls_back_to_the_next_candidate_and_ignores_unsupported_files() {
        let root = material_dir("fallback");
        let student = root.join("internal-id");
        std::fs::create_dir_all(&student).unwrap();
        std::fs::write(student.join("report.pdf"), "pdf bytes").unwrap();

        let candidates = vec!["missing-id".to_string(), "internal-id".to_string()];
        let found = find_newest_supported_file(&root, &candidates, &STUDENT_MATERIAL_EXTENSIONS).expect("report path");
        assert_eq!(found.file_name().unwrap(), "report.pdf");

        let only_unsupported = root.join("only-unsupported");
        std::fs::create_dir_all(&only_unsupported).unwrap();
        std::fs::write(only_unsupported.join("photo.png"), "image").unwrap();
        assert!(find_newest_supported_file(&root, &["only-unsupported".to_string()], &STUDENT_MATERIAL_EXTENSIONS).is_none());

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn rejects_folder_names_that_escape_the_materials_root() {
        let root = material_dir("traversal");
        let outside = std::env::temp_dir().join(format!(
            "feedback-student-materials-outside-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&outside);
        std::fs::create_dir_all(&outside).unwrap();
        std::fs::write(outside.join("secret.txt"), "secret").unwrap();

        let candidates = vec![
            "../".to_string(),
            "..".to_string(),
            "a/b".to_string(),
            String::new(),
        ];
        assert!(find_newest_supported_file(&root, &candidates, &STUDENT_MATERIAL_EXTENSIONS).is_none());

        let _ = std::fs::remove_dir_all(&root);
        let _ = std::fs::remove_dir_all(&outside);
    }

    #[test]
    fn rubric_folders_accept_csv_and_reject_powerpoint() {
        let root = material_dir("rubric");
        let assessment = root.join("Research and Communication");
        std::fs::create_dir_all(&assessment).unwrap();
        std::fs::write(assessment.join("rubric.pptx"), "slides").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        std::fs::write(assessment.join("rubric.csv"), "criterion,mark").unwrap();

        let candidates = vec!["Research and Communication".to_string()];
        let found = find_newest_supported_file(&root, &candidates, &RUBRIC_EXTENSIONS)
            .expect("rubric path");
        assert_eq!(found.file_name().unwrap(), "rubric.csv");

        let only_pptx = root.join("Slides Only");
        std::fs::create_dir_all(&only_pptx).unwrap();
        std::fs::write(only_pptx.join("rubric.pptx"), "slides").unwrap();
        assert!(
            find_newest_supported_file(&root, &["Slides Only".to_string()], &RUBRIC_EXTENSIONS)
                .is_none()
        );

        let _ = std::fs::remove_dir_all(&root);
    }
}

#[tauri::command]
fn generate_pdf_file(
    content: String,
    subject_name: Option<String>,
    assessment_name: Option<String>,
    student_name: Option<String>,
) -> Result<String, String> {
    use printpdf::*;
    
    let dir = portable_data_dir()?;
    
    // Generate filename
    let mut filename = "Feedback-report".to_string();
    if let Some(subject) = &subject_name {
        filename = format!(
            "{}-{}",
            filename,
            subject.replace(|c: char| !c.is_alphanumeric(), "-")
        );
    }
    if let Some(assessment) = &assessment_name {
        filename = format!(
            "{}-{}",
            filename,
            assessment.replace(|c: char| !c.is_alphanumeric(), "-")
        );
    }
    if let Some(student) = &student_name {
        filename = format!(
            "{}-{}",
            filename,
            student.replace(|c: char| !c.is_alphanumeric(), "-")
        );
    }
    filename = format!("{}.pdf", filename);
    
    let pdf_path = std::path::Path::new(&dir).join(&filename);
    
    // Create PDF document
    let (doc, page1, layer1) = PdfDocument::new("Feedback Report", Mm(210.0), Mm(297.0), "Layer 1");
    let current_layer = doc.get_page(page1).get_layer(layer1);
    
    // Add fonts
    let font = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| e.to_string())?;
    let regular_font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| e.to_string())?;
    
    let mut y_position = 270.0; // Start from top
    let margin = 20.0;
    
    // Font sizes and spacing
    let header_font_size = 10.0;
    let content_font_size = 9.0; // One level smaller for paragraph text
    let header_spacing = 4.0;
    let content_spacing = 3.0;
    let empty_line_spacing = 1.5;

    // Add header information with smaller font size and bold font
    if let Some(subject) = &subject_name {
        current_layer.use_text(
            format!("Subject: {}", subject),
            header_font_size,
            Mm(margin),
            Mm(y_position),
            &font,
        );
        y_position -= header_spacing + 1.0;
    }
    
    if let Some(assessment) = &assessment_name {
        current_layer.use_text(
            format!("Assessment: {}", assessment),
            header_font_size,
            Mm(margin),
            Mm(y_position),
            &font,
        );
        y_position -= header_spacing;
    }
    
    if let Some(student) = &student_name {
        current_layer.use_text(
            format!("Student: {}", student),
            header_font_size,
            Mm(margin),
            Mm(y_position),
            &font,
        );
        y_position -= header_spacing;
    }
    
    // Add separator with reduced spacing
    y_position -= 6.0;
    
    // Add content
    let lines: Vec<&str> = content.split('\n').collect();
    for line in lines {
        if y_position < 30.0 {
            // Would need new page logic here for a full implementation
            break;
        }
        
        if line.trim().is_empty() {
            y_position -= empty_line_spacing; // Reduced empty line spacing
            continue;
        }
        
        // Check if it's a category header (Sub Objective X.X, Sub Learning Objective X.X, Report, Decision followed by ':')
        if line.trim().ends_with(':')
            && (line.contains("Sub Objective")
                || line.contains("Sub Learning Objective")
                || line.contains("Report")
                || line.contains("Decision"))
        {
            // Bold font for category headers, same size as content
            current_layer.use_text(
                line.to_string(),
                header_font_size,
                Mm(margin),
                Mm(y_position),
                &font,
            );
            y_position -= header_spacing; // Reduced spacing after headers
        } else {
            // Regular content with smaller font
            current_layer.use_text(
                line.to_string(),
                content_font_size,
                Mm(margin),
                Mm(y_position),
                &regular_font,
            );
            y_position -= content_spacing; // Further reduced line spacing
        }
    }
    
    // Save the PDF
    use std::io::BufWriter;
    let file = std::fs::File::create(&pdf_path).map_err(|e| e.to_string())?;
    let mut writer = BufWriter::new(file);
    doc.save(&mut writer).map_err(|e| e.to_string())?;
    
    Ok(pdf_path.to_string_lossy().to_string())
}

#[tauri::command]
fn write_student_evaluation(
    student_id: String,
    assessment_id: String,
    data: String,
) -> Result<(), String> {
    let dir = portable_data_dir()?;
    let filename = format!("student-evaluation-{}-{}.json", student_id, assessment_id);
    let path = std::path::Path::new(&dir).join(filename);
    std::fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_student_evaluation(student_id: String, assessment_id: String) -> Result<String, String> {
    let dir = portable_data_dir()?;
    let filename = format!("student-evaluation-{}-{}.json", student_id, assessment_id);
    let path = std::path::Path::new(&dir).join(filename);
    match std::fs::read_to_string(&path) {
        Ok(s) => Ok(s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn write_student_paragraphs(student_id: String, data: String) -> Result<(), String> {
    let dir = portable_data_dir()?;
    let filename = format!("student-paragraphs-{}.json", student_id);
    let path = std::path::Path::new(&dir).join(filename);
    std::fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_student_paragraphs(student_id: String) -> Result<String, String> {
    let dir = portable_data_dir()?;
    let filename = format!("student-paragraphs-{}.json", student_id);
    let path = std::path::Path::new(&dir).join(filename);
    match std::fs::read_to_string(&path) {
        Ok(s) => Ok(s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn delete_student_evaluation(student_id: String, assessment_id: String) -> Result<(), String> {
    let dir = portable_data_dir()?;
    let filename = format!("student-evaluation-{}-{}.json", student_id, assessment_id);
    let path = std::path::Path::new(&dir).join(filename);
    
    match std::fs::remove_file(&path) {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()), // File doesn't exist, that's fine
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn delete_student_paragraphs(student_id: String) -> Result<(), String> {
    let dir = portable_data_dir()?;
    let filename = format!("student-paragraphs-{}.json", student_id);
    let path = std::path::Path::new(&dir).join(filename);
    
    match std::fs::remove_file(&path) {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()), // File doesn't exist, that's fine
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn delete_all_student_files(student_id: String) -> Result<(), String> {
    let dir = portable_data_dir()?;
    
    // Delete student paragraphs file
    let paragraphs_filename = format!("student-paragraphs-{}.json", student_id);
    let paragraphs_path = std::path::Path::new(&dir).join(paragraphs_filename);
    
    if let Err(e) = std::fs::remove_file(&paragraphs_path) {
        if e.kind() != std::io::ErrorKind::NotFound {
            return Err(e.to_string());
        }
    }
    
    // Find and delete all student evaluation files for this student
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                if let Some(file_name) = entry.file_name().to_str() {
                    if file_name.starts_with(&format!("student-evaluation-{}-", student_id))
                        && file_name.ends_with(".json")
                    {
                        if let Err(e) = std::fs::remove_file(entry.path()) {
                            eprintln!("Warning: Could not delete file {}: {}", file_name, e);
                        }
                    }
                }
            }
        }
    }
    
    Ok(())
}

#[tauri::command]
fn export_csv_file(content: String, subject_name: String) -> Result<String, String> {
    // Get Downloads directory
    let downloads_dir = dirs::download_dir().ok_or("Could not find Downloads directory")?;
    
    // Generate filename with current date
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    
    let date_str = chrono::DateTime::from_timestamp(now as i64, 0)
        .unwrap_or_default()
        .format("%Y-%m-%d")
        .to_string();
    
    let safe_subject_name = subject_name
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>();
    
    let filename = format!("student-marks-{}-{}.csv", safe_subject_name, date_str);
    let csv_path = downloads_dir.join(&filename);
    
    // Write CSV content to file
    std::fs::write(&csv_path, content).map_err(|e| e.to_string())?;
    
    Ok(csv_path.to_string_lossy().to_string())
}

fn sanitize_component(value: &str) -> String {
    let mut result = String::new();
    let mut last_was_hyphen = false;

    for c in value.chars() {
        if c.is_alphanumeric() {
            result.push(c);
            last_was_hyphen = false;
        } else if !last_was_hyphen {
            result.push('-');
            last_was_hyphen = true;
        }
    }

    while result.ends_with('-') {
        result.pop();
    }
    while result.starts_with('-') {
        result.remove(0);
    }

    result
}

#[tauri::command]
fn save_pdf_to_folder(
    pdf_data: Vec<u8>,
    subject_name: Option<String>,
    assessment_name: Option<String>,
    student_name: Option<String>,
) -> Result<String, String> {
    // Get Documents directory
    let documents_dir = dirs::document_dir().ok_or("Could not find Documents directory")?;

    // Create folder structure: Documents/Feedback-PDFs/[AssessmentName]/
    let pdfs_dir = documents_dir.join("Feedback-PDFs");
    std::fs::create_dir_all(&pdfs_dir).map_err(|e| e.to_string())?;

    // Create assessment-specific folder if assessment name is provided
    let target_dir = if let Some(assessment) = &assessment_name {
        let safe_assessment = sanitize_component(assessment);
        let assessment_dir = pdfs_dir.join(&safe_assessment);
        std::fs::create_dir_all(&assessment_dir).map_err(|e| e.to_string())?;
        assessment_dir
    } else {
        pdfs_dir
    };

    // Generate filename
    let mut filename = "Feedback-report".to_string();
    if let Some(subject) = &subject_name {
        let safe_subject = sanitize_component(subject);
        if !safe_subject.is_empty() {
            filename = format!("{}-{}", filename, safe_subject);
        }
    }
    if let Some(assessment) = &assessment_name {
        let safe_assessment = sanitize_component(assessment);
        if !safe_assessment.is_empty() {
            filename = format!("{}-{}", filename, safe_assessment);
        }
    }
    if let Some(student) = &student_name {
        let safe_student = sanitize_component(student);
        if !safe_student.is_empty() {
            filename = format!("{}-{}", filename, safe_student);
        }
    }
    filename = format!("{}.pdf", filename);

    let pdf_path = target_dir.join(&filename);

    // Write PDF data to file
    std::fs::write(&pdf_path, pdf_data).map_err(|e| e.to_string())?;

    Ok(pdf_path.to_string_lossy().to_string())
}
