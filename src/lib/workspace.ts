import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  IndexStatus,
  MarkdownRecord,
  ScanProgress,
  ScanWarning,
  WorkspaceSnapshot,
} from "../types";
import { buildRecord, enrichWorkspaceIssues, isMarkdownFile, sha256 } from "./markdown";

const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".svn",
  ".hg",
  "node_modules",
  ".next",
  "dist",
  "build",
]);

interface DesktopRawFile {
  relativePath: string;
  content: string;
  updatedAt: number;
  size: number;
  hash: string;
}

interface DesktopScanResult {
  name: string;
  root: string;
  files: DesktopRawFile[];
  availablePaths: string[];
  warnings: ScanWarning[];
  scannedAt: number;
  index: IndexStatus;
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

async function buildDesktopSnapshot(
  result: DesktopScanResult,
  onProgress?: (progress: ScanProgress) => void,
): Promise<WorkspaceSnapshot> {
  const files: MarkdownRecord[] = [];
  for (const raw of result.files) {
    files.push(
      await buildRecord(
        raw.relativePath,
        raw.content,
        raw.updatedAt,
        "desktop",
        undefined,
        result.root,
      ),
    );
    onProgress?.({ scanned: files.length, currentPath: raw.relativePath });
  }
  return {
    name: result.name,
    files: enrichWorkspaceIssues(files, new Set(result.availablePaths)),
    source: "desktop",
    scannedAt: result.scannedAt,
    root: result.root,
    index: result.index,
    warnings: result.warnings,
  };
}

export async function scanDesktopWorkspace(
  root: string,
  onProgress?: (progress: ScanProgress) => void,
): Promise<WorkspaceSnapshot> {
  onProgress?.({ scanned: 0, currentPath: "正在读取目录并建立本地 SQLite 索引…" });
  const result = await invoke<DesktopScanResult>("scan_workspace", { root });
  return buildDesktopSnapshot(result, onProgress);
}

async function walkDirectory(
  directory: FileSystemDirectoryHandle,
  prefix: string,
  records: MarkdownRecord[],
  availablePaths: Set<string>,
  onProgress?: (progress: ScanProgress) => void,
): Promise<void> {
  const entries: Array<FileSystemFileHandle | FileSystemDirectoryHandle> = [];
  for await (const entry of directory.values()) entries.push(entry);
  entries.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.kind === "directory") continue;
    if (entry.kind === "directory") {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      await walkDirectory(entry, `${prefix}${entry.name}/`, records, availablePaths, onProgress);
      continue;
    }
    const relativePath = `${prefix}${entry.name}`;
    availablePaths.add(relativePath);
    if (!isMarkdownFile(entry.name)) continue;

    const file = await entry.getFile();
    const content = await file.text();
    records.push(await buildRecord(relativePath, content, file.lastModified, "local", entry));
    onProgress?.({ scanned: records.length, currentPath: relativePath });
  }
}

export async function openLocalWorkspace(
  onProgress?: (progress: ScanProgress) => void,
): Promise<WorkspaceSnapshot> {
  if (isTauriRuntime()) {
    const selected = await open({ directory: true, multiple: false, title: "选择 Markdown 资料库" });
    if (!selected) throw new DOMException("用户取消选择", "AbortError");
    return scanDesktopWorkspace(selected, onProgress);
  }
  if (!window.showDirectoryPicker) {
    throw new Error("当前浏览器不支持本地文件夹访问，请使用最新版 Chrome 或 Edge。\n也可以先体验示例资料库。");
  }
  const directory = await window.showDirectoryPicker({ mode: "readwrite" });
  const files: MarkdownRecord[] = [];
  const availablePaths = new Set<string>();
  await walkDirectory(directory, "", files, availablePaths, onProgress);
  return {
    name: directory.name,
    files: enrichWorkspaceIssues(files, availablePaths),
    source: "local",
    scannedAt: Date.now(),
  };
}

export async function saveRecord(record: MarkdownRecord, content: string): Promise<MarkdownRecord> {
  if (record.source === "desktop") {
    if (!record.workspaceRoot) throw new Error("资料库根目录已失效，请重新打开。原文件没有被修改。");
    await invoke("save_markdown", {
      root: record.workspaceRoot,
      relativePath: record.relativePath,
      expectedHash: record.hash,
      content,
    });
  } else if (record.source === "local") {
    if (!record.handle) throw new Error("文件句柄已失效，请重新打开资料库。\n原文件没有被修改。");
    const currentFile = await record.handle.getFile();
    const currentContent = await currentFile.text();
    const currentHash = await sha256(currentContent);
    if (currentHash !== record.hash) {
      throw new Error("文件已被其他程序修改。为避免覆盖，PatchMark 已停止保存，请重新扫描后合并。\n原文件没有被修改。");
    }
    const writable = await record.handle.createWritable();
    try {
      await writable.write(content);
      await writable.close();
    } catch (error) {
      await writable.abort();
      throw error;
    }
  }

  const saved = await buildRecord(
    record.relativePath,
    content,
    Date.now(),
    record.source,
    record.handle,
    record.workspaceRoot,
  );
  return { ...saved, originalContent: content };
}

export function supportsLocalWorkspace(): boolean {
  return isTauriRuntime() || typeof window.showDirectoryPicker === "function";
}

export function supportsDesktopIndex(): boolean {
  return isTauriRuntime();
}

export async function clearDesktopIndex(root: string): Promise<IndexStatus> {
  return invoke<IndexStatus>("clear_workspace_index", { root });
}
