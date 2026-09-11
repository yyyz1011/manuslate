import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Command,
  Database,
  File,
  FileCheck2,
  FileClock,
  FileText,
  FolderOpen,
  HardDrive,
  Inbox,
  LayoutDashboard,
  Library,
  Link2Off,
  ListFilter,
  LoaderCircle,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  TriangleAlert,
  Trash2,
  Unplug,
  X,
} from "lucide-react";
import { createDemoWorkspace } from "./data/demo";
import { enrichWorkspaceIssues, matchesSearch, parseFrontmatter } from "./lib/markdown";
import {
  clearDesktopIndex,
  openLocalWorkspace,
  saveRecord,
  scanDesktopWorkspace,
  supportsDesktopIndex,
  supportsLocalWorkspace,
} from "./lib/workspace";
import type {
  AiConnectionDraft,
  FileIssue,
  IssueKind,
  MarkdownRecord,
  ScanProgress,
  ViewName,
  WorkspaceSnapshot,
} from "./types";

const CodeEditor = lazy(() =>
  import("./components/CodeEditor").then((module) => ({ default: module.CodeEditor })),
);
const MarkdownPreview = lazy(() =>
  import("./components/MarkdownPreview").then((module) => ({ default: module.MarkdownPreview })),
);
const DiffModal = lazy(() =>
  import("./components/DiffModal").then((module) => ({ default: module.DiffModal })),
);

type LibraryFilter = "all" | "issues" | "draft" | "orphan" | "duplicate";
type EditorMode = "write" | "preview" | "split";

const issueMeta: Record<IssueKind, { label: string; icon: typeof AlertCircle }> = {
  "missing-title": { label: "缺少标题", icon: FileText },
  "invalid-frontmatter": { label: "元数据错误", icon: AlertCircle },
  "broken-link": { label: "失效链接", icon: Link2Off },
  "missing-asset": { label: "资源缺失", icon: TriangleAlert },
  orphan: { label: "孤立文档", icon: Unplug },
  duplicate: { label: "重复内容", icon: Archive },
};

const railItems: Array<{ view: ViewName; label: string; icon: typeof LayoutDashboard }> = [
  { view: "overview", label: "总览", icon: LayoutDashboard },
  { view: "library", label: "资料库", icon: Library },
  { view: "inbox", label: "治理收件箱", icon: Inbox },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "刚刚";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(timestamp);
}

function AppLogo() {
  return (
    <div className="app-mark" aria-label="PatchMark">
      <span className="mark-fold" />
      <span className="mark-line first" />
      <span className="mark-line second" />
    </div>
  );
}

function StatusDot({ severity }: { severity: FileIssue["severity"] | "healthy" }) {
  return <span className={`status-dot ${severity}`} aria-label={severity} />;
}

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [view, setView] = useState<ViewName>("overview");
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [editorMode, setEditorMode] = useState<EditorMode>("write");
  const [draft, setDraft] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanError, setScanError] = useState("");
  const [notice, setNotice] = useState("");
  const [diffOpen, setDiffOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const [aiDraft, setAiDraft] = useState<AiConnectionDraft>(() => ({
    provider: "openai-compatible",
    endpoint: localStorage.getItem("patchmark.ai.endpoint") ?? "",
    model: localStorage.getItem("patchmark.ai.model") ?? "",
    apiKey: "",
  }));
  const [aiTestState, setAiTestState] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [aiTestMessage, setAiTestMessage] = useState("");

  useEffect(() => {
    createDemoWorkspace().then((snapshot) => {
      setWorkspace(snapshot);
      setSelectedId(snapshot.files[0]?.id ?? "");
    });
  }, []);

  const files = workspace?.files ?? [];
  const selected = files.find((file) => file.id === selectedId) ?? files[0];

  useEffect(() => {
    if (selected) setDraft(selected.content);
  }, [selected?.id, selected?.content]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && diffOpen) setDiffOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [diffOpen]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const allIssues = useMemo(() => files.flatMap((file) => file.issues), [files]);
  const stats = useMemo(() => {
    const wordCount = files.reduce((sum, file) => sum + file.wordCount, 0);
    const linkCount = files.reduce((sum, file) => sum + file.links.length, 0);
    const needsReview = files.filter((file) => file.issues.length > 0).length;
    const errorFiles = files.filter((file) => file.issues.some((issue) => issue.severity === "error")).length;
    return { wordCount, linkCount, needsReview, errorFiles };
  }, [files]);

  const filteredFiles = useMemo(() => {
    return files
      .filter((file) => matchesSearch(file, query))
      .filter((file) => {
        if (filter === "all") return true;
        if (filter === "issues") return file.issues.length > 0;
        if (filter === "draft") return file.status.toLowerCase() === "draft" || file.status === "未分类";
        return file.issues.some((issue) => issue.kind === filter);
      });
  }, [files, filter, query]);

  const issueGroups = useMemo(() => {
    return (Object.keys(issueMeta) as IssueKind[])
      .map((kind) => ({
        kind,
        count: files.filter((file) => file.issues.some((issue) => issue.kind === kind)).length,
      }))
      .filter((group) => group.count > 0);
  }, [files]);

  const isDirty = Boolean(selected && draft !== selected.originalContent);

  async function handleOpenWorkspace() {
    setScanError("");
    setScanProgress({ scanned: 0, currentPath: "等待选择文件夹…" });
    try {
      const snapshot = await openLocalWorkspace(setScanProgress);
      setWorkspace(snapshot);
      setSelectedId(snapshot.files[0]?.id ?? "");
      setView("overview");
      setNotice(
        `已只读盘点 ${snapshot.files.length} 份 Markdown${snapshot.index ? "，本地索引已更新" : ""}。${snapshot.warnings?.length ? `另有 ${snapshot.warnings.length} 项扫描提示。` : ""}`,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setScanError(error instanceof Error ? error.message : "打开资料库失败，原文件没有被修改。");
    } finally {
      setScanProgress(null);
    }
  }

  async function reloadDemo() {
    const snapshot = await createDemoWorkspace();
    setWorkspace(snapshot);
    setSelectedId(snapshot.files[0]?.id ?? "");
    setView("overview");
    setNotice("示例资料库已重置。");
  }

  async function rebuildDesktopIndex() {
    const currentWorkspace = workspace;
    if (!currentWorkspace?.root || currentWorkspace.source !== "desktop") return;
    setScanError("");
    setScanProgress({ scanned: 0, currentPath: "正在重建本地索引…" });
    try {
      const snapshot = await scanDesktopWorkspace(currentWorkspace.root, setScanProgress);
      setWorkspace(snapshot);
      setSelectedId((current) => snapshot.files.some((file) => file.id === current) ? current : (snapshot.files[0]?.id ?? ""));
      setNotice(`本地 SQLite 索引已重建，共 ${snapshot.files.length} 份 Markdown。`);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "重建本地索引失败，Markdown 原文件没有被修改。");
    } finally {
      setScanProgress(null);
    }
  }

  async function clearIndex() {
    const currentWorkspace = workspace;
    if (!currentWorkspace?.root || currentWorkspace.source !== "desktop") return;
    const confirmed = window.confirm("只清空当前资料库的本地 SQLite 索引。Markdown 原文件不会被删除或修改，是否继续？");
    if (!confirmed) return;
    try {
      const index = await clearDesktopIndex(currentWorkspace.root);
      setWorkspace({ ...currentWorkspace, index });
      setNotice("本地索引已清空，Markdown 原文件未改变。需要时可以重新建立。");
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "清空本地索引失败。Markdown 原文件没有被修改。");
    }
  }

  function openFile(file: MarkdownRecord) {
    if (isDirty && selected && file.id !== selected.id) {
      const shouldDiscard = window.confirm("当前文件有未保存修改。切换文件会丢弃这些修改，是否继续？");
      if (!shouldDiscard) return;
    }
    setSelectedId(file.id);
    setView("editor");
  }

  function requestSave() {
    if (!selected || !isDirty) return;
    setSaveError("");
    setDiffOpen(true);
  }

  async function confirmSave() {
    if (!workspace || !selected) return;
    setSaving(true);
    setSaveError("");
    try {
      const saved = await saveRecord(selected, draft);
      const nextFiles = enrichWorkspaceIssues(
        workspace.files.map((file) => (file.id === saved.id ? saved : file)),
      );
      setWorkspace({ ...workspace, files: nextFiles, scannedAt: Date.now() });
      setDiffOpen(false);
      setNotice(workspace.source === "demo" ? "示例文档已更新（未写入磁盘）。" : "文件已安全写入原目录。");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存失败，原文件没有被修改。");
    } finally {
      setSaving(false);
    }
  }

  function navigate(next: ViewName) {
    setView(next);
    if (next === "library") setFilter("all");
  }

  function inspectIssue(kind: IssueKind) {
    setFilter(kind === "orphan" || kind === "duplicate" ? kind : "issues");
    setView("library");
  }

  async function testAiConnection() {
    const endpoint = aiDraft.endpoint.trim().replace(/\/$/, "");
    if (!endpoint) {
      setAiTestState("error");
      setAiTestMessage("请先填写接入点。");
      return;
    }
    setAiTestState("testing");
    setAiTestMessage("");
    try {
      const url = aiDraft.provider === "ollama" ? `${endpoint}/api/tags` : `${endpoint}/models`;
      const response = await fetch(url, {
        headers: aiDraft.apiKey ? { Authorization: `Bearer ${aiDraft.apiKey}` } : undefined,
      });
      if (!response.ok) throw new Error(`接入点返回 HTTP ${response.status}`);
      setAiTestState("ok");
      setAiTestMessage("连接成功。PatchMark 只完成能力探测，没有发送任何文档内容。");
      localStorage.setItem("patchmark.ai.endpoint", endpoint);
      localStorage.setItem("patchmark.ai.model", aiDraft.model.trim());
    } catch (error) {
      setAiTestState("error");
      setAiTestMessage(
        `${error instanceof Error ? error.message : "连接失败"}。请检查地址、跨域设置和凭据。`,
      );
    }
  }

  if (!workspace) {
    return (
      <main className="boot-screen">
        <AppLogo />
        <LoaderCircle className="spin" size={20} />
        <p>正在建立示例资料库…</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <nav className="tool-rail" aria-label="主导航">
        <AppLogo />
        <div className="rail-stack">
          {railItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.view}
                className={`rail-button ${view === item.view ? "active" : ""}`}
                title={item.label}
                aria-label={item.label}
                onClick={() => navigate(item.view)}
              >
                <Icon size={20} strokeWidth={1.8} />
                {item.view === "inbox" && allIssues.length > 0 && (
                  <span className="rail-badge">{Math.min(allIssues.length, 99)}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="rail-bottom">
          <button
            className={`rail-button ${view === "settings" ? "active" : ""}`}
            title="设置"
            aria-label="设置"
            onClick={() => navigate("settings")}
          >
            <Settings size={20} strokeWidth={1.8} />
          </button>
          <div className="avatar">M</div>
        </div>
      </nav>

      <aside className="collection-panel">
        <header className="workspace-header">
          <div>
            <span className="eyebrow">当前资料库</span>
            <button className="workspace-name" onClick={handleOpenWorkspace} title="更换文件夹">
              <span>{workspace.name}</span>
              <ChevronRight size={15} />
            </button>
          </div>
          <button className="icon-button" onClick={handleOpenWorkspace} title="打开本地文件夹">
            <FolderOpen size={17} />
          </button>
        </header>

        <div className="global-search">
          <Search size={16} />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => {
              if (view !== "library") setView("library");
            }}
            placeholder="搜索正文、路径或标签"
            aria-label="搜索资料库"
          />
          {query ? (
            <button onClick={() => setQuery("")} aria-label="清空搜索"><X size={14} /></button>
          ) : (
            <kbd><Command size={11} />K</kbd>
          )}
        </div>

        <div className="panel-section">
          <div className="section-label">智能集合</div>
          <button className={filter === "all" && view === "library" ? "selected" : ""} onClick={() => { setFilter("all"); setView("library"); }}>
            <FileText size={16} /> 全部文档 <span>{files.length}</span>
          </button>
          <button className={filter === "issues" && view === "library" ? "selected" : ""} onClick={() => { setFilter("issues"); setView("library"); }}>
            <FileClock size={16} /> 待处理 <span>{stats.needsReview}</span>
          </button>
          <button className={filter === "draft" && view === "library" ? "selected" : ""} onClick={() => { setFilter("draft"); setView("library"); }}>
            <CircleDot size={16} /> 草稿与未分类 <span>{files.filter((file) => file.status === "draft" || file.status === "未分类").length}</span>
          </button>
        </div>

        <div className="panel-section">
          <div className="section-label">资料健康</div>
          {issueGroups.slice(0, 5).map(({ kind, count }) => {
            const Icon = issueMeta[kind].icon;
            return (
              <button key={kind} onClick={() => inspectIssue(kind)}>
                <Icon size={16} /> {issueMeta[kind].label} <span>{count}</span>
              </button>
            );
          })}
          {issueGroups.length === 0 && <p className="muted-copy">当前没有发现问题。</p>}
        </div>

        <div className="health-spine" aria-label="资料库健康脊柱">
          <div className="spine-label">
            <span>资料脊柱</span>
            <strong>{files.length ? Math.round(((files.length - stats.needsReview) / files.length) * 100) : 100}%</strong>
          </div>
          <div className="spine-track">
            {files.map((file) => {
              const severity = file.issues.some((issue) => issue.severity === "error")
                ? "error"
                : file.issues.some((issue) => issue.severity === "warning")
                  ? "warning"
                  : file.issues.length
                    ? "info"
                    : "healthy";
              return <button key={file.id} className={severity} title={`${file.title} · ${file.issues.length} 个问题`} onClick={() => openFile(file)} />;
            })}
          </div>
          <p>每一格代表一份文档，颜色表示当前风险。</p>
        </div>
      </aside>

      <main className="workspace-main">
        {scanProgress && (
          <div className="scan-overlay">
            <div className="scan-card">
              <div className="scan-beam" />
              <LoaderCircle className="spin" size={20} />
              <strong>正在只读盘点资料库</strong>
              <span>已读取 {scanProgress.scanned} 份 Markdown</span>
              <code>{scanProgress.currentPath}</code>
              <small>此阶段不会创建、修改、移动或删除文件。</small>
            </div>
          </div>
        )}

        {scanError && (
          <div className="top-error">
            <AlertCircle size={17} />
            <span>{scanError}</span>
            <button onClick={() => setScanError("")}><X size={15} /></button>
          </div>
        )}

        {view === "overview" && (
          <Overview
            workspace={workspace}
            stats={stats}
            issueGroups={issueGroups}
            onOpenWorkspace={handleOpenWorkspace}
            onOpenFile={openFile}
            onInspectIssue={inspectIssue}
            onShowLibrary={() => setView("library")}
          />
        )}

        {view === "library" && (
          <LibraryView
            files={filteredFiles}
            total={files.length}
            query={query}
            filter={filter}
            onFilter={setFilter}
            onOpenFile={openFile}
          />
        )}

        {view === "editor" && selected && (
          <EditorView
            file={selected}
            draft={draft}
            mode={editorMode}
            dirty={isDirty}
            inspectorOpen={inspectorOpen}
            onBack={() => setView("library")}
            onDraft={setDraft}
            onMode={setEditorMode}
            onSave={requestSave}
            onToggleInspector={() => setInspectorOpen((current) => !current)}
          />
        )}

        {view === "inbox" && (
          <InboxView
            files={files}
            issueGroups={issueGroups}
            onOpenFile={openFile}
            onConfigureAi={() => setView("settings")}
          />
        )}

        {view === "settings" && (
          <SettingsView
            aiDraft={aiDraft}
            aiTestState={aiTestState}
            aiTestMessage={aiTestMessage}
            localSupported={supportsLocalWorkspace()}
            desktopIndexSupported={supportsDesktopIndex()}
            workspace={workspace}
            onAiDraft={setAiDraft}
            onTest={testAiConnection}
            onOpenWorkspace={handleOpenWorkspace}
            onReloadDemo={reloadDemo}
            onRebuildIndex={rebuildDesktopIndex}
            onClearIndex={clearIndex}
          />
        )}
      </main>

      {view === "editor" && selected && inspectorOpen && (
        <Inspector file={selected} draft={draft} />
      )}

      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} /> {notice}
        </div>
      )}

      {diffOpen && selected && (
        <Suspense fallback={null}>
          <DiffModal
            path={selected.relativePath}
            before={selected.originalContent}
            after={draft}
            saving={saving}
            error={saveError}
            onCancel={() => !saving && setDiffOpen(false)}
            onConfirm={confirmSave}
          />
        </Suspense>
      )}
    </div>
  );
}

interface OverviewProps {
  workspace: WorkspaceSnapshot;
  stats: { wordCount: number; linkCount: number; needsReview: number; errorFiles: number };
  issueGroups: Array<{ kind: IssueKind; count: number }>;
  onOpenWorkspace: () => void;
  onOpenFile: (file: MarkdownRecord) => void;
  onInspectIssue: (kind: IssueKind) => void;
  onShowLibrary: () => void;
}

function Overview({
  workspace,
  stats,
  issueGroups,
  onOpenWorkspace,
  onOpenFile,
  onInspectIssue,
  onShowLibrary,
}: OverviewProps) {
  const recent = [...workspace.files].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  const health = workspace.files.length
    ? Math.round(((workspace.files.length - stats.needsReview) / workspace.files.length) * 100)
    : 100;

  return (
    <div className="page overview-page">
      <header className="page-header overview-header">
        <div>
          <span className="eyebrow">资料库总览 · {workspace.source === "demo" ? "示例模式" : "本地模式"}</span>
          <h1>先看懂，再动手。</h1>
          <p>上次盘点于 {formatRelativeTime(workspace.scannedAt)}；扫描过程未写入任何文件。</p>
        </div>
        <button className="button primary" onClick={onOpenWorkspace}>
          <FolderOpen size={17} /> 打开本地文件夹
        </button>
      </header>

      <section className="pulse-board">
        <div className="health-score">
          <div className="score-ring" style={{ "--score": `${health * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{health}</strong><span>健康度</span></div>
          </div>
          <div>
            <span className="eyebrow">资料状态</span>
            <h2>{stats.errorFiles ? "有风险项需要先处理" : stats.needsReview ? "结构可用，但仍需整理" : "资料库状态良好"}</h2>
            <p>{stats.needsReview} 份文档需要关注，其中 {stats.errorFiles} 份含阻断性问题。</p>
          </div>
        </div>
        <div className="stat-strip">
          <div><span>文档</span><strong>{formatNumber(workspace.files.length)}</strong><small>Markdown files</small></div>
          <div><span>有效字数</span><strong>{formatNumber(stats.wordCount)}</strong><small>中英文混合计数</small></div>
          <div><span>链接</span><strong>{formatNumber(stats.linkCount)}</strong><small>内部与外部引用</small></div>
          <div><span>待处理</span><strong>{formatNumber(stats.needsReview)}</strong><small>按文档去重</small></div>
        </div>
      </section>

      <section className="overview-grid">
        <div className="issue-board">
          <div className="section-heading">
            <div><span className="eyebrow">确定性检查</span><h2>治理入口</h2></div>
            <button className="text-button" onClick={onShowLibrary}>查看全部 <ChevronRight size={15} /></button>
          </div>
          <div className="issue-grid">
            {issueGroups.slice(0, 6).map(({ kind, count }) => {
              const meta = issueMeta[kind];
              const Icon = meta.icon;
              return (
                <button className="issue-tile" key={kind} onClick={() => onInspectIssue(kind)}>
                  <span className={`issue-icon ${kind}`}><Icon size={19} /></span>
                  <span><strong>{count}</strong><small>{meta.label}</small></span>
                  <ChevronRight size={16} />
                </button>
              );
            })}
            {issueGroups.length === 0 && (
              <div className="empty-inline"><ShieldCheck size={22} /><span>没有发现结构性问题</span></div>
            )}
          </div>
        </div>

        <aside className="ai-brief">
          <div className="ai-orbit"><Sparkles size={20} /></div>
          <span className="eyebrow">AI 资料管理员</span>
          <h2>先汇总证据，暂不自动执行</h2>
          <p>连接自己的模型后，AI 会基于当前检查结果提出分类、标签和归档建议。每项建议都必须经过你的批准。</p>
          <div className="brief-line"><span>待分析对象</span><strong>{stats.needsReview} 份</strong></div>
          <div className="brief-line"><span>已批准写操作</span><strong>0 项</strong></div>
        </aside>
      </section>

      <section className="recent-section">
        <div className="section-heading">
          <div><span className="eyebrow">最近活动</span><h2>刚刚更新的资料</h2></div>
        </div>
        <FileTable files={recent} onOpenFile={onOpenFile} />
      </section>
    </div>
  );
}

function LibraryView({
  files,
  total,
  query,
  filter,
  onFilter,
  onOpenFile,
}: {
  files: MarkdownRecord[];
  total: number;
  query: string;
  filter: LibraryFilter;
  onFilter: (filter: LibraryFilter) => void;
  onOpenFile: (file: MarkdownRecord) => void;
}) {
  const filters: Array<{ id: LibraryFilter; label: string }> = [
    { id: "all", label: "全部" },
    { id: "issues", label: "有问题" },
    { id: "draft", label: "草稿" },
    { id: "orphan", label: "孤立" },
    { id: "duplicate", label: "重复" },
  ];
  return (
    <div className="page library-page">
      <header className="page-header compact">
        <div>
          <span className="eyebrow">资料库</span>
          <h1>{query ? `“${query}” 的结果` : "全部 Markdown"}</h1>
          <p>显示 {files.length} / {total} 份文档</p>
        </div>
      </header>
      <div className="filter-bar">
        <div className="filter-icon"><ListFilter size={16} /><span>筛选</span></div>
        {filters.map((item) => (
          <button key={item.id} className={filter === item.id ? "active" : ""} onClick={() => onFilter(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {files.length ? (
        <FileTable files={files} onOpenFile={onOpenFile} detailed />
      ) : (
        <div className="empty-state">
          <Search size={28} />
          <h2>没有匹配的文档</h2>
          <p>换一个关键词或清除当前筛选条件。</p>
          <button className="button secondary" onClick={() => onFilter("all")}>清除筛选</button>
        </div>
      )}
    </div>
  );
}

function FileTable({ files, onOpenFile, detailed = false }: { files: MarkdownRecord[]; onOpenFile: (file: MarkdownRecord) => void; detailed?: boolean }) {
  return (
    <div className="file-table" role="table" aria-label="Markdown 文件列表">
      <div className="file-row file-head" role="row">
        <span>文档</span><span>状态</span>{detailed && <span>标签</span>}<span>字数</span><span>更新</span><span />
      </div>
      {files.map((file) => {
        const topSeverity = file.issues.some((issue) => issue.severity === "error")
          ? "error"
          : file.issues.some((issue) => issue.severity === "warning")
            ? "warning"
            : file.issues.length
              ? "info"
              : "healthy";
        return (
          <button className={`file-row ${detailed ? "detailed" : ""}`} role="row" key={file.id} onClick={() => onOpenFile(file)}>
            <span className="file-identity">
              <span className="file-glyph"><File size={16} /></span>
              <span><strong>{file.title}</strong><small>{file.relativePath}</small></span>
            </span>
            <span className="file-status"><StatusDot severity={topSeverity} />{file.issues.length ? `${file.issues.length} 项` : "正常"}</span>
            {detailed && <span className="tag-cell">{file.tags.slice(0, 2).map((tag) => <em key={tag}>{tag}</em>)}{!file.tags.length && <small>—</small>}</span>}
            <span className="numeric">{formatNumber(file.wordCount)}</span>
            <span>{formatRelativeTime(file.updatedAt)}</span>
            <ChevronRight size={16} />
          </button>
        );
      })}
    </div>
  );
}

function EditorView({
  file,
  draft,
  mode,
  dirty,
  inspectorOpen,
  onBack,
  onDraft,
  onMode,
  onSave,
  onToggleInspector,
}: {
  file: MarkdownRecord;
  draft: string;
  mode: EditorMode;
  dirty: boolean;
  inspectorOpen: boolean;
  onBack: () => void;
  onDraft: (value: string) => void;
  onMode: (mode: EditorMode) => void;
  onSave: () => void;
  onToggleInspector: () => void;
}) {
  const body = parseFrontmatter(draft).body;
  return (
    <div className="editor-page">
      <header className="editor-toolbar">
        <button className="icon-button" onClick={onBack} aria-label="返回资料库"><ArrowLeft size={18} /></button>
        <div className="editor-title">
          <strong>{file.title}</strong>
          <span>{file.relativePath}{dirty && <i>已修改</i>}</span>
        </div>
        <div className="mode-switch" aria-label="编辑模式">
          <button className={mode === "write" ? "active" : ""} onClick={() => onMode("write")}>编辑</button>
          <button className={mode === "split" ? "active" : ""} onClick={() => onMode("split")}>分屏</button>
          <button className={mode === "preview" ? "active" : ""} onClick={() => onMode("preview")}>阅读</button>
        </div>
        <div className="editor-actions">
          <span className={`write-state ${dirty ? "dirty" : ""}`}>{dirty ? "尚未写入磁盘" : "已与磁盘一致"}</span>
          <button className="button primary small" onClick={onSave} disabled={!dirty}>
            <Save size={15} /> 检查并保存
          </button>
          <button className="icon-button" onClick={onToggleInspector} aria-label={inspectorOpen ? "关闭检查器" : "打开检查器"}>
            {inspectorOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        </div>
      </header>
      <div className={`editor-canvas mode-${mode}`}>
        <Suspense fallback={<div className="editor-loading"><LoaderCircle className="spin" size={19} /><span>正在加载编辑能力…</span></div>}>
          {(mode === "write" || mode === "split") && <CodeEditor key={file.id} value={draft} onChange={onDraft} onSave={onSave} />}
          {(mode === "preview" || mode === "split") && <MarkdownPreview content={body} />}
        </Suspense>
      </div>
    </div>
  );
}

function Inspector({ file, draft }: { file: MarkdownRecord; draft: string }) {
  const parsed = parseFrontmatter(draft);
  const currentOutline = file.content === draft ? file.outline : [];
  return (
    <aside className="inspector-panel">
      <div className="inspector-tabs"><button className="active">检查器</button><button>关系</button></div>
      <section>
        <div className="section-label">文档状态</div>
        <div className="inspector-health">
          <ShieldCheck size={19} />
          <span><strong>{file.issues.length ? `${file.issues.length} 个待处理项` : "文档状态良好"}</strong><small>{file.wordCount} 字 · {file.lineCount} 行</small></span>
        </div>
      </section>
      <section>
        <div className="section-label">Frontmatter</div>
        <dl className="metadata-list">
          {Object.entries(parsed.data).slice(0, 8).map(([key, value]) => (
            <div key={key}><dt>{key}</dt><dd>{Array.isArray(value) ? value.join(", ") : String(value)}</dd></div>
          ))}
          {!Object.keys(parsed.data).length && <p className="muted-copy">这份文档没有 Frontmatter。</p>}
        </dl>
      </section>
      <section>
        <div className="section-label">结构大纲</div>
        <div className="outline-list">
          {currentOutline.map((item) => (
            <button key={`${item.line}-${item.text}`} style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}>
              <span>{item.text}</span><small>L{item.line}</small>
            </button>
          ))}
          {!currentOutline.length && <p className="muted-copy">保存后重新生成大纲。</p>}
        </div>
      </section>
      <section>
        <div className="section-label">检查结果</div>
        <div className="inspector-issues">
          {file.issues.map((issue) => (
            <div key={issue.id} className={issue.severity}>
              <StatusDot severity={issue.severity} />
              <span><strong>{issue.label}</strong><small>{issue.detail}</small></span>
            </div>
          ))}
          {!file.issues.length && <p className="muted-copy">没有发现确定性问题。</p>}
        </div>
      </section>
    </aside>
  );
}

function InboxView({
  files,
  issueGroups,
  onOpenFile,
  onConfigureAi,
}: {
  files: MarkdownRecord[];
  issueGroups: Array<{ kind: IssueKind; count: number }>;
  onOpenFile: (file: MarkdownRecord) => void;
  onConfigureAi: () => void;
}) {
  const queued = files.filter((file) => file.issues.length > 0);
  return (
    <div className="page inbox-page">
      <header className="page-header compact">
        <div><span className="eyebrow">治理收件箱</span><h1>证据先于建议</h1><p>规则检查是事实层；AI 判断会单独标注，不混在一起。</p></div>
        <button className="button secondary" onClick={onConfigureAi}><Bot size={17} /> 连接自己的模型</button>
      </header>
      <div className="governance-layout">
        <section className="queue-panel">
          <div className="section-heading">
            <div><span className="eyebrow">规则发现</span><h2>{queued.length} 份文档等待处理</h2></div>
            <span className="safe-label"><ShieldCheck size={14} /> 尚未写入</span>
          </div>
          <div className="queue-list">
            {queued.map((file) => (
              <button key={file.id} onClick={() => onOpenFile(file)}>
                <span className="queue-index">{String(queued.indexOf(file) + 1).padStart(2, "0")}</span>
                <span className="queue-copy"><strong>{file.title}</strong><small>{file.relativePath}</small></span>
                <span className="queue-issues">{file.issues.slice(0, 2).map((issue) => <em key={issue.id}>{issue.label}</em>)}</span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </section>
        <aside className="governance-side">
          <span className="eyebrow">问题构成</span>
          <h2>先处理会阻断工作的项</h2>
          <div className="issue-bars">
            {issueGroups.map((group) => (
              <div key={group.kind}>
                <span>{issueMeta[group.kind].label}</span><strong>{group.count}</strong>
                <i style={{ width: `${Math.max(12, (group.count / Math.max(...issueGroups.map((item) => item.count))) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="ai-locked">
            <Sparkles size={18} />
            <div><strong>AI 分类尚未运行</strong><p>只有连接模型并明确选择文档后，内容才会发送到用户指定的接入点。</p></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SettingsView({
  aiDraft,
  aiTestState,
  aiTestMessage,
  localSupported,
  desktopIndexSupported,
  workspace,
  onAiDraft,
  onTest,
  onOpenWorkspace,
  onReloadDemo,
  onRebuildIndex,
  onClearIndex,
}: {
  aiDraft: AiConnectionDraft;
  aiTestState: "idle" | "testing" | "ok" | "error";
  aiTestMessage: string;
  localSupported: boolean;
  desktopIndexSupported: boolean;
  workspace: WorkspaceSnapshot;
  onAiDraft: (draft: AiConnectionDraft) => void;
  onTest: () => void;
  onOpenWorkspace: () => void;
  onReloadDemo: () => void;
  onRebuildIndex: () => void;
  onClearIndex: () => void;
}) {
  return (
    <div className="page settings-page">
      <header className="page-header compact">
        <div><span className="eyebrow">设置</span><h1>本地优先，由你掌控</h1><p>正文留在原目录；模型和接入点也由你选择。</p></div>
      </header>

      <section className="settings-section">
        <div className="settings-copy"><FolderOpen size={21} /><div><h2>资料库</h2><p>扫描时只读；单文件保存前显示差异并检查外部冲突。</p></div></div>
        <div className="settings-card">
          <div className="setting-line"><span>当前来源</span><strong>{workspace.source === "demo" ? "内置示例" : workspace.source === "desktop" ? "Tauri 本地目录" : "浏览器本地目录"}</strong></div>
          <div className="setting-line"><span>浏览器目录能力</span><strong className={localSupported ? "ok-text" : "warning-text"}>{localSupported ? "可用" : "当前不可用"}</strong></div>
          <div className="button-row">
            <button className="button primary" onClick={onOpenWorkspace}><FolderOpen size={16} /> 打开文件夹</button>
            {workspace.source === "demo" && <button className="button secondary" onClick={onReloadDemo}><RefreshCw size={16} /> 重置示例</button>}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-copy"><Database size={21} /><div><h2>本地 SQLite 索引</h2><p>保存在这台设备的应用数据目录，用于快速搜索和增量扫描；它不是 Markdown 正文仓库。</p></div></div>
        <div className="settings-card index-card">
          <div className="local-seal"><HardDrive size={18} /><span><strong>{desktopIndexSupported ? "只在这台设备" : "桌面版启用"}</strong><small>不需要数据库服务器，不会自动上传</small></span></div>
          {workspace.index ? (
            <>
              <div className="setting-line"><span>已索引文档</span><strong>{formatNumber(workspace.index.fileCount)}</strong></div>
              <div className="setting-line"><span>数据库大小</span><strong>{formatBytes(workspace.index.databaseBytes)}</strong></div>
              <div className="setting-line"><span>全文索引</span><strong className="ok-text">{workspace.index.contentIndexed ? "FTS5 · 本地" : "未启用"}</strong></div>
              <div className="index-path"><span>数据库文件</span><code>{workspace.index.databasePath}</code></div>
              <div className="button-row">
                <button className="button primary" onClick={onRebuildIndex}><RefreshCw size={16} /> 重建索引</button>
                <button className="button danger" onClick={onClearIndex}><Trash2 size={16} /> 仅清空索引</button>
              </div>
            </>
          ) : (
            <div className="index-empty">
              <Database size={22} />
              <div><strong>{desktopIndexSupported ? "打开一个本地目录后建立索引" : "浏览器预览不创建 SQLite 文件"}</strong><p>安装版会显示数据库的真实路径、大小和最近更新时间。</p></div>
            </div>
          )}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-copy"><Bot size={21} /><div><h2>AI 接入</h2><p>兼容 OpenAI API 的云服务、Ollama 和 LM Studio。PatchMark 不提供强制代理。</p></div></div>
        <div className="settings-card form-card">
          <label>
            <span>服务类型</span>
            <select value={aiDraft.provider} onChange={(event) => onAiDraft({ ...aiDraft, provider: event.target.value as AiConnectionDraft["provider"] })}>
              <option value="openai-compatible">OpenAI-compatible</option>
              <option value="ollama">Ollama</option>
              <option value="lm-studio">LM Studio</option>
            </select>
          </label>
          <label>
            <span>接入点</span>
            <input value={aiDraft.endpoint} onChange={(event) => onAiDraft({ ...aiDraft, endpoint: event.target.value })} placeholder={aiDraft.provider === "ollama" ? "http://localhost:11434" : "https://api.example.com/v1"} />
          </label>
          <label>
            <span>模型</span>
            <input value={aiDraft.model} onChange={(event) => onAiDraft({ ...aiDraft, model: event.target.value })} placeholder="例如 qwen3:8b" />
          </label>
          <label>
            <span>API Key</span>
            <input type="password" autoComplete="off" value={aiDraft.apiKey} onChange={(event) => onAiDraft({ ...aiDraft, apiKey: event.target.value })} placeholder="仅保留在当前页面会话" />
            <small>密钥不会写入 localStorage，也不会随项目文件保存。</small>
          </label>
          {aiTestMessage && <div className={`connection-result ${aiTestState}`}>
            {aiTestState === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}<span>{aiTestMessage}</span>
          </div>}
          <div className="button-row">
            <button className="button primary" onClick={onTest} disabled={aiTestState === "testing"}>
              {aiTestState === "testing" ? <LoaderCircle className="spin" size={16} /> : <Unplug size={16} />}
              {aiTestState === "testing" ? "正在探测…" : "仅测试连接"}
            </button>
          </div>
        </div>
      </section>

      <section className="settings-section compact-setting">
        <div className="settings-copy"><ShieldCheck size={21} /><div><h2>隐私边界</h2><p>默认不上传目录、文件名或正文。未来每次 AI 任务都会先显示将发送的内容范围。</p></div></div>
        <div className="settings-card policy-list">
          <p><CheckCircle2 size={15} /> Markdown 原文始终是唯一真源</p>
          <p><CheckCircle2 size={15} /> 索引可删除，不用于锁定内容</p>
          <p><CheckCircle2 size={15} /> AI 建议与确定性检查分层展示</p>
        </div>
      </section>
    </div>
  );
}
