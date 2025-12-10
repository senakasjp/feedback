#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![portable_data_dir, write_portable, read_portable, write_subject_data, read_subject_data, generate_pdf_file, write_student_evaluation, read_student_evaluation, write_student_paragraphs, read_student_paragraphs, delete_student_evaluation, delete_student_paragraphs, delete_all_student_files, export_csv_file, save_pdf_to_folder])
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
        filename = format!("{}-{}", filename, subject.replace(|c: char| !c.is_alphanumeric(), "-"));
    }
    if let Some(assessment) = &assessment_name {
        filename = format!("{}-{}", filename, assessment.replace(|c: char| !c.is_alphanumeric(), "-"));
    }
    if let Some(student) = &student_name {
        filename = format!("{}-{}", filename, student.replace(|c: char| !c.is_alphanumeric(), "-"));
    }
    filename = format!("{}.pdf", filename);
    
    let pdf_path = std::path::Path::new(&dir).join(&filename);
    
    // Create PDF document
    let (doc, page1, layer1) = PdfDocument::new("Feedback Report", Mm(210.0), Mm(297.0), "Layer 1");
    let current_layer = doc.get_page(page1).get_layer(layer1);
    
    // Add fonts
    let font = doc.add_builtin_font(BuiltinFont::HelveticaBold).map_err(|e| e.to_string())?;
    let regular_font = doc.add_builtin_font(BuiltinFont::Helvetica).map_err(|e| e.to_string())?;
    
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
        current_layer.use_text(format!("Subject: {}", subject), header_font_size, Mm(margin), Mm(y_position), &font);
        y_position -= header_spacing + 1.0;
    }
    
    if let Some(assessment) = &assessment_name {
        current_layer.use_text(format!("Assessment: {}", assessment), header_font_size, Mm(margin), Mm(y_position), &font);
        y_position -= header_spacing;
    }
    
    if let Some(student) = &student_name {
        current_layer.use_text(format!("Student: {}", student), header_font_size, Mm(margin), Mm(y_position), &font);
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
        if line.trim().ends_with(':') && (line.contains("Sub Objective") || line.contains("Sub Learning Objective") || line.contains("Report") || line.contains("Decision")) {
            // Bold font for category headers, same size as content
            current_layer.use_text(line.to_string(), header_font_size, Mm(margin), Mm(y_position), &font);
            y_position -= header_spacing; // Reduced spacing after headers
        } else {
            // Regular content with smaller font
            current_layer.use_text(line.to_string(), content_font_size, Mm(margin), Mm(y_position), &regular_font);
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
fn write_student_evaluation(student_id: String, assessment_id: String, data: String) -> Result<(), String> {
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
                    if file_name.starts_with(&format!("student-evaluation-{}-", student_id)) && file_name.ends_with(".json") {
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
    let downloads_dir = dirs::download_dir()
        .ok_or("Could not find Downloads directory")?;
    
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
    let documents_dir = dirs::document_dir()
        .ok_or("Could not find Documents directory")?;

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
