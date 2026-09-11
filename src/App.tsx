import {
  Bold,
  Check,
  ChevronRight,
  Code2,
  Columns2,
  Command,
  Eye,
  FilePlus2,
  FileText,
  Focus,
  FolderOpen,
  Heading1,
  Heading2,
  Italic,
  Link,
  List,
  ListChecks,
  Menu,
  PanelRight,
  Pencil,
  Quote,
  Save,
  Search,
  SunMoon,
  X,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MarkdownEditorHandle } from "./editor/MarkdownEditor";
import { getOutline, getWordStats, renderMarkdown } from "./lib/markdown";
import {
  loadActiveDocumentId,
  loadDocuments,
  loadTheme,
  loadViewMode,
  saveActiveDocumentId,
  saveDocuments,
  saveTheme,
  saveViewMode,
} from "./lib/storage";
import type { MarkdownDocument, ThemeMode, ViewMode } from "./types";

const MarkdownEditor = lazy(() => import("./editor/MarkdownEditor"));

const markdownFileTypes = [
  {
    description: "Markdown",
    accept: { "text/markdown": [".md", ".markdown", ".mdown"], "text/plain": [".txt"] },
  },
];

function uniqueId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `document-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(timestamp);
}

function createUntitled(index: number): MarkdownDocument {
  const now = Date.now();
  return {
    id: uniqueId(),
    name: index === 1 ? "未命名.md" : `未命名 ${index}.md`,
    content: "",
    source: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

function App() {
  const initialDocuments = useMemo(loadDocuments, []);
  const [documents, setDocuments] = useState<MarkdownDocument[]>(initialDocuments);
  const [activeId, setActiveId] = useState(() => {
    const stored = loadActiveDocumentId();
    return initialDocuments.some((document) => document.id === stored) ? stored! : initialDocuments[0].id;
  });
  const [viewMode, setViewModeState] = useState<ViewMode>(loadViewMode);
  const [theme, setThemeState] = useState<ThemeMode>(loadTheme);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [isCompact, setIsCompact] = useState(() => window.innerWidth < 860);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 860);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [documentSearch, setDocumentSearch] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved">("saved");
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLElement>(null);
  const paletteReturnFocusRef = useRef<HTMLElement | null>(null);
  const handlesRef = useRef(new Map<string, FileSystemFileHandle>());
  const savedSnapshotsRef = useRef(new Map(initialDocuments.map((document) => [document.id, document.content])));

  const activeDocument = documents.find((document) => document.id === activeId) ?? documents[0];
  const rendered = useMemo(() => renderMarkdown(activeDocument?.content ?? ""), [activeDocument?.content]);
  const outline = useMemo(() => getOutline(activeDocument?.content ?? ""), [activeDocument?.content]);
  const stats = useMemo(() => getWordStats(activeDocument?.content ?? ""), [activeDocument?.content]);
  const dark = theme === "dark" || (theme === "system" && systemDark);
  const isDiskDirty = activeDocument
    ? savedSnapshotsRef.current.get(activeDocument.id) !== activeDocument.content
    : false;

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2200);
  }, []);

  const openPalette = useCallback(() => {
    paletteReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPaletteSearch("");
    setPaletteOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    const effectiveMode = mode === "split" && isCompact ? "preview" : mode;
    if (mode === "split" && isCompact) notify("分栏适合宽屏，已进入阅读");
    setViewModeState(effectiveMode);
    saveViewMode(effectiveMode);
    if (effectiveMode === "preview") setFocusMode(false);
  }, [isCompact, notify]);

  const updateActiveContent = useCallback((content: string) => {
    setDraftState("saving");
    setDocuments((current) =>
      current.map((document) =>
        document.id === activeId
          ? {
              ...document,
              content,
              source: document.source === "sample" ? "draft" : document.source,
              updatedAt: Date.now(),
            }
          : document,
      ),
    );
  }, [activeId]);

  const selectDocument = useCallback((id: string) => {
    setActiveId(id);
    saveActiveDocumentId(id);
    if (window.innerWidth < 860) setSidebarOpen(false);
  }, []);

  const createDocument = useCallback(() => {
    const untitledCount = documents.filter((document) => document.name.startsWith("未命名")).length + 1;
    const document = createUntitled(untitledCount);
    savedSnapshotsRef.current.set(document.id, document.content);
    setDocuments((current) => [document, ...current]);
    setActiveId(document.id);
    saveActiveDocumentId(document.id);
    setViewMode("write");
    setSidebarOpen(window.innerWidth >= 860);
    window.setTimeout(() => editorRef.current?.focus(), 0);
  }, [documents, setViewMode]);

  const addFiles = useCallback((files: Array<{ file: File; handle?: FileSystemFileHandle }>) => {
    if (!files.length) return;
    Promise.all(
      files.map(async ({ file, handle }) => {
        const content = await file.text();
        const document: MarkdownDocument = {
          id: uniqueId(),
          name: file.name,
          content,
          source: "local",
          createdAt: file.lastModified || Date.now(),
          updatedAt: file.lastModified || Date.now(),
        };
        if (handle) handlesRef.current.set(document.id, handle);
        savedSnapshotsRef.current.set(document.id, content);
        return document;
      }),
    ).then((opened) => {
      setDocuments((current) => {
        const names = new Set(opened.map((document) => document.name));
        return [...opened, ...current.filter((document) => !names.has(document.name))];
      });
      setActiveId(opened[0].id);
      saveActiveDocumentId(opened[0].id);
      setViewMode("preview");
      notify(opened.length === 1 ? `已打开 ${opened[0].name}` : `已打开 ${opened.length} 个文档`);
    });
  }, [notify, setViewMode]);

  const openFiles = useCallback(async () => {
    if (window.showOpenFilePicker) {
      try {
        const handles = await window.showOpenFilePicker({ multiple: true, types: markdownFileTypes });
        const files = await Promise.all(handles.map(async (handle) => ({ file: await handle.getFile(), handle })));
        addFiles(files);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    inputRef.current?.click();
  }, [addFiles]);

  const saveActive = useCallback(async () => {
    if (!activeDocument) return;
    try {
      let handle = handlesRef.current.get(activeDocument.id);
      if (!handle && window.showSaveFilePicker) {
        handle = await window.showSaveFilePicker({
          suggestedName: activeDocument.name.endsWith(".md") ? activeDocument.name : `${activeDocument.name}.md`,
          types: markdownFileTypes,
        });
        handlesRef.current.set(activeDocument.id, handle);
      }

      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(activeDocument.content);
        await writable.close();
        setDocuments((current) =>
          current.map((document) =>
            document.id === activeDocument.id ? { ...document, name: handle!.name, source: "local" } : document,
          ),
        );
      } else {
        const blob = new Blob([activeDocument.content], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = activeDocument.name.endsWith(".md") ? activeDocument.name : `${activeDocument.name}.md`;
        link.click();
        URL.revokeObjectURL(url);
      }

      savedSnapshotsRef.current.set(activeDocument.id, activeDocument.content);
      notify("已保存到本地");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify("保存失败，请重试");
    }
  }, [activeDocument, notify]);

  const cycleTheme = useCallback(() => {
    const next: ThemeMode = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setThemeState(next);
    saveTheme(next);
    notify(next === "system" ? "外观跟随系统" : next === "light" ? "已切换浅色外观" : "已切换深色外观");
  }, [notify, theme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    const onResize = () => setIsCompact(window.innerWidth < 860);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (isCompact && viewMode === "split") {
      setViewModeState("preview");
      saveViewMode("preview");
    }
  }, [isCompact, viewMode]);

  useEffect(() => {
    if (!paletteOpen) return;

    const containFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePalette();
        return;
      }
      if (event.key !== "Tab" || !paletteRef.current) return;
      const focusable = Array.from(
        paletteRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", containFocus);
    return () => {
      document.removeEventListener("keydown", containFocus);
      paletteReturnFocusRef.current?.focus();
    };
  }, [closePalette, paletteOpen]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      saveDocuments(documents);
      setDraftState("saved");
    }, 420);
    return () => window.clearTimeout(timeout);
  }, [documents]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveActive();
      } else if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        void openFiles();
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        createDocument();
      } else if (event.key === "1") {
        event.preventDefault();
        setViewMode("write");
      } else if (event.key === "2") {
        event.preventDefault();
        setViewMode("preview");
      } else if (event.key === "3") {
        event.preventDefault();
        setViewMode("split");
      } else if (event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFocusMode((current) => !current);
        setViewMode("write");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createDocument, openFiles, openPalette, saveActive, setViewMode]);

  const filteredDocuments = useMemo(() => {
    const query = documentSearch.trim().toLocaleLowerCase();
    return [...documents]
      .filter((document) => !query || document.name.toLocaleLowerCase().includes(query) || document.content.toLocaleLowerCase().includes(query))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [documentSearch, documents]);

  const commands = [
    { label: "新建文档", hint: "⌘N", icon: FilePlus2, run: createDocument },
    { label: "打开 Markdown", hint: "⌘O", icon: FolderOpen, run: () => void openFiles() },
    { label: "保存到本地", hint: "⌘S", icon: Save, run: () => void saveActive() },
    { label: "进入编辑", hint: "⌘1", icon: Pencil, run: () => setViewMode("write") },
    { label: "进入阅读", hint: "⌘2", icon: Eye, run: () => setViewMode("preview") },
    ...(!isCompact ? [{ label: "打开分栏", hint: "⌘3", icon: Columns2, run: () => setViewMode("split") }] : []),
    { label: focusMode ? "退出专注模式" : "进入专注模式", hint: "⌘⇧F", icon: Focus, run: () => { setViewMode("write"); setFocusMode((current) => !current); } },
    { label: outlineOpen ? "关闭大纲" : "打开大纲", hint: "", icon: PanelRight, run: () => setOutlineOpen((current) => !current) },
    { label: "切换外观", hint: "", icon: SunMoon, run: cycleTheme },
  ].filter((command) => command.label.toLocaleLowerCase().includes(paletteSearch.trim().toLocaleLowerCase()));

  const runPaletteCommand = (run: () => void) => {
    closePalette();
    window.setTimeout(run, 0);
  };

  if (!activeDocument) return null;

  return (
    <div className={`app-shell${sidebarOpen ? " has-sidebar" : ""}${outlineOpen ? " has-outline" : ""}`}>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain"
        multiple
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []).map((file) => ({ file })));
          event.currentTarget.value = "";
        }}
      />

      {sidebarOpen && <button className="mobile-scrim" aria-label="关闭文稿列表" onClick={() => setSidebarOpen(false)} />}

      <aside className="library-rail" aria-label="文稿列表">
        <div className="library-brand">
          <span className="brand-mark" aria-hidden="true">P</span>
          <span className="brand-name">PatchMark</span>
          <button className="icon-button quiet" type="button" onClick={createDocument} aria-label="新建文档" title="新建文档 ⌘N">
            <FilePlus2 size={18} />
          </button>
        </div>

        <label className="library-search">
          <Search size={15} aria-hidden="true" />
          <span className="visually-hidden">搜索文稿</span>
          <input value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder="搜索" />
          {documentSearch && (
            <button type="button" onClick={() => setDocumentSearch("")} aria-label="清除搜索"><X size={13} /></button>
          )}
        </label>

        <div className="rail-heading">
          <span>文稿</span>
          <span>{filteredDocuments.length}</span>
        </div>

        <div className="document-list">
          {filteredDocuments.map((document) => (
            <div className={`document-row${document.id === activeDocument.id ? " active" : ""}`} key={document.id}>
              <button className="document-select" type="button" onClick={() => selectDocument(document.id)}>
                <FileText size={16} aria-hidden="true" />
                <span className="document-copy">
                  <span className="document-name">{document.name.replace(/\.(md|markdown|mdown|txt)$/i, "")}</span>
                  <span className="document-meta">{relativeTime(document.updatedAt)}</span>
                </span>
                {document.id === activeDocument.id && <ChevronRight className="row-chevron" size={14} aria-hidden="true" />}
              </button>
            </div>
          ))}
          {!filteredDocuments.length && (
            <div className="rail-empty">没有匹配的文稿</div>
          )}
        </div>

        <div className="library-footer">
          <button type="button" onClick={() => void openFiles()}>
            <FolderOpen size={17} />
            <span>打开 Markdown</span>
            <kbd>⌘O</kbd>
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="titlebar">
          <div className="titlebar-left">
            <button className="icon-button" type="button" onClick={() => setSidebarOpen((current) => !current)} aria-label={sidebarOpen ? "隐藏文稿列表" : "显示文稿列表"} title="文稿列表">
              <Menu size={19} />
            </button>
            <div className="document-title-block">
              <div className="document-title-line">
                <span className="document-title">{activeDocument.name.replace(/\.(md|markdown|mdown|txt)$/i, "")}</span>
                {isDiskDirty && <span className="dirty-dot" title="有尚未写入文件的更改" />}
              </div>
              <span className="save-state">
                {draftState === "saving" ? "正在保存草稿…" : isDiskDirty ? "草稿已恢复 · 尚未写入文件" : "已保存"}
              </span>
            </div>
          </div>

          <div className="view-switcher" role="tablist" aria-label="显示模式">
            <button role="tab" aria-selected={viewMode === "write"} className={viewMode === "write" ? "active" : ""} type="button" onClick={() => setViewMode("write")} title="编辑 ⌘1">
              <Pencil size={14} /><span>编辑</span>
            </button>
            <button role="tab" aria-selected={viewMode === "preview"} className={viewMode === "preview" ? "active" : ""} type="button" onClick={() => setViewMode("preview")} title="阅读 ⌘2">
              <Eye size={14} /><span>阅读</span>
            </button>
            <button role="tab" aria-selected={viewMode === "split"} className={viewMode === "split" ? "active" : ""} type="button" onClick={() => setViewMode("split")} title="分栏 ⌘3">
              <Columns2 size={14} /><span>分栏</span>
            </button>
          </div>

          <div className="titlebar-actions">
            <button className={`icon-button${focusMode ? " active" : ""}`} type="button" onClick={() => { setViewMode("write"); setFocusMode((current) => !current); }} aria-label={focusMode ? "退出专注模式" : "进入专注模式"} title="专注模式 ⌘⇧F">
              <Focus size={18} />
            </button>
            <button className={`icon-button${outlineOpen ? " active" : ""}`} type="button" onClick={() => setOutlineOpen((current) => !current)} aria-label={outlineOpen ? "关闭大纲" : "打开大纲"} title="文档大纲">
              <PanelRight size={18} />
            </button>
            <button className="icon-button" type="button" onClick={cycleTheme} aria-label="切换外观" title={`外观：${theme === "system" ? "跟随系统" : theme === "light" ? "浅色" : "深色"}`}>
              <SunMoon size={18} />
            </button>
            <button className="save-button" type="button" onClick={() => void saveActive()}>
              {isDiskDirty ? <Save size={16} /> : <Check size={16} />}
              <span>{isDiskDirty ? "保存" : "已保存"}</span>
            </button>
            <button className="icon-button command-button" type="button" onClick={openPalette} aria-label="打开命令面板" title="命令 ⌘K">
              <Command size={17} />
            </button>
          </div>
        </header>

        <main className={`document-stage mode-${viewMode}`}>
          {(viewMode === "write" || viewMode === "split") && (
            <section className="editor-pane" aria-label="编辑视图">
              <Suspense fallback={<div className="editor-loading" aria-label="正在准备编辑器"><span /><span /><span /></div>}>
                <MarkdownEditor
                  key={activeDocument.id}
                  ref={editorRef}
                  value={activeDocument.content}
                  onChange={updateActiveContent}
                  dark={dark}
                  focusMode={focusMode}
                />
              </Suspense>
            </section>
          )}

          {(viewMode === "preview" || viewMode === "split") && (
            <section className="preview-pane" aria-label="阅读视图" onDoubleClick={() => setViewMode("write")}>
              {activeDocument.content.trim() ? (
                <article className="markdown-preview" dangerouslySetInnerHTML={{ __html: rendered }} />
              ) : (
                <div className="empty-document">
                  <div className="empty-caret" aria-hidden="true" />
                  <h1>空白页</h1>
                  <p>切换到编辑，写下第一行。</p>
                  <button type="button" onClick={() => setViewMode("write")}><Pencil size={16} />开始写作</button>
                </div>
              )}
            </section>
          )}

          {(viewMode === "write" || viewMode === "split") && (
            <div className="format-shelf" role="toolbar" aria-label="Markdown 格式">
              <button type="button" onClick={() => editorRef.current?.prefixLine("# ")} aria-label="一级标题" title="一级标题"><Heading1 size={17} /></button>
              <button type="button" onClick={() => editorRef.current?.prefixLine("## ")} aria-label="二级标题" title="二级标题"><Heading2 size={17} /></button>
              <span className="shelf-divider" />
              <button type="button" onClick={() => editorRef.current?.surround("**", "**", "粗体文字")} aria-label="粗体" title="粗体"><Bold size={17} /></button>
              <button type="button" onClick={() => editorRef.current?.surround("*", "*", "斜体文字")} aria-label="斜体" title="斜体"><Italic size={17} /></button>
              <button type="button" onClick={() => editorRef.current?.surround("[", "](https://)", "链接文字")} aria-label="链接" title="链接"><Link size={17} /></button>
              <button type="button" onClick={() => editorRef.current?.surround("`", "`", "code")} aria-label="行内代码" title="行内代码"><Code2 size={17} /></button>
              <span className="shelf-divider" />
              <button type="button" onClick={() => editorRef.current?.prefixLine("> ")} aria-label="引用" title="引用"><Quote size={17} /></button>
              <button type="button" onClick={() => editorRef.current?.prefixLine("- ")} aria-label="无序列表" title="无序列表"><List size={17} /></button>
              <button type="button" onClick={() => editorRef.current?.prefixLine("- [ ] ")} aria-label="任务列表" title="任务列表"><ListChecks size={17} /></button>
            </div>
          )}

          <footer className="document-status" aria-label="文档统计">
            <span>{stats.words.toLocaleString("zh-CN")} 字词</span>
            <span>{stats.characters.toLocaleString("zh-CN")} 字符</span>
            <span>约 {stats.minutes} 分钟阅读</span>
            <span className="status-spacer" />
            <span>Markdown · UTF-8</span>
          </footer>
        </main>
      </section>

      <aside className="outline-rail" aria-label="文档大纲">
        <div className="outline-header">
          <span>大纲</span>
          <button className="icon-button quiet" type="button" onClick={() => setOutlineOpen(false)} aria-label="关闭大纲"><X size={16} /></button>
        </div>
        <nav>
          {outline.map((item, index) => (
            <button
              type="button"
              key={`${item.id}-${index}`}
              className={`outline-level-${item.level}`}
              onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              {item.text}
            </button>
          ))}
          {!outline.length && <p className="outline-empty">添加标题后，大纲会出现在这里。</p>}
        </nav>
      </aside>

      {paletteOpen && (
        <div className="palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePalette(); }}>
          <section ref={paletteRef} className="command-palette" role="dialog" aria-modal="true" aria-label="命令面板">
            <label className="palette-search">
              <Search size={18} />
              <input
                autoFocus
                value={paletteSearch}
                onChange={(event) => setPaletteSearch(event.target.value)}
                placeholder="输入命令…"
              />
              <kbd>esc</kbd>
            </label>
            <div className="palette-results">
              {commands.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button key={item.label} className={index === 0 ? "suggested" : ""} type="button" onClick={() => runPaletteCommand(item.run)}>
                    <Icon size={17} />
                    <span>{item.label}</span>
                    {item.hint && <kbd>{item.hint}</kbd>}
                  </button>
                );
              })}
              {!commands.length && <p>没有匹配的命令</p>}
            </div>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status"><Check size={15} />{toast}</div>}
    </div>
  );
}

export default App;
