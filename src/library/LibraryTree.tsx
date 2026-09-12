import { Check, ChevronDown, ChevronRight, FileText, Folder, FolderOpen, FolderPlus, Inbox, MoreHorizontal, Pencil, Pin, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LibraryCategory, MarkdownDocument } from "../types";

interface LibraryTreeProps {
  documents: MarkdownDocument[];
  categories: LibraryCategory[];
  activeId: string;
  searching: boolean;
  onSelect: (id: string) => void;
  onCreateCategory: (name: string, parentId?: string) => string | undefined;
  onRenameCategory: (id: string, name: string) => void;
  onDeleteCategory: (id: string) => void;
  onMoveDocument: (documentId: string, categoryId?: string) => void;
  onDeleteDocument: (documentId: string) => void;
  onTogglePinned: (documentId: string) => void;
}

function withoutExtension(name: string): string { return name.replace(/\.(md|markdown|mdown|txt)$/i, ""); }
function snippet(content: string): string { return content.split("\n").map((line) => line.replace(/^#{1,6}\s+/, "").replace(/[*_`>[\]()!-]/g, " ").trim()).find(Boolean) || "还没有内容"; }
function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(timestamp);
}

interface PathFolder {
  name: string;
  path: string;
  documents: MarkdownDocument[];
  children: PathFolder[];
}

function buildPathTree(documents: MarkdownDocument[]): { root: MarkdownDocument[]; folders: PathFolder[] } {
  const root: MarkdownDocument[] = [];
  const folders = new Map<string, PathFolder>();

  for (const document of documents) {
    const parts = (document.path || "").split("/").filter(Boolean);
    const directoryParts = parts.length > 1 ? parts.slice(1, -1) : [];
    if (!directoryParts.length) { root.push(document); continue; }

    let parent: PathFolder | undefined;
    directoryParts.forEach((name, index) => {
      const path = directoryParts.slice(0, index + 1).join("/");
      let folder = folders.get(path);
      if (!folder) {
        folder = { name, path, documents: [], children: [] };
        folders.set(path, folder);
        if (parent) parent.children.push(folder);
      }
      parent = folder;
    });
    parent?.documents.push(document);
  }

  const topLevel = [...folders.values()].filter((folder) => !folder.path.includes("/"));
  const sortFolders = (items: PathFolder[]) => items.sort((a, b) => a.name.localeCompare(b.name, "zh-CN")).forEach((item) => sortFolders(item.children));
  sortFolders(topLevel);
  return { root, folders: topLevel };
}

function folderDocumentCount(folder: PathFolder): number {
  return folder.documents.length + folder.children.reduce((total, child) => total + folderDocumentCount(child), 0);
}

export default function LibraryTree({ documents, categories, activeId, searching, onSelect, onCreateCategory, onRenameCategory, onDeleteCategory, onMoveDocument, onDeleteDocument, onTogglePinned }: LibraryTreeProps) {
  const [expanded, setExpanded] = useState(() => new Set<string>(["pinned", "uncategorized", ...categories.map((item) => item.id)]));
  const [creatingParent, setCreatingParent] = useState<string | null | undefined>(undefined);
  const [createName, setCreateName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [documentMenuId, setDocumentMenuId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => { setExpanded((current) => new Set([...current, ...categories.map((item) => item.id)])); }, [categories]);
  useEffect(() => {
    const dismiss = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key !== "Escape" : (event.target as Element | null)?.closest(".category-menu, .category-more, .document-more")) return;
      setMenuId(null); setDocumentMenuId(null);
    };
    document.addEventListener("pointerdown", dismiss); document.addEventListener("keydown", dismiss);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", dismiss); };
  }, []);

  const sorted = useMemo(() => [...documents].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt), [documents]);
  const validCategories = new Set(categories.map((item) => item.id));
  const uncategorized = sorted.filter((item) => !item.categoryId || !validCategories.has(item.categoryId));
  const pinned = sorted.filter((item) => item.pinned);
  const rootCategories = categories.filter((item) => !item.parentId || !validCategories.has(item.parentId));

  const toggle = (id: string) => setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const commitCreate = () => {
    const name = createName.trim(); if (!name) { setCreatingParent(undefined); return; }
    onCreateCategory(name, creatingParent || undefined); setCreateName(""); setCreatingParent(undefined);
  };
  const commitRename = (id: string) => {
    const name = editName.trim();
    if (name && id === "uncategorized") { const categoryId = onCreateCategory(name); if (categoryId) uncategorized.forEach((item) => onMoveDocument(item.id, categoryId)); }
    else if (name) onRenameCategory(id, name);
    setEditingId(null); setMenuId(null);
  };
  const dropDocument = (event: React.DragEvent, categoryId?: string) => { event.preventDefault(); const documentId = event.dataTransfer.getData("application/x-patchmark-document"); if (documentId) onMoveDocument(documentId, categoryId); setDropTarget(null); };
  const selectRow = (event: React.MouseEvent, item: MarkdownDocument) => {
    if (event.metaKey || event.ctrlKey) setSelectedIds((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; });
    else { setSelectedIds(new Set()); onSelect(item.id); }
  };

  const renderDocument = (item: MarkdownDocument, shortcut = false) => {
    const menuKey = shortcut ? `pinned:${item.id}` : item.id;
    return (
    <div className={`tree-document-wrap${selectedIds.has(item.id) ? " is-selected" : ""}`} key={`${shortcut ? "shortcut-" : ""}${item.id}`} draggable={!shortcut}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setDocumentMenuId(menuKey); setMenuId(null); }}
      onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-patchmark-document", item.id); }}>
      <button className={`tree-document${item.id === activeId ? " active" : ""}`} type="button" onClick={(event) => selectRow(event, item)}>
        {selectedIds.has(item.id) ? <Check size={15} aria-hidden="true" /> : item.pinned ? <Pin size={14} aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}
        <span><strong title={item.path || item.name}>{withoutExtension(item.name)}</strong><small>{item.path ? `${item.path.split("/").slice(0, -1).join("/")} · ${snippet(item.content)}` : snippet(item.content)}</small></span><time>{relativeTime(item.updatedAt)}</time>
      </button>
      <button className="document-more" type="button" aria-label={`${withoutExtension(item.name)}文稿操作`} aria-expanded={documentMenuId === menuKey} onClick={() => { setDocumentMenuId((current) => current === menuKey ? null : menuKey); setMenuId(null); }}><MoreHorizontal size={14} /></button>
      {documentMenuId === menuKey && <div className="category-menu document-menu" role="menu" aria-label={`${withoutExtension(item.name)}文稿操作`}>
        <button type="button" role="menuitemcheckbox" aria-checked={Boolean(item.pinned)} onClick={() => { onTogglePinned(item.id); setDocumentMenuId(null); }}><Pin size={14} />{item.pinned ? "取消置顶" : "置顶文稿"}</button><div className="menu-separator" />
        <span>修改分类</span>{categories.map((category) => <button className={item.categoryId === category.id ? "is-current" : ""} type="button" role="menuitemradio" aria-checked={item.categoryId === category.id} key={category.id} onClick={() => { onMoveDocument(item.id, category.id); setDocumentMenuId(null); }}><Folder size={14} />{category.name}{item.categoryId === category.id && <Check className="menu-check" size={13} />}</button>)}
        <button className={!item.categoryId ? "is-current" : ""} type="button" role="menuitemradio" aria-checked={!item.categoryId} onClick={() => { onMoveDocument(item.id); setDocumentMenuId(null); }}><Inbox size={14} />未分类{!item.categoryId && <Check className="menu-check" size={13} />}</button><div className="menu-separator" />
        <button className="danger" type="button" role="menuitem" onClick={() => { onDeleteDocument(item.id); setDocumentMenuId(null); }}><Trash2 size={14} />移到最近删除</button>
      </div>}
    </div>
    );
  };

  const renderPathFolder = (folder: PathFolder, categoryKey: string, depth = 0): React.ReactNode => {
    const key = `path:${categoryKey}:${folder.path}`;
    const isExpanded = expanded.has(key);
    return <section className={`path-folder depth-${Math.min(depth, 3)}`} key={key}>
      <button className="path-folder-toggle" type="button" onClick={() => toggle(key)} aria-expanded={isExpanded} title={folder.path}>
        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {isExpanded ? <FolderOpen size={15} /> : <Folder size={15} />}
        <span>{folder.name}</span><small>{folderDocumentCount(folder)}</small>
      </button>
      {isExpanded && <div className="path-folder-contents">{folder.children.map((child) => renderPathFolder(child, categoryKey, depth + 1))}{folder.documents.map((item) => renderDocument(item))}</div>}
    </section>;
  };

  const renderDocumentsWithPaths = (items: MarkdownDocument[], categoryKey: string) => {
    const tree = buildPathTree(items);
    return <>{tree.folders.map((folder) => renderPathFolder(folder, categoryKey))}{tree.root.map((item) => renderDocument(item))}</>;
  };

  const renderCategory = (category: LibraryCategory, depth = 0): React.ReactNode => {
    const children = sorted.filter((item) => item.categoryId === category.id);
    const nested = categories.filter((item) => item.parentId === category.id);
    const isExpanded = expanded.has(category.id);
    return <section className={`category-group depth-${Math.min(depth, 3)}${dropTarget === category.id ? " is-drop-target" : ""}`} style={{ "--tree-depth": depth } as React.CSSProperties} key={category.id} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; setDropTarget(category.id); }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => dropDocument(event, category.id)}>
      <div className="category-row" onContextMenu={(event) => { event.preventDefault(); setMenuId(category.id); setDocumentMenuId(null); }}>
        {editingId === category.id ? <div className="category-rename"><Folder size={16} /><input autoFocus value={editName} aria-label="重命名分类" onChange={(event) => setEditName(event.target.value)} onBlur={() => commitRename(category.id)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { event.preventDefault(); setEditingId(null); } }} /></div> : <button className="category-toggle" type="button" onClick={() => toggle(category.id)} aria-expanded={isExpanded}>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<Folder size={16} /><span>{category.name}</span><small>{children.length + nested.length}</small></button>}
        <button className="category-more" type="button" aria-label={`${category.name}分类操作`} aria-expanded={menuId === category.id} onClick={() => setMenuId((current) => current === category.id ? null : category.id)}><MoreHorizontal size={15} /></button>
        {menuId === category.id && <div className="category-menu" role="menu" aria-label={`${category.name}分类操作`}><button type="button" role="menuitem" onClick={() => { setCreatingParent(category.id); setExpanded((current) => new Set(current).add(category.id)); setMenuId(null); }}><FolderPlus size={14} />新建子分类</button><button type="button" role="menuitem" onClick={() => { setEditingId(category.id); setEditName(category.name); setMenuId(null); }}><Pencil size={14} />重命名分类</button><button className="danger" type="button" role="menuitem" onClick={() => { onDeleteCategory(category.id); setMenuId(null); }}><Trash2 size={14} />删除分类</button></div>}
      </div>
      {isExpanded && <div className="category-documents">{creatingParent === category.id && <div className="category-editor nested-editor"><Folder size={15} /><input autoFocus value={createName} onChange={(event) => setCreateName(event.target.value)} onBlur={commitCreate} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setCreatingParent(undefined); }} placeholder="子分类名称" /></div>}{nested.map((item) => renderCategory(item, depth + 1))}{renderDocumentsWithPaths(children, category.id)}{!children.length && !nested.length && creatingParent !== category.id && <div className="category-empty">把相近的文稿拖到这里</div>}</div>}
    </section>;
  };

  if (searching) return <div className="library-tree"><div className="tree-section-title"><span>筛选结果</span><span>{sorted.length}</span></div><div className="search-tree-results">{sorted.map((item) => renderDocument(item))}{!sorted.length && <div className="rail-empty">没有匹配的文稿</div>}</div></div>;

  return <div className="library-tree">
    {selectedIds.size > 0 && <div className="batch-bar"><strong>已选 {selectedIds.size}</strong><select aria-label="批量移动到分类" defaultValue="" onChange={(event) => { const target = event.currentTarget.value; selectedIds.forEach((id) => onMoveDocument(id, target === "uncategorized" ? undefined : target)); setSelectedIds(new Set()); }}><option value="" disabled>移动到…</option><option value="uncategorized">未分类</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select><button type="button" onClick={() => setSelectedIds(new Set())} aria-label="取消选择"><X size={14} /></button></div>}
    {pinned.length > 0 && <section className="category-group pinned-group"><div className="category-row"><button className="category-toggle" type="button" onClick={() => toggle("pinned")} aria-expanded={expanded.has("pinned")}>{expanded.has("pinned") ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<Pin size={15} /><span>置顶</span><small>{pinned.length}</small></button></div>{expanded.has("pinned") && <div className="category-documents">{pinned.map((item) => renderDocument(item, true))}</div>}</section>}
    <div className="tree-section-title"><span>知识树</span><button type="button" onClick={() => { setCreatingParent(null); setMenuId(null); }} aria-label="新建分类" title="新建分类"><FolderPlus size={15} /></button></div><p className="tree-hint">拖动归类 · ⌘ 点击多选</p>
    {creatingParent === null && <div className="category-editor"><Folder size={15} /><input autoFocus value={createName} onChange={(event) => setCreateName(event.target.value)} onBlur={commitCreate} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setCreatingParent(undefined); }} placeholder="分类名称" aria-label="分类名称" /></div>}
    {rootCategories.map((category) => renderCategory(category))}
    {(uncategorized.length > 0 || categories.length === 0) && <section className={`category-group uncategorized${dropTarget === "uncategorized" ? " is-drop-target" : ""}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget("uncategorized"); }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => dropDocument(event)}><div className="category-row" onContextMenu={(event) => { event.preventDefault(); setMenuId("uncategorized"); setDocumentMenuId(null); }}>{editingId === "uncategorized" ? <div className="category-rename"><Folder size={16} /><input autoFocus value={editName} aria-label="重命名未分类" onChange={(event) => setEditName(event.target.value)} onBlur={() => commitRename("uncategorized")} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setEditingId(null); }} /></div> : <button className="category-toggle" type="button" onClick={() => toggle("uncategorized")} aria-expanded={expanded.has("uncategorized")}>{expanded.has("uncategorized") ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<Inbox size={16} /><span>未分类</span><small>{uncategorized.length}</small></button>}{menuId === "uncategorized" && <div className="category-menu uncategorized-menu" role="menu"><span>整理未分类</span>{categories.map((category) => <button type="button" key={category.id} disabled={!uncategorized.length} onClick={() => { uncategorized.forEach((item) => onMoveDocument(item.id, category.id)); setMenuId(null); }}><Folder size={14} />全部移到“{category.name}”</button>)}<button type="button" onClick={() => { setEditingId("uncategorized"); setEditName("未分类"); setMenuId(null); }}><Pencil size={14} />重命名为分类</button></div>}</div>{expanded.has("uncategorized") && <div className="category-documents">{renderDocumentsWithPaths(uncategorized, "uncategorized")}</div>}</section>}
  </div>;
}
