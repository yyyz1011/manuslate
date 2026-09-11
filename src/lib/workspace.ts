import type { MarkdownRecord, ScanProgress, WorkspaceSnapshot } from "../types";
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
  if (record.source === "local") {
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
  );
  return { ...saved, originalContent: content };
}

export function supportsLocalWorkspace(): boolean {
  return typeof window.showDirectoryPicker === "function";
}
