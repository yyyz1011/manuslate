import {
  Bold, BookOpen, Check, ChevronDown, ChevronRight, Code2, Columns2, Copy, Download, Eye,
  Archive, Clock3, FileCode2, FilePlus2, FileSearch, Focus, Heading1, Heading2, Image, Info, Italic, Link, Link2, List,
  Import, ListChecks, ListOrdered, Menu, MoreHorizontal, PanelLeftOpen, PanelRight, Pencil, Plus, Printer, Quote,
  Save, Search, Settings, Settings as Settings2, Share, Sparkles, SunMoon, Table2, TextCursorInput, Trash2, X,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import type { MarkdownEditorHandle } from "./editor/MarkdownEditor";
import ImportDialog, { type ImportCandidate } from "./library/ImportDialog";
import LibraryTree from "./library/LibraryTree";
import { ConfirmDialog, ConflictDialog, HistoryDialog, SettingsDialog, TemplateDialog, TrashDialog } from "./library/WorkspaceDialogs";
import { getOutline, getWordStats } from "./lib/document";
import { getBacklinks, getOutgoingLinks, resolveDocumentLink } from "./lib/links";
import {
  chooseNativeDirectory, chooseNativeMarkdownDirectory, chooseNativeMarkdownFiles, chooseNativeSavePath,
  isDesktopApp, pathName, readNativeSnapshot, uniqueNativeMarkdownPath, writeNativeImage, writeNativeMarkdown,
  type NativeMarkdownFile,
} from "./lib/native";
import {
  builtInTemplates, defaultEditorPreferences, loadActiveDocumentId, loadCategories, loadDocuments, loadEditorPreferences, loadTheme, loadTrash, loadVersions, loadViewMode, saveActiveDocumentId,
  saveCategories, saveDocuments, saveEditorPreferences, saveTheme, saveTrash, saveVersions, saveViewMode,
} from "./lib/storage";
import {
  ensureWritePermission, forgetDefaultDocumentDirectory, forgetFileHandle, permissionFor,
  recallDefaultDocumentDirectory, recallFileHandle, rememberDefaultDocumentDirectory, rememberFileHandle,
} from "./lib/workspace";
import type { DocumentTemplate, EditorPreferences, FileConflict, LibraryCategory, MarkdownDocument, ThemeMode, TrashEntry, VersionSnapshot, ViewMode } from "./types";

const MarkdownEditor = lazy(() => import("./editor/MarkdownEditor"));
const MarkdownPreview = lazy(() => import("./editor/MarkdownPreview"));
const desktopApp = isDesktopApp();
const NATIVE_DEFAULT_DIRECTORY_KEY = "patchmark.native.default-directory";
const NATIVE_ASSET_DIRECTORY_KEY = "patchmark.native.asset-directory";

const markdownFileTypes = [{
  description: "Markdown",
  accept: { "text/markdown": [".md", ".markdown", ".mdown"], "text/plain": [".txt"] },
}];

const viewOptions: Array<{ mode: ViewMode; label: string; detail: string; icon: typeof Pencil }> = [
  { mode: "live", label: "实时排版", detail: "边写边看到成稿", icon: TextCursorInput },
  { mode: "preview", label: "阅读", detail: "沉浸校对成稿", icon: BookOpen },
  { mode: "source", label: "Markdown 源码", detail: "显示全部标记", icon: FileCode2 },
  { mode: "split", label: "对照", detail: "源码与成稿并排", icon: Columns2 },
];

function uniqueId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `document-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function withoutExtension(name: string): string {
  return name.replace(/\.(md|markdown|mdown|txt)$/i, "");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character] ?? character);
}

function createUntitled(index: number): MarkdownDocument {
  const now = Date.now();
  return {
    id: uniqueId(), name: index === 1 ? "未命名.md" : `未命名 ${index}.md`, content: "",
    source: "draft", createdAt: now, updatedAt: now,
  };
}

function safeMarkdownName(name: string): string {
  const normalized = name.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ") || "未命名";
  return /\.(md|markdown|mdown|txt)$/i.test(normalized) ? normalized : `${normalized}.md`;
}

async function createUniqueFileHandle(directory: FileSystemDirectoryHandle, suggestedName: string): Promise<FileSystemFileHandle> {
  const fileName = safeMarkdownName(suggestedName);
  const extension = fileName.match(/\.[^.]+$/)?.[0] ?? ".md";
  const stem = fileName.slice(0, -extension.length);
  for (let index = 0; index < 1000; index += 1) {
    const candidate = index === 0 ? fileName : `${stem} ${index + 1}${extension}`;
    try {
      await directory.getFileHandle(candidate);
    } catch (error) {
      if (error instanceof DOMException && error.name !== "NotFoundError") throw error;
      return directory.getFileHandle(candidate, { create: true });
    }
  }
  return directory.getFileHandle(`${stem}-${Date.now()}${extension}`, { create: true });
}

function App() {
  const initialDocuments = useMemo(loadDocuments, []);
  const initialCategories = useMemo(loadCategories, []);
  const [documents, setDocuments] = useState<MarkdownDocument[]>(initialDocuments);
  const [categories, setCategories] = useState<LibraryCategory[]>(initialCategories);
  const [versions, setVersions] = useState<VersionSnapshot[]>(loadVersions);
  const [trash, setTrash] = useState<TrashEntry[]>(loadTrash);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState(() => {
    const stored = loadActiveDocumentId();
    return initialDocuments.some((item) => item.id === stored) ? stored! : initialDocuments[0].id;
  });
  const [viewMode, setViewModeState] = useState<ViewMode>(loadViewMode);
  const [theme, setThemeState] = useState<ThemeMode>(loadTheme);
  const [editorPreferences, setEditorPreferences] = useState<EditorPreferences>(loadEditorPreferences);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [isCompact, setIsCompact] = useState(() => window.innerWidth < 900);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 900);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"outline" | "links" | "info">("outline");
  const [focusMode, setFocusMode] = useState(false);
  const [documentSearch, setDocumentSearch] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState<"all" | "title" | "content" | "pinned">("all");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [draftState, setDraftState] = useState<"saving" | "saved">("saved");
  const [activeOutlineId, setActiveOutlineId] = useState<string | null>(null);
  const [fileConflict, setFileConflict] = useState<FileConflict | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: "category" | "document"; id: string } | null>(null);
  const [handleAccess, setHandleAccess] = useState<Record<string, "granted" | "prompt" | "denied" | "missing">>({});
  const [defaultDirectoryPath, setDefaultDirectoryPath] = useState<string | null>(() => desktopApp ? localStorage.getItem(NATIVE_DEFAULT_DIRECTORY_KEY) : null);
  const [defaultDirectoryName, setDefaultDirectoryName] = useState<string | null>(() => {
    const path = desktopApp ? localStorage.getItem(NATIVE_DEFAULT_DIRECTORY_KEY) : null;
    return path ? pathName(path) : null;
  });
  const [defaultDirectoryAccess, setDefaultDirectoryAccess] = useState<PermissionState | "missing">(() => desktopApp && localStorage.getItem(NATIVE_DEFAULT_DIRECTORY_KEY) ? "granted" : "missing");
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const paletteRef = useRef<HTMLElement>(null);
  const paletteReturnFocusRef = useRef<HTMLElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const handlesRef = useRef(new Map<string, FileSystemFileHandle>());
  const assetDirectoryRef = useRef<FileSystemDirectoryHandle | null>(null);
  const defaultDirectoryRef = useRef<FileSystemDirectoryHandle | null>(null);
  const savedSnapshotsRef = useRef(new Map(initialDocuments.map((item) => [item.id, item.content])));
  const autoVersionRef = useRef(new Map<string, { content: string; at: number }>());
  const documentsRef = useRef(documents);
  const activeIdRef = useRef(activeId);

  const activeDocument = documents.find((item) => item.id === activeId) ?? documents[0];
  const outline = useMemo(() => getOutline(activeDocument?.content ?? ""), [activeDocument?.content]);
  const stats = useMemo(() => getWordStats(activeDocument?.content ?? ""), [activeDocument?.content]);
  const outgoingLinks = useMemo(() => activeDocument ? getOutgoingLinks(activeDocument, documents) : [], [activeDocument, documents]);
  const backlinks = useMemo(() => activeDocument ? getBacklinks(activeDocument.id, documents) : [], [activeDocument, documents]);
  const dark = theme === "dark" || (theme === "system" && systemDark);
  const isDiskDirty = activeDocument
    ? (activeDocument.source === "local" ? (activeDocument.diskContent ?? savedSnapshotsRef.current.get(activeDocument.id)) !== activeDocument.content : savedSnapshotsRef.current.get(activeDocument.id) !== activeDocument.content)
    : false;
  const activeHandleName = activeDocument ? handlesRef.current.get(activeDocument.id)?.name : undefined;
  const activeDiskName = activeDocument?.nativePath ? pathName(activeDocument.nativePath) : activeHandleName;
  const hasDisplayName = Boolean(activeDiskName && activeDiskName !== activeDocument?.name);
  const activeHandleAccess = activeDocument?.source === "local" ? (activeDocument.nativePath ? "granted" : handleAccess[activeDocument.id]) : undefined;
  const activeView = viewOptions.find((item) => item.mode === viewMode) ?? viewOptions[0];
  const ActiveViewIcon = activeView.icon;

  const navigateToOutline = useCallback((item: (typeof outline)[number]) => {
    setActiveOutlineId(item.id);
    if (viewMode === "preview" || viewMode === "split") {
      document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      editorRef.current?.scrollToLine(item.line);
    }
  }, [viewMode]);

  const syncPreviewOutline = useCallback((event: React.UIEvent<HTMLElement>) => {
    const pane = event.currentTarget;
    const threshold = pane.getBoundingClientRect().top + 110;
    let current = outline[0]?.id ?? null;
    for (const item of outline) {
      const heading = pane.querySelector<HTMLElement>(`#${CSS.escape(item.id)}`);
      if (heading && heading.getBoundingClientRect().top <= threshold) current = item.id;
      else if (heading) break;
    }
    setActiveOutlineId(current);
  }, [outline]);

  const saveStateLabel = draftState === "saving"
    ? "正在存入恢复草稿…"
    : activeDocument?.source === "sample"
      ? "示例文稿 · 已存入恢复草稿"
      : activeDocument?.source === "local" && activeDiskName
        ? activeHandleAccess === "prompt"
          ? `${activeDiskName} · 保存时重新授权`
          : activeHandleAccess === "denied"
            ? `${activeDiskName} · 文件权限已关闭`
            : isDiskDirty
              ? `尚未写入 ${activeDiskName}`
              : hasDisplayName
                ? `已同步 ${activeDiskName} · 当前为显示名`
                : `已与 ${activeDiskName} 同步`
        : activeDocument?.source === "local"
          ? "恢复副本 · 保存时重新选择文件"
          : isDiskDirty
            ? "已自动恢复 · 尚未导出文件"
            : "已存入恢复草稿";

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? null : current), 2200);
  }, []);

  const dismissMenus = useCallback(() => {
    setViewMenuOpen(false); setShareMenuOpen(false); setInsertMenuOpen(false);
  }, []);

  const startWindowDrag = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!desktopApp || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, input, a, [role='button'], [contenteditable='true']")) return;
    event.preventDefault();
    void getCurrentWindow().startDragging();
  }, []);

  const navigateMenu = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = current;
    if (event.key === "ArrowDown") next = (current + 1 + items.length) % items.length;
    else if (event.key === "ArrowUp") next = (current - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "Escape") { event.preventDefault(); dismissMenus(); return; }
    else return;
    event.preventDefault(); items[next]?.focus();
  }, [dismissMenus]);

  const navigateInspectorTabs = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const tabs = ["outline", "links", "info"] as const;
    const current = tabs.indexOf(inspectorTab);
    const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs.at(-1)! : tabs[(current + (event.key === "ArrowLeft" ? -1 : 1) + tabs.length) % tabs.length];
    setInspectorTab(next);
    window.setTimeout(() => document.getElementById(`${next}-tab`)?.focus(), 0);
  }, [inspectorTab]);

  const openPalette = useCallback(() => {
    paletteReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dismissMenus(); setPaletteSearch(""); setPaletteIndex(0); setPaletteOpen(true);
  }, [dismissMenus]);

  const setViewMode = useCallback((mode: ViewMode) => {
    const effectiveMode = mode === "split" && isCompact ? "preview" : mode;
    if (mode === "split" && isCompact) notify("对照视图适合宽屏，已切换到阅读");
    setViewModeState(effectiveMode); saveViewMode(effectiveMode);
    if (effectiveMode === "preview") setFocusMode(false);
    dismissMenus();
  }, [dismissMenus, isCompact, notify]);

  const updateActiveContent = useCallback((content: string) => {
    if (activeDocument && activeDocument.content.trim() && activeDocument.content !== content) {
      const previous = autoVersionRef.current.get(activeDocument.id);
      const now = Date.now();
      if (!previous || now - previous.at > 30_000) {
        const snapshot: VersionSnapshot = { id: uniqueId(), documentId: activeDocument.id, name: "自动版本", content: activeDocument.content, createdAt: now, kind: "auto" };
        setVersions((current) => [snapshot, ...current.filter((item) => item.documentId !== activeDocument.id || item.content !== snapshot.content)].filter((item, index, all) => all.slice(0, index).filter((other) => other.documentId === item.documentId).length < 30));
        autoVersionRef.current.set(activeDocument.id, { content: activeDocument.content, at: now });
      }
    }
    setDraftState("saving");
    setDocuments((current) => current.map((item) => item.id === activeId ? {
      ...item, content, source: item.source === "sample" ? "draft" : item.source, updatedAt: Date.now(),
    } : item));
  }, [activeDocument, activeId]);

  const selectDocument = useCallback((id: string) => {
    setActiveId(id); saveActiveDocumentId(id); dismissMenus();
    if (window.innerWidth < 900) setSidebarOpen(false);
  }, [dismissMenus]);

  const createDocument = useCallback((template?: DocumentTemplate) => {
    const count = documents.filter((item) => item.name.startsWith("未命名")).length + 1;
    const item = createUntitled(count);
    if (template) {
      item.name = template.id === "blank" ? item.name : `${template.name}.md`;
      item.content = template.content;
    }
    savedSnapshotsRef.current.set(item.id, item.content);
    setDocuments((current) => [item, ...current]); setActiveId(item.id); saveActiveDocumentId(item.id);
    setViewMode("live"); setSidebarOpen(window.innerWidth >= 900);
    window.setTimeout(() => editorRef.current?.focus(), 0);
    setTemplateOpen(false);
  }, [documents, setViewMode]);

  const saveNamedVersion = useCallback(() => {
    if (!activeDocument) return;
    const suggested = `版本 ${new Date().toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    const name = window.prompt("版本名称", suggested)?.trim();
    if (!name) return;
    const snapshot: VersionSnapshot = { id: uniqueId(), documentId: activeDocument.id, name, content: activeDocument.content, createdAt: Date.now(), kind: "named" };
    setVersions((current) => [snapshot, ...current]); notify("已保存当前版本");
  }, [activeDocument, notify]);

  const restoreVersion = useCallback((version: VersionSnapshot) => {
    if (!window.confirm(`恢复“${version.name}”？当前内容会先保存为自动版本。`)) return;
    if (activeDocument) setVersions((current) => [{ id: uniqueId(), documentId: activeDocument.id, name: "恢复前", content: activeDocument.content, createdAt: Date.now(), kind: "auto" }, ...current]);
    updateActiveContent(version.content); setHistoryOpen(false); notify("版本已恢复");
  }, [activeDocument, notify, updateActiveContent]);

  const handleImageFile = useCallback(async (file: File): Promise<string | null> => {
    try {
      if (desktopApp) {
        let directoryPath = localStorage.getItem(NATIVE_ASSET_DIRECTORY_KEY);
        if (!directoryPath) {
          notify("请选择文稿旁边的资源目录（例如 assets）");
          directoryPath = await chooseNativeDirectory("选择图片资源文件夹");
          if (!directoryPath) return null;
          localStorage.setItem(NATIVE_ASSET_DIRECTORY_KEY, directoryPath);
        }
        const extension = file.name.match(/\.[a-z0-9]+$/i)?.[0] || ".png";
        const stem = file.name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-|-$/g, "") || "image";
        const fileName = `${stem}-${Date.now()}${extension.toLocaleLowerCase()}`;
        const target = await writeNativeImage(directoryPath, fileName, new Uint8Array(await file.arrayBuffer()));
        const markdownPath = `${pathName(directoryPath)}/${pathName(target)}`;
        setAssetUrls((current) => ({ ...current, [markdownPath]: URL.createObjectURL(file) }));
        notify(`图片已存入 ${pathName(directoryPath)}`);
        return markdownPath;
      }
      let directory = assetDirectoryRef.current;
      if (!directory) {
        if (!window.showDirectoryPicker) { notify("当前浏览器不支持本地资源目录"); return null; }
        notify("请选择文稿旁边的资源目录（例如 assets）");
        directory = await window.showDirectoryPicker({ mode: "readwrite" });
        assetDirectoryRef.current = directory;
      }
      const extension = file.name.match(/\.[a-z0-9]+$/i)?.[0] || ".png";
      const stem = file.name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-|-$/g, "") || "image";
      const fileName = `${stem}-${Date.now()}${extension.toLocaleLowerCase()}`;
      const handle = await directory.getFileHandle(fileName, { create: true });
      const writable = await handle.createWritable(); await writable.write(file); await writable.close();
      const path = `${directory.name}/${fileName}`;
      setAssetUrls((current) => ({ ...current, [path]: URL.createObjectURL(file) }));
      notify(`图片已存入 ${directory.name}`);
      return path;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return null;
      notify("图片写入失败，请重新选择资源目录"); assetDirectoryRef.current = null; return null;
    }
  }, [notify]);

  const navigateDocumentLink = useCallback((href: string) => {
    if (href.startsWith("#")) { document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" }); return true; }
    const resolved = resolveDocumentLink(href, documents, activeDocument);
    if (resolved.ambiguous) {
      notify(`链接目标不唯一：${resolved.candidates?.slice(0, 2).join("、")}`);
      return true;
    }
    if (!resolved.documentId) return false;
    selectDocument(resolved.documentId);
    if (resolved.anchor) window.setTimeout(() => document.getElementById(resolved.anchor!)?.scrollIntoView({ behavior: "smooth" }), 80);
    return true;
  }, [activeDocument, documents, notify, selectDocument]);

  const importFiles = useCallback(async (files: ImportCandidate[]) => {
    if (!files.length) return;
    const categoryIds = new Map(categories.map((item) => [item.name.toLocaleLowerCase(), item.id]));
    const additions: LibraryCategory[] = [];
    files.forEach((item) => {
      const name = item.categoryName?.trim();
      if (!name || categoryIds.has(name.toLocaleLowerCase())) return;
      const category: LibraryCategory = { id: uniqueId(), name, createdAt: Date.now() };
      categoryIds.set(name.toLocaleLowerCase(), category.id); additions.push(category);
    });
    if (additions.length) setCategories((current) => [...current, ...additions]);

    const opened = await Promise.all(files.map(async ({ file, handle, nativePath, relativePath, categoryName }) => {
      const content = await file.text();
      const item: MarkdownDocument = {
        id: uniqueId(), name: file.name, content, source: "local", path: relativePath ?? nativePath, nativePath,
        diskModifiedAt: file.lastModified, diskContent: content,
        categoryId: categoryName ? categoryIds.get(categoryName.toLocaleLowerCase()) : undefined,
        createdAt: file.lastModified || Date.now(), updatedAt: file.lastModified || Date.now(),
      };
      if (handle) {
        handlesRef.current.set(item.id, handle);
        setHandleAccess((current) => ({ ...current, [item.id]: "granted" }));
        try { await rememberFileHandle(item.id, handle); } catch { /* recovery copy remains available */ }
      } else if (nativePath) {
        setHandleAccess((current) => ({ ...current, [item.id]: "granted" }));
      }
      savedSnapshotsRef.current.set(item.id, content);
      return item;
    }));
    setDocuments((current) => {
      const keys = new Set(opened.map((item) => item.path || item.name));
      return [...opened, ...current.filter((item) => !keys.has(item.path || item.name))];
    });
    setActiveId(opened[0].id); saveActiveDocumentId(opened[0].id); setViewMode("live");
    notify(opened.length === 1 ? `已导入 ${opened[0].name}` : `已导入 ${opened.length} 个文稿`);
  }, [categories, notify, setViewMode]);

  const nativeFilesToCandidates = useCallback((files: NativeMarkdownFile[]): ImportCandidate[] => files.map((item) => ({
    file: new File([item.content], item.name, { type: "text/markdown", lastModified: item.modifiedAt }),
    nativePath: item.path,
    relativePath: item.relativePath,
    categoryName: item.categoryName,
  })), []);

  const chooseDesktopFiles = useCallback(async () => nativeFilesToCandidates(await chooseNativeMarkdownFiles()), [nativeFilesToCandidates]);
  const chooseDesktopFolder = useCallback(async () => nativeFilesToCandidates(await chooseNativeMarkdownDirectory()), [nativeFilesToCandidates]);

  const createCategory = useCallback((name: string, parentId?: string) => {
    if (categories.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { notify("已经有同名分类"); return; }
    const id = uniqueId();
    setCategories((current) => [...current, { id, name, createdAt: Date.now(), parentId }]);
    return id;
  }, [categories, notify]);

  const renameCategory = useCallback((id: string, name: string) => {
    if (categories.some((item) => item.id !== id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { notify("已经有同名分类"); return; }
    setCategories((current) => current.map((item) => item.id === id ? { ...item, name } : item));
  }, [categories, notify]);

  const deleteCategory = useCallback((id: string) => {
    setPendingDelete({ kind: "category", id });
  }, []);

  const moveDocument = useCallback((documentId: string, categoryId?: string) => {
    setDocuments((current) => current.map((item) => item.id === documentId ? { ...item, categoryId } : item));
  }, []);

  const togglePinned = useCallback((documentId: string) => {
    setDocuments((current) => current.map((item) => item.id === documentId ? { ...item, pinned: !item.pinned, updatedAt: Date.now() } : item));
  }, []);

  const deleteDocument = useCallback((documentId: string) => {
    setPendingDelete({ kind: "document", id: documentId });
  }, []);

  const confirmPendingDelete = useCallback(() => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "category") {
      const descendants = new Set<string>([pendingDelete.id]);
      let changed = true;
      while (changed) { changed = false; categories.forEach((item) => { if (item.parentId && descendants.has(item.parentId) && !descendants.has(item.id)) { descendants.add(item.id); changed = true; } }); }
      setCategories((current) => current.filter((item) => !descendants.has(item.id)));
      setDocuments((current) => current.map((item) => item.categoryId && descendants.has(item.categoryId) ? { ...item, categoryId: undefined } : item));
      notify("分类已删除，文稿已移到未分类");
    } else {
      const target = documents.find((item) => item.id === pendingDelete.id);
      if (target) {
        const remaining = documents.filter((item) => item.id !== target.id);
        let nextDocuments = remaining;
        if (!remaining.length) {
          const replacement = createUntitled(1);
          savedSnapshotsRef.current.set(replacement.id, replacement.content);
          nextDocuments = [replacement];
        }
        setTrash((current) => [{ document: target, deletedAt: Date.now() }, ...current.filter((entry) => entry.document.id !== target.id)]);
        setDocuments(nextDocuments);
        if (activeId === target.id) {
          setActiveId(nextDocuments[0].id);
          saveActiveDocumentId(nextDocuments[0].id);
        }
        notify(target.source === "local" ? "已移到最近删除，本地文件仍在电脑上" : "已移到最近删除");
      }
    }
    setPendingDelete(null);
  }, [activeId, categories, documents, notify, pendingDelete]);

  const restoreTrashEntry = useCallback((entry: TrashEntry) => {
    setDocuments((current) => [entry.document, ...current.filter((item) => item.id !== entry.document.id)]);
    setTrash((current) => current.filter((item) => item.document.id !== entry.document.id));
    setActiveId(entry.document.id); saveActiveDocumentId(entry.document.id); notify("文稿已恢复");
  }, [notify]);

  const deleteTrashEntry = useCallback((entry: TrashEntry) => {
    if (!window.confirm(`永久删除“${withoutExtension(entry.document.name)}”的恢复记录？此操作不可撤销。`)) return;
    setTrash((current) => current.filter((item) => item.document.id !== entry.document.id));
    handlesRef.current.delete(entry.document.id);
    savedSnapshotsRef.current.delete(entry.document.id);
    void forgetFileHandle(entry.document.id).catch(() => undefined);
  }, []);

  const writeDocumentToHandle = useCallback(async (documentToWrite: MarkdownDocument, handle: FileSystemFileHandle, keepDisplayName: boolean) => {
    const writable = await handle.createWritable();
    await writable.write(documentToWrite.content);
    await writable.close();
    const writtenFile = await handle.getFile();
    savedSnapshotsRef.current.set(documentToWrite.id, documentToWrite.content);
    handlesRef.current.set(documentToWrite.id, handle);
    setHandleAccess((current) => ({ ...current, [documentToWrite.id]: "granted" }));
    setDocuments((current) => current.map((item) => item.id === documentToWrite.id ? {
      ...item,
      name: keepDisplayName ? item.name : handle.name,
      source: "local",
      diskContent: documentToWrite.content,
      diskModifiedAt: writtenFile.lastModified,
    } : item));
    try { await rememberFileHandle(documentToWrite.id, handle); } catch { /* writing still succeeded */ }
    notify(`已安全写入 ${handle.name}`);
  }, [notify]);

  const writeDocumentToNativePath = useCallback(async (documentToWrite: MarkdownDocument, nativePath: string, keepDisplayName: boolean) => {
    const written = await writeNativeMarkdown(nativePath, documentToWrite.content);
    savedSnapshotsRef.current.set(documentToWrite.id, documentToWrite.content);
    setHandleAccess((current) => ({ ...current, [documentToWrite.id]: "granted" }));
    setDocuments((current) => current.map((item) => item.id === documentToWrite.id ? {
      ...item,
      name: keepDisplayName ? item.name : written.name,
      source: "local",
      path: written.path,
      nativePath: written.path,
      diskContent: documentToWrite.content,
      diskModifiedAt: written.modifiedAt,
    } : item));
    notify(`已安全写入 ${written.name}`);
  }, [notify]);

  const chooseDefaultDocumentDirectory = useCallback(async () => {
    if (desktopApp) {
      try {
        const directory = await chooseNativeDirectory("选择新文稿文件夹");
        if (!directory) return;
        localStorage.setItem(NATIVE_DEFAULT_DIRECTORY_KEY, directory);
        setDefaultDirectoryPath(directory);
        setDefaultDirectoryName(pathName(directory));
        setDefaultDirectoryAccess("granted");
        notify(`新文稿将保存到 ${pathName(directory)}`);
      } catch { notify("文件夹设置失败，请重试"); }
      return;
    }
    if (!window.showDirectoryPicker) { notify("当前浏览器不支持自定义文件夹"); return; }
    try {
      const directory = await window.showDirectoryPicker({ mode: "readwrite" });
      defaultDirectoryRef.current = directory;
      setDefaultDirectoryName(directory.name);
      setDefaultDirectoryAccess(await permissionFor(directory));
      await rememberDefaultDocumentDirectory(directory);
      notify(`新文稿将保存到 ${directory.name}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify("文件夹设置失败，请重试");
    }
  }, [notify]);

  const clearDefaultDocumentDirectory = useCallback(() => {
    localStorage.removeItem(NATIVE_DEFAULT_DIRECTORY_KEY);
    defaultDirectoryRef.current = null;
    setDefaultDirectoryPath(null);
    setDefaultDirectoryName(null);
    setDefaultDirectoryAccess("missing");
    void forgetDefaultDocumentDirectory().catch(() => undefined);
    notify("已改为首次保存时选择位置");
  }, [notify]);

  const saveActive = useCallback(async () => {
    if (!activeDocument) return;
    try {
      if (desktopApp) {
        let nativePath = activeDocument.nativePath;
        const hadNativePath = Boolean(nativePath);
        if (!nativePath && defaultDirectoryPath) nativePath = await uniqueNativeMarkdownPath(defaultDirectoryPath, activeDocument.name);
        if (!nativePath) nativePath = await chooseNativeSavePath(activeDocument.name.endsWith(".md") ? activeDocument.name : `${activeDocument.name}.md`) ?? undefined;
        if (!nativePath) return;
        if (hadNativePath && activeDocument.source === "local") {
          const disk = await readNativeSnapshot(nativePath);
          const baseline = activeDocument.diskContent ?? savedSnapshotsRef.current.get(activeDocument.id) ?? activeDocument.content;
          if (disk.content !== baseline && disk.content !== activeDocument.content) {
            setFileConflict({ documentId: activeDocument.id, diskContent: disk.content, diskModifiedAt: disk.modifiedAt });
            return;
          }
        }
        await writeDocumentToNativePath(activeDocument, nativePath, hadNativePath);
        return;
      }
      let handle = handlesRef.current.get(activeDocument.id);
      if (!handle) {
        handle = await recallFileHandle(activeDocument.id);
        if (handle) handlesRef.current.set(activeDocument.id, handle);
      }
      const hadHandle = Boolean(handle);
      if (!handle && defaultDirectoryRef.current) {
        const directory = defaultDirectoryRef.current;
        if (await ensureWritePermission(directory)) {
          setDefaultDirectoryAccess("granted");
          handle = await createUniqueFileHandle(directory, activeDocument.name);
          handlesRef.current.set(activeDocument.id, handle);
        } else {
          setDefaultDirectoryAccess("denied");
          notify("默认文件夹不可写，将为这篇文稿选择位置");
        }
      }
      if (!handle && window.showSaveFilePicker) {
        handle = await window.showSaveFilePicker({
          suggestedName: activeDocument.name.endsWith(".md") ? activeDocument.name : `${activeDocument.name}.md`,
          types: markdownFileTypes,
        });
        handlesRef.current.set(activeDocument.id, handle);
      }
      if (handle) {
        if (!await ensureWritePermission(handle)) {
          setHandleAccess((current) => ({ ...current, [activeDocument.id]: "denied" }));
          notify("没有文件写入权限，请重新选择文件");
          return;
        }
        if (hadHandle && activeDocument.source === "local") {
          const diskFile = await handle.getFile();
          const diskContent = await diskFile.text();
          const baseline = activeDocument.diskContent ?? savedSnapshotsRef.current.get(activeDocument.id) ?? activeDocument.content;
          if (diskContent !== baseline && diskContent !== activeDocument.content) {
            setFileConflict({ documentId: activeDocument.id, diskContent, diskModifiedAt: diskFile.lastModified });
            return;
          }
        }
        await writeDocumentToHandle(activeDocument, handle, hadHandle);
      } else {
        const url = URL.createObjectURL(new Blob([activeDocument.content], { type: "text/markdown;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url;
        link.download = activeDocument.name.endsWith(".md") ? activeDocument.name : `${activeDocument.name}.md`;
        link.click(); URL.revokeObjectURL(url);
        savedSnapshotsRef.current.set(activeDocument.id, activeDocument.content);
        notify("Markdown 已下载；浏览器无法保持文件连接");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify("保存失败，请重试");
    }
  }, [activeDocument, defaultDirectoryPath, notify, writeDocumentToHandle, writeDocumentToNativePath]);

  const useDiskConflict = useCallback(() => {
    if (!fileConflict) return;
    savedSnapshotsRef.current.set(fileConflict.documentId, fileConflict.diskContent);
    setDocuments((current) => current.map((item) => item.id === fileConflict.documentId ? {
      ...item,
      content: fileConflict.diskContent,
      diskContent: fileConflict.diskContent,
      diskModifiedAt: fileConflict.diskModifiedAt,
      updatedAt: Date.now(),
    } : item));
    setFileConflict(null);
    notify("已载入磁盘上的最新版本");
  }, [fileConflict, notify]);

  const overwriteDiskConflict = useCallback(async () => {
    if (!fileConflict) return;
    const documentToWrite = documents.find((item) => item.id === fileConflict.documentId);
    if (desktopApp && documentToWrite?.nativePath) {
      try {
        await writeDocumentToNativePath(documentToWrite, documentToWrite.nativePath, true);
        setFileConflict(null);
      } catch { notify("覆盖失败，磁盘文件没有改变"); }
      return;
    }
    const handle = handlesRef.current.get(fileConflict.documentId);
    if (!documentToWrite || !handle) { setFileConflict(null); notify("文件连接已丢失，请重新保存"); return; }
    try {
      if (!await ensureWritePermission(handle)) { notify("没有文件写入权限"); return; }
      await writeDocumentToHandle(documentToWrite, handle, true);
      setFileConflict(null);
    } catch { notify("覆盖失败，磁盘文件没有改变"); }
  }, [documents, fileConflict, notify, writeDocumentToHandle, writeDocumentToNativePath]);

  const renameActive = useCallback(() => {
    const next = renameValue.trim();
    if (!next || !activeDocument) { setRenaming(false); return; }
    const suffix = /\.(md|markdown|mdown|txt)$/i.test(next) ? "" : ".md";
    setDocuments((current) => current.map((item) => item.id === activeDocument.id ? { ...item, name: `${next}${suffix}`, updatedAt: Date.now() } : item));
    setRenaming(false);
  }, [activeDocument, renameValue]);

  const exportHtml = useCallback(async () => {
    if (!activeDocument) return;
    const { renderMarkdown } = await import("./lib/markdown");
    const rendered = renderMarkdown(activeDocument.content);
    const title = withoutExtension(activeDocument.name);
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>body{max-width:760px;margin:64px auto;padding:0 28px;color:#1d1d1f;font:17px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}h1,h2,h3{line-height:1.25;letter-spacing:-.025em}pre{overflow:auto;padding:18px;background:#f5f5f7;border-radius:12px}code{font-family:ui-monospace,Menlo,monospace}img{max-width:100%}table{border-collapse:collapse;width:100%}th,td{padding:8px;border-bottom:1px solid #d2d2d7;text-align:left}blockquote{margin-left:0;padding-left:18px;border-left:1px solid #d2d2d7;color:#636366}.katex-html{display:none}.katex-mathml{display:inline}.katex-display{display:block;margin:1em 0;text-align:center}.katex-display .katex-mathml{display:block}math{font-family:STIX Two Math,Cambria Math,serif}</style></head><body>${rendered}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${title}.html`; link.click();
    URL.revokeObjectURL(url); dismissMenus(); notify("HTML 已导出");
  }, [activeDocument, dismissMenus, notify]);

  const copyRich = useCallback(async () => {
    if (!activeDocument) return;
    try {
      const { renderMarkdown } = await import("./lib/markdown");
      const rendered = renderMarkdown(activeDocument.content);
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({
          "text/html": new Blob([rendered], { type: "text/html" }),
          "text/plain": new Blob([activeDocument.content], { type: "text/plain" }),
        })]);
      } else await navigator.clipboard.writeText(activeDocument.content);
      notify("已复制富文本与 Markdown");
    } catch { notify("复制失败，请检查浏览器权限"); }
    dismissMenus();
  }, [activeDocument, dismissMenus, notify]);

  const printDocument = useCallback(() => {
    setViewMode("preview"); window.setTimeout(() => window.print(), 80); dismissMenus();
  }, [dismissMenus, setViewMode]);

  const cycleTheme = useCallback(() => {
    const next: ThemeMode = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setThemeState(next); saveTheme(next);
    notify(next === "system" ? "外观跟随系统" : next === "light" ? "已切换浅色外观" : "已切换深色外观");
  }, [notify, theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    saveTheme(next);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", listener); return () => media.removeEventListener("change", listener);
  }, []);
  useEffect(() => {
    const onResize = () => setIsCompact(window.innerWidth < 900);
    window.addEventListener("resize", onResize); return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => { if (isCompact && viewMode === "split") setViewMode("preview"); }, [isCompact, setViewMode, viewMode]);
  useEffect(() => { documentsRef.current = documents; }, [documents]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => {
    let cancelled = false;
    void Promise.all(initialDocuments.filter((item) => item.source === "local" && !item.nativePath).map(async (item) => {
      try {
        const handle = await recallFileHandle(item.id);
        if (!handle || cancelled) {
          if (!cancelled) setHandleAccess((current) => ({ ...current, [item.id]: "missing" }));
          return;
        }
        handlesRef.current.set(item.id, handle);
        const permission = await permissionFor(handle);
        if (!cancelled) setHandleAccess((current) => ({ ...current, [item.id]: permission }));
      } catch {
        if (!cancelled) setHandleAccess((current) => ({ ...current, [item.id]: "missing" }));
      }
    }));
    return () => { cancelled = true; };
  }, [initialDocuments]);
  useEffect(() => {
    if (desktopApp) return;
    let cancelled = false;
    void recallDefaultDocumentDirectory().then(async (directory) => {
      if (!directory || cancelled) return;
      defaultDirectoryRef.current = directory;
      setDefaultDirectoryName(directory.name);
      setDefaultDirectoryAccess(await permissionFor(directory));
    }).catch(() => {
      if (!cancelled) setDefaultDirectoryAccess("missing");
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    let checking = false;
    const checkActiveFile = async () => {
      if (checking) return;
      const documentToCheck = documentsRef.current.find((item) => item.id === activeIdRef.current);
      if (!documentToCheck || documentToCheck.source !== "local") return;
      checking = true;
      try {
        if (desktopApp && documentToCheck.nativePath) {
          const disk = await readNativeSnapshot(documentToCheck.nativePath);
          setHandleAccess((current) => ({ ...current, [documentToCheck.id]: "granted" }));
          if (documentToCheck.diskModifiedAt === disk.modifiedAt) return;
          const baseline = documentToCheck.diskContent ?? savedSnapshotsRef.current.get(documentToCheck.id) ?? documentToCheck.content;
          if (disk.content === baseline) {
            setDocuments((current) => current.map((item) => item.id === documentToCheck.id ? { ...item, diskModifiedAt: disk.modifiedAt, diskContent: disk.content } : item));
          } else if (documentToCheck.content === baseline) {
            savedSnapshotsRef.current.set(documentToCheck.id, disk.content);
            setDocuments((current) => current.map((item) => item.id === documentToCheck.id ? { ...item, content: disk.content, diskContent: disk.content, diskModifiedAt: disk.modifiedAt, updatedAt: Date.now() } : item));
            notify(`${pathName(documentToCheck.nativePath)} 已从磁盘更新`);
          } else {
            setFileConflict((current) => current ?? { documentId: documentToCheck.id, diskContent: disk.content, diskModifiedAt: disk.modifiedAt });
          }
          return;
        }
        let handle = handlesRef.current.get(documentToCheck.id);
        if (!handle) {
          handle = await recallFileHandle(documentToCheck.id);
          if (handle) handlesRef.current.set(documentToCheck.id, handle);
        }
        if (!handle) { setHandleAccess((current) => ({ ...current, [documentToCheck.id]: "missing" })); return; }
        const permission = await permissionFor(handle);
        setHandleAccess((current) => ({ ...current, [documentToCheck.id]: permission }));
        if (permission !== "granted") return;
        const diskFile = await handle.getFile();
        if (documentToCheck.diskModifiedAt === diskFile.lastModified) return;
        const diskContent = await diskFile.text();
        const baseline = documentToCheck.diskContent ?? savedSnapshotsRef.current.get(documentToCheck.id) ?? documentToCheck.content;
        if (diskContent === baseline) {
          setDocuments((current) => current.map((item) => item.id === documentToCheck.id ? { ...item, diskModifiedAt: diskFile.lastModified, diskContent } : item));
        } else if (documentToCheck.content === baseline) {
          savedSnapshotsRef.current.set(documentToCheck.id, diskContent);
          setDocuments((current) => current.map((item) => item.id === documentToCheck.id ? { ...item, content: diskContent, diskContent, diskModifiedAt: diskFile.lastModified, updatedAt: Date.now() } : item));
          notify(`${handle.name} 已从磁盘更新`);
        } else {
          setFileConflict((current) => current ?? { documentId: documentToCheck.id, diskContent, diskModifiedAt: diskFile.lastModified });
        }
      } catch {
        setHandleAccess((current) => ({ ...current, [documentToCheck.id]: "missing" }));
      } finally { checking = false; }
    };
    const interval = window.setInterval(() => void checkActiveFile(), 4_000);
    const onFocus = () => void checkActiveFile();
    window.addEventListener("focus", onFocus);
    void checkActiveFile();
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [notify]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    const timeout = window.setTimeout(() => { saveDocuments(documents); setDraftState("saved"); }, 380);
    return () => window.clearTimeout(timeout);
  }, [documents]);
  useEffect(() => { saveCategories(categories); }, [categories]);
  useEffect(() => { saveVersions(versions); }, [versions]);
  useEffect(() => { saveTrash(trash); }, [trash]);
  useEffect(() => { saveEditorPreferences(editorPreferences); }, [editorPreferences]);
  useEffect(() => {
    const retainedIds = new Set([...documents.map((item) => item.id), ...trash.map((entry) => entry.document.id)]);
    setVersions((current) => {
      const next = current.filter((item) => retainedIds.has(item.documentId));
      return next.length === current.length ? current : next;
    });
  }, [documents, trash]);
  useEffect(() => {
    setActiveOutlineId((current) => outline.some((item) => item.id === current) ? current : outline[0]?.id ?? null);
  }, [activeDocument.id, outline]);

  useEffect(() => {
    if (!paletteOpen) return;
    const containFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setPaletteOpen(false); return; }
      if (event.key !== "Tab" || !paletteRef.current) return;
      const focusable = Array.from(paletteRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      const first = focusable[0]; const last = focusable.at(-1); if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", containFocus);
    return () => { document.removeEventListener("keydown", containFocus); paletteReturnFocusRef.current?.focus(); };
  }, [paletteOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissMenus();
      const mod = event.metaKey || event.ctrlKey; if (!mod) return;
      if (event.key.toLowerCase() === "k") { event.preventDefault(); openPalette(); }
      else if (event.key.toLowerCase() === "s") { event.preventDefault(); void saveActive(); }
      else if (event.key.toLowerCase() === "o") { event.preventDefault(); setImportOpen(true); }
      else if (event.key.toLowerCase() === "n") { event.preventDefault(); createDocument(); }
      else if (event.key === ",") { event.preventDefault(); setSettingsOpen(true); }
      else if (event.key === "1") { event.preventDefault(); setViewMode("live"); }
      else if (event.key === "2") { event.preventDefault(); setViewMode("preview"); }
      else if (event.key === "3") { event.preventDefault(); setViewMode("source"); }
      else if (event.key === "4") { event.preventDefault(); setViewMode("split"); }
      else if (event.key === "Backspace") { event.preventDefault(); setPendingDelete({ kind: "document", id: activeId }); }
      else if (event.shiftKey && event.key.toLowerCase() === "f") { event.preventDefault(); setViewMode("live"); setFocusMode((current) => !current); }
    };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeId, createDocument, dismissMenus, openPalette, saveActive, setViewMode]);

  const filteredDocuments = useMemo(() => {
    const query = documentSearch.trim().toLocaleLowerCase();
    return [...documents].filter((item) => {
      if (searchFilter === "pinned" && !item.pinned) return false;
      if (!query) return true;
      if (searchFilter === "title") return item.name.toLocaleLowerCase().includes(query);
      if (searchFilter === "content") return item.content.toLocaleLowerCase().includes(query);
      return item.name.toLocaleLowerCase().includes(query) || item.content.toLocaleLowerCase().includes(query);
    }).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt);
  }, [documentSearch, documents, searchFilter]);

  const commands = [
    { label: "新建文稿", hint: "⌘N", icon: FilePlus2, run: () => setTemplateOpen(true) },
    { label: "导入 Markdown", hint: "⌘O", icon: Import, run: () => setImportOpen(true) },
    { label: "写入本地文件", hint: "⌘S", icon: Save, run: () => void saveActive() },
    { label: "在文稿中查找与替换", hint: "⌘F", icon: FileSearch, run: () => { setViewMode("live"); window.setTimeout(() => editorRef.current?.openSearch(), 40); } },
    { label: "保存当前版本", hint: "", icon: Clock3, run: saveNamedVersion },
    { label: "查看版本记录", hint: "", icon: Archive, run: () => setHistoryOpen(true) },
    { label: "最近删除", hint: "", icon: Trash2, run: () => setTrashOpen(true) },
    { label: "把当前文稿移到最近删除", hint: "⌘⌫", icon: Trash2, run: () => setPendingDelete({ kind: "document", id: activeId }) },
    { label: "实时排版", hint: "⌘1", icon: TextCursorInput, run: () => setViewMode("live") },
    { label: "阅读视图", hint: "⌘2", icon: Eye, run: () => setViewMode("preview") },
    { label: "Markdown 源码", hint: "⌘3", icon: FileCode2, run: () => setViewMode("source") },
    ...(!isCompact ? [{ label: "并排对照", hint: "⌘4", icon: Columns2, run: () => setViewMode("split") }] : []),
    { label: focusMode ? "退出专注模式" : "进入专注模式", hint: "⌘⇧F", icon: Focus, run: () => { setViewMode("live"); setFocusMode((current) => !current); } },
    { label: inspectorOpen ? "关闭检查器" : "打开检查器", hint: "", icon: PanelRight, run: () => setInspectorOpen((current) => !current) },
    { label: "打开设置", hint: "⌘,", icon: Settings, run: () => setSettingsOpen(true) },
    { label: "切换外观", hint: "", icon: SunMoon, run: cycleTheme },
    { label: "导出 HTML", hint: "", icon: Download, run: exportHtml },
  ].filter((item) => item.label.toLocaleLowerCase().includes(paletteSearch.trim().toLocaleLowerCase()));

  const insertActions = [
    { label: "一级标题", icon: Heading1, run: () => editorRef.current?.prefixLine("# ") },
    { label: "二级标题", icon: Heading2, run: () => editorRef.current?.prefixLine("## ") },
    { label: "引用", icon: Quote, run: () => editorRef.current?.prefixLine("> ") },
    { label: "任务", icon: ListChecks, run: () => editorRef.current?.prefixLine("- [ ] ") },
    { label: "有序列表", icon: ListOrdered, run: () => editorRef.current?.prefixLine("1. ") },
    { label: "表格", icon: Table2, run: () => editorRef.current?.insert("| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |") },
    { label: "代码块", icon: Code2, run: () => editorRef.current?.insert("```\n\n```") },
    { label: "数学公式", icon: Sparkles, run: () => editorRef.current?.insert("$$\nE = mc^2\n$$") },
  ];

  if (!activeDocument) return null;

  const manuscriptTypeface = editorPreferences.typeface === "serif"
    ? '"Songti SC", "STSong", "Noto Serif CJK SC", Georgia, serif'
    : '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';
  const appStyle = {
    "--manuscript-font-size": `${editorPreferences.manuscriptFontSize}px`,
    "--source-font-size": `${editorPreferences.sourceFontSize}px`,
    "--manuscript-line-height": editorPreferences.lineHeight,
    "--manuscript-width": `${editorPreferences.manuscriptWidth}px`,
    "--manuscript-typeface": manuscriptTypeface,
  } as CSSProperties;

  return (
    <div style={appStyle} className={`app-shell${desktopApp ? " desktop-app" : ""}${sidebarOpen ? " has-sidebar" : ""}${inspectorOpen ? " has-inspector" : ""}`} onMouseDown={(event) => {
      if ((event.target as HTMLElement).closest("[data-popover-root]")) return;
      dismissMenus();
    }}>
      {sidebarOpen && <button className="mobile-scrim" aria-label="关闭文稿列表" onClick={() => setSidebarOpen(false)} />}

      <aside className="library-rail" aria-label="文稿列表">
        {desktopApp && <div className="sidebar-windowbar" data-tauri-drag-region onMouseDown={startWindowDrag}><button className="icon-button" type="button" onClick={() => setSidebarOpen(false)} aria-label="隐藏文稿列表" title="隐藏文稿列表"><img className="sidebar-toggle-glyph" src="/sidebar-collapse-v2.png" alt="" /></button></div>}
        <div className="library-heading" data-tauri-drag-region={desktopApp ? true : undefined} onMouseDown={startWindowDrag}><div className="library-title-row"><div className="product-brand"><img src="/patchmark-icon-64.png" alt="" /><h1>PatchMark</h1></div><button className="icon-button compose-button" type="button" onClick={() => setTemplateOpen(true)} aria-label="新建文稿" title="新建文稿"><FilePlus2 size={18} /></button></div><p>本地优先的 Markdown 编辑器</p></div>
        <label className="library-search"><Search size={15} aria-hidden="true" /><span className="visually-hidden">搜索文稿</span><input value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder="搜索" />{documentSearch && <button type="button" onClick={() => setDocumentSearch("")} aria-label="清除搜索"><X size={13} /></button>}</label>
        <div className="search-scopes" role="group" aria-label="搜索范围">{([ ["all", "全部"], ["title", "标题"], ["content", "正文"], ["pinned", "置顶"] ] as const).map(([value, label]) => <button type="button" className={searchFilter === value ? "active" : ""} key={value} onClick={() => setSearchFilter(value)}>{label}</button>)}</div>
        <LibraryTree documents={filteredDocuments} categories={categories} activeId={activeDocument.id} searching={Boolean(documentSearch.trim()) || searchFilter !== "all"} onSelect={selectDocument} onCreateCategory={createCategory} onRenameCategory={renameCategory} onDeleteCategory={deleteCategory} onMoveDocument={moveDocument} onDeleteDocument={deleteDocument} onTogglePinned={togglePinned} />
        <div className="library-footer" role="toolbar" aria-label="资料库工具"><button type="button" aria-label="导入文件" data-tooltip="导入文件 · ⌘O" onClick={() => setImportOpen(true)}><Import size={18} /></button><button type="button" aria-label="最近删除" data-tooltip="最近删除" onClick={() => setTrashOpen(true)}><Trash2 size={17} />{trash.length > 0 && <b aria-label={`${trash.length} 个项目`}>{trash.length}</b>}</button><button type="button" aria-label="设置" data-tooltip="设置 · ⌘," onClick={() => setSettingsOpen(true)}><Settings size={17} /></button></div>
      </aside>

      <section className="workspace">
        <header className="titlebar" data-tauri-drag-region={desktopApp ? true : undefined} onMouseDown={startWindowDrag}>
          <div className="titlebar-left">{(!desktopApp || !sidebarOpen) && <button className="icon-button" type="button" onClick={() => setSidebarOpen((current) => !current)} aria-label={sidebarOpen ? "隐藏文稿列表" : "显示文稿列表"} title="文稿列表">{desktopApp ? <PanelLeftOpen size={16} /> : <Menu size={20} />}</button>}</div>
          <div className="document-title-block">
            {renaming ? <input autoFocus className="title-input" aria-label={activeDocument.source === "local" ? "修改列表显示名，不重命名原文件" : "重命名文稿"} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onBlur={renameActive} onKeyDown={(event) => { if (event.key === "Enter") renameActive(); if (event.key === "Escape") setRenaming(false); }} /> : <button className="document-title-button" type="button" onClick={() => { setRenameValue(withoutExtension(activeDocument.name)); setRenaming(true); }} aria-label={activeDocument.source === "local" ? "修改列表显示名，不重命名原文件" : "重命名文稿"} title={activeDocument.source === "local" ? "修改列表显示名（不会重命名原文件）" : "重命名文稿"}><span>{withoutExtension(activeDocument.name)}</span>{isDiskDirty && <span className="dirty-dot" title="尚未写入文件" />}</button>}
            <span className="save-state">{saveStateLabel}</span>
          </div>
          <div className="titlebar-actions">
            {isDiskDirty && <button className="icon-button save-now" type="button" onClick={() => void saveActive()} aria-label="写入本地文件" title="写入本地文件 ⌘S"><Save size={18} /></button>}
            <div className="popover-anchor" data-popover-root>
              <button className={`view-button${viewMenuOpen ? " active" : ""}`} type="button" onClick={() => { setViewMenuOpen((current) => !current); setShareMenuOpen(false); }} aria-expanded={viewMenuOpen}><ActiveViewIcon size={16} /><span>{activeView.label}</span><ChevronDown size={14} /></button>
              {viewMenuOpen && <div className="popover-menu view-menu" role="menu" aria-label="显示方式" onKeyDown={navigateMenu}><div className="popover-label">显示方式</div>{viewOptions.map((item, index) => { const Icon = item.icon; return <button type="button" role="menuitemradio" aria-checked={viewMode === item.mode} key={item.mode} onClick={() => setViewMode(item.mode)} disabled={item.mode === "split" && isCompact}><Icon size={18} /><span><strong>{item.label}</strong><small>{item.detail}</small></span><kbd>⌘{index + 1}</kbd>{viewMode === item.mode && <Check className="menu-check" size={15} />}</button>; })}<div className="menu-separator" /><button type="button" role="menuitemcheckbox" aria-checked={focusMode} onClick={() => { setViewMode("live"); setFocusMode((current) => !current); }}><Focus size={18} /><span><strong>专注当前段落</strong><small>弱化其余内容</small></span>{focusMode && <Check className="menu-check" size={15} />}</button></div>}
            </div>
            <button className={`icon-button${inspectorOpen ? " active" : ""}`} type="button" onClick={() => setInspectorOpen((current) => !current)} aria-label={inspectorOpen ? "关闭检查器" : "打开检查器"} title="检查器"><PanelRight size={19} /></button>
            <div className="popover-anchor" data-popover-root>
              <button className={`icon-button${shareMenuOpen ? " active" : ""}`} type="button" onClick={() => { setShareMenuOpen((current) => !current); setViewMenuOpen(false); }} aria-label="分享与导出" aria-expanded={shareMenuOpen}><Share size={18} /></button>
              {shareMenuOpen && <div className="popover-menu share-menu" role="menu" aria-label="分享与导出" onKeyDown={navigateMenu}><button type="button" role="menuitem" onClick={() => void saveActive()}><Save size={18} /><span><strong>保存 Markdown</strong><small>写入本地 .md 文件</small></span></button><button type="button" role="menuitem" onClick={() => void copyRich()}><Copy size={18} /><span><strong>复制富文本</strong><small>同时保留 Markdown</small></span></button><button type="button" role="menuitem" onClick={() => void exportHtml()}><Download size={18} /><span><strong>导出 HTML</strong><small>独立网页，数学使用原生 MathML</small></span></button><button type="button" role="menuitem" onClick={printDocument}><Printer size={18} /><span><strong>打印或导出 PDF</strong><small>使用系统打印面板</small></span></button></div>}
            </div>
            <button className="icon-button command-button" type="button" onClick={openPalette} aria-label="打开命令面板" title="命令 ⌘K"><MoreHorizontal size={20} /></button>
          </div>
        </header>

        <main className={`document-stage mode-${viewMode} manuscript-width-${editorPreferences.manuscriptWidth}${outline.length > 0 ? " has-document-toc" : ""}`}>
          {outline.length > 0 && <nav className="document-toc" aria-label="文内目录"><div className="document-toc-inner"><span>目录</span>{outline.map((item, index) => <button type="button" key={`${item.id}-${index}`} className={`toc-level-${item.level}${activeOutlineId === item.id ? " active" : ""}`} onClick={() => navigateToOutline(item)} title={item.text}>{item.text}</button>)}</div></nav>}
          {(viewMode === "live" || viewMode === "source" || viewMode === "split") && <section className="editor-pane" aria-label={viewMode === "live" ? "实时排版编辑器" : "Markdown 源码编辑器"}><Suspense fallback={<div className="editor-loading" aria-label="正在准备编辑器"><span /><span /><span /></div>}><MarkdownEditor key={activeDocument.id} ref={editorRef} value={activeDocument.content} onChange={updateActiveContent} dark={dark} focusMode={focusMode} livePreview={viewMode === "live"} preferences={editorPreferences} onImageFile={handleImageFile} assetUrls={assetUrls} /></Suspense></section>}
          {(viewMode === "preview" || viewMode === "split") && <section className="preview-pane" aria-label="阅读视图" onScroll={syncPreviewOutline} onDoubleClick={() => setViewMode("live")}>{activeDocument.content.trim() ? <Suspense fallback={<div className="preview-loading">正在排版…</div>}><MarkdownPreview content={activeDocument.content} onNavigate={navigateDocumentLink} assetUrls={assetUrls} /></Suspense> : <div className="empty-document"><div className="empty-caret" aria-hidden="true" /><h1>开始一篇文稿</h1><p>标题会自动成为文件的名字，也可以稍后修改。</p><button type="button" onClick={() => setViewMode("live")}><Pencil size={17} />开始写作</button></div>}</section>}
          {(viewMode === "live" || viewMode === "source" || viewMode === "split") && <div className="format-dock" role="toolbar" aria-label="Markdown 格式"><div className="popover-anchor insert-anchor" data-popover-root><button className={`dock-add${insertMenuOpen ? " active" : ""}`} type="button" onClick={() => setInsertMenuOpen((current) => !current)} aria-label="插入内容" aria-expanded={insertMenuOpen}><Plus size={19} /></button>{insertMenuOpen && <div className="insert-menu" role="menu" aria-label="插入内容" onKeyDown={navigateMenu}>{insertActions.map((item) => { const Icon = item.icon; return <button type="button" role="menuitem" key={item.label} onClick={() => { item.run(); setInsertMenuOpen(false); }}><Icon size={18} /><span>{item.label}</span></button>; })}</div>}</div><span className="dock-divider" /><button type="button" onClick={() => editorRef.current?.surround("**", "**", "粗体文字")} aria-label="粗体" title="粗体"><Bold size={18} /></button><button type="button" onClick={() => editorRef.current?.surround("*", "*", "斜体文字")} aria-label="斜体" title="斜体"><Italic size={18} /></button><button type="button" onClick={() => editorRef.current?.surround("[", "](https://)", "链接文字")} aria-label="链接" title="链接"><Link size={18} /></button><button type="button" onClick={() => editorRef.current?.surround("`", "`", "code")} aria-label="行内代码" title="行内代码"><Code2 size={18} /></button><button type="button" onClick={() => imageInputRef.current?.click()} aria-label="插入本地图片" title="插入本地图片"><Image size={18} /></button><span className="dock-divider" /><button type="button" onClick={() => editorRef.current?.prefixLine("- ")} aria-label="列表" title="无序列表"><List size={18} /></button><button type="button" onClick={() => editorRef.current?.prefixLine("- [ ] ")} aria-label="任务" title="任务列表"><ListChecks size={18} /></button><input ref={imageInputRef} className="visually-hidden" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImageFile(file).then((path) => path && editorRef.current?.insert(`![${file.name.replace(/\.[^.]+$/, "") || "图片"}](${path})`)); event.currentTarget.value = ""; }} /></div>}
          <footer className="document-status" aria-label="文档统计"><span>{stats.words.toLocaleString("zh-CN")} 字词</span><span>{stats.characters.toLocaleString("zh-CN")} 字符</span><span>约 {stats.minutes} 分钟</span><span className="status-spacer" /><span>{viewMode === "live" ? "实时排版" : viewMode === "source" ? "Markdown" : viewMode === "preview" ? "阅读" : "对照"}</span></footer>
        </main>
      </section>

      {inspectorOpen && <aside className="inspector-rail" aria-label="文档检查器"><div className="inspector-header"><div className="inspector-tabs" role="tablist" aria-label="检查器页面" onKeyDown={navigateInspectorTabs}><button id="outline-tab" role="tab" aria-selected={inspectorTab === "outline"} aria-controls="outline-panel" tabIndex={inspectorTab === "outline" ? 0 : -1} className={inspectorTab === "outline" ? "active" : ""} type="button" onClick={() => setInspectorTab("outline")}>大纲</button><button id="links-tab" role="tab" aria-selected={inspectorTab === "links"} aria-controls="links-panel" tabIndex={inspectorTab === "links" ? 0 : -1} className={inspectorTab === "links" ? "active" : ""} type="button" onClick={() => setInspectorTab("links")}>链接</button><button id="info-tab" role="tab" aria-selected={inspectorTab === "info"} aria-controls="info-panel" tabIndex={inspectorTab === "info" ? 0 : -1} className={inspectorTab === "info" ? "active" : ""} type="button" onClick={() => setInspectorTab("info")}>文稿</button></div><button className="icon-button" type="button" onClick={() => setInspectorOpen(false)} aria-label="关闭检查器"><X size={17} /></button></div>{inspectorTab === "outline" ? <nav id="outline-panel" role="tabpanel" aria-labelledby="outline-tab" className="outline-nav">{outline.map((item, index) => <button type="button" key={`${item.id}-${index}`} className={`outline-level-${item.level}`} onClick={() => navigateToOutline(item)}>{item.text}</button>)}{!outline.length && <div className="inspector-empty"><Info size={20} /><p>添加标题后，大纲会在这里自动生成。</p></div>}</nav> : inspectorTab === "links" ? <div id="links-panel" role="tabpanel" aria-labelledby="links-tab" className="links-panel"><section><span>引用本文 · {backlinks.length}</span>{backlinks.map((item) => <button type="button" key={item.id} onClick={() => selectDocument(item.id)}><Link2 size={14} /><span>{withoutExtension(item.name)}</span></button>)}{!backlinks.length && <p>还没有其他文稿链接到这里。</p>}</section><section><span>本文链接 · {outgoingLinks.length}</span>{outgoingLinks.map((item, index) => <button type="button" className={item.ambiguous ? "ambiguous" : item.broken ? "broken" : ""} key={`${item.href}-${index}`} title={item.candidates?.join("\n")} onClick={() => navigateDocumentLink(item.href)}><Link size={14} /><span><strong>{item.label}</strong><small>{item.ambiguous ? `目标不唯一 · ${item.candidates?.length ?? 0} 个同名文件` : item.broken ? `失效 · ${item.href}` : item.href}</small></span></button>)}{!outgoingLinks.length && <p>使用 `[标题](文件.md)` 建立文稿关系。</p>}</section></div> : <div id="info-panel" role="tabpanel" aria-labelledby="info-tab" className="document-info"><section><span>统计</span><dl><div><dt>字词</dt><dd>{stats.words.toLocaleString("zh-CN")}</dd></div><div><dt>字符</dt><dd>{stats.characters.toLocaleString("zh-CN")}</dd></div><div><dt>阅读</dt><dd>{stats.minutes} 分钟</dd></div></dl></section><section><span>文件</span><dl><div><dt>名称</dt><dd>{activeDocument.name}</dd></div>{activeDocument.path && <div><dt>路径</dt><dd>{activeDocument.path}</dd></div>}<div><dt>来源</dt><dd>{activeDocument.source === "local" ? "本地文件" : activeDocument.source === "sample" ? "示例" : "恢复草稿"}</dd></div>{activeDocument.source === "local" && <div><dt>连接</dt><dd>{activeHandleAccess === "granted" ? "可读写并监测外部修改" : activeHandleAccess === "prompt" ? "保存时需要授权" : activeHandleAccess === "denied" ? "权限已关闭" : "需要重新定位"}</dd></div>}<div><dt>格式</dt><dd>Markdown · UTF-8</dd></div></dl></section><button className="theme-row" type="button" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /><span><strong>编辑器设置</strong><small>{editorPreferences.manuscriptFontSize} px · {theme === "system" ? "跟随系统" : theme === "light" ? "浅色" : "深色"}</small></span><ChevronRight size={15} /></button><button className="theme-row" type="button" onClick={() => setHistoryOpen(true)}><Clock3 size={18} /><span><strong>版本记录</strong><small>{versions.filter((item) => item.documentId === activeDocument.id).length} 个本地版本</small></span><ChevronRight size={15} /></button></div>}</aside>}

      {paletteOpen && <div className="palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}><section ref={paletteRef} className="command-palette" role="dialog" aria-modal="true" aria-label="命令面板" onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setPaletteIndex((current) => commands.length ? (current + 1) % commands.length : 0); } else if (event.key === "ArrowUp") { event.preventDefault(); setPaletteIndex((current) => commands.length ? (current - 1 + commands.length) % commands.length : 0); } else if (event.key === "Enter" && commands[paletteIndex]) { event.preventDefault(); const command = commands[paletteIndex]; setPaletteOpen(false); window.setTimeout(command.run, 0); } }}><label className="palette-search"><Search size={18} /><input autoFocus value={paletteSearch} onChange={(event) => { setPaletteSearch(event.target.value); setPaletteIndex(0); }} placeholder="搜索命令与操作" aria-activedescendant={commands[paletteIndex] ? `palette-command-${paletteIndex}` : undefined} /><kbd>esc</kbd></label><div className="palette-results" role="listbox" aria-label="命令结果">{commands.map((item, index) => { const Icon = item.icon; return <button id={`palette-command-${index}`} role="option" aria-selected={index === paletteIndex} key={item.label} className={index === paletteIndex ? "suggested" : ""} type="button" onMouseEnter={() => setPaletteIndex(index)} onClick={() => { setPaletteOpen(false); window.setTimeout(item.run, 0); }}><Icon size={18} /><span>{item.label}</span>{item.hint && <kbd>{item.hint}</kbd>}</button>; })}{!commands.length && <p>没有匹配的命令</p>}</div></section></div>}
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={importFiles} onChooseNativeFiles={desktopApp ? chooseDesktopFiles : undefined} onChooseNativeFolder={desktopApp ? chooseDesktopFolder : undefined} />
      <TemplateDialog open={templateOpen} templates={builtInTemplates} onClose={() => setTemplateOpen(false)} onCreate={createDocument} />
      <HistoryDialog open={historyOpen} document={activeDocument} versions={versions.filter((item) => item.documentId === activeDocument.id)} onClose={() => setHistoryOpen(false)} onRestore={restoreVersion} onNameVersion={saveNamedVersion} />
      <TrashDialog open={trashOpen} entries={trash} onClose={() => setTrashOpen(false)} onRestore={restoreTrashEntry} onDelete={deleteTrashEntry} />
      <SettingsDialog open={settingsOpen} preferences={editorPreferences} theme={theme} defaultDirectoryName={defaultDirectoryName} defaultDirectoryAccess={defaultDirectoryAccess} canChooseDirectory={desktopApp || Boolean(window.showDirectoryPicker)} onClose={() => setSettingsOpen(false)} onChange={setEditorPreferences} onThemeChange={setTheme} onReset={() => setEditorPreferences(defaultEditorPreferences)} onChooseDirectory={() => void chooseDefaultDocumentDirectory()} onClearDirectory={clearDefaultDocumentDirectory} />
      <ConfirmDialog open={Boolean(pendingDelete)} title={pendingDelete?.kind === "category" ? `删除分类“${categories.find((item) => item.id === pendingDelete.id)?.name ?? ""}”？` : `把“${withoutExtension(documents.find((item) => item.id === pendingDelete?.id)?.name ?? "文稿")}”移到最近删除？`} description={pendingDelete?.kind === "category" ? "分类和子分类会被移除，其中的文稿会回到未分类。" : documents.find((item) => item.id === pendingDelete?.id)?.source === "local" ? "只移除 PatchMark 中的记录，电脑上的原文件不会被删除。" : "文稿会保留在最近删除中，可以稍后恢复。"} confirmLabel={pendingDelete?.kind === "category" ? "删除分类" : "移到最近删除"} onClose={() => setPendingDelete(null)} onConfirm={confirmPendingDelete} />
      <ConflictDialog conflict={fileConflict} document={documents.find((item) => item.id === fileConflict?.documentId) ?? activeDocument} onClose={() => setFileConflict(null)} onUseDisk={useDiskConflict} onOverwrite={() => void overwriteDiskConflict()} />
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}

export default App;
