import { AlertTriangle, ArchiveRestore, Check, Clock3, FilePlus2, FolderOpen, HardDriveDownload, Monitor, Moon, RotateCcw, Save, Settings, Sun, Trash2, Type, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { lineDiff } from "../lib/diff";
import type { DocumentTemplate, EditorPreferences, FileConflict, MarkdownDocument, ThemeMode, TrashEntry, VersionSnapshot } from "../types";

function useDialogFocus(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusInitial = window.requestAnimationFrame(() => {
      const initial = dialogRef.current?.querySelector<HTMLElement>('[data-dialog-primary], button:not(.icon-button), input:not([disabled])');
      initial?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      const first = focusable[0]; const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusInitial);
      document.removeEventListener("keydown", onKeyDown);
      returnFocus?.focus();
    };
  }, [open]);
  return dialogRef;
}

interface TemplateDialogProps {
  open: boolean;
  templates: DocumentTemplate[];
  onClose: () => void;
  onCreate: (template: DocumentTemplate) => void;
}

export function TemplateDialog({ open, templates, onClose, onCreate }: TemplateDialogProps) {
  const dialogRef = useDialogFocus(open, onClose);
  if (!open) return null;
  return <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} className="workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="template-title"><header><div><span className="dialog-mark"><FilePlus2 size={18} /></span><div><h2 id="template-title">新建文稿</h2><p>模板只是普通 Markdown 的起点</p></div></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={17} /></button></header><div className="template-grid">{templates.map((template, index) => <button type="button" data-dialog-primary={index === 0 ? "true" : undefined} key={template.id} onClick={() => onCreate(template)}><FilePlus2 size={19} /><strong>{template.name}</strong><span>{template.description}</span></button>)}</div></section></div>;
}

interface HistoryDialogProps {
  open: boolean;
  document: MarkdownDocument;
  versions: VersionSnapshot[];
  onClose: () => void;
  onRestore: (version: VersionSnapshot) => void;
  onNameVersion: () => void;
}

export function HistoryDialog({ open, document, versions, onClose, onRestore, onNameVersion }: HistoryDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = versions.find((item) => item.id === selectedId) ?? versions[0];
  const diff = useMemo(() => selected ? lineDiff(selected.content, document.content) : [], [document.content, selected]);
  const dialogRef = useDialogFocus(open, onClose);
  if (!open) return null;
  return <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} className="workspace-dialog history-dialog" role="dialog" aria-modal="true" aria-labelledby="history-title"><header><div><span className="dialog-mark"><Clock3 size={18} /></span><div><h2 id="history-title">版本记录</h2><p>自动保留关键写作节点，可随时回到过去</p></div></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={17} /></button></header><div className="history-layout"><aside><button data-dialog-primary className="named-version-button" type="button" onClick={onNameVersion}>保存当前版本</button>{versions.map((version) => <button type="button" key={version.id} className={selected?.id === version.id ? "active" : ""} onClick={() => setSelectedId(version.id)}><strong>{version.name}</strong><time>{new Date(version.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></button>)}{!versions.length && <p className="dialog-empty">开始编辑后会自动生成版本。</p>}</aside><div className="diff-panel">{selected ? <>{<div className="diff-title"><span>所选版本 → 当前内容</span><button type="button" onClick={() => onRestore(selected)}><RotateCcw size={14} />恢复此版本</button></div>}<pre>{diff.map((line, index) => <span className={`diff-${line.kind}`} key={`${index}-${line.text}`}>{line.kind === "add" ? "+ " : line.kind === "remove" ? "− " : "  "}{line.text || " "}</span>)}</pre></> : <div className="dialog-empty centered">还没有可比较的版本</div>}</div></div></section></div>;
}

interface TrashDialogProps {
  open: boolean;
  entries: TrashEntry[];
  onClose: () => void;
  onRestore: (entry: TrashEntry) => void;
  onDelete: (entry: TrashEntry) => void;
}

export function TrashDialog({ open, entries, onClose, onRestore, onDelete }: TrashDialogProps) {
  const dialogRef = useDialogFocus(open, onClose);
  if (!open) return null;
  return <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} className="workspace-dialog trash-dialog" role="dialog" aria-modal="true" aria-labelledby="trash-title"><header><div><span className="dialog-mark"><Trash2 size={18} /></span><div><h2 id="trash-title">最近删除</h2><p>删除的资料库记录保存在本机</p></div></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={17} /></button></header><div className="trash-list">{entries.map((entry, index) => <article key={entry.document.id}><div><strong>{entry.document.name}</strong><time>{new Date(entry.deletedAt).toLocaleString("zh-CN")}</time></div><button data-dialog-primary={index === 0 ? "true" : undefined} type="button" onClick={() => onRestore(entry)}><ArchiveRestore size={15} />恢复</button><button className="danger" type="button" onClick={() => onDelete(entry)}><Trash2 size={15} />永久删除</button></article>)}{!entries.length && <div className="dialog-empty centered">最近删除是空的</div>}</div></section></div>;
}

interface SettingsDialogProps {
  open: boolean;
  preferences: EditorPreferences;
  theme: ThemeMode;
  defaultDirectoryName: string | null;
  defaultDirectoryAccess: PermissionState | "missing";
  canChooseDirectory: boolean;
  onClose: () => void;
  onChange: (preferences: EditorPreferences) => void;
  onThemeChange: (theme: ThemeMode) => void;
  onReset: () => void;
  onChooseDirectory: () => void;
  onClearDirectory: () => void;
}

const widthOptions: Array<{ value: EditorPreferences["manuscriptWidth"]; label: string }> = [
  { value: 640, label: "紧凑" },
  { value: 760, label: "标准" },
  { value: 900, label: "宽阔" },
];

const themeOptions: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: "system", label: "跟随系统", icon: Monitor },
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
];

export function SettingsDialog({ open, preferences, theme, defaultDirectoryName, defaultDirectoryAccess, canChooseDirectory, onClose, onChange, onThemeChange, onReset, onChooseDirectory, onClearDirectory }: SettingsDialogProps) {
  const dialogRef = useDialogFocus(open, onClose);
  const patch = (next: Partial<EditorPreferences>) => onChange({ ...preferences, ...next });
  const sampleTypeface = preferences.typeface === "serif"
    ? '"Songti SC", "STSong", "Noto Serif CJK SC", Georgia, serif'
    : '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';
  if (!open) return null;
  return <div className="sheet-backdrop settings-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={dialogRef} className="workspace-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header>
        <div><span className="dialog-mark"><Settings size={18} /></span><div><h2 id="settings-title">设置</h2><p>让写作表面适合你的眼睛与节奏</p></div></div>
        <button className="icon-button" onClick={onClose} aria-label="关闭设置"><X size={17} /></button>
      </header>
      <div className="settings-layout">
        <aside aria-label="设置分类"><span className="settings-nav-icon"><Type size={18} /></span><span><strong>编辑与阅读</strong><small>字号、行高与版心</small></span></aside>
        <div className="settings-content">
          <section className="settings-group" aria-labelledby="typesetting-heading">
            <div className="settings-group-title"><div><h3 id="typesetting-heading">文稿排版</h3><p>实时排版和阅读视图保持一致。</p></div><button type="button" className="reset-settings" onClick={onReset}><RotateCcw size={13} />恢复默认</button></div>
            <div className="type-specimen" aria-label="源码与即时预览">
              <section className="source-specimen" style={{ fontSize: `${preferences.sourceFontSize}px` }}><span>Markdown 源码</span><pre>{"# 写作，从舒服的版面开始\n\n**Markdown** 标记退到一旁，文字回到眼前。"}</pre></section>
              <section className="rendered-specimen" style={{ fontFamily: sampleTypeface, fontSize: `${preferences.manuscriptFontSize}px`, lineHeight: preferences.lineHeight }}><span>即时预览</span><strong>写作，从舒服的版面开始</strong><p><b>Markdown</b> 标记退到一旁，文字回到眼前。</p></section>
            </div>
            <label className="preference-slider"><span><strong>文稿字号</strong><small>实时排版与阅读视图</small></span><input type="range" min="13" max="24" step="1" value={preferences.manuscriptFontSize} onChange={(event) => patch({ manuscriptFontSize: Number(event.target.value) })} /><output>{preferences.manuscriptFontSize} px</output></label>
            <label className="preference-slider"><span><strong>行高</strong><small>控制正文的呼吸感</small></span><input type="range" min="1.4" max="2" step="0.05" value={preferences.lineHeight} onChange={(event) => patch({ lineHeight: Number(event.target.value) })} /><output>{preferences.lineHeight.toFixed(2)}</output></label>
            <label className="preference-slider"><span><strong>源码字号</strong><small>Markdown 源码视图</small></span><input type="range" min="12" max="20" step="1" value={preferences.sourceFontSize} onChange={(event) => patch({ sourceFontSize: Number(event.target.value) })} /><output>{preferences.sourceFontSize} px</output></label>
            <div className="preference-choice"><span><strong>正文字体</strong><small>只影响文稿，不影响代码</small></span><div className="settings-segment" role="group" aria-label="正文字体"><button type="button" className={preferences.typeface === "sans" ? "active" : ""} aria-pressed={preferences.typeface === "sans"} onClick={() => patch({ typeface: "sans" })}>现代</button><button type="button" className={preferences.typeface === "serif" ? "active serif" : "serif"} aria-pressed={preferences.typeface === "serif"} onClick={() => patch({ typeface: "serif" })}>书卷</button></div></div>
            <div className="preference-choice"><span><strong>页面宽度</strong><small>{preferences.manuscriptWidth} px 版心</small></span><div className="settings-segment width-segment" role="group" aria-label="页面宽度">{widthOptions.map((option) => <button type="button" className={preferences.manuscriptWidth === option.value ? "active" : ""} aria-pressed={preferences.manuscriptWidth === option.value} key={option.value} onClick={() => patch({ manuscriptWidth: option.value })}>{option.label}</button>)}</div></div>
          </section>
          <section className="settings-group file-settings" aria-labelledby="file-settings-heading">
            <div className="settings-group-title"><div><h3 id="file-settings-heading">文件与存储</h3><p>指定新文稿第一次写入磁盘的位置。</p></div></div>
            <div className="directory-setting">
              <span className="directory-icon"><FolderOpen size={18} /></span>
              <span className="directory-copy"><strong>{defaultDirectoryName ?? "每次保存时选择"}</strong><small>{defaultDirectoryName ? defaultDirectoryAccess === "granted" ? "已授权写入，新文稿首次保存时进入这里" : "保存时会请求重新授权" : "新文稿先进入恢复草稿，按 ⌘S 时选择文件夹"}</small></span>
              <span className="directory-actions"><button type="button" onClick={onChooseDirectory} disabled={!canChooseDirectory}>{defaultDirectoryName ? "更改" : "选择文件夹"}</button>{defaultDirectoryName && <button type="button" className="subtle" onClick={onClearDirectory}>移除</button>}</span>
            </div>
            {!canChooseDirectory && <p className="directory-unsupported">当前浏览器不支持固定文件夹，首次保存时仍可下载 Markdown。</p>}
          </section>
          <section className="settings-group appearance-settings" aria-labelledby="appearance-heading"><div className="settings-group-title"><div><h3 id="appearance-heading">外观</h3><p>选择应用界面的明暗方式。</p></div></div><div className="theme-options" role="radiogroup" aria-label="应用外观">{themeOptions.map((option) => { const Icon = option.icon; return <button type="button" role="radio" aria-checked={theme === option.value} className={theme === option.value ? "active" : ""} key={option.value} onClick={() => onThemeChange(option.value)}><Icon size={17} /><span>{option.label}</span>{theme === option.value && <Check size={14} />}</button>; })}</div></section>
        </div>
      </div>
      <footer className="settings-footer"><span>更改自动保存在这台设备上</span><button data-dialog-primary type="button" onClick={onClose}>完成</button></footer>
    </section>
  </div>;
}

interface ConflictDialogProps {
  conflict: FileConflict | null;
  document: MarkdownDocument;
  onClose: () => void;
  onUseDisk: () => void;
  onOverwrite: () => void;
}

export function ConflictDialog({ conflict, document, onClose, onUseDisk, onOverwrite }: ConflictDialogProps) {
  const open = Boolean(conflict);
  const dialogRef = useDialogFocus(open, onClose);
  const diff = useMemo(() => conflict ? lineDiff(conflict.diskContent, document.content) : [], [conflict, document.content]);
  if (!conflict) return null;
  return <div className="sheet-backdrop"><section ref={dialogRef} className="workspace-dialog conflict-dialog" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title" aria-describedby="conflict-description"><header><div><span className="dialog-mark warning"><AlertTriangle size={18} /></span><div><h2 id="conflict-title">文件在磁盘上发生了变化</h2><p id="conflict-description">请选择保留电脑上的版本，或用当前编辑内容覆盖它。</p></div></div><button className="icon-button" onClick={onClose} aria-label="稍后处理"><X size={17} /></button></header><div className="conflict-summary"><span><HardDriveDownload size={15} />磁盘版本</span><span>→</span><span><Save size={15} />当前编辑</span></div><pre className="conflict-diff">{diff.slice(0, 180).map((line, index) => <span className={`diff-${line.kind}`} key={`${index}-${line.text}`}>{line.kind === "add" ? "+ " : line.kind === "remove" ? "− " : "  "}{line.text || " "}</span>)}</pre><footer className="conflict-actions"><button data-dialog-primary type="button" onClick={onUseDisk}><HardDriveDownload size={15} />使用磁盘版本</button><button className="primary" type="button" onClick={onOverwrite}><Save size={15} />覆盖磁盘文件</button></footer></section></div>;
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel, onClose, onConfirm }: ConfirmDialogProps) {
  const dialogRef = useDialogFocus(open, onClose);
  if (!open) return null;
  return <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} className="workspace-dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><header><div><span className="dialog-mark warning"><Trash2 size={18} /></span><div><h2 id="confirm-title">{title}</h2><p id="confirm-description">{description}</p></div></div><button className="icon-button" onClick={onClose} aria-label="取消"><X size={17} /></button></header><footer className="conflict-actions"><button data-dialog-primary type="button" onClick={onClose}>取消</button><button className="danger-primary" type="button" onClick={onConfirm}><Trash2 size={15} />{confirmLabel}</button></footer></section></div>;
}
