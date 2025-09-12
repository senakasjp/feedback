#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![portable_data_dir, write_portable, read_portable, write_subject_data, read_subject_data, generate_pdf_file, write_student_evaluation, read_student_evaluation, write_student_paragraphs, read_student_paragraphs])
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
    
    // Add header information with smaller font size and bold font
    if let Some(subject) = &subject_name {
        current_layer.use_text(format!("Subject: {}", subject), 10.0, Mm(margin), Mm(y_position), &font);
        y_position -= 6.0;
    }
    
    if let Some(assessment) = &assessment_name {
        current_layer.use_text(format!("Assessment: {}", assessment), 10.0, Mm(margin), Mm(y_position), &font);
        y_position -= 5.0;
    }
    
    if let Some(student) = &student_name {
        current_layer.use_text(format!("Student: {}", student), 10.0, Mm(margin), Mm(y_position), &font);
        y_position -= 5.0;
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
            y_position -= 2.0; // Reduced empty line spacing
            continue;
        }
        
        // Check if it's a category header (Sub Objective X.X, Sub Learning Objective X.X, Report, Decision followed by ':')
        if line.trim().ends_with(':') && (line.contains("Sub Objective") || line.contains("Sub Learning Objective") || line.contains("Report") || line.contains("Decision")) {
            // Bold font for category headers, same size as content
            current_layer.use_text(line.to_string(), 10.0, Mm(margin), Mm(y_position), &font);
            y_position -= 5.0; // Reduced spacing after headers
        } else {
            // Regular content with smaller font
            current_layer.use_text(line.to_string(), 10.0, Mm(margin), Mm(y_position), &regular_font);
            y_position -= 4.0; // Further reduced line spacing
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
