import { AlertTriangle, ArchiveRestore, Clock3, FilePlus2, HardDriveDownload, Save, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { lineDiff } from "../lib/diff";
import type { DocumentTemplate, FileConflict, MarkdownDocument, TrashEntry, VersionSnapshot } from "../types";

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
