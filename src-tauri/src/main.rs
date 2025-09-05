// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::State;
use std::sync::Mutex;
use std::fs;
use std::io::{BufWriter, Write};
use printpdf::*;

mod database;
use database::{Database, Subject, Assessment, Category, Paragraph};

// App state containing the database connection
pub struct AppState {
    db: Mutex<Database>,
}

#[derive(serde::Deserialize)]
struct PrintData {
    content: String,
    student_name: Option<String>,
    subject: Option<String>,
    assessment: Option<String>,
    student_image: Option<String>, // Base64 encoded image data
}

// Initialize the database
#[tauri::command]
async fn init_database(_state: State<'_, AppState>) -> Result<(), String> {
    // Database is already initialized when the app starts
    // This command exists for consistency with the frontend
    Ok(())
}

// Subject commands
#[tauri::command]
async fn get_subjects(state: State<'_, AppState>) -> Result<Vec<Subject>, String> {
    let db = state.db.lock().unwrap();
    db.get_subjects().map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_subject(state: State<'_, AppState>, name: String) -> Result<i32, String> {
    let mut db = state.db.lock().unwrap();
    db.create_subject(&name).map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_subject(state: State<'_, AppState>, id: i32, name: String) -> Result<(), String> {
    let mut db = state.db.lock().unwrap();
    db.update_subject(id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_subject(state: State<'_, AppState>, id: i32) -> Result<(), String> {
    println!("🔴 BACKEND: Received delete_subject command for ID: {}", id);
    let mut db = state.db.lock().unwrap();
    println!("🔴 BACKEND: Got database lock, calling delete_subject");
    match db.delete_subject(id) {
        Ok(()) => {
            println!("🔴 BACKEND: Successfully deleted subject with ID: {}", id);
            Ok(())
        }
        Err(e) => {
            println!("🔴 BACKEND: Failed to delete subject with ID: {}, error: {}", id, e);
            Err(e.to_string())
        }
    }
}

// Assessment commands
#[tauri::command]
async fn get_assessments(state: State<'_, AppState>, subject_id: i32) -> Result<Vec<Assessment>, String> {
    let db = state.db.lock().unwrap();
    db.get_assessments(subject_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_assessment(state: State<'_, AppState>, subject_id: i32, name: String) -> Result<i32, String> {
    let mut db = state.db.lock().unwrap();
    db.create_assessment(subject_id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_assessment(state: State<'_, AppState>, id: i32, name: String) -> Result<(), String> {
    let mut db = state.db.lock().unwrap();
    db.update_assessment(id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_assessment(state: State<'_, AppState>, id: i32) -> Result<(), String> {
    let mut db = state.db.lock().unwrap();
    db.delete_assessment(id).map_err(|e| e.to_string())
}

// Category commands
#[tauri::command]
async fn get_categories(state: State<'_, AppState>) -> Result<Vec<Category>, String> {
    let db = state.db.lock().unwrap();
    db.get_categories().map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_category(state: State<'_, AppState>, name: String) -> Result<i32, String> {
    let mut db = state.db.lock().unwrap();
    db.create_category(&name).map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_category(state: State<'_, AppState>, id: i32, name: String) -> Result<(), String> {
    let mut db = state.db.lock().unwrap();
    db.update_category(id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_category(state: State<'_, AppState>, id: i32) -> Result<(), String> {
    let mut db = state.db.lock().unwrap();
    db.delete_category(id).map_err(|e| e.to_string())
}

// Paragraph commands
#[tauri::command]
async fn get_paragraphs(state: State<'_, AppState>, assessment_id: i32) -> Result<Vec<Paragraph>, String> {
    let db = state.db.lock().unwrap();
    db.get_paragraphs(assessment_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_all_paragraphs(state: State<'_, AppState>) -> Result<Vec<Paragraph>, String> {
    let db = state.db.lock().unwrap();
    db.get_all_paragraphs().map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_paragraph(
    state: State<'_, AppState>,
    assessment_id: i32,
    category_id: i32,
    name: String,
    content: String,
    image_path: Option<String>,
) -> Result<i32, String> {
    let mut db = state.db.lock().unwrap();
    db.create_paragraph(assessment_id, category_id, &name, &content, image_path.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_paragraph(
    state: State<'_, AppState>,
    id: i32,
    name: String,
    content: String,
    category_id: i32,
    image_path: Option<String>,
) -> Result<(), String> {
    let mut db = state.db.lock().unwrap();
    db.update_paragraph(id, &name, &content, category_id, image_path.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_paragraph(state: State<'_, AppState>, id: i32) -> Result<(), String> {
    let mut db = state.db.lock().unwrap();
    db.delete_paragraph(id).map_err(|e| e.to_string())
}

// Export to PDF using proper PDF generation
#[tauri::command]
async fn export_to_pdf(data: PrintData) -> Result<String, String> {
    println!("🔵 PDF Export: FUNCTION CALLED - Starting PDF generation");
    println!("🔵 PDF Export: Content length: {} characters", data.content.len());
    println!("🔵 PDF Export: Content preview: {}", data.content.chars().take(100).collect::<String>());
    println!("🔵 PDF Export: Student name: {:?}", data.student_name);
    println!("🔵 PDF Export: Subject: {:?}", data.subject);
    println!("🔵 PDF Export: Assessment: {:?}", data.assessment);
    println!("🔵 PDF Export: Student image provided: {}", data.student_image.is_some());
    if let Some(ref img) = data.student_image {
        println!("🔵 PDF Export: Image data length: {} characters", img.len());
    }

    // Validate input
    if data.content.trim().is_empty() {
        println!("🔴 PDF Export: Empty content provided");
        return Err("No content to export".to_string());
    }
    println!("🔵 PDF Export: Content validation passed");

    // Get downloads directory with fallback
    let downloads_dir = dirs::download_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
        .ok_or("Could not find downloads directory or home directory")?;

    // Ensure downloads directory exists
    if !downloads_dir.exists() {
        println!("🔵 PDF Export: Creating downloads directory: {:?}", downloads_dir);
        fs::create_dir_all(&downloads_dir).map_err(|e| {
            println!("🔴 PDF Export: Failed to create downloads directory: {}", e);
            format!("Failed to create downloads directory: {}", e)
        })?;
    }

    let filename = format!("feedback_{}.pdf", chrono::Utc::now().format("%Y%m%d_%H%M%S"));
    let file_path = downloads_dir.join(&filename);

    println!("🔵 PDF Export: Saving to {:?}", file_path);

    // Create PDF document
    println!("🔵 PDF Export: Creating PDF document");
    let (doc, page1, layer1) = PdfDocument::new("Feedback Report", Mm(210.0), Mm(297.0), "Layer 1");
    let current_layer = doc.get_page(page1).get_layer(layer1);
    println!("🔵 PDF Export: PDF document created successfully");

    // Set up fonts
    let font = doc.add_builtin_font(BuiltinFont::HelveticaBold).map_err(|e| {
        println!("🔴 PDF Export: Failed to add font: {}", e);
        format!("Failed to add font: {}", e)
    })?;

    let font_regular = doc.add_builtin_font(BuiltinFont::Helvetica).map_err(|e| {
        println!("🔴 PDF Export: Failed to add regular font: {}", e);
        format!("Failed to add regular font: {}", e)
    })?;

    // Add title
    let title = "FEEDBACK REPORT";
    current_layer.use_text(title, 24.0, Mm(20.0), Mm(270.0), &font);

    // Add horizontal line (using text as a simple line)
    let mut y_position = 250.0;
    current_layer.use_text("________________________________________________________________________________", 10.0, Mm(20.0), Mm(y_position), &font_regular);
    y_position -= 20.0;

    // Add student image placeholder (full page width)
    if data.student_image.is_some() {
        println!("🔵 PDF Export: Student image provided - creating full page width placeholder");
        
        // Create a full page width placeholder using repeated characters
        let full_width_line = "█".repeat(85); // Full page width placeholder
        
        // Add multiple lines to create a rectangular image placeholder
        for i in 0..8 {
            current_layer.use_text(&full_width_line, 8.0, Mm(20.0), Mm(y_position - (i as f32 * 8.0)), &font_regular);
        }
        
        // Add text label below the placeholder
        current_layer.use_text("STUDENT PHOTO (Full Page Width)", 12.0, Mm(20.0), Mm(y_position - 70.0), &font);
        
        println!("🔵 PDF Export: Full page width image placeholder created");
        y_position -= 80.0; // Move down by placeholder height plus spacing
    } else {
        println!("🔵 PDF Export: No student image provided");
        current_layer.use_text("Student Photo: [No image provided]", 10.0, Mm(20.0), Mm(y_position), &font_regular);
        y_position -= 30.0;
    }

    // Add student information
    let student_name = data.student_name.as_deref().unwrap_or("Student Name");
    let subject = data.subject.as_deref().unwrap_or("Subject");
    let assessment = data.assessment.as_deref().unwrap_or("Assessment");
    
    current_layer.use_text(format!("Student: {}", student_name), 12.0, Mm(20.0), Mm(y_position), &font_regular);
    y_position -= 15.0;
    current_layer.use_text(format!("Subject: {}", subject), 12.0, Mm(20.0), Mm(y_position), &font_regular);
    y_position -= 15.0;
    current_layer.use_text(format!("Assessment: {}", assessment), 12.0, Mm(20.0), Mm(y_position), &font_regular);
    y_position -= 20.0;


    // Add content
    y_position -= 10.0;
    let line_height = 6.0;
    let left_margin = 20.0;
    let _right_margin = 20.0;
    let _max_width = 170.0; // A4 width minus margins

    // Split content into lines and wrap text
    let lines = wrap_text(&data.content, 80); // 80 characters per line

    for line in lines {
        if y_position < 30.0 { // Near bottom of page
            println!("🔵 PDF Export: Content too long, would need multiple pages");
            break;
        }

        current_layer.use_text(line, 10.0, Mm(left_margin), Mm(y_position), &font_regular);
        y_position -= line_height;
    }

    // Save PDF
    println!("🔵 PDF Export: Saving PDF file to {:?}", file_path);
    let file = fs::File::create(&file_path).map_err(|e| {
        println!("🔴 PDF Export: Failed to create PDF file: {}", e);
        format!("Failed to create PDF file: {}", e)
    })?;
    println!("🔵 PDF Export: PDF file created successfully");

    let mut writer = BufWriter::new(file);
    doc.save(&mut writer).map_err(|e| {
        println!("🔴 PDF Export: Failed to save PDF: {}", e);
        format!("Failed to save PDF: {}", e)
    })?;
    println!("🔵 PDF Export: PDF content written successfully");

    // Flush the writer to ensure data is written
    writer.flush().map_err(|e| {
        println!("🔴 PDF Export: Failed to flush PDF file: {}", e);
        format!("Failed to flush PDF file: {}", e)
    })?;
    println!("🔵 PDF Export: PDF file flushed successfully");

    // Verify file was created and has content
    if !file_path.exists() {
        println!("🔴 PDF Export: PDF file was not created successfully");
        return Err("PDF file was not created successfully".to_string());
    }
    
    let metadata = fs::metadata(&file_path).map_err(|e| {
        println!("🔴 PDF Export: Failed to get file metadata: {}", e);
        format!("Failed to get file metadata: {}", e)
    })?;
    println!("✅ PDF Export: PDF saved successfully to {:?} ({} bytes)", file_path, metadata.len());

    let file_size = fs::metadata(&file_path)
        .map(|m| m.len())
        .unwrap_or(0);

    println!("✅ PDF Export: Successfully saved PDF to: {:?} ({} bytes)", file_path, file_size);

    Ok(filename)
}

// Create HTML report that can be printed as PDF
fn create_html_report(content: &str, date: &str) -> String {
    let content_html = content
        .lines()
        .map(|line| {
            if line.trim().is_empty() {
                "<br>".to_string()
            } else {
                format!("<p>{}</p>", html_escape(line))
            }
        })
        .collect::<Vec<String>>()
        .join("\n");

    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feedback Report</title>
    <style>
        @media print {{
            @page {{
                margin: 1in;
                size: A4;
            }}
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
            }}
        }}
        body {{
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }}
        .header {{
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        .title {{
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
        }}
        .date {{
            font-size: 14px;
            color: #666;
        }}
        .content {{
            font-size: 14px;
        }}
        .content p {{
            margin: 10px 0;
        }}
    </style>
</head>
<body>
    <div class="header">
        <div class="title">FEEDBACK REPORT</div>
        <div class="date">Generated on: {}</div>
    </div>
    <div class="content">
        {}
    </div>
    <script>
        // Auto-print when opened
        window.onload = function() {{
            setTimeout(function() {{
                window.print();
            }}, 1000);
        }};
    </script>
</body>
</html>"#,
        date, content_html
    )
}

// Helper function to escape HTML
fn html_escape(text: &str) -> String {
    text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#x27;")
}

// Helper function to wrap text
fn wrap_text(text: &str, max_width: usize) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    let mut lines = Vec::new();
    let mut current_line = String::new();
    
    for word in words {
        if current_line.len() + word.len() + 1 <= max_width {
            if !current_line.is_empty() {
                current_line.push(' ');
            }
            current_line.push_str(word);
        } else {
            if !current_line.is_empty() {
                lines.push(current_line);
                current_line = String::new();
            }
            current_line.push_str(word);
        }
    }
    
    if !current_line.is_empty() {
        lines.push(current_line);
    }
    
    lines
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize the database
    let database = Database::new().expect("Failed to initialize database");
    
    tauri::Builder::default()
        .manage(AppState {
            db: Mutex::new(database),
        })
        .invoke_handler(tauri::generate_handler![
            init_database,
            get_subjects,
            create_subject,
            update_subject,
            delete_subject,
            get_assessments,
            create_assessment,
            update_assessment,
            delete_assessment,
            get_categories,
            create_category,
            update_category,
            delete_category,
            get_paragraphs,
            get_all_paragraphs,
            create_paragraph,
            update_paragraph,
            delete_paragraph,
            export_to_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}