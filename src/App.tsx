import {
  Bold, BookOpen, Check, ChevronDown, ChevronRight, Code2, Columns2, Copy, Download, Eye,
  Archive, Clock3, FileCode2, FilePlus2, FileSearch, Focus, Heading1, Heading2, Image, Info, Italic, Link, Link2, List,
  Import, ListChecks, ListOrdered, Menu, MessageCircle, MoreHorizontal, PanelLeftOpen, PanelRight, Pencil, Plus, Printer, Quote,
  Save, Search, Settings, Settings as Settings2, Share, Sparkles, SunMoon, Table2, TextCursorInput, Trash2, X,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import type { MarkdownEditorHandle } from "./editor/MarkdownEditor";
import ImportDialog, { type ImportCandidate } from "./library/ImportDialog";
import LibraryTree from "./library/LibraryTree";
import { AboutDialog, ConfirmDialog, ConflictDialog, HistoryDialog, SettingsDialog, TemplateDialog, TrashDialog } from "./library/WorkspaceDialogs";
import { useI18n } from "./i18n";
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

const REPOSITORY_URL = "https://github.com/yyyz1011/manuslate";
const FEEDBACK_URL = `${REPOSITORY_URL}/issues/new`;

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

function createUntitled(index: number, untitled: string): MarkdownDocument {
  const now = Date.now();
  return {
    id: uniqueId(), name: index === 1 ? `${untitled}.md` : `${untitled} ${index}.md`, content: "",
    source: "draft", createdAt: now, updatedAt: now,
  };
}

function safeMarkdownName(name: string): string {
  const normalized = name.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ") || "Untitled";
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
  const { language, locale, t } = useI18n();
  const viewOptions: Array<{ mode: ViewMode; label: string; detail: string; icon: typeof Pencil }> = [
    { mode: "live", label: t("Live", "实时排版"), detail: t("Write in the finished page", "边写边看到成稿"), icon: TextCursorInput },
    { mode: "preview", label: t("Reading", "阅读"), detail: t("Review without distractions", "沉浸校对成稿"), icon: BookOpen },
    { mode: "source", label: t("Markdown source", "Markdown 源码"), detail: t("Show every mark", "显示全部标记"), icon: FileCode2 },
    { mode: "split", label: t("Split", "对照"), detail: t("Source and result side by side", "源码与成稿并排"), icon: Columns2 },
  ];
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
  const [aboutOpen, setAboutOpen] = useState(false);
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
    ? t("Saving recovery draft…", "正在存入恢复草稿…")
    : activeDocument?.source === "sample"
      ? t("Sample · saved as recovery draft", "示例文稿 · 已存入恢复草稿")
      : activeDocument?.source === "local" && activeDiskName
        ? activeHandleAccess === "prompt"
          ? t(`${activeDiskName} · authorize on save`, `${activeDiskName} · 保存时重新授权`)
          : activeHandleAccess === "denied"
            ? t(`${activeDiskName} · access denied`, `${activeDiskName} · 文件权限已关闭`)
            : isDiskDirty
              ? t(`Not written to ${activeDiskName}`, `尚未写入 ${activeDiskName}`)
              : hasDisplayName
                ? t(`Synced with ${activeDiskName} · display name shown`, `已同步 ${activeDiskName} · 当前为显示名`)
                : t(`Synced with ${activeDiskName}`, `已与 ${activeDiskName} 同步`)
        : activeDocument?.source === "local"
          ? t("Recovery copy · reconnect on save", "恢复副本 · 保存时重新选择文件")
          : isDiskDirty
            ? t("Recovered automatically · not exported", "已自动恢复 · 尚未导出文件")
            : t("Saved as recovery draft", "已存入恢复草稿");

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? null : current), 2200);
  }, []);

  const openExternal = useCallback(async (url: string) => {
    try {
      if (desktopApp) await openUrl(url);
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      notify(t("Could not open the link.", "无法打开链接。"));
    }
  }, [notify, t]);

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
    if (mode === "split" && isCompact) notify(t("Split view needs more room. Switched to Reading.", "对照视图适合宽屏，已切换到阅读"));
    setViewModeState(effectiveMode); saveViewMode(effectiveMode);
    if (effectiveMode === "preview") setFocusMode(false);
    dismissMenus();
  }, [dismissMenus, isCompact, notify]);

  const updateActiveContent = useCallback((content: string) => {
    if (activeDocument && activeDocument.content.trim() && activeDocument.content !== content) {
      const previous = autoVersionRef.current.get(activeDocument.id);
      const now = Date.now();
      if (!previous || now - previous.at > 30_000) {
        const snapshot: VersionSnapshot = { id: uniqueId(), documentId: activeDocument.id, name: t("Auto version", "自动版本"), content: activeDocument.content, createdAt: now, kind: "auto" };
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
    const untitled = t("Untitled", "未命名");
    const count = documents.filter((item) => item.name.startsWith(untitled)).length + 1;
    const item = createUntitled(count, untitled);
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
    const suggested = `${t("Version", "版本")} ${new Date().toLocaleString(locale, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    const name = window.prompt(t("Version name", "版本名称"), suggested)?.trim();
    if (!name) return;
    const snapshot: VersionSnapshot = { id: uniqueId(), documentId: activeDocument.id, name, content: activeDocument.content, createdAt: Date.now(), kind: "named" };
    setVersions((current) => [snapshot, ...current]); notify(t("Current version saved", "已保存当前版本"));
  }, [activeDocument, notify]);

  const restoreVersion = useCallback((version: VersionSnapshot) => {
    if (!window.confirm(t(`Restore “${version.name}”? The current content will be saved first.`, `恢复“${version.name}”？当前内容会先保存为自动版本。`))) return;
    if (activeDocument) setVersions((current) => [{ id: uniqueId(), documentId: activeDocument.id, name: t("Before restore", "恢复前"), content: activeDocument.content, createdAt: Date.now(), kind: "auto" }, ...current]);
    updateActiveContent(version.content); setHistoryOpen(false); notify(t("Version restored", "版本已恢复"));
  }, [activeDocument, notify, updateActiveContent]);

  const handleImageFile = useCallback(async (file: File): Promise<string | null> => {
    try {
      if (desktopApp) {
        let directoryPath = localStorage.getItem(NATIVE_ASSET_DIRECTORY_KEY);
        if (!directoryPath) {
          notify(t("Choose an asset folder beside the document (for example, assets).", "请选择文稿旁边的资源目录（例如 assets）"));
          directoryPath = await chooseNativeDirectory(t("Choose image asset folder", "选择图片资源文件夹"));
          if (!directoryPath) return null;
          localStorage.setItem(NATIVE_ASSET_DIRECTORY_KEY, directoryPath);
        }
        const extension = file.name.match(/\.[a-z0-9]+$/i)?.[0] || ".png";
        const stem = file.name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-|-$/g, "") || "image";
        const fileName = `${stem}-${Date.now()}${extension.toLocaleLowerCase()}`;
        const target = await writeNativeImage(directoryPath, fileName, new Uint8Array(await file.arrayBuffer()));
        const markdownPath = `${pathName(directoryPath)}/${pathName(target)}`;
        setAssetUrls((current) => ({ ...current, [markdownPath]: URL.createObjectURL(file) }));
        notify(t(`Image saved to ${pathName(directoryPath)}`, `图片已存入 ${pathName(directoryPath)}`));
        return markdownPath;
      }
      let directory = assetDirectoryRef.current;
      if (!directory) {
        if (!window.showDirectoryPicker) { notify(t("This browser does not support local asset folders.", "当前浏览器不支持本地资源目录")); return null; }
        notify(t("Choose an asset folder beside the document (for example, assets).", "请选择文稿旁边的资源目录（例如 assets）"));
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
      notify(t(`Image saved to ${directory.name}`, `图片已存入 ${directory.name}`));
      return path;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return null;
      notify(t("Could not save the image. Choose the asset folder again.", "图片写入失败，请重新选择资源目录")); assetDirectoryRef.current = null; return null;
    }
  }, [notify]);

  const navigateDocumentLink = useCallback((href: string) => {
    if (href.startsWith("#")) { document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" }); return true; }
    const resolved = resolveDocumentLink(href, documents, activeDocument);
    if (resolved.ambiguous) {
      notify(t(`Link target is ambiguous: ${resolved.candidates?.slice(0, 2).join(", ")}`, `链接目标不唯一：${resolved.candidates?.slice(0, 2).join("、")}`));
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
    notify(opened.length === 1 ? t(`Imported ${opened[0].name}`, `已导入 ${opened[0].name}`) : t(`Imported ${opened.length} documents`, `已导入 ${opened.length} 个文稿`));
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
    if (categories.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { notify(t("A category with this name already exists.", "已经有同名分类")); return; }
    const id = uniqueId();
    setCategories((current) => [...current, { id, name, createdAt: Date.now(), parentId }]);
    return id;
  }, [categories, notify]);

  const renameCategory = useCallback((id: string, name: string) => {
    if (categories.some((item) => item.id !== id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { notify(t("A category with this name already exists.", "已经有同名分类")); return; }
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
      notify(t("Category deleted; documents moved to Uncategorized.", "分类已删除，文稿已移到未分类"));
    } else {
      const target = documents.find((item) => item.id === pendingDelete.id);
      if (target) {
        const remaining = documents.filter((item) => item.id !== target.id);
        let nextDocuments = remaining;
        if (!remaining.length) {
          const replacement = createUntitled(1, t("Untitled", "未命名"));
          savedSnapshotsRef.current.set(replacement.id, replacement.content);
          nextDocuments = [replacement];
        }
        setTrash((current) => [{ document: target, deletedAt: Date.now() }, ...current.filter((entry) => entry.document.id !== target.id)]);
        setDocuments(nextDocuments);
        if (activeId === target.id) {
          setActiveId(nextDocuments[0].id);
          saveActiveDocumentId(nextDocuments[0].id);
        }
        notify(target.source === "local" ? t("Moved to Recently Deleted; the local file remains on your computer.", "已移到最近删除，本地文件仍在电脑上") : t("Moved to Recently Deleted", "已移到最近删除"));
      }
    }
    setPendingDelete(null);
  }, [activeId, categories, documents, notify, pendingDelete]);

  const restoreTrashEntry = useCallback((entry: TrashEntry) => {
    setDocuments((current) => [entry.document, ...current.filter((item) => item.id !== entry.document.id)]);
    setTrash((current) => current.filter((item) => item.document.id !== entry.document.id));
    setActiveId(entry.document.id); saveActiveDocumentId(entry.document.id); notify(t("Document restored", "文稿已恢复"));
  }, [notify]);

  const deleteTrashEntry = useCallback((entry: TrashEntry) => {
    if (!window.confirm(t(`Permanently delete the recovery record for “${withoutExtension(entry.document.name)}”? This cannot be undone.`, `永久删除“${withoutExtension(entry.document.name)}”的恢复记录？此操作不可撤销。`))) return;
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
    notify(t(`Safely written to ${handle.name}`, `已安全写入 ${handle.name}`));
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
    notify(t(`Safely written to ${written.name}`, `已安全写入 ${written.name}`));
  }, [notify]);

  const chooseDefaultDocumentDirectory = useCallback(async () => {
    if (desktopApp) {
      try {
        const directory = await chooseNativeDirectory(t("Choose folder for new documents", "选择新文稿文件夹"));
        if (!directory) return;
        localStorage.setItem(NATIVE_DEFAULT_DIRECTORY_KEY, directory);
        setDefaultDirectoryPath(directory);
        setDefaultDirectoryName(pathName(directory));
        setDefaultDirectoryAccess("granted");
        notify(t(`New documents will be saved to ${pathName(directory)}`, `新文稿将保存到 ${pathName(directory)}`));
      } catch { notify(t("Could not set the folder. Try again.", "文件夹设置失败，请重试")); }
      return;
    }
    if (!window.showDirectoryPicker) { notify(t("This browser cannot remember a custom folder.", "当前浏览器不支持自定义文件夹")); return; }
    try {
      const directory = await window.showDirectoryPicker({ mode: "readwrite" });
      defaultDirectoryRef.current = directory;
      setDefaultDirectoryName(directory.name);
      setDefaultDirectoryAccess(await permissionFor(directory));
      await rememberDefaultDocumentDirectory(directory);
      notify(t(`New documents will be saved to ${directory.name}`, `新文稿将保存到 ${directory.name}`));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify(t("Could not set the folder. Try again.", "文件夹设置失败，请重试"));
    }
  }, [notify]);

  const clearDefaultDocumentDirectory = useCallback(() => {
    localStorage.removeItem(NATIVE_DEFAULT_DIRECTORY_KEY);
    defaultDirectoryRef.current = null;
    setDefaultDirectoryPath(null);
    setDefaultDirectoryName(null);
    setDefaultDirectoryAccess("missing");
    void forgetDefaultDocumentDirectory().catch(() => undefined);
    notify(t("The save location will be chosen on first save.", "已改为首次保存时选择位置"));
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
          notify(t("The default folder is not writable. Choose a location for this document.", "默认文件夹不可写，将为这篇文稿选择位置"));
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
          notify(t("No permission to write this file. Choose it again.", "没有文件写入权限，请重新选择文件"));
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
        notify(t("Markdown downloaded; this browser cannot keep the file connection.", "Markdown 已下载；浏览器无法保持文件连接"));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify(t("Save failed. Try again.", "保存失败，请重试"));
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
    notify(t("Loaded the latest version from disk", "已载入磁盘上的最新版本"));
  }, [fileConflict, notify]);

  const overwriteDiskConflict = useCallback(async () => {
    if (!fileConflict) return;
    const documentToWrite = documents.find((item) => item.id === fileConflict.documentId);
    if (desktopApp && documentToWrite?.nativePath) {
      try {
        await writeDocumentToNativePath(documentToWrite, documentToWrite.nativePath, true);
        setFileConflict(null);
      } catch { notify(t("Overwrite failed; the disk file was not changed.", "覆盖失败，磁盘文件没有改变")); }
      return;
    }
    const handle = handlesRef.current.get(fileConflict.documentId);
    if (!documentToWrite || !handle) { setFileConflict(null); notify(t("The file connection was lost. Save again.", "文件连接已丢失，请重新保存")); return; }
    try {
      if (!await ensureWritePermission(handle)) { notify(t("No permission to write this file.", "没有文件写入权限")); return; }
      await writeDocumentToHandle(documentToWrite, handle, true);
      setFileConflict(null);
    } catch { notify(t("Overwrite failed; the disk file was not changed.", "覆盖失败，磁盘文件没有改变")); }
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
    URL.revokeObjectURL(url); dismissMenus(); notify(t("HTML exported", "HTML 已导出"));
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
      notify(t("Rich text and Markdown copied", "已复制富文本与 Markdown"));
    } catch { notify(t("Copy failed. Check browser permissions.", "复制失败，请检查浏览器权限")); }
    dismissMenus();
  }, [activeDocument, dismissMenus, notify]);

  const printDocument = useCallback(() => {
    setViewMode("preview"); window.setTimeout(() => window.print(), 80); dismissMenus();
  }, [dismissMenus, setViewMode]);

  const cycleTheme = useCallback(() => {
    const next: ThemeMode = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setThemeState(next); saveTheme(next);
    notify(next === "system" ? t("Appearance follows the system", "外观跟随系统") : next === "light" ? t("Switched to light appearance", "已切换浅色外观") : t("Switched to dark appearance", "已切换深色外观"));
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
            notify(t(`${pathName(documentToCheck.nativePath)} updated from disk`, `${pathName(documentToCheck.nativePath)} 已从磁盘更新`));
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
          notify(t(`${handle.name} updated from disk`, `${handle.name} 已从磁盘更新`));
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
    { label: t("New document", "新建文稿"), hint: "⌘N", icon: FilePlus2, run: () => setTemplateOpen(true) },
    { label: t("Import Markdown", "导入 Markdown"), hint: "⌘O", icon: Import, run: () => setImportOpen(true) },
    { label: t("Save to local file", "写入本地文件"), hint: "⌘S", icon: Save, run: () => void saveActive() },
    { label: t("Find and replace", "在文稿中查找与替换"), hint: "⌘F", icon: FileSearch, run: () => { setViewMode("live"); window.setTimeout(() => editorRef.current?.openSearch(), 40); } },
    { label: t("Save current version", "保存当前版本"), hint: "", icon: Clock3, run: saveNamedVersion },
    { label: t("View version history", "查看版本记录"), hint: "", icon: Archive, run: () => setHistoryOpen(true) },
    { label: t("Recently deleted", "最近删除"), hint: "", icon: Trash2, run: () => setTrashOpen(true) },
    { label: t("Move current document to trash", "把当前文稿移到最近删除"), hint: "⌘⌫", icon: Trash2, run: () => setPendingDelete({ kind: "document", id: activeId }) },
    { label: t("Live editing", "实时排版"), hint: "⌘1", icon: TextCursorInput, run: () => setViewMode("live") },
    { label: t("Reading view", "阅读视图"), hint: "⌘2", icon: Eye, run: () => setViewMode("preview") },
    { label: t("Markdown source", "Markdown 源码"), hint: "⌘3", icon: FileCode2, run: () => setViewMode("source") },
    ...(!isCompact ? [{ label: t("Split view", "并排对照"), hint: "⌘4", icon: Columns2, run: () => setViewMode("split") }] : []),
    { label: focusMode ? t("Exit focus mode", "退出专注模式") : t("Enter focus mode", "进入专注模式"), hint: "⌘⇧F", icon: Focus, run: () => { setViewMode("live"); setFocusMode((current) => !current); } },
    { label: inspectorOpen ? t("Close inspector", "关闭检查器") : t("Open inspector", "打开检查器"), hint: "", icon: PanelRight, run: () => setInspectorOpen((current) => !current) },
    { label: t("Open settings", "打开设置"), hint: "⌘,", icon: Settings, run: () => setSettingsOpen(true) },
    { label: t("Cycle appearance", "切换外观"), hint: "", icon: SunMoon, run: cycleTheme },
    { label: t("Export HTML", "导出 HTML"), hint: "", icon: Download, run: exportHtml },
  ].filter((item) => item.label.toLocaleLowerCase().includes(paletteSearch.trim().toLocaleLowerCase()));

  const insertActions = [
    { label: t("Heading 1", "一级标题"), icon: Heading1, run: () => editorRef.current?.prefixLine("# ") },
    { label: t("Heading 2", "二级标题"), icon: Heading2, run: () => editorRef.current?.prefixLine("## ") },
    { label: t("Quote", "引用"), icon: Quote, run: () => editorRef.current?.prefixLine("> ") },
    { label: t("Task", "任务"), icon: ListChecks, run: () => editorRef.current?.prefixLine("- [ ] ") },
    { label: t("Numbered list", "有序列表"), icon: ListOrdered, run: () => editorRef.current?.prefixLine("1. ") },
    { label: t("Table", "表格"), icon: Table2, run: () => editorRef.current?.insert(t("| Column 1 | Column 2 |\n| --- | --- |\n| Content | Content |", "| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |")) },
    { label: t("Code block", "代码块"), icon: Code2, run: () => editorRef.current?.insert("```\n\n```") },
    { label: t("Math block", "数学公式"), icon: Sparkles, run: () => editorRef.current?.insert("$$\nE = mc^2\n$$") },
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
      {sidebarOpen && <button className="mobile-scrim" aria-label={t("Close document library", "关闭文稿列表")} onClick={() => setSidebarOpen(false)} />}

      <aside className="library-rail" aria-label={t("Document library", "文稿列表")}>
        {desktopApp && <div className="sidebar-windowbar" data-tauri-drag-region onMouseDown={startWindowDrag}><button className="icon-button" type="button" onClick={() => setSidebarOpen(false)} aria-label={t("Hide document library", "隐藏文稿列表")} title={t("Hide document library", "隐藏文稿列表")}><img className="sidebar-toggle-glyph" src="/sidebar-collapse-v2.png" alt="" /></button></div>}
        <div className="library-heading" data-tauri-drag-region={desktopApp ? true : undefined} onMouseDown={startWindowDrag}><div className="library-title-row"><button className="product-brand brand-button" type="button" onClick={() => setAboutOpen(true)} aria-label={t("About Manuslate", "关于 Manuslate")} title={t("About Manuslate", "关于 Manuslate")}><img src="/manuslate-icon-v1-128.png" alt="" /><h1>Manuslate</h1></button><button className="icon-button compose-button" type="button" onClick={() => setTemplateOpen(true)} aria-label={t("New document", "新建文稿")} title={t("New document", "新建文稿")}><FilePlus2 size={18} /></button></div><p>{t("Local-first Markdown editor", "本地优先的 Markdown 编辑器")}</p></div>
        <label className="library-search"><Search size={15} aria-hidden="true" /><span className="visually-hidden">{t("Search documents", "搜索文稿")}</span><input value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder={t("Search", "搜索")} />{documentSearch && <button type="button" onClick={() => setDocumentSearch("")} aria-label={t("Clear search", "清除搜索")}><X size={13} /></button>}</label>
        <div className="search-scopes" role="group" aria-label={t("Search scope", "搜索范围")}>{([ ["all", t("All", "全部")], ["title", t("Title", "标题")], ["content", t("Body", "正文")], ["pinned", t("Pinned", "置顶")] ] as const).map(([value, label]) => <button type="button" className={searchFilter === value ? "active" : ""} key={value} onClick={() => setSearchFilter(value)}>{label}</button>)}</div>
        <LibraryTree documents={filteredDocuments} categories={categories} activeId={activeDocument.id} searching={Boolean(documentSearch.trim()) || searchFilter !== "all"} onSelect={selectDocument} onCreateCategory={createCategory} onRenameCategory={renameCategory} onDeleteCategory={deleteCategory} onMoveDocument={moveDocument} onDeleteDocument={deleteDocument} onTogglePinned={togglePinned} />
        <div className="library-footer" role="toolbar" aria-label={t("Library tools", "资料库工具")}><button type="button" aria-label={t("Import files", "导入文件")} data-tooltip={t("Import · ⌘O", "导入文件 · ⌘O")} onClick={() => setImportOpen(true)}><Import size={18} /></button><button type="button" aria-label={t("Recently deleted", "最近删除")} data-tooltip={t("Recently deleted", "最近删除")} onClick={() => setTrashOpen(true)}><Trash2 size={17} />{trash.length > 0 && <b aria-label={t(`${trash.length} items`, `${trash.length} 个项目`)}>{trash.length}</b>}</button><button type="button" aria-label={t("Feedback", "反馈")} data-tooltip={t("Feedback on GitHub", "在 GitHub 反馈")} onClick={() => void openExternal(FEEDBACK_URL)}><MessageCircle size={17} /></button><button type="button" aria-label={t("Settings", "设置")} data-tooltip={t("Settings · ⌘,", "设置 · ⌘,")} onClick={() => setSettingsOpen(true)}><Settings size={17} /></button></div>
      </aside>

      <section className="workspace">
        <header className="titlebar" data-tauri-drag-region={desktopApp ? true : undefined} onMouseDown={startWindowDrag}>
          <div className="titlebar-left">{(!desktopApp || !sidebarOpen) && <button className="icon-button" type="button" onClick={() => setSidebarOpen((current) => !current)} aria-label={sidebarOpen ? t("Hide document library", "隐藏文稿列表") : t("Show document library", "显示文稿列表")} title={t("Document library", "文稿列表")}>{desktopApp ? <PanelLeftOpen size={16} /> : <Menu size={20} />}</button>}</div>
          <div className="document-title-block">
            {renaming ? <input autoFocus className="title-input" aria-label={activeDocument.source === "local" ? t("Change the library name without renaming the file", "修改列表显示名，不重命名原文件") : t("Rename document", "重命名文稿")} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onBlur={renameActive} onKeyDown={(event) => { if (event.key === "Enter") renameActive(); if (event.key === "Escape") setRenaming(false); }} /> : <button className="document-title-button" type="button" onClick={() => { setRenameValue(withoutExtension(activeDocument.name)); setRenaming(true); }} aria-label={activeDocument.source === "local" ? t("Change the library name without renaming the file", "修改列表显示名，不重命名原文件") : t("Rename document", "重命名文稿")} title={activeDocument.source === "local" ? t("Change display name (the original file is unchanged)", "修改列表显示名（不会重命名原文件）") : t("Rename document", "重命名文稿")}><span>{withoutExtension(activeDocument.name)}</span>{isDiskDirty && <span className="dirty-dot" title={t("Not yet written to file", "尚未写入文件")} />}</button>}
            <span className="save-state">{saveStateLabel}</span>
          </div>
          <div className="titlebar-actions">
            {isDiskDirty && <button className="icon-button save-now" type="button" onClick={() => void saveActive()} aria-label={t("Save to local file", "写入本地文件")} title={t("Save to local file · ⌘S", "写入本地文件 · ⌘S")}><Save size={18} /></button>}
            <div className="popover-anchor" data-popover-root>
              <button className={`view-button${viewMenuOpen ? " active" : ""}`} type="button" onClick={() => { setViewMenuOpen((current) => !current); setShareMenuOpen(false); }} aria-expanded={viewMenuOpen}><ActiveViewIcon size={16} /><span>{activeView.label}</span><ChevronDown size={14} /></button>
              {viewMenuOpen && <div className="popover-menu view-menu" role="menu" aria-label={t("View", "显示方式")} onKeyDown={navigateMenu}><div className="popover-label">{t("View", "显示方式")}</div>{viewOptions.map((item, index) => { const Icon = item.icon; return <button type="button" role="menuitemradio" aria-checked={viewMode === item.mode} key={item.mode} onClick={() => setViewMode(item.mode)} disabled={item.mode === "split" && isCompact}><Icon size={18} /><span><strong>{item.label}</strong><small>{item.detail}</small></span><kbd>⌘{index + 1}</kbd>{viewMode === item.mode && <Check className="menu-check" size={15} />}</button>; })}<div className="menu-separator" /><button type="button" role="menuitemcheckbox" aria-checked={focusMode} onClick={() => { setViewMode("live"); setFocusMode((current) => !current); }}><Focus size={18} /><span><strong>{t("Focus current paragraph", "专注当前段落")}</strong><small>{t("Dim the rest", "弱化其余内容")}</small></span>{focusMode && <Check className="menu-check" size={15} />}</button></div>}
            </div>
            <button className={`icon-button${inspectorOpen ? " active" : ""}`} type="button" onClick={() => setInspectorOpen((current) => !current)} aria-label={inspectorOpen ? t("Close inspector", "关闭检查器") : t("Open inspector", "打开检查器")} title={t("Inspector", "检查器")}><PanelRight size={19} /></button>
            <div className="popover-anchor" data-popover-root>
              <button className={`icon-button${shareMenuOpen ? " active" : ""}`} type="button" onClick={() => { setShareMenuOpen((current) => !current); setViewMenuOpen(false); }} aria-label={t("Share and export", "分享与导出")} aria-expanded={shareMenuOpen}><Share size={18} /></button>
              {shareMenuOpen && <div className="popover-menu share-menu" role="menu" aria-label={t("Share and export", "分享与导出")} onKeyDown={navigateMenu}><button type="button" role="menuitem" onClick={() => void saveActive()}><Save size={18} /><span><strong>{t("Save Markdown", "保存 Markdown")}</strong><small>{t("Write to a local .md file", "写入本地 .md 文件")}</small></span></button><button type="button" role="menuitem" onClick={() => void copyRich()}><Copy size={18} /><span><strong>{t("Copy rich text", "复制富文本")}</strong><small>{t("Keep Markdown on the clipboard too", "同时保留 Markdown")}</small></span></button><button type="button" role="menuitem" onClick={() => void exportHtml()}><Download size={18} /><span><strong>{t("Export HTML", "导出 HTML")}</strong><small>{t("Standalone page with native MathML", "独立网页，数学使用原生 MathML")}</small></span></button><button type="button" role="menuitem" onClick={printDocument}><Printer size={18} /><span><strong>{t("Print or export PDF", "打印或导出 PDF")}</strong><small>{t("Use the system print panel", "使用系统打印面板")}</small></span></button></div>}
            </div>
            <button className="icon-button command-button" type="button" onClick={openPalette} aria-label={t("Open command palette", "打开命令面板")} title={t("Commands · ⌘K", "命令 · ⌘K")}><MoreHorizontal size={20} /></button>
          </div>
        </header>

        <main className={`document-stage mode-${viewMode} manuscript-width-${editorPreferences.manuscriptWidth}${outline.length > 0 ? " has-document-toc" : ""}`}>
          {outline.length > 0 && <nav className="document-toc" aria-label={t("Table of contents", "文内目录")}><div className="document-toc-inner"><span>{t("Contents", "目录")}</span>{outline.map((item, index) => <button type="button" key={`${item.id}-${index}`} className={`toc-level-${item.level}${activeOutlineId === item.id ? " active" : ""}`} onClick={() => navigateToOutline(item)} title={item.text}>{item.text}</button>)}</div></nav>}
          {(viewMode === "live" || viewMode === "source" || viewMode === "split") && <section className="editor-pane" aria-label={viewMode === "live" ? t("Live Markdown editor", "实时排版编辑器") : t("Markdown source editor", "Markdown 源码编辑器")}><Suspense fallback={<div className="editor-loading" aria-label={t("Preparing editor", "正在准备编辑器")}><span /><span /><span /></div>}><MarkdownEditor key={`${activeDocument.id}-${language}`} ref={editorRef} value={activeDocument.content} onChange={updateActiveContent} dark={dark} focusMode={focusMode} livePreview={viewMode === "live"} preferences={editorPreferences} onImageFile={handleImageFile} assetUrls={assetUrls} /></Suspense></section>}
          {(viewMode === "preview" || viewMode === "split") && <section className="preview-pane" aria-label={t("Reading view", "阅读视图")} onScroll={syncPreviewOutline} onDoubleClick={() => setViewMode("live")}>{activeDocument.content.trim() ? <Suspense fallback={<div className="preview-loading">{t("Typesetting…", "正在排版…")}</div>}><MarkdownPreview content={activeDocument.content} onNavigate={navigateDocumentLink} assetUrls={assetUrls} /></Suspense> : <div className="empty-document"><div className="empty-caret" aria-hidden="true" /><h1>{t("Begin a document", "开始一篇文稿")}</h1><p>{t("The title can become the file name, and you can change it later.", "标题会自动成为文件的名字，也可以稍后修改。")}</p><button type="button" onClick={() => setViewMode("live")}><Pencil size={17} />{t("Start writing", "开始写作")}</button></div>}</section>}
          {(viewMode === "live" || viewMode === "source" || viewMode === "split") && <div className="format-dock" role="toolbar" aria-label={t("Markdown formatting", "Markdown 格式")}><div className="popover-anchor insert-anchor" data-popover-root><button className={`dock-add${insertMenuOpen ? " active" : ""}`} type="button" onClick={() => setInsertMenuOpen((current) => !current)} aria-label={t("Insert", "插入内容")} aria-expanded={insertMenuOpen}><Plus size={19} /></button>{insertMenuOpen && <div className="insert-menu" role="menu" aria-label={t("Insert", "插入内容")} onKeyDown={navigateMenu}>{insertActions.map((item) => { const Icon = item.icon; return <button type="button" role="menuitem" key={item.label} onClick={() => { item.run(); setInsertMenuOpen(false); }}><Icon size={18} /><span>{item.label}</span></button>; })}</div>}</div><span className="dock-divider" /><button type="button" onClick={() => editorRef.current?.surround("**", "**", t("bold text", "粗体文字"))} aria-label={t("Bold", "粗体")} title={t("Bold", "粗体")}><Bold size={18} /></button><button type="button" onClick={() => editorRef.current?.surround("*", "*", t("italic text", "斜体文字"))} aria-label={t("Italic", "斜体")} title={t("Italic", "斜体")}><Italic size={18} /></button><button type="button" onClick={() => editorRef.current?.surround("[", "](https://)", t("link text", "链接文字"))} aria-label={t("Link", "链接")} title={t("Link", "链接")}><Link size={18} /></button><button type="button" onClick={() => editorRef.current?.surround("`", "`", "code")} aria-label={t("Inline code", "行内代码")} title={t("Inline code", "行内代码")}><Code2 size={18} /></button><button type="button" onClick={() => imageInputRef.current?.click()} aria-label={t("Insert local image", "插入本地图片")} title={t("Insert local image", "插入本地图片")}><Image size={18} /></button><span className="dock-divider" /><button type="button" onClick={() => editorRef.current?.prefixLine("- ")} aria-label={t("Bulleted list", "列表")} title={t("Bulleted list", "无序列表")}><List size={18} /></button><button type="button" onClick={() => editorRef.current?.prefixLine("- [ ] ")} aria-label={t("Task list", "任务")} title={t("Task list", "任务列表")}><ListChecks size={18} /></button><input ref={imageInputRef} className="visually-hidden" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImageFile(file).then((path) => path && editorRef.current?.insert(`![${file.name.replace(/\.[^.]+$/, "") || t("image", "图片")}](${path})`)); event.currentTarget.value = ""; }} /></div>}
          <footer className="document-status" aria-label={t("Document statistics", "文档统计")}><span>{stats.words.toLocaleString(locale)} {t("words", "字词")}</span><span>{stats.characters.toLocaleString(locale)} {t("characters", "字符")}</span><span>{t(`about ${stats.minutes} min`, `约 ${stats.minutes} 分钟`)}</span><span className="status-spacer" /><span>{viewMode === "live" ? t("Live", "实时排版") : viewMode === "source" ? "Markdown" : viewMode === "preview" ? t("Reading", "阅读") : t("Split", "对照")}</span></footer>
        </main>
      </section>

      {inspectorOpen && <aside className="inspector-rail" aria-label={t("Document inspector", "文档检查器")}>
        <div className="inspector-header"><div className="inspector-tabs" role="tablist" aria-label={t("Inspector pages", "检查器页面")} onKeyDown={navigateInspectorTabs}><button id="outline-tab" role="tab" aria-selected={inspectorTab === "outline"} aria-controls="outline-panel" tabIndex={inspectorTab === "outline" ? 0 : -1} className={inspectorTab === "outline" ? "active" : ""} type="button" onClick={() => setInspectorTab("outline")}>{t("Outline", "大纲")}</button><button id="links-tab" role="tab" aria-selected={inspectorTab === "links"} aria-controls="links-panel" tabIndex={inspectorTab === "links" ? 0 : -1} className={inspectorTab === "links" ? "active" : ""} type="button" onClick={() => setInspectorTab("links")}>{t("Links", "链接")}</button><button id="info-tab" role="tab" aria-selected={inspectorTab === "info"} aria-controls="info-panel" tabIndex={inspectorTab === "info" ? 0 : -1} className={inspectorTab === "info" ? "active" : ""} type="button" onClick={() => setInspectorTab("info")}>{t("Document", "文稿")}</button></div><button className="icon-button" type="button" onClick={() => setInspectorOpen(false)} aria-label={t("Close inspector", "关闭检查器")}><X size={17} /></button></div>
        {inspectorTab === "outline" ? <nav id="outline-panel" role="tabpanel" aria-labelledby="outline-tab" className="outline-nav">{outline.map((item, index) => <button type="button" key={`${item.id}-${index}`} className={`outline-level-${item.level}`} onClick={() => navigateToOutline(item)}>{item.text}</button>)}{!outline.length && <div className="inspector-empty"><Info size={20} /><p>{t("Add headings to generate an outline.", "添加标题后，大纲会在这里自动生成。")}</p></div>}</nav> : inspectorTab === "links" ? <div id="links-panel" role="tabpanel" aria-labelledby="links-tab" className="links-panel"><section><span>{t("Backlinks", "引用本文")} · {backlinks.length}</span>{backlinks.map((item) => <button type="button" key={item.id} onClick={() => selectDocument(item.id)}><Link2 size={14} /><span>{withoutExtension(item.name)}</span></button>)}{!backlinks.length && <p>{t("No other documents link here yet.", "还没有其他文稿链接到这里。")}</p>}</section><section><span>{t("Links in this document", "本文链接")} · {outgoingLinks.length}</span>{outgoingLinks.map((item, index) => <button type="button" className={item.ambiguous ? "ambiguous" : item.broken ? "broken" : ""} key={`${item.href}-${index}`} title={item.candidates?.join("\n")} onClick={() => navigateDocumentLink(item.href)}><Link size={14} /><span><strong>{item.label}</strong><small>{item.ambiguous ? t(`Ambiguous · ${item.candidates?.length ?? 0} matching files`, `目标不唯一 · ${item.candidates?.length ?? 0} 个同名文件`) : item.broken ? t(`Broken · ${item.href}`, `失效 · ${item.href}`) : item.href}</small></span></button>)}{!outgoingLinks.length && <p>{t("Use `[Title](file.md)` to connect documents.", "使用 `[标题](文件.md)` 建立文稿关系。")}</p>}</section></div> : <div id="info-panel" role="tabpanel" aria-labelledby="info-tab" className="document-info"><section><span>{t("Statistics", "统计")}</span><dl><div><dt>{t("Words", "字词")}</dt><dd>{stats.words.toLocaleString(locale)}</dd></div><div><dt>{t("Characters", "字符")}</dt><dd>{stats.characters.toLocaleString(locale)}</dd></div><div><dt>{t("Reading", "阅读")}</dt><dd>{t(`${stats.minutes} min`, `${stats.minutes} 分钟`)}</dd></div></dl></section><section><span>{t("File", "文件")}</span><dl><div><dt>{t("Name", "名称")}</dt><dd>{activeDocument.name}</dd></div>{activeDocument.path && <div><dt>{t("Path", "路径")}</dt><dd>{activeDocument.path}</dd></div>}<div><dt>{t("Source", "来源")}</dt><dd>{activeDocument.source === "local" ? t("Local file", "本地文件") : activeDocument.source === "sample" ? t("Sample", "示例") : t("Recovery draft", "恢复草稿")}</dd></div>{activeDocument.source === "local" && <div><dt>{t("Connection", "连接")}</dt><dd>{activeHandleAccess === "granted" ? t("Read/write; watching external changes", "可读写并监测外部修改") : activeHandleAccess === "prompt" ? t("Authorization required on save", "保存时需要授权") : activeHandleAccess === "denied" ? t("Permission denied", "权限已关闭") : t("Reconnect required", "需要重新定位")}</dd></div>}<div><dt>{t("Format", "格式")}</dt><dd>Markdown · UTF-8</dd></div></dl></section><button className="theme-row" type="button" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /><span><strong>{t("Editor settings", "编辑器设置")}</strong><small>{editorPreferences.manuscriptFontSize} px · {theme === "system" ? t("System", "跟随系统") : theme === "light" ? t("Light", "浅色") : t("Dark", "深色")}</small></span><ChevronRight size={15} /></button><button className="theme-row" type="button" onClick={() => setHistoryOpen(true)}><Clock3 size={18} /><span><strong>{t("Version history", "版本记录")}</strong><small>{t(`${versions.filter((item) => item.documentId === activeDocument.id).length} local versions`, `${versions.filter((item) => item.documentId === activeDocument.id).length} 个本地版本`)}</small></span><ChevronRight size={15} /></button></div>}
      </aside>}

      {paletteOpen && <div className="palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}><section ref={paletteRef} className="command-palette" role="dialog" aria-modal="true" aria-label={t("Command palette", "命令面板")} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setPaletteIndex((current) => commands.length ? (current + 1) % commands.length : 0); } else if (event.key === "ArrowUp") { event.preventDefault(); setPaletteIndex((current) => commands.length ? (current - 1 + commands.length) % commands.length : 0); } else if (event.key === "Enter" && commands[paletteIndex]) { event.preventDefault(); const command = commands[paletteIndex]; setPaletteOpen(false); window.setTimeout(command.run, 0); } }}><label className="palette-search"><Search size={18} /><input autoFocus value={paletteSearch} onChange={(event) => { setPaletteSearch(event.target.value); setPaletteIndex(0); }} placeholder={t("Search commands and actions", "搜索命令与操作")} aria-activedescendant={commands[paletteIndex] ? `palette-command-${paletteIndex}` : undefined} /><kbd>esc</kbd></label><div className="palette-results" role="listbox" aria-label={t("Command results", "命令结果")}>{commands.map((item, index) => { const Icon = item.icon; return <button id={`palette-command-${index}`} role="option" aria-selected={index === paletteIndex} key={item.label} className={index === paletteIndex ? "suggested" : ""} type="button" onMouseEnter={() => setPaletteIndex(index)} onClick={() => { setPaletteOpen(false); window.setTimeout(item.run, 0); }}><Icon size={18} /><span>{item.label}</span>{item.hint && <kbd>{item.hint}</kbd>}</button>; })}{!commands.length && <p>{t("No matching commands", "没有匹配的命令")}</p>}</div></section></div>}
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={importFiles} onChooseNativeFiles={desktopApp ? chooseDesktopFiles : undefined} onChooseNativeFolder={desktopApp ? chooseDesktopFolder : undefined} />
      <TemplateDialog open={templateOpen} templates={builtInTemplates} onClose={() => setTemplateOpen(false)} onCreate={createDocument} />
      <HistoryDialog open={historyOpen} document={activeDocument} versions={versions.filter((item) => item.documentId === activeDocument.id)} onClose={() => setHistoryOpen(false)} onRestore={restoreVersion} onNameVersion={saveNamedVersion} />
      <TrashDialog open={trashOpen} entries={trash} onClose={() => setTrashOpen(false)} onRestore={restoreTrashEntry} onDelete={deleteTrashEntry} />
      <SettingsDialog open={settingsOpen} preferences={editorPreferences} theme={theme} defaultDirectoryName={defaultDirectoryName} defaultDirectoryAccess={defaultDirectoryAccess} canChooseDirectory={desktopApp || Boolean(window.showDirectoryPicker)} onClose={() => setSettingsOpen(false)} onChange={setEditorPreferences} onThemeChange={setTheme} onReset={() => setEditorPreferences(defaultEditorPreferences)} onChooseDirectory={() => void chooseDefaultDocumentDirectory()} onClearDirectory={clearDefaultDocumentDirectory} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} onOpenRepository={() => void openExternal(REPOSITORY_URL)} onFeedback={() => void openExternal(FEEDBACK_URL)} />
      <ConfirmDialog open={Boolean(pendingDelete)} title={pendingDelete?.kind === "category" ? t(`Delete category “${categories.find((item) => item.id === pendingDelete.id)?.name ?? ""}”?`, `删除分类“${categories.find((item) => item.id === pendingDelete.id)?.name ?? ""}”？`) : t(`Move “${withoutExtension(documents.find((item) => item.id === pendingDelete?.id)?.name ?? "Document")}” to Recently Deleted?`, `把“${withoutExtension(documents.find((item) => item.id === pendingDelete?.id)?.name ?? "文稿")}”移到最近删除？`)} description={pendingDelete?.kind === "category" ? t("The category and its subcategories will be removed. Their documents return to Uncategorized.", "分类和子分类会被移除，其中的文稿会回到未分类。") : documents.find((item) => item.id === pendingDelete?.id)?.source === "local" ? t("Only the Manuslate library record is removed. The original file stays on your computer.", "只移除 Manuslate 中的记录，电脑上的原文件不会被删除。") : t("The document stays in Recently Deleted and can be restored later.", "文稿会保留在最近删除中，可以稍后恢复。")} confirmLabel={pendingDelete?.kind === "category" ? t("Delete category", "删除分类") : t("Move to Recently Deleted", "移到最近删除")} onClose={() => setPendingDelete(null)} onConfirm={confirmPendingDelete} />
      <ConflictDialog conflict={fileConflict} document={documents.find((item) => item.id === fileConflict?.documentId) ?? activeDocument} onClose={() => setFileConflict(null)} onUseDisk={useDiskConflict} onOverwrite={() => void overwriteDiskConflict()} />
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}

export default App;
