import { Check, ChevronDown, ChevronRight, FileText, Folder, FolderPlus, Inbox, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LibraryCategory, MarkdownDocument } from "../types";

interface LibraryTreeProps {
  documents: MarkdownDocument[];
  categories: LibraryCategory[];
  activeId: string;
  searching: boolean;
  onSelect: (id: string) => void;
  onCreateCategory: (name: string) => string | undefined;
  onRenameCategory: (id: string, name: string) => void;
  onDeleteCategory: (id: string) => void;
  onMoveDocument: (documentId: string, categoryId?: string) => void;
  onDeleteDocument: (documentId: string) => void;
}

function withoutExtension(name: string): string {
  return name.replace(/\.(md|markdown|mdown|txt)$/i, "");
}

function snippet(content: string): string {
  return content.split("\n").map((line) => line.replace(/^#{1,6}\s+/, "").replace(/[*_`>[\]()!-]/g, " ").trim()).find(Boolean) || "还没有内容";
}

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(timestamp);
}

export default function LibraryTree({ documents, categories, activeId, searching, onSelect, onCreateCategory, onRenameCategory, onDeleteCategory, onMoveDocument, onDeleteDocument }: LibraryTreeProps) {
  const [expanded, setExpanded] = useState(() => new Set<string>(["uncategorized", ...categories.map((item) => item.id)]));
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [documentMenuId, setDocumentMenuId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    setExpanded((current) => new Set([...current, ...categories.map((item) => item.id)]));
  }, [categories]);

  useEffect(() => {
    const dismissMenus = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
      } else if ((event.target as Element | null)?.closest(".category-menu, .category-more, .document-more")) {
        return;
      }
      setMenuId(null);
      setDocumentMenuId(null);
    };
    document.addEventListener("pointerdown", dismissMenus);
    document.addEventListener("keydown", dismissMenus);
    return () => {
      document.removeEventListener("pointerdown", dismissMenus);
      document.removeEventListener("keydown", dismissMenus);
    };
  }, []);

  const sorted = useMemo(() => [...documents].sort((a, b) => b.updatedAt - a.updatedAt), [documents]);
  const validCategories = new Set(categories.map((item) => item.id));
  const uncategorized = sorted.filter((item) => !item.categoryId || !validCategories.has(item.categoryId));

  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });

  const commitCreate = () => {
    const name = createName.trim(); if (!name) { setCreating(false); return; }
    onCreateCategory(name); setCreateName(""); setCreating(false);
  };

  const commitRename = (id: string) => {
    const name = editName.trim();
    if (name && id === "uncategorized") {
      const categoryId = onCreateCategory(name);
      if (categoryId) uncategorized.forEach((item) => onMoveDocument(item.id, categoryId));
    } else if (name) onRenameCategory(id, name);
    setEditingId(null); setMenuId(null);
  };

  const dropDocument = (event: React.DragEvent, categoryId?: string) => {
    event.preventDefault();
    const documentId = event.dataTransfer.getData("application/x-patchmark-document");
    if (documentId) onMoveDocument(documentId, categoryId);
    setDropTarget(null);
  };

  const renderDocument = (item: MarkdownDocument) => (
    <div className="tree-document-wrap" key={item.id} draggable
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setDocumentMenuId(item.id); setMenuId(null); }}
      onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-patchmark-document", item.id); }}>
      <button className={`tree-document${item.id === activeId ? " active" : ""}`} type="button" onClick={() => onSelect(item.id)}>
        <FileText size={15} aria-hidden="true" />
        <span><strong>{withoutExtension(item.name)}</strong><small>{snippet(item.content)}</small></span>
        <time>{relativeTime(item.updatedAt)}</time>
      </button>
      <button className="document-more" type="button" aria-label={`${withoutExtension(item.name)}文稿操作`} aria-expanded={documentMenuId === item.id} onClick={() => { setDocumentMenuId((current) => current === item.id ? null : item.id); setMenuId(null); }}><MoreHorizontal size={14} /></button>
      {documentMenuId === item.id && <div className="category-menu document-menu" role="menu" aria-label={`${withoutExtension(item.name)}文稿操作`}>
        <span>修改分类</span>
        {categories.map((category) => <button className={item.categoryId === category.id ? "is-current" : ""} type="button" role="menuitemradio" aria-checked={item.categoryId === category.id} key={category.id} onClick={() => { onMoveDocument(item.id, category.id); setDocumentMenuId(null); }}><Folder size={14} />{category.name}{item.categoryId === category.id && <Check className="menu-check" size={13} />}</button>)}
        <button className={!item.categoryId ? "is-current" : ""} type="button" role="menuitemradio" aria-checked={!item.categoryId} onClick={() => { onMoveDocument(item.id); setDocumentMenuId(null); }}><Inbox size={14} />未分类{!item.categoryId && <Check className="menu-check" size={13} />}</button>
        <div className="menu-separator" role="separator" />
        <button className="danger" type="button" role="menuitem" onClick={() => { onDeleteDocument(item.id); setDocumentMenuId(null); }}><Trash2 size={14} />删除文稿</button>
      </div>}
    </div>
  );

  if (searching) {
    return <div className="library-tree"><div className="tree-section-title"><span>搜索结果</span><span>{sorted.length}</span></div><div className="search-tree-results">{sorted.map(renderDocument)}{!sorted.length && <div className="rail-empty">没有匹配的文稿</div>}</div></div>;
  }

  return (
    <div className="library-tree">
      <div className="tree-section-title"><span>分类</span><button type="button" onClick={() => { setCreating(true); setMenuId(null); }} aria-label="新建分类" title="新建分类"><FolderPlus size={15} /></button></div>
      <p className="tree-hint">拖动文稿即可归类</p>
      {creating && <div className="category-editor"><Folder size={15} /><input autoFocus value={createName} onChange={(event) => setCreateName(event.target.value)} onBlur={commitCreate} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { event.preventDefault(); setCreating(false); } }} placeholder="分类名称" aria-label="分类名称" /></div>}

      {categories.map((category) => {
        const children = sorted.filter((item) => item.categoryId === category.id);
        const isExpanded = expanded.has(category.id);
        return <section className={`category-group${dropTarget === category.id ? " is-drop-target" : ""}`} key={category.id} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget(category.id); }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => dropDocument(event, category.id)}>
          <div className="category-row" onContextMenu={(event) => { event.preventDefault(); setMenuId(category.id); setDocumentMenuId(null); }}>
            {editingId === category.id ? <div className="category-rename"><Folder size={16} /><input autoFocus value={editName} aria-label="重命名分类" onChange={(event) => setEditName(event.target.value)} onBlur={() => commitRename(category.id)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { event.preventDefault(); setEditingId(null); } }} /></div> : <button className="category-toggle" type="button" onClick={() => toggle(category.id)} aria-expanded={isExpanded}>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<Folder size={16} /><span>{category.name}</span><small>{children.length}</small></button>}
            <button className="category-more" type="button" aria-label={`${category.name}分类操作`} aria-expanded={menuId === category.id} onClick={() => setMenuId((current) => current === category.id ? null : category.id)}><MoreHorizontal size={15} /></button>
            {menuId === category.id && <div className="category-menu" role="menu" aria-label={`${category.name}分类操作`}><button type="button" role="menuitem" onClick={() => { setEditingId(category.id); setEditName(category.name); setMenuId(null); }}><Pencil size={14} />重命名分类</button><button className="danger" type="button" role="menuitem" onClick={() => { onDeleteCategory(category.id); setMenuId(null); }}><Trash2 size={14} />删除分类</button></div>}
          </div>
          {isExpanded && <div className="category-documents">{children.map(renderDocument)}{!children.length && <div className="category-empty">把相近的文稿拖到这里</div>}</div>}
        </section>;
      })}

      {(uncategorized.length > 0 || categories.length === 0) && <section className={`category-group uncategorized${dropTarget === "uncategorized" ? " is-drop-target" : ""}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget("uncategorized"); }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => dropDocument(event)}>
        <div className="category-row" onContextMenu={(event) => { event.preventDefault(); setMenuId("uncategorized"); setDocumentMenuId(null); }}>
          {editingId === "uncategorized" ? <div className="category-rename"><Folder size={16} /><input autoFocus value={editName} aria-label="重命名未分类" onChange={(event) => setEditName(event.target.value)} onBlur={() => commitRename("uncategorized")} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { event.preventDefault(); setEditingId(null); } }} /></div> : <button className="category-toggle" type="button" onClick={() => toggle("uncategorized")} aria-expanded={expanded.has("uncategorized")}>{expanded.has("uncategorized") ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<Inbox size={16} /><span>未分类</span><small>{uncategorized.length}</small></button>}
          {menuId === "uncategorized" && <div className="category-menu uncategorized-menu" role="menu" aria-label="整理未分类">
            <span>整理未分类</span>
            {categories.map((category) => <button type="button" role="menuitem" key={category.id} disabled={!uncategorized.length} onClick={() => { uncategorized.forEach((item) => onMoveDocument(item.id, category.id)); setMenuId(null); }}><Folder size={14} />全部移到“{category.name}”</button>)}
            <button type="button" role="menuitem" onClick={() => { setEditingId("uncategorized"); setEditName("未分类"); setMenuId(null); }}><Pencil size={14} />重命名为分类</button>
          </div>}
        </div>
        {expanded.has("uncategorized") && <div className="category-documents">{uncategorized.map(renderDocument)}{!uncategorized.length && <div className="category-empty">暂时没有文稿</div>}</div>}
      </section>}
    </div>
  );
}
