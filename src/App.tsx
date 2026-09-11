import {
  Bold, BookOpen, Check, ChevronDown, ChevronRight, Code2, Columns2, Copy, Download, Eye,
  FileCode2, FilePlus2, Focus, Heading1, Heading2, Info, Italic, Link, List,
  Import, ListChecks, ListOrdered, Menu, MoreHorizontal, PanelRight, Pencil, Plus, Printer, Quote,
  Save, Search, Share, Sparkles, SunMoon, Table2, TextCursorInput, X,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MarkdownEditorHandle } from "./editor/MarkdownEditor";
import ImportDialog, { type ImportCandidate } from "./library/ImportDialog";
import LibraryTree from "./library/LibraryTree";
import { getOutline, getWordStats } from "./lib/document";
import {
  loadActiveDocumentId, loadCategories, loadDocuments, loadTheme, loadViewMode, saveActiveDocumentId,
  saveCategories, saveDocuments, saveTheme, saveViewMode,
} from "./lib/storage";
import type { LibraryCategory, MarkdownDocument, ThemeMode, ViewMode } from "./types";

const MarkdownEditor = lazy(() => import("./editor/MarkdownEditor"));
const MarkdownPreview = lazy(() => import("./editor/MarkdownPreview"));

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

function App() {
  const initialDocuments = useMemo(loadDocuments, []);
  const initialCategories = useMemo(loadCategories, []);
  const [documents, setDocuments] = useState<MarkdownDocument[]>(initialDocuments);
  const [categories, setCategories] = useState<LibraryCategory[]>(initialCategories);
  const [activeId, setActiveId] = useState(() => {
    const stored = loadActiveDocumentId();
    return initialDocuments.some((item) => item.id === stored) ? stored! : initialDocuments[0].id;
  });
  const [viewMode, setViewModeState] = useState<ViewMode>(loadViewMode);
  const [theme, setThemeState] = useState<ThemeMode>(loadTheme);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [isCompact, setIsCompact] = useState(() => window.innerWidth < 900);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 900);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"outline" | "info">("outline");
  const [focusMode, setFocusMode] = useState(false);
  const [documentSearch, setDocumentSearch] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [draftState, setDraftState] = useState<"saving" | "saved">("saved");
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const paletteRef = useRef<HTMLElement>(null);
  const paletteReturnFocusRef = useRef<HTMLElement | null>(null);
  const handlesRef = useRef(new Map<string, FileSystemFileHandle>());
  const savedSnapshotsRef = useRef(new Map(initialDocuments.map((item) => [item.id, item.content])));

  const activeDocument = documents.find((item) => item.id === activeId) ?? documents[0];
  const outline = useMemo(() => getOutline(activeDocument?.content ?? ""), [activeDocument?.content]);
  const stats = useMemo(() => getWordStats(activeDocument?.content ?? ""), [activeDocument?.content]);
  const dark = theme === "dark" || (theme === "system" && systemDark);
  const isDiskDirty = activeDocument ? savedSnapshotsRef.current.get(activeDocument.id) !== activeDocument.content : false;
  const activeHandleName = activeDocument ? handlesRef.current.get(activeDocument.id)?.name : undefined;
  const hasDisplayName = Boolean(activeHandleName && activeHandleName !== activeDocument?.name);
  const activeView = viewOptions.find((item) => item.mode === viewMode) ?? viewOptions[0];
  const ActiveViewIcon = activeView.icon;

  const saveStateLabel = draftState === "saving"
    ? "正在存入恢复草稿…"
    : activeDocument?.source === "sample"
      ? "示例文稿 · 已存入恢复草稿"
      : activeDocument?.source === "local" && activeHandleName
        ? isDiskDirty
          ? `尚未写入 ${activeHandleName}`
          : hasDisplayName
            ? `已写入 ${activeHandleName} · 当前为显示名`
            : `已写入 ${activeHandleName}`
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
    const next = event.key === "ArrowLeft" || event.key === "Home" ? "outline" : "info";
    setInspectorTab(next);
    window.setTimeout(() => document.getElementById(`${next}-tab`)?.focus(), 0);
  }, []);

  const openPalette = useCallback(() => {
    paletteReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dismissMenus(); setPaletteSearch(""); setPaletteOpen(true);
  }, [dismissMenus]);

  const setViewMode = useCallback((mode: ViewMode) => {
    const effectiveMode = mode === "split" && isCompact ? "preview" : mode;
    if (mode === "split" && isCompact) notify("对照视图适合宽屏，已切换到阅读");
    setViewModeState(effectiveMode); saveViewMode(effectiveMode);
    if (effectiveMode === "preview") setFocusMode(false);
    dismissMenus();
  }, [dismissMenus, isCompact, notify]);

  const updateActiveContent = useCallback((content: string) => {
    setDraftState("saving");
    setDocuments((current) => current.map((item) => item.id === activeId ? {
      ...item, content, source: item.source === "sample" ? "draft" : item.source, updatedAt: Date.now(),
    } : item));
  }, [activeId]);

  const selectDocument = useCallback((id: string) => {
    setActiveId(id); saveActiveDocumentId(id); dismissMenus();
    if (window.innerWidth < 900) setSidebarOpen(false);
  }, [dismissMenus]);

  const createDocument = useCallback(() => {
    const count = documents.filter((item) => item.name.startsWith("未命名")).length + 1;
    const item = createUntitled(count);
    savedSnapshotsRef.current.set(item.id, item.content);
    setDocuments((current) => [item, ...current]); setActiveId(item.id); saveActiveDocumentId(item.id);
    setViewMode("live"); setSidebarOpen(window.innerWidth >= 900);
    window.setTimeout(() => editorRef.current?.focus(), 0);
  }, [documents, setViewMode]);

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

    const opened = await Promise.all(files.map(async ({ file, handle, relativePath, categoryName }) => {
      const content = await file.text();
      const item: MarkdownDocument = {
        id: uniqueId(), name: file.name, content, source: "local", path: relativePath,
        categoryId: categoryName ? categoryIds.get(categoryName.toLocaleLowerCase()) : undefined,
        createdAt: file.lastModified || Date.now(), updatedAt: file.lastModified || Date.now(),
      };
      if (handle) handlesRef.current.set(item.id, handle);
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

  const createCategory = useCallback((name: string) => {
    if (categories.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { notify("已经有同名分类"); return; }
    setCategories((current) => [...current, { id: uniqueId(), name, createdAt: Date.now() }]);
  }, [categories, notify]);

  const renameCategory = useCallback((id: string, name: string) => {
    if (categories.some((item) => item.id !== id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { notify("已经有同名分类"); return; }
    setCategories((current) => current.map((item) => item.id === id ? { ...item, name } : item));
  }, [categories, notify]);

  const deleteCategory = useCallback((id: string) => {
    setCategories((current) => current.filter((item) => item.id !== id));
    setDocuments((current) => current.map((item) => item.categoryId === id ? { ...item, categoryId: undefined } : item));
    notify("分类已删除，文稿已移到未分类");
  }, [notify]);

  const moveDocument = useCallback((documentId: string, categoryId?: string) => {
    setDocuments((current) => current.map((item) => item.id === documentId ? { ...item, categoryId } : item));
  }, []);

  const saveActive = useCallback(async () => {
    if (!activeDocument) return;
    try {
      let handle = handlesRef.current.get(activeDocument.id);
      const hadHandle = Boolean(handle);
      if (!handle && window.showSaveFilePicker) {
        handle = await window.showSaveFilePicker({
          suggestedName: activeDocument.name.endsWith(".md") ? activeDocument.name : `${activeDocument.name}.md`,
          types: markdownFileTypes,
        });
        handlesRef.current.set(activeDocument.id, handle);
      }
      if (handle) {
        const writable = await handle.createWritable(); await writable.write(activeDocument.content); await writable.close();
        setDocuments((current) => current.map((item) => item.id === activeDocument.id ? { ...item, name: hadHandle ? item.name : handle!.name, source: "local" } : item));
      } else {
        const url = URL.createObjectURL(new Blob([activeDocument.content], { type: "text/markdown;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url;
        link.download = activeDocument.name.endsWith(".md") ? activeDocument.name : `${activeDocument.name}.md`;
        link.click(); URL.revokeObjectURL(url);
      }
      savedSnapshotsRef.current.set(activeDocument.id, activeDocument.content); notify("已写入本地文件");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify("保存失败，请重试");
    }
  }, [activeDocument, notify]);

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
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    const timeout = window.setTimeout(() => { saveDocuments(documents); setDraftState("saved"); }, 380);
    return () => window.clearTimeout(timeout);
  }, [documents]);
  useEffect(() => { saveCategories(categories); }, [categories]);

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
      else if (event.key === "1") { event.preventDefault(); setViewMode("live"); }
      else if (event.key === "2") { event.preventDefault(); setViewMode("preview"); }
      else if (event.key === "3") { event.preventDefault(); setViewMode("source"); }
      else if (event.key === "4") { event.preventDefault(); setViewMode("split"); }
      else if (event.shiftKey && event.key.toLowerCase() === "f") { event.preventDefault(); setViewMode("live"); setFocusMode((current) => !current); }
    };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, [createDocument, dismissMenus, openPalette, saveActive, setViewMode]);

  const filteredDocuments = useMemo(() => {
    const query = documentSearch.trim().toLocaleLowerCase();
    return [...documents].filter((item) => !query || item.name.toLocaleLowerCase().includes(query) || item.content.toLocaleLowerCase().includes(query)).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [documentSearch, documents]);

  const commands = [
    { label: "新建文稿", hint: "⌘N", icon: FilePlus2, run: createDocument },
    { label: "导入 Markdown", hint: "⌘O", icon: Import, run: () => setImportOpen(true) },
    { label: "写入本地文件", hint: "⌘S", icon: Save, run: () => void saveActive() },
    { label: "实时排版", hint: "⌘1", icon: TextCursorInput, run: () => setViewMode("live") },
    { label: "阅读视图", hint: "⌘2", icon: Eye, run: () => setViewMode("preview") },
    { label: "Markdown 源码", hint: "⌘3", icon: FileCode2, run: () => setViewMode("source") },
    ...(!isCompact ? [{ label: "并排对照", hint: "⌘4", icon: Columns2, run: () => setViewMode("split") }] : []),
    { label: focusMode ? "退出专注模式" : "进入专注模式", hint: "⌘⇧F", icon: Focus, run: () => { setViewMode("live"); setFocusMode((current) => !current); } },
    { label: inspectorOpen ? "关闭检查器" : "打开检查器", hint: "", icon: PanelRight, run: () => setInspectorOpen((current) => !current) },
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

  return (
    <div className={`app-shell${sidebarOpen ? " has-sidebar" : ""}${inspectorOpen ? " has-inspector" : ""}`} onMouseDown={(event) => {
      if ((event.target as HTMLElement).closest("[data-popover-root]")) return;
      dismissMenus();
    }}>
      {sidebarOpen && <button className="mobile-scrim" aria-label="关闭文稿列表" onClick={() => setSidebarOpen(false)} />}

      <aside className="library-rail" aria-label="文稿列表">
        <div className="library-nav"><button className="icon-button compose-button" type="button" onClick={createDocument} aria-label="新建文稿" title="新建文稿 ⌘N"><FilePlus2 size={19} /></button></div>
        <div className="library-heading"><h1>文稿</h1><p>本机草稿与打开的文件</p></div>
        <label className="library-search"><Search size={15} aria-hidden="true" /><span className="visually-hidden">搜索文稿</span><input value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder="搜索" />{documentSearch && <button type="button" onClick={() => setDocumentSearch("")} aria-label="清除搜索"><X size={13} /></button>}</label>
        <LibraryTree documents={filteredDocuments} categories={categories} activeId={activeDocument.id} searching={Boolean(documentSearch.trim())} onSelect={selectDocument} onCreateCategory={createCategory} onRenameCategory={renameCategory} onDeleteCategory={deleteCategory} onMoveDocument={moveDocument} />
        <div className="library-footer"><button type="button" onClick={() => setImportOpen(true)}><Import size={18} /><span>导入文件</span><kbd>⌘O</kbd></button></div>
      </aside>

      <section className="workspace">
        <header className="titlebar">
          <div className="titlebar-left"><button className="icon-button" type="button" onClick={() => setSidebarOpen((current) => !current)} aria-label={sidebarOpen ? "隐藏文稿列表" : "显示文稿列表"} title="文稿列表"><Menu size={20} /></button></div>
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

        <main className={`document-stage mode-${viewMode}`}>
          {(viewMode === "live" || viewMode === "source" || viewMode === "split") && <section className="editor-pane" aria-label={viewMode === "live" ? "实时排版编辑器" : "Markdown 源码编辑器"}><Suspense fallback={<div className="editor-loading" aria-label="正在准备编辑器"><span /><span /><span /></div>}><MarkdownEditor key={activeDocument.id} ref={editorRef} value={activeDocument.content} onChange={updateActiveContent} dark={dark} focusMode={focusMode} livePreview={viewMode === "live"} /></Suspense></section>}
          {(viewMode === "preview" || viewMode === "split") && <section className="preview-pane" aria-label="阅读视图" onDoubleClick={() => setViewMode("live")}>{activeDocument.content.trim() ? <Suspense fallback={<div className="preview-loading">正在排版…</div>}><MarkdownPreview content={activeDocument.content} /></Suspense> : <div className="empty-document"><div className="empty-caret" aria-hidden="true" /><h1>开始一篇文稿</h1><p>标题会自动成为文件的名字，也可以稍后修改。</p><button type="button" onClick={() => setViewMode("live")}><Pencil size={17} />开始写作</button></div>}</section>}
          {(viewMode === "live" || viewMode === "source" || viewMode === "split") && <div className="format-dock" role="toolbar" aria-label="Markdown 格式"><div className="popover-anchor insert-anchor" data-popover-root><button className={`dock-add${insertMenuOpen ? " active" : ""}`} type="button" onClick={() => setInsertMenuOpen((current) => !current)} aria-label="插入内容" aria-expanded={insertMenuOpen}><Plus size={19} /></button>{insertMenuOpen && <div className="insert-menu" role="menu" aria-label="插入内容" onKeyDown={navigateMenu}>{insertActions.map((item) => { const Icon = item.icon; return <button type="button" role="menuitem" key={item.label} onClick={() => { item.run(); setInsertMenuOpen(false); }}><Icon size={18} /><span>{item.label}</span></button>; })}</div>}</div><span className="dock-divider" /><button type="button" onClick={() => editorRef.current?.surround("**", "**", "粗体文字")} aria-label="粗体" title="粗体"><Bold size={18} /></button><button type="button" onClick={() => editorRef.current?.surround("*", "*", "斜体文字")} aria-label="斜体" title="斜体"><Italic size={18} /></button><button type="button" onClick={() => editorRef.current?.surround("[", "](https://)", "链接文字")} aria-label="链接" title="链接"><Link size={18} /></button><button type="button" onClick={() => editorRef.current?.surround("`", "`", "code")} aria-label="行内代码" title="行内代码"><Code2 size={18} /></button><span className="dock-divider" /><button type="button" onClick={() => editorRef.current?.prefixLine("- ")} aria-label="列表" title="无序列表"><List size={18} /></button><button type="button" onClick={() => editorRef.current?.prefixLine("- [ ] ")} aria-label="任务" title="任务列表"><ListChecks size={18} /></button></div>}
          <footer className="document-status" aria-label="文档统计"><span>{stats.words.toLocaleString("zh-CN")} 字词</span><span>{stats.characters.toLocaleString("zh-CN")} 字符</span><span>约 {stats.minutes} 分钟</span><span className="status-spacer" /><span>{viewMode === "live" ? "实时排版" : viewMode === "source" ? "Markdown" : viewMode === "preview" ? "阅读" : "对照"}</span></footer>
        </main>
      </section>

      <aside className="inspector-rail" aria-label="文档检查器"><div className="inspector-header"><div className="inspector-tabs" role="tablist" aria-label="检查器页面" onKeyDown={navigateInspectorTabs}><button id="outline-tab" role="tab" aria-selected={inspectorTab === "outline"} aria-controls="outline-panel" tabIndex={inspectorTab === "outline" ? 0 : -1} className={inspectorTab === "outline" ? "active" : ""} type="button" onClick={() => setInspectorTab("outline")}>大纲</button><button id="info-tab" role="tab" aria-selected={inspectorTab === "info"} aria-controls="info-panel" tabIndex={inspectorTab === "info" ? 0 : -1} className={inspectorTab === "info" ? "active" : ""} type="button" onClick={() => setInspectorTab("info")}>文稿</button></div><button className="icon-button" type="button" onClick={() => setInspectorOpen(false)} aria-label="关闭检查器"><X size={17} /></button></div>{inspectorTab === "outline" ? <nav id="outline-panel" role="tabpanel" aria-labelledby="outline-tab" className="outline-nav">{outline.map((item, index) => <button type="button" key={`${item.id}-${index}`} className={`outline-level-${item.level}`} onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}>{item.text}</button>)}{!outline.length && <div className="inspector-empty"><Info size={20} /><p>添加标题后，大纲会在这里自动生成。</p></div>}</nav> : <div id="info-panel" role="tabpanel" aria-labelledby="info-tab" className="document-info"><section><span>统计</span><dl><div><dt>字词</dt><dd>{stats.words.toLocaleString("zh-CN")}</dd></div><div><dt>字符</dt><dd>{stats.characters.toLocaleString("zh-CN")}</dd></div><div><dt>阅读</dt><dd>{stats.minutes} 分钟</dd></div></dl></section><section><span>文件</span><dl><div><dt>名称</dt><dd>{activeDocument.name}</dd></div><div><dt>来源</dt><dd>{activeDocument.source === "local" ? "本地文件" : activeDocument.source === "sample" ? "示例" : "恢复草稿"}</dd></div><div><dt>格式</dt><dd>Markdown · UTF-8</dd></div></dl></section><button className="theme-row" type="button" onClick={cycleTheme}><SunMoon size={18} /><span><strong>外观</strong><small>{theme === "system" ? "跟随系统" : theme === "light" ? "浅色" : "深色"}</small></span><ChevronRight size={15} /></button></div>}</aside>

      {paletteOpen && <div className="palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}><section ref={paletteRef} className="command-palette" role="dialog" aria-modal="true" aria-label="命令面板"><label className="palette-search"><Search size={18} /><input autoFocus value={paletteSearch} onChange={(event) => setPaletteSearch(event.target.value)} placeholder="搜索命令与操作" /><kbd>esc</kbd></label><div className="palette-results">{commands.map((item, index) => { const Icon = item.icon; return <button key={item.label} className={index === 0 ? "suggested" : ""} type="button" onClick={() => { setPaletteOpen(false); window.setTimeout(item.run, 0); }}><Icon size={18} /><span>{item.label}</span>{item.hint && <kbd>{item.hint}</kbd>}</button>; })}{!commands.length && <p>没有匹配的命令</p>}</div></section></div>}
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={importFiles} />
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}

export default App;
