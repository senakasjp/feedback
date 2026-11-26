use std::io::Write;

#[tauri::command]
pub fn open_uploaded_docx(data: Vec<u8>) -> Result<(), String> {
    if !data.starts_with(b"PK\x03\x04") {
        return Err("The original DOCX data is invalid.".into());
    }
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let directory =
        std::env::temp_dir().join(format!("feedback-document-{}-{stamp}", std::process::id()));
    let mut builder = std::fs::DirBuilder::new();
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        builder.mode(0o700);
    }
    builder
        .create(&directory)
        .map_err(|error| error.to_string())?;
    let path = directory.join("Uploaded document.docx");
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|error| error.to_string())?;
    file.write_all(&data).map_err(|error| error.to_string())?;
    drop(file);
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("/usr/bin/open")
        .arg(&path)
        .status();
    #[cfg(target_os = "linux")]
    let result = std::process::Command::new("xdg-open").arg(&path).status();
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("explorer.exe")
        .arg(&path)
        .status();
    let status = result.map_err(|error| format!("Could not open document: {error}"))?;
    if !status.success() {
        return Err("Could not open the document. Install an app that opens DOCX files.".into());
    }
    Ok(())
}
