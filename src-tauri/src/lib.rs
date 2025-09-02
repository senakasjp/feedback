#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![portable_data_dir, write_portable, read_portable, write_subject_data, read_subject_data])
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

    let data_dir = base.join("data");
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
