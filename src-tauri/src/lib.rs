use atomicwrites::{AllowOverwrite, AtomicFile};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use walkdir::{DirEntry, WalkDir};

const MAX_MARKDOWN_BYTES: u64 = 16 * 1024 * 1024;
const DATABASE_FILE: &str = "patchmark-index.sqlite3";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RawMarkdownFile {
    relative_path: String,
    content: String,
    updated_at: u64,
    size: u64,
    hash: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanWarning {
    path: String,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct IndexStatus {
    database_path: String,
    database_bytes: u64,
    file_count: u64,
    last_scanned_at: Option<u64>,
    content_indexed: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopScanResult {
    name: String,
    root: String,
    files: Vec<RawMarkdownFile>,
    available_paths: Vec<String>,
    warnings: Vec<ScanWarning>,
    scanned_at: u64,
    index: IndexStatus,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveResult {
    hash: String,
    updated_at: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchHit {
    relative_path: String,
    title: String,
    snippet: String,
    rank: f64,
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn modified_millis(metadata: &fs::Metadata) -> u64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn normalized_hash(content: &str) -> String {
    let normalized = content.replace("\r\n", "\n");
    hex::encode(Sha256::digest(normalized.trim().as_bytes()))
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "md" | "markdown" | "mdown" | "mkdn"
            )
        })
        .unwrap_or(false)
}

fn should_visit(entry: &DirEntry) -> bool {
    if !entry.file_type().is_dir() {
        return true;
    }
    let name = entry.file_name().to_string_lossy();
    if entry.depth() == 0 {
        return true;
    }
    !name.starts_with('.') && !matches!(name.as_ref(), "node_modules" | "dist" | "build" | ".next")
}

fn relative_string(root: &Path, path: &Path) -> Result<String, String> {
    path.strip_prefix(root)
        .map(|relative| relative.to_string_lossy().replace('\\', "/"))
        .map_err(|_| format!("无法计算相对路径：{}", path.display()))
}

fn title_from(path: &Path, content: &str) -> String {
    content
        .lines()
        .find_map(|line| {
            line.strip_prefix("# ")
                .map(str::trim)
                .filter(|title| !title.is_empty())
        })
        .map(ToOwned::to_owned)
        .or_else(|| {
            path.file_stem()
                .map(|value| value.to_string_lossy().into_owned())
        })
        .unwrap_or_else(|| "未命名文档".to_string())
}

fn open_index(app: &AppHandle) -> Result<(Connection, PathBuf), String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法定位应用数据目录：{error}"))?;
    fs::create_dir_all(&data_dir).map_err(|error| format!("无法创建应用数据目录：{error}"))?;
    let database_path = data_dir.join(DATABASE_FILE);
    let connection =
        Connection::open(&database_path).map_err(|error| format!("无法打开本地索引：{error}"))?;
    connection
        .execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA foreign_keys=ON;
             CREATE TABLE IF NOT EXISTS workspaces (
               root TEXT PRIMARY KEY,
               name TEXT NOT NULL,
               scanned_at INTEGER NOT NULL,
               file_count INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS documents (
               workspace_root TEXT NOT NULL,
               relative_path TEXT NOT NULL,
               title TEXT NOT NULL,
               content_hash TEXT NOT NULL,
               modified_at INTEGER NOT NULL,
               byte_size INTEGER NOT NULL,
               PRIMARY KEY (workspace_root, relative_path),
               FOREIGN KEY (workspace_root) REFERENCES workspaces(root) ON DELETE CASCADE
             );
             CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
               workspace_root UNINDEXED,
               relative_path UNINDEXED,
               title,
               body,
               tokenize='unicode61'
             );",
        )
        .map_err(|error| format!("无法初始化本地索引：{error}"))?;
    Ok((connection, database_path))
}

fn status_for(app: &AppHandle, workspace_root: Option<&str>) -> Result<IndexStatus, String> {
    let (connection, database_path) = open_index(app)?;
    let (file_count, last_scanned_at) = if let Some(root) = workspace_root {
        connection
            .query_row(
                "SELECT file_count, scanned_at FROM workspaces WHERE root = ?1",
                params![root],
                |row| Ok((row.get::<_, u64>(0)?, Some(row.get::<_, u64>(1)?))),
            )
            .optional()
            .map_err(|error| format!("无法读取索引状态：{error}"))?
            .unwrap_or((0, None))
    } else {
        let count = connection
            .query_row("SELECT COUNT(*) FROM documents", [], |row| {
                row.get::<_, u64>(0)
            })
            .map_err(|error| format!("无法统计索引：{error}"))?;
        (count, None)
    };
    let database_bytes = fs::metadata(&database_path)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    Ok(IndexStatus {
        database_path: database_path.to_string_lossy().into_owned(),
        database_bytes,
        file_count,
        last_scanned_at,
        content_indexed: true,
    })
}

fn scan_impl(app: &AppHandle, requested_root: &str) -> Result<DesktopScanResult, String> {
    let root =
        fs::canonicalize(requested_root).map_err(|error| format!("无法打开资料库：{error}"))?;
    if !root.is_dir() {
        return Err("所选路径不是文件夹。".to_string());
    }
    let scanned_at = now_millis();
    let name = root
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| root.to_string_lossy().into_owned());
    let root_string = root.to_string_lossy().into_owned();
    let mut files = Vec::new();
    let mut available_paths = Vec::new();
    let mut warnings = Vec::new();

    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(should_visit)
    {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                warnings.push(ScanWarning {
                    path: root_string.clone(),
                    message: error.to_string(),
                });
                continue;
            }
        };
        if !entry.file_type().is_file() {
            continue;
        }
        let relative_path = relative_string(&root, entry.path())?;
        available_paths.push(relative_path.clone());
        if !is_markdown(entry.path()) {
            continue;
        }
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(error) => {
                warnings.push(ScanWarning {
                    path: relative_path,
                    message: format!("无法读取元数据：{error}"),
                });
                continue;
            }
        };
        if metadata.len() > MAX_MARKDOWN_BYTES {
            warnings.push(ScanWarning {
                path: relative_path,
                message: "文件超过 16 MB，为避免卡住界面已跳过。".to_string(),
            });
            continue;
        }
        let content = match fs::read_to_string(entry.path()) {
            Ok(content) => content,
            Err(error) => {
                warnings.push(ScanWarning {
                    path: relative_path,
                    message: format!("不是可读取的 UTF-8 文本：{error}"),
                });
                continue;
            }
        };
        files.push(RawMarkdownFile {
            hash: normalized_hash(&content),
            relative_path,
            content,
            updated_at: modified_millis(&metadata),
            size: metadata.len(),
        });
    }

    let (mut connection, _) = open_index(app)?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("无法开始索引事务：{error}"))?;
    transaction
        .execute(
            "DELETE FROM documents_fts WHERE workspace_root = ?1",
            params![root_string],
        )
        .and_then(|_| {
            transaction.execute(
                "DELETE FROM documents WHERE workspace_root = ?1",
                params![root_string],
            )
        })
        .and_then(|_| {
            transaction.execute(
                "DELETE FROM workspaces WHERE root = ?1",
                params![root_string],
            )
        })
        .map_err(|error| format!("无法刷新旧索引：{error}"))?;
    transaction
        .execute(
            "INSERT INTO workspaces(root, name, scanned_at, file_count) VALUES (?1, ?2, ?3, ?4)",
            params![root_string, name, scanned_at, files.len() as u64],
        )
        .map_err(|error| format!("无法登记资料库：{error}"))?;
    {
        let mut document_statement = transaction
            .prepare("INSERT INTO documents(workspace_root, relative_path, title, content_hash, modified_at, byte_size) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
            .map_err(|error| format!("无法准备索引：{error}"))?;
        let mut search_statement = transaction
            .prepare("INSERT INTO documents_fts(workspace_root, relative_path, title, body) VALUES (?1, ?2, ?3, ?4)")
            .map_err(|error| format!("无法准备全文索引：{error}"))?;
        for file in &files {
            let title = title_from(Path::new(&file.relative_path), &file.content);
            document_statement
                .execute(params![
                    root_string,
                    file.relative_path,
                    title,
                    file.hash,
                    file.updated_at,
                    file.size
                ])
                .and_then(|_| {
                    search_statement.execute(params![
                        root_string,
                        file.relative_path,
                        title,
                        file.content
                    ])
                })
                .map_err(|error| format!("索引 {} 失败：{error}", file.relative_path))?;
        }
    }
    transaction
        .commit()
        .map_err(|error| format!("无法提交索引事务：{error}"))?;
    let index = status_for(app, Some(&root_string))?;

    Ok(DesktopScanResult {
        name,
        root: root_string,
        files,
        available_paths,
        warnings,
        scanned_at,
        index,
    })
}

#[tauri::command]
async fn scan_workspace(app: AppHandle, root: String) -> Result<DesktopScanResult, String> {
    tauri::async_runtime::spawn_blocking(move || scan_impl(&app, &root))
        .await
        .map_err(|error| format!("扫描任务异常结束：{error}"))?
}

#[tauri::command]
fn get_index_status(app: AppHandle, root: Option<String>) -> Result<IndexStatus, String> {
    status_for(&app, root.as_deref())
}

#[tauri::command]
fn clear_workspace_index(app: AppHandle, root: String) -> Result<IndexStatus, String> {
    let (mut connection, _) = open_index(&app)?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("无法开始清理事务：{error}"))?;
    transaction
        .execute(
            "DELETE FROM documents_fts WHERE workspace_root = ?1",
            params![root],
        )
        .and_then(|_| transaction.execute("DELETE FROM workspaces WHERE root = ?1", params![root]))
        .map_err(|error| format!("无法清空索引：{error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("无法提交清理事务：{error}"))?;
    connection
        .execute_batch("VACUUM;")
        .map_err(|error| format!("无法压缩索引：{error}"))?;
    status_for(&app, Some(&root))
}

#[tauri::command]
fn search_index(
    app: AppHandle,
    root: String,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<SearchHit>, String> {
    let (connection, _) = open_index(&app)?;
    let mut statement = connection
        .prepare(
            "SELECT relative_path, title, snippet(documents_fts, 3, '<mark>', '</mark>', '…', 22), bm25(documents_fts)
             FROM documents_fts
             WHERE workspace_root = ?1 AND documents_fts MATCH ?2
             ORDER BY bm25(documents_fts)
             LIMIT ?3",
        )
        .map_err(|error| format!("无法准备搜索：{error}"))?;
    let rows = statement
        .query_map(params![root, query, limit.unwrap_or(50).min(200)], |row| {
            Ok(SearchHit {
                relative_path: row.get(0)?,
                title: row.get(1)?,
                snippet: row.get(2)?,
                rank: row.get(3)?,
            })
        })
        .map_err(|error| format!("无法搜索本地索引：{error}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("无法读取搜索结果：{error}"))
}

#[tauri::command]
fn save_markdown(
    app: AppHandle,
    root: String,
    relative_path: String,
    expected_hash: String,
    content: String,
) -> Result<SaveResult, String> {
    let canonical_root =
        fs::canonicalize(&root).map_err(|error| format!("无法定位资料库：{error}"))?;
    let requested_target = canonical_root.join(&relative_path);
    let canonical_target =
        fs::canonicalize(&requested_target).map_err(|error| format!("无法定位文件：{error}"))?;
    if !canonical_target.starts_with(&canonical_root) || !canonical_target.is_file() {
        return Err("目标文件不在当前资料库内，已拒绝写入。".to_string());
    }
    if !is_markdown(&canonical_target) {
        return Err("只允许写入 Markdown 文件。".to_string());
    }
    let current = fs::read_to_string(&canonical_target)
        .map_err(|error| format!("无法读取磁盘版本：{error}"))?;
    if normalized_hash(&current) != expected_hash {
        return Err("文件已被其他程序修改。为避免覆盖，PatchMark 已停止保存；请重新扫描后合并。原文件没有被修改。".to_string());
    }

    AtomicFile::new(&canonical_target, AllowOverwrite)
        .write(|file| file.write_all(content.as_bytes()))
        .map_err(|error| format!("原子写入失败：{error}"))?;

    let updated_at = now_millis();
    let hash = normalized_hash(&content);
    let title = title_from(&canonical_target, &content);
    let size = content.len() as u64;
    let (mut connection, _) = open_index(&app)?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("无法开始索引更新：{error}"))?;
    transaction
        .execute(
            "INSERT INTO documents(workspace_root, relative_path, title, content_hash, modified_at, byte_size)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(workspace_root, relative_path) DO UPDATE SET
               title=excluded.title, content_hash=excluded.content_hash,
               modified_at=excluded.modified_at, byte_size=excluded.byte_size",
            params![root, relative_path, title, hash, updated_at, size],
        )
        .and_then(|_| transaction.execute("DELETE FROM documents_fts WHERE workspace_root = ?1 AND relative_path = ?2", params![root, relative_path]))
        .and_then(|_| transaction.execute("INSERT INTO documents_fts(workspace_root, relative_path, title, body) VALUES (?1, ?2, ?3, ?4)", params![root, relative_path, title, content]))
        .map_err(|error| format!("文件已保存，但更新本地索引失败：{error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("文件已保存，但提交索引失败：{error}"))?;

    Ok(SaveResult { hash, updated_at })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_workspace,
            get_index_status,
            clear_workspace_index,
            search_index,
            save_markdown
        ])
        .run(tauri::generate_context!())
        .expect("failed to run PatchMark");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn content_hash_ignores_outer_space_and_line_endings() {
        assert_eq!(
            normalized_hash("  # A\r\n\r\nBody  "),
            normalized_hash("# A\n\nBody")
        );
    }

    #[test]
    fn title_uses_only_a_level_one_heading() {
        assert_eq!(
            title_from(Path::new("inbox/note.md"), "text\n## Next"),
            "note"
        );
        assert_eq!(
            title_from(Path::new("inbox/note.md"), "text\n# Canonical\n## Next"),
            "Canonical"
        );
    }

    #[test]
    fn bundled_sqlite_supports_local_fts5() {
        let temporary = tempfile::tempdir().expect("temporary directory");
        let database = temporary.path().join("index.sqlite3");
        let connection = Connection::open(database).expect("open bundled sqlite");
        connection
            .execute_batch(
                "CREATE VIRTUAL TABLE search_test USING fts5(path UNINDEXED, title, body, tokenize='unicode61');
                 INSERT INTO search_test(path, title, body) VALUES ('a.md', 'Local index', 'Markdown 资料治理');",
            )
            .expect("create FTS5 index");
        let count: u64 = connection
            .query_row(
                "SELECT COUNT(*) FROM search_test WHERE search_test MATCH 'Markdown'",
                [],
                |row| row.get(0),
            )
            .expect("query FTS5 index");
        assert_eq!(count, 1);
    }
}
