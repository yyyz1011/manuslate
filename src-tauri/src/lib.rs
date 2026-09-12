use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeMarkdownFile {
    path: String,
    name: String,
    content: String,
    modified_at: u64,
    relative_path: Option<String>,
    category_name: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeFileSnapshot {
    content: String,
    modified_at: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeWriteResult {
    path: String,
    name: String,
    modified_at: u64,
}

fn modified_at(path: &Path) -> Result<u64, String> {
    let modified = fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .map_err(|error| format!("无法读取文件时间：{error}"))?;
    Ok(modified.duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64)
}

fn supported_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| matches!(extension.to_ascii_lowercase().as_str(), "md" | "markdown" | "mdown" | "txt"))
        .unwrap_or(false)
}

fn read_markdown(path: &Path, root: Option<&Path>) -> Result<NativeMarkdownFile, String> {
    if !supported_markdown(path) {
        return Err("只支持 Markdown 与纯文本文件".into());
    }
    let content = fs::read_to_string(path).map_err(|error| format!("无法读取 {}：{error}", path.display()))?;
    let name = path.file_name().and_then(|name| name.to_str()).unwrap_or("未命名.md").to_string();
    let (relative_path, category_name) = if let Some(root) = root {
        let root_name = root.file_name().and_then(|name| name.to_str()).unwrap_or("导入文件夹");
        let relative = path.strip_prefix(root).unwrap_or(path).to_string_lossy().replace('\\', "/");
        (Some(format!("{root_name}/{relative}")), Some(root_name.to_string()))
    } else {
        (None, None)
    };
    Ok(NativeMarkdownFile {
        path: path.to_string_lossy().to_string(),
        name,
        content,
        modified_at: modified_at(path)?,
        relative_path,
        category_name,
    })
}

#[tauri::command]
fn read_markdown_files(paths: Vec<String>) -> Result<Vec<NativeMarkdownFile>, String> {
    paths.into_iter().map(|path| read_markdown(Path::new(&path), None)).collect()
}

fn collect_markdown(root: &Path, directory: &Path, files: &mut Vec<NativeMarkdownFile>) -> Result<(), String> {
    let entries = fs::read_dir(directory).map_err(|error| format!("无法读取 {}：{error}", directory.display()))?;
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if path.is_dir() {
            if name.starts_with('.') || matches!(name.as_ref(), "node_modules" | "target" | "dist") { continue; }
            collect_markdown(root, &path, files)?;
        } else if supported_markdown(&path) {
            files.push(read_markdown(&path, Some(root))?);
        }
    }
    Ok(())
}

#[tauri::command]
fn scan_markdown_directory(root: String) -> Result<Vec<NativeMarkdownFile>, String> {
    let root_path = PathBuf::from(root);
    let mut files = Vec::new();
    collect_markdown(&root_path, &root_path, &mut files)?;
    files.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok(files)
}

#[tauri::command]
fn read_file_snapshot(path: String) -> Result<NativeFileSnapshot, String> {
    let path = PathBuf::from(path);
    let content = fs::read_to_string(&path).map_err(|error| format!("无法读取 {}：{error}", path.display()))?;
    Ok(NativeFileSnapshot { content, modified_at: modified_at(&path)? })
}

#[tauri::command]
fn write_markdown_file(path: String, content: String) -> Result<NativeWriteResult, String> {
    let path = PathBuf::from(path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建目录：{error}"))?;
    }
    fs::write(&path, content.as_bytes()).map_err(|error| format!("无法写入 {}：{error}", path.display()))?;
    Ok(NativeWriteResult {
        name: path.file_name().and_then(|name| name.to_str()).unwrap_or("未命名.md").to_string(),
        path: path.to_string_lossy().to_string(),
        modified_at: modified_at(&path)?,
    })
}

fn sanitized_file_name(value: &str) -> String {
    let cleaned: String = value.chars().map(|character| if matches!(character, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') { '-' } else { character }).collect();
    let cleaned = cleaned.trim();
    if cleaned.is_empty() { "未命名".to_string() } else { cleaned.to_string() }
}

fn safe_markdown_name(value: &str) -> String {
    let name = sanitized_file_name(value);
    let lower = name.to_ascii_lowercase();
    if [".md", ".markdown", ".mdown", ".txt"].iter().any(|extension| lower.ends_with(extension)) { name } else { format!("{name}.md") }
}

#[tauri::command]
fn unique_markdown_path(directory: String, suggested_name: String) -> Result<String, String> {
    let directory = PathBuf::from(directory);
    if !directory.is_dir() { return Err("默认文件夹不存在".into()); }
    let file_name = safe_markdown_name(&suggested_name);
    let path = Path::new(&file_name);
    let stem = path.file_stem().and_then(|value| value.to_str()).unwrap_or("未命名");
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("md");
    for index in 1..=1000 {
        let candidate = if index == 1 { file_name.clone() } else { format!("{stem} {index}.{extension}") };
        let candidate_path = directory.join(candidate);
        if !candidate_path.exists() { return Ok(candidate_path.to_string_lossy().to_string()); }
    }
    Ok(directory.join(format!("{stem}-{}.{}", std::process::id(), extension)).to_string_lossy().to_string())
}

#[tauri::command]
fn write_image_file(directory: String, file_name: String, bytes: Vec<u8>) -> Result<String, String> {
    let directory = PathBuf::from(directory);
    fs::create_dir_all(&directory).map_err(|error| format!("无法创建资源目录：{error}"))?;
    let safe_name = sanitized_file_name(&file_name);
    let target = directory.join(safe_name);
    fs::write(&target, bytes).map_err(|error| format!("无法写入图片：{error}"))?;
    Ok(target.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_and_completes_markdown_names() {
        assert_eq!(safe_markdown_name("项目/计划"), "项目-计划.md");
        assert_eq!(safe_markdown_name("README.md"), "README.md");
        assert_eq!(sanitized_file_name("cover:1.png"), "cover-1.png");
    }

    #[test]
    fn unique_path_never_reuses_an_existing_document() {
        let directory = std::env::temp_dir().join(format!("manuslate-test-{}", std::process::id()));
        fs::create_dir_all(&directory).unwrap();
        fs::write(directory.join("未命名.md"), "existing").unwrap();
        let result = unique_markdown_path(directory.to_string_lossy().to_string(), "未命名.md".into()).unwrap();
        assert!(result.ends_with("未命名 2.md"));
        fs::remove_dir_all(directory).unwrap();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_markdown_files,
            scan_markdown_directory,
            read_file_snapshot,
            write_markdown_file,
            unique_markdown_path,
            write_image_file,
        ])
        .run(tauri::generate_context!())
        .expect("Manuslate failed to start");
}
