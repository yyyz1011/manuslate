import { AlertTriangle, ArchiveRestore, Check, Clock3, ExternalLink, FilePlus2, FolderOpen, GitFork, Globe2, HardDriveDownload, MessageCircle, Monitor, Moon, RotateCcw, Save, Settings, Sun, Trash2, Type, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
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
  const { language, t } = useI18n();
  const dialogRef = useDialogFocus(open, onClose);
  const templateCopy: Record<string, [string, string, string, string]> = {
    blank: ["Blank document", "空白文稿", "Start from a quiet page", "从一个安静页面开始"],
    meeting: ["Meeting notes", "会议记录", "Topics, decisions, and actions", "议题、结论和待办"],
    project: ["Project plan", "项目计划", "Goals, milestones, and risks", "目标、里程碑和风险"],
    readme: ["README", "README", "Open-source project overview", "适合开源项目说明"],
    daily: ["Daily note", "每日笔记", "Focus today and the next step", "聚焦今天和下一步"],
  };
  const englishTemplateContent: Record<string, string> = {
    blank: "",
    meeting: "# Meeting notes\n\n**Date:** \n**Attendees:** \n\n## Topics\n\n- \n\n## Decisions\n\n- \n\n## Actions\n\n- [ ] \n",
    project: "# Project plan\n\n## Goal\n\n\n## Milestones\n\n- [ ] Phase one\n- [ ] Phase two\n\n## Risks and decisions\n\n",
    readme: "# Project name\n\nA one-line description of the project.\n\n## Features\n\n- \n\n## Getting started\n\n```bash\n\n```\n\n## License\n\nMIT\n",
    daily: "# Daily note\n\n## Most important today\n\n- \n\n## Notes\n\n\n## Next\n\n- [ ] \n",
  };
  if (!open) return null;
  return <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} className="workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="template-title"><header><div><span className="dialog-mark"><FilePlus2 size={18} /></span><div><h2 id="template-title">{t("New document", "新建文稿")}</h2><p>{t("Every template stays plain Markdown.", "模板只是普通 Markdown 的起点")}</p></div></div><button className="icon-button" onClick={onClose} aria-label={t("Close", "关闭")}><X size={17} /></button></header><div className="template-grid">{templates.map((template, index) => { const copy = templateCopy[template.id]; return <button type="button" data-dialog-primary={index === 0 ? "true" : undefined} key={template.id} onClick={() => onCreate({ ...template, name: copy ? t(copy[0], copy[1]) : template.name, content: language === "en" ? englishTemplateContent[template.id] ?? template.content : template.content })}><FilePlus2 size={19} /><strong>{copy ? t(copy[0], copy[1]) : template.name}</strong><span>{copy ? t(copy[2], copy[3]) : template.description}</span></button>; })}</div></section></div>;
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
  const { locale, t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = versions.find((item) => item.id === selectedId) ?? versions[0];
  const diff = useMemo(() => selected ? lineDiff(selected.content, document.content) : [], [document.content, selected]);
  const dialogRef = useDialogFocus(open, onClose);
  if (!open) return null;
  return <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} className="workspace-dialog history-dialog" role="dialog" aria-modal="true" aria-labelledby="history-title"><header><div><span className="dialog-mark"><Clock3 size={18} /></span><div><h2 id="history-title">{t("Version history", "版本记录")}</h2><p>{t("Return to an important writing checkpoint at any time.", "自动保留关键写作节点，可随时回到过去")}</p></div></div><button className="icon-button" onClick={onClose} aria-label={t("Close", "关闭")}><X size={17} /></button></header><div className="history-layout"><aside><button data-dialog-primary className="named-version-button" type="button" onClick={onNameVersion}>{t("Save current version", "保存当前版本")}</button>{versions.map((version) => <button type="button" key={version.id} className={selected?.id === version.id ? "active" : ""} onClick={() => setSelectedId(version.id)}><strong>{version.name}</strong><time>{new Date(version.createdAt).toLocaleString(locale, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></button>)}{!versions.length && <p className="dialog-empty">{t("Versions appear after you begin editing.", "开始编辑后会自动生成版本。")}</p>}</aside><div className="diff-panel">{selected ? <>{<div className="diff-title"><span>{t("Selected version → current document", "所选版本 → 当前内容")}</span><button type="button" onClick={() => onRestore(selected)}><RotateCcw size={14} />{t("Restore this version", "恢复此版本")}</button></div>}<pre>{diff.map((line, index) => <span className={`diff-${line.kind}`} key={`${index}-${line.text}`}>{line.kind === "add" ? "+ " : line.kind === "remove" ? "− " : "  "}{line.text || " "}</span>)}</pre></> : <div className="dialog-empty centered">{t("No versions to compare yet", "还没有可比较的版本")}</div>}</div></div></section></div>;
}

interface TrashDialogProps {
  open: boolean;
  entries: TrashEntry[];
  onClose: () => void;
  onRestore: (entry: TrashEntry) => void;
  onDelete: (entry: TrashEntry) => void;
}

export function TrashDialog({ open, entries, onClose, onRestore, onDelete }: TrashDialogProps) {
  const { locale, t } = useI18n();
  const dialogRef = useDialogFocus(open, onClose);
  if (!open) return null;
  return <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} className="workspace-dialog trash-dialog" role="dialog" aria-modal="true" aria-labelledby="trash-title"><header><div><span className="dialog-mark"><Trash2 size={18} /></span><div><h2 id="trash-title">{t("Recently deleted", "最近删除")}</h2><p>{t("Removed library records stay on this device.", "删除的资料库记录保存在本机")}</p></div></div><button className="icon-button" onClick={onClose} aria-label={t("Close", "关闭")}><X size={17} /></button></header><div className="trash-list">{entries.map((entry, index) => <article key={entry.document.id}><div><strong>{entry.document.name}</strong><time>{new Date(entry.deletedAt).toLocaleString(locale)}</time></div><button data-dialog-primary={index === 0 ? "true" : undefined} type="button" onClick={() => onRestore(entry)}><ArchiveRestore size={15} />{t("Restore", "恢复")}</button><button className="danger" type="button" onClick={() => onDelete(entry)}><Trash2 size={15} />{t("Delete forever", "永久删除")}</button></article>)}{!entries.length && <div className="dialog-empty centered">{t("Recently deleted is empty", "最近删除是空的")}</div>}</div></section></div>;
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

const widthOptions: EditorPreferences["manuscriptWidth"][] = [640, 760, 900];

const themeOptions: Array<{ value: ThemeMode; icon: typeof Sun }> = [
  { value: "system", icon: Monitor },
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
];

export function SettingsDialog({ open, preferences, theme, defaultDirectoryName, defaultDirectoryAccess, canChooseDirectory, onClose, onChange, onThemeChange, onReset, onChooseDirectory, onClearDirectory }: SettingsDialogProps) {
  const { language, setLanguage, t } = useI18n();
  const dialogRef = useDialogFocus(open, onClose);
  const patch = (next: Partial<EditorPreferences>) => onChange({ ...preferences, ...next });
  const sampleTypeface = preferences.typeface === "serif"
    ? '"Songti SC", "STSong", "Noto Serif CJK SC", Georgia, serif'
    : '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';
  if (!open) return null;
  return <div className="sheet-backdrop settings-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={dialogRef} className="workspace-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header>
        <div><span className="dialog-mark"><Settings size={18} /></span><div><h2 id="settings-title">{t("Settings", "设置")}</h2><p>{t("Make the writing surface fit your eyes and rhythm.", "让写作表面适合你的眼睛与节奏")}</p></div></div>
        <button className="icon-button" onClick={onClose} aria-label={t("Close settings", "关闭设置")}><X size={17} /></button>
      </header>
      <div className="settings-layout">
        <aside aria-label={t("Settings sections", "设置分类")}><span className="settings-nav-icon"><Type size={18} /></span><span><strong>{t("Writing & reading", "编辑与阅读")}</strong><small>{t("Type, spacing, and page width", "字号、行高与版心")}</small></span></aside>
        <div className="settings-content">
          <section className="settings-group" aria-labelledby="typesetting-heading">
            <div className="settings-group-title"><div><h3 id="typesetting-heading">{t("Document typography", "文稿排版")}</h3><p>{t("Live and reading views stay in sync.", "实时排版和阅读视图保持一致。")}</p></div><button type="button" className="reset-settings" onClick={onReset}><RotateCcw size={13} />{t("Reset", "恢复默认")}</button></div>
            <div className="type-specimen" aria-label={t("Source and live preview", "源码与即时预览")}>
              <section className="source-specimen" style={{ fontSize: `${preferences.sourceFontSize}px` }}><span>{t("Markdown source", "Markdown 源码")}</span><pre>{t("# Write from a comfortable page\n\n**Markdown** steps aside. Your words stay in focus.", "# 写作，从舒服的版面开始\n\n**Markdown** 标记退到一旁，文字回到眼前。")}</pre></section>
              <section className="rendered-specimen" style={{ fontFamily: sampleTypeface, fontSize: `${preferences.manuscriptFontSize}px`, lineHeight: preferences.lineHeight }}><span>{t("Live preview", "即时预览")}</span><strong>{t("Write from a comfortable page", "写作，从舒服的版面开始")}</strong><p><b>Markdown</b> {t("steps aside. Your words stay in focus.", "标记退到一旁，文字回到眼前。")}</p></section>
            </div>
            <label className="preference-slider"><span><strong>{t("Document size", "文稿字号")}</strong><small>{t("Live and reading views", "实时排版与阅读视图")}</small></span><input type="range" min="13" max="24" step="1" value={preferences.manuscriptFontSize} onChange={(event) => patch({ manuscriptFontSize: Number(event.target.value) })} /><output>{preferences.manuscriptFontSize} px</output></label>
            <label className="preference-slider"><span><strong>{t("Line height", "行高")}</strong><small>{t("Set the document rhythm", "控制正文的呼吸感")}</small></span><input type="range" min="1.4" max="2" step="0.05" value={preferences.lineHeight} onChange={(event) => patch({ lineHeight: Number(event.target.value) })} /><output>{preferences.lineHeight.toFixed(2)}</output></label>
            <label className="preference-slider"><span><strong>{t("Source size", "源码字号")}</strong><small>{t("Markdown source view", "Markdown 源码视图")}</small></span><input type="range" min="12" max="20" step="1" value={preferences.sourceFontSize} onChange={(event) => patch({ sourceFontSize: Number(event.target.value) })} /><output>{preferences.sourceFontSize} px</output></label>
            <div className="preference-choice"><span><strong>{t("Document typeface", "正文字体")}</strong><small>{t("Does not affect code", "只影响文稿，不影响代码")}</small></span><div className="settings-segment" role="group" aria-label={t("Document typeface", "正文字体")}><button type="button" className={preferences.typeface === "sans" ? "active" : ""} aria-pressed={preferences.typeface === "sans"} onClick={() => patch({ typeface: "sans" })}>{t("Modern", "现代")}</button><button type="button" className={preferences.typeface === "serif" ? "active serif" : "serif"} aria-pressed={preferences.typeface === "serif"} onClick={() => patch({ typeface: "serif" })}>{t("Book", "书卷")}</button></div></div>
            <div className="preference-choice"><span><strong>{t("Page width", "页面宽度")}</strong><small>{t(`${preferences.manuscriptWidth} px column`, `${preferences.manuscriptWidth} px 版心`)}</small></span><div className="settings-segment width-segment" role="group" aria-label={t("Page width", "页面宽度")}>{widthOptions.map((option) => <button type="button" className={preferences.manuscriptWidth === option ? "active" : ""} aria-pressed={preferences.manuscriptWidth === option} key={option} onClick={() => patch({ manuscriptWidth: option })}>{option === 640 ? t("Compact", "紧凑") : option === 760 ? t("Standard", "标准") : t("Wide", "宽阔")}</button>)}</div></div>
          </section>
          <section className="settings-group file-settings" aria-labelledby="file-settings-heading">
            <div className="settings-group-title"><div><h3 id="file-settings-heading">{t("Files & storage", "文件与存储")}</h3><p>{t("Choose where a new document is first written to disk.", "指定新文稿第一次写入磁盘的位置。")}</p></div></div>
            <div className="directory-setting">
              <span className="directory-icon"><FolderOpen size={18} /></span>
              <span className="directory-copy"><strong>{defaultDirectoryName ?? t("Choose on first save", "每次保存时选择")}</strong><small>{defaultDirectoryName ? defaultDirectoryAccess === "granted" ? t("New documents will be written here on first save", "已授权写入，新文稿首次保存时进入这里") : t("Manuslate will request access when saving", "保存时会请求重新授权") : t("New documents begin as recovery drafts; choose a folder with ⌘S", "新文稿先进入恢复草稿，按 ⌘S 时选择文件夹")}</small></span>
              <span className="directory-actions"><button type="button" onClick={onChooseDirectory} disabled={!canChooseDirectory}>{defaultDirectoryName ? t("Change", "更改") : t("Choose folder", "选择文件夹")}</button>{defaultDirectoryName && <button type="button" className="subtle" onClick={onClearDirectory}>{t("Remove", "移除")}</button>}</span>
            </div>
            {!canChooseDirectory && <p className="directory-unsupported">{t("This browser cannot remember a folder. Markdown can still be downloaded on first save.", "当前浏览器不支持固定文件夹，首次保存时仍可下载 Markdown。")}</p>}
          </section>
          <section className="settings-group appearance-settings" aria-labelledby="appearance-heading"><div className="settings-group-title"><div><h3 id="appearance-heading">{t("Appearance", "外观")}</h3><p>{t("Choose how Manuslate looks.", "选择应用界面的明暗方式。")}</p></div></div><div className="theme-options" role="radiogroup" aria-label={t("App appearance", "应用外观")}>{themeOptions.map((option) => { const Icon = option.icon; const label = option.value === "system" ? t("System", "跟随系统") : option.value === "light" ? t("Light", "浅色") : t("Dark", "深色"); return <button type="button" role="radio" aria-checked={theme === option.value} className={theme === option.value ? "active" : ""} key={option.value} onClick={() => onThemeChange(option.value)}><Icon size={17} /><span>{label}</span>{theme === option.value && <Check size={14} />}</button>; })}</div></section>
          <section className="settings-group language-settings" aria-labelledby="language-heading"><div className="settings-group-title"><div><h3 id="language-heading">{t("Language", "语言")}</h3><p>{t("Change the interface language instantly.", "即时切换应用界面语言。")}</p></div></div><div className="language-setting-row"><span className="directory-icon"><Globe2 size={18} /></span><span><strong>{t("Interface language", "界面语言")}</strong><small>{t("English is the default on a new installation.", "新安装默认使用英文。")}</small></span><div className="settings-segment language-segment" role="group" aria-label={t("Interface language", "界面语言")}><button type="button" className={language === "en" ? "active" : ""} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>English</button><button type="button" className={language === "zh-CN" ? "active" : ""} aria-pressed={language === "zh-CN"} onClick={() => setLanguage("zh-CN")}>简体中文</button></div></div></section>
        </div>
      </div>
      <footer className="settings-footer">
        <span className="settings-footer-status"><Check size={13} aria-hidden="true" />{t("Changes save automatically on this device", "更改会自动保存在这台设备上")}</span>
        <button data-dialog-primary type="button" onClick={onClose}>{t("Done", "完成")}</button>
      </footer>
    </section>
  </div>;
}

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenRepository: () => void;
  onFeedback: () => void;
}

export function AboutDialog({ open, onClose, onOpenRepository, onFeedback }: AboutDialogProps) {
  const { t } = useI18n();
  const dialogRef = useDialogFocus(open, onClose);
  if (!open) return null;
  return <div className="sheet-backdrop about-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={dialogRef} className="workspace-dialog about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <button className="icon-button about-close" type="button" onClick={onClose} aria-label={t("Close about Manuslate", "关闭关于 Manuslate")}><X size={17} /></button>
      <div className="about-hero">
        <img src="/manuslate-icon-v1-128.png" alt="" />
        <div><h2 id="about-title">Manuslate</h2><p>{t("Markdown, precisely yours.", "让 Markdown 精确属于你。")}</p></div>
      </div>
      <div className="about-version"><span>{t("Version", "版本")}</span><strong>0.1.0</strong><span className="about-badge">{t("Open source", "开源")}</span></div>
      <p className="about-description">{t("A refined, local-first Markdown editor and document library. Your files stay plain, portable, and under your control.", "一款精致、本地优先的 Markdown 编辑器与文稿资料库。文件始终保持普通、可迁移，并由你掌控。")}</p>
      <div className="about-principles"><span>{t("Local first", "本地优先")}</span><span>{t("Plain Markdown", "纯 Markdown")}</span><span>{t("No account", "无需账号")}</span></div>
      <footer className="about-actions"><button type="button" onClick={onOpenRepository}><GitFork size={16} />{t("GitHub repository", "GitHub 仓库")}<ExternalLink size={13} /></button><button className="primary" data-dialog-primary type="button" onClick={onFeedback}><MessageCircle size={16} />{t("Send feedback", "提交反馈")}</button></footer>
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
  const { t } = useI18n();
  const open = Boolean(conflict);
  const dialogRef = useDialogFocus(open, onClose);
  const diff = useMemo(() => conflict ? lineDiff(conflict.diskContent, document.content) : [], [conflict, document.content]);
  if (!conflict) return null;
  return <div className="sheet-backdrop"><section ref={dialogRef} className="workspace-dialog conflict-dialog" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title" aria-describedby="conflict-description"><header><div><span className="dialog-mark warning"><AlertTriangle size={18} /></span><div><h2 id="conflict-title">{t("The file changed on disk", "文件在磁盘上发生了变化")}</h2><p id="conflict-description">{t("Keep the disk version or overwrite it with your current edit.", "请选择保留电脑上的版本，或用当前编辑内容覆盖它。")}</p></div></div><button className="icon-button" onClick={onClose} aria-label={t("Decide later", "稍后处理")}><X size={17} /></button></header><div className="conflict-summary"><span><HardDriveDownload size={15} />{t("Disk version", "磁盘版本")}</span><span>→</span><span><Save size={15} />{t("Current edit", "当前编辑")}</span></div><pre className="conflict-diff">{diff.slice(0, 180).map((line, index) => <span className={`diff-${line.kind}`} key={`${index}-${line.text}`}>{line.kind === "add" ? "+ " : line.kind === "remove" ? "− " : "  "}{line.text || " "}</span>)}</pre><footer className="conflict-actions"><button data-dialog-primary type="button" onClick={onUseDisk}><HardDriveDownload size={15} />{t("Use disk version", "使用磁盘版本")}</button><button className="primary" type="button" onClick={onOverwrite}><Save size={15} />{t("Overwrite disk file", "覆盖磁盘文件")}</button></footer></section></div>;
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
  const { t } = useI18n();
  const dialogRef = useDialogFocus(open, onClose);
  if (!open) return null;
  return <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} className="workspace-dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><header><div><span className="dialog-mark warning"><Trash2 size={18} /></span><div><h2 id="confirm-title">{title}</h2><p id="confirm-description">{description}</p></div></div><button className="icon-button" onClick={onClose} aria-label={t("Cancel", "取消")}><X size={17} /></button></header><footer className="conflict-actions"><button data-dialog-primary type="button" onClick={onClose}>{t("Cancel", "取消")}</button><button className="danger-primary" type="button" onClick={onConfirm}><Trash2 size={15} />{confirmLabel}</button></footer></section></div>;
}
