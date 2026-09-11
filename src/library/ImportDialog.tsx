import { FileText, FolderOpen, FolderUp, Import, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface ImportCandidate {
  file: File;
  handle?: FileSystemFileHandle;
  relativePath?: string;
  categoryName?: string;
}

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (files: ImportCandidate[]) => Promise<void>;
}

interface DirectoryWithValues extends FileSystemDirectoryHandle {
  values: () => AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
}

interface LegacyEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
}

interface LegacyFileEntry extends LegacyEntry {
  file: (callback: (file: File) => void, error?: (reason: DOMException) => void) => void;
}

interface LegacyDirectoryEntry extends LegacyEntry {
  createReader: () => { readEntries: (callback: (entries: LegacyEntry[]) => void, error?: (reason: DOMException) => void) => void };
}

const markdownExtensions = /\.(md|markdown|mdown|txt)$/i;

function isMarkdown(file: File) {
  return markdownExtensions.test(file.name);
}

async function collectDirectory(
  directory: FileSystemDirectoryHandle,
  rootName = directory.name,
  prefix = "",
): Promise<ImportCandidate[]> {
  const files: ImportCandidate[] = [];
  for await (const entry of (directory as DirectoryWithValues).values()) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === "file") {
      const file = await entry.getFile();
      if (isMarkdown(file)) files.push({ file, handle: entry, relativePath: `${rootName}/${path}`, categoryName: rootName });
    } else {
      files.push(...await collectDirectory(entry, rootName, path));
    }
  }
  return files;
}

function readLegacyEntries(directory: LegacyDirectoryEntry): Promise<LegacyEntry[]> {
  const reader = directory.createReader();
  return new Promise((resolve, reject) => {
    const found: LegacyEntry[] = [];
    const read = () => reader.readEntries((entries) => {
      if (!entries.length) { resolve(found); return; }
      found.push(...entries); read();
    }, reject);
    read();
  });
}

function readLegacyFile(entry: LegacyFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function collectLegacyDirectory(
  directory: LegacyDirectoryEntry,
  rootName = directory.name,
  prefix = "",
): Promise<ImportCandidate[]> {
  const files: ImportCandidate[] = [];
  for (const entry of await readLegacyEntries(directory)) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isFile) {
      const file = await readLegacyFile(entry as LegacyFileEntry);
      if (isMarkdown(file)) files.push({ file, relativePath: `${rootName}/${path}`, categoryName: rootName });
    } else if (entry.isDirectory) {
      files.push(...await collectLegacyDirectory(entry as LegacyDirectoryEntry, rootName, path));
    }
  }
  return files;
}

export default function ImportDialog({ open, onClose, onImport }: ImportDialogProps) {
  const [queued, setQueued] = useState<ImportCandidate[]>([]);
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("支持 .md、.markdown、.mdown 和 .txt");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    setQueued([]); setDragging(false); setWorking(false); setMessage("支持 .md、.markdown、.mdown 和 .txt");
    folderInputRef.current?.setAttribute("webkitdirectory", "");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, working]);

  const appendFiles = (next: ImportCandidate[]) => {
    const markdown = next.filter(({ file }) => isMarkdown(file));
    setQueued((current) => {
      const byKey = new Map(current.map((item) => [item.relativePath || `${item.file.name}:${item.file.size}:${item.file.lastModified}`, item]));
      markdown.forEach((item) => byKey.set(item.relativePath || `${item.file.name}:${item.file.size}:${item.file.lastModified}`, item));
      return [...byKey.values()];
    });
    const skipped = next.length - markdown.length;
    setMessage(skipped ? `已忽略 ${skipped} 个非 Markdown 文件` : "可以继续添加，确认后一次导入");
  };

  const chooseFiles = async () => {
    if (window.showOpenFilePicker) {
      try {
        const handles = await window.showOpenFilePicker({ multiple: true, types: [{ description: "Markdown", accept: { "text/markdown": [".md", ".markdown", ".mdown"], "text/plain": [".txt"] } }] });
        appendFiles(await Promise.all(handles.map(async (handle) => ({ file: await handle.getFile(), handle }))));
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    fileInputRef.current?.click();
  };

  const chooseFolder = async () => {
    if (window.showDirectoryPicker) {
      try {
        const directory = await window.showDirectoryPicker({ mode: "readwrite" });
        setWorking(true);
        const files = await collectDirectory(directory);
        appendFiles(files);
        if (!files.length) setMessage("这个文件夹里没有可导入的 Markdown 文件");
        setWorking(false);
        return;
      } catch (error) {
        setWorking(false);
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    folderInputRef.current?.click();
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragging(false); setWorking(true);
    try {
      const collected: ImportCandidate[] = [];
      const items = Array.from(event.dataTransfer.items);
      for (const item of items) {
        const itemWithHandle = item as unknown as { getAsFileSystemHandle?: () => Promise<FileSystemFileHandle | FileSystemDirectoryHandle | null> };
        if (itemWithHandle.getAsFileSystemHandle) {
          const handle = await itemWithHandle.getAsFileSystemHandle();
          if (handle?.kind === "file") {
            const file = await handle.getFile(); if (isMarkdown(file)) collected.push({ file, handle });
          } else if (handle?.kind === "directory") collected.push(...await collectDirectory(handle));
          continue;
        }
        const entry = (item as unknown as { webkitGetAsEntry?: () => LegacyEntry | null }).webkitGetAsEntry?.();
        if (entry?.isFile) {
          const file = await readLegacyFile(entry as LegacyFileEntry); if (isMarkdown(file)) collected.push({ file });
        } else if (entry?.isDirectory) collected.push(...await collectLegacyDirectory(entry as LegacyDirectoryEntry));
      }
      if (!collected.length) appendFiles(Array.from(event.dataTransfer.files).map((file) => ({ file })));
      else appendFiles(collected);
    } catch {
      setMessage("有内容无法读取，请改用“选择文件夹”重试");
    } finally {
      setWorking(false);
    }
  };

  if (!open) return null;

  return (
    <div className="import-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !working) onClose(); }}>
      <section ref={dialogRef} className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <header className="import-header">
          <div className="import-title-mark"><Import size={20} /></div>
          <div><h2 id="import-title">导入 Markdown</h2><p>文件保留原格式，文件夹会自动成为一个分类。</p></div>
          <button autoFocus className="icon-button" type="button" onClick={onClose} disabled={working} aria-label="关闭导入"><X size={18} /></button>
        </header>

        <div className={`import-dropzone${dragging ? " is-dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={(event) => void handleDrop(event)}>
          <div className="drop-illustration" aria-hidden="true"><FolderOpen size={34} /><span><FileText size={18} /></span></div>
          <strong>{working ? "正在读取文件夹…" : dragging ? "松开即可加入" : "把文件或文件夹拖到这里"}</strong>
          <span>内容只在你的电脑上处理</span>
          <div className="import-pickers">
            <button type="button" onClick={() => void chooseFiles()} disabled={working}><UploadCloud size={17} />选择文件</button>
            <button type="button" onClick={() => void chooseFolder()} disabled={working}><FolderUp size={17} />选择文件夹</button>
          </div>
        </div>

        <input ref={fileInputRef} className="visually-hidden" type="file" tabIndex={-1} aria-hidden="true" multiple accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain" onChange={(event) => { appendFiles(Array.from(event.currentTarget.files ?? []).map((file) => ({ file }))); event.currentTarget.value = ""; }} />
        <input ref={folderInputRef} className="visually-hidden" type="file" tabIndex={-1} aria-hidden="true" multiple onChange={(event) => { appendFiles(Array.from(event.currentTarget.files ?? []).map((file) => { const relativePath = file.webkitRelativePath || file.name; return { file, relativePath, categoryName: relativePath.split("/")[0] }; })); event.currentTarget.value = ""; }} />

        <div className="import-queue" aria-live="polite">
          <div><span>{queued.length ? `已选择 ${queued.length} 个文稿` : "等待选择"}</span><small>{message}</small></div>
          {queued.length > 0 && <div className="queued-files">{queued.slice(0, 4).map((item) => <span key={item.relativePath || `${item.file.name}-${item.file.lastModified}`}><FileText size={14} /><span>{item.relativePath || item.file.name}</span></span>)}{queued.length > 4 && <small>还有 {queued.length - 4} 个文稿</small>}</div>}
        </div>

        <footer className="import-actions"><button type="button" onClick={onClose} disabled={working}>取消</button><button className="primary" type="button" disabled={!queued.length || working} onClick={async () => { setWorking(true); try { await onImport(queued); onClose(); } catch { setMessage("导入失败，请检查文件权限后重试"); } finally { setWorking(false); } }}><Import size={16} />导入{queued.length ? ` ${queued.length} 个文稿` : ""}</button></footer>
      </section>
    </div>
  );
}
