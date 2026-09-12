import { ArchiveRestore, Clock3, FilePlus2, RotateCcw, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { lineDiff } from "../lib/diff";
import type { DocumentTemplate, MarkdownDocument, TrashEntry, VersionSnapshot } from "../types";

interface TemplateDialogProps {
  open: boolean;
  templates: DocumentTemplate[];
  onClose: () => void;
  onCreate: (template: DocumentTemplate) => void;
}

export function TemplateDialog({ open, templates, onClose, onCreate }: TemplateDialogProps) {
  if (!open) return null;
  return <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="template-title"><header><div><span className="dialog-mark"><FilePlus2 size={18} /></span><div><h2 id="template-title">新建文稿</h2><p>模板只是普通 Markdown 的起点</p></div></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={17} /></button></header><div className="template-grid">{templates.map((template) => <button type="button" key={template.id} onClick={() => onCreate(template)}><FilePlus2 size={19} /><strong>{template.name}</strong><span>{template.description}</span></button>)}</div></section></div>;
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
  if (!open) return null;
  return <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="workspace-dialog history-dialog" role="dialog" aria-modal="true" aria-labelledby="history-title"><header><div><span className="dialog-mark"><Clock3 size={18} /></span><div><h2 id="history-title">版本记录</h2><p>自动保留关键写作节点，可随时回到过去</p></div></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={17} /></button></header><div className="history-layout"><aside><button className="named-version-button" type="button" onClick={onNameVersion}>保存当前版本</button>{versions.map((version) => <button type="button" key={version.id} className={selected?.id === version.id ? "active" : ""} onClick={() => setSelectedId(version.id)}><strong>{version.name}</strong><time>{new Date(version.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></button>)}{!versions.length && <p className="dialog-empty">开始编辑后会自动生成版本。</p>}</aside><div className="diff-panel">{selected ? <>{<div className="diff-title"><span>所选版本 → 当前内容</span><button type="button" onClick={() => onRestore(selected)}><RotateCcw size={14} />恢复此版本</button></div>}<pre>{diff.map((line, index) => <span className={`diff-${line.kind}`} key={`${index}-${line.text}`}>{line.kind === "add" ? "+ " : line.kind === "remove" ? "− " : "  "}{line.text || " "}</span>)}</pre></> : <div className="dialog-empty centered">还没有可比较的版本</div>}</div></div></section></div>;
}

interface TrashDialogProps {
  open: boolean;
  entries: TrashEntry[];
  onClose: () => void;
  onRestore: (entry: TrashEntry) => void;
  onDelete: (entry: TrashEntry) => void;
}

export function TrashDialog({ open, entries, onClose, onRestore, onDelete }: TrashDialogProps) {
  if (!open) return null;
  return <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="workspace-dialog trash-dialog" role="dialog" aria-modal="true" aria-labelledby="trash-title"><header><div><span className="dialog-mark"><Trash2 size={18} /></span><div><h2 id="trash-title">最近删除</h2><p>删除的资料库记录保存在本机</p></div></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={17} /></button></header><div className="trash-list">{entries.map((entry) => <article key={entry.document.id}><div><strong>{entry.document.name}</strong><time>{new Date(entry.deletedAt).toLocaleString("zh-CN")}</time></div><button type="button" onClick={() => onRestore(entry)}><ArchiveRestore size={15} />恢复</button><button className="danger" type="button" onClick={() => onDelete(entry)}><Trash2 size={15} />永久删除</button></article>)}{!entries.length && <div className="dialog-empty centered">最近删除是空的</div>}</div></section></div>;
}
