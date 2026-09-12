import { Check, ChevronDown, ChevronRight, Circle, CircleCheck, FileText, Folder, FolderOpen, FolderPlus, Inbox, ListChecks, MoreHorizontal, Pencil, Pin, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
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
  onDeleteSelection: (selection: { documentIds: string[]; categoryIds: string[]; selectedCount: number; folderCount: number }) => void;
  onTogglePinned: (documentId: string) => void;
}

function withoutExtension(name: string): string { return name.replace(/\.(md|markdown|mdown|txt)$/i, ""); }
function snippet(content: string, emptyLabel: string): string { return content.split("\n").map((line) => line.replace(/^#{1,6}\s+/, "").replace(/[*_`>[\]()!-]/g, " ").trim()).find(Boolean) || emptyLabel; }
function relativeTime(timestamp: number, locale: string, justNow: string, minutesAgo: (count: number) => string, hoursAgo: (count: number) => string): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return justNow;
  if (diff < 3_600_000) return minutesAgo(Math.floor(diff / 60_000));
  if (diff < 86_400_000) return hoursAgo(Math.floor(diff / 3_600_000));
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(timestamp);
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

function folderDocumentIds(folder: PathFolder): string[] {
  return [...folder.documents.map((item) => item.id), ...folder.children.flatMap(folderDocumentIds)];
}

export default function LibraryTree({ documents, categories, activeId, searching, onSelect, onCreateCategory, onRenameCategory, onDeleteCategory, onMoveDocument, onDeleteDocument, onDeleteSelection, onTogglePinned }: LibraryTreeProps) {
  const { locale, t } = useI18n();
  const emptySnippet = t("No content yet", "还没有内容");
  const [expanded, setExpanded] = useState(() => new Set<string>(["pinned", "uncategorized", ...categories.map((item) => item.id)]));
  const [creatingParent, setCreatingParent] = useState<string | null | undefined>(undefined);
  const [createName, setCreateName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [documentMenuId, setDocumentMenuId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Map<string, string[]>>(new Map());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  useEffect(() => { setExpanded((current) => new Set([...current, ...categories.map((item) => item.id)])); }, [categories]);
  useEffect(() => {
    const documentIds = new Set(documents.map((item) => item.id));
    const categoryIds = new Set(categories.map((item) => item.id));
    setSelectedIds((current) => new Set([...current].filter((id) => documentIds.has(id))));
    setSelectedFolders((current) => new Map([...current].map(([key, ids]) => [key, ids.filter((id) => documentIds.has(id))] as const).filter(([, ids]) => ids.length > 0)));
    setSelectedCategories((current) => new Set([...current].filter((id) => categoryIds.has(id))));
  }, [categories, documents]);
  useEffect(() => {
    const dismiss = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key !== "Escape" : (event.target as Element | null)?.closest(".category-menu, .category-more, .document-more")) return;
      setMenuId(null); setDocumentMenuId(null);
      if (event instanceof KeyboardEvent) {
        setSelectionMode(false);
        setSelectedIds(new Set());
        setSelectedFolders(new Map());
        setSelectedCategories(new Set());
      }
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
  const clearSelection = (exitMode = false) => { setSelectedIds(new Set()); setSelectedFolders(new Map()); setSelectedCategories(new Set()); if (exitMode) setSelectionMode(false); };
  const toggleFolderSelection = (key: string, documentIds: string[]) => setSelectedFolders((current) => { const next = new Map(current); if (next.has(key)) next.delete(key); else next.set(key, documentIds); return next; });
  const toggleCategorySelection = (id: string) => setSelectedCategories((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const selectedDocumentIds = () => new Set([...selectedIds, ...[...selectedFolders.values()].flat()]);
  const selectedCount = selectedIds.size + selectedFolders.size + selectedCategories.size;
  const folderCount = selectedFolders.size + selectedCategories.size;
  const batchBar = selectedCount > 0 && <div className="batch-bar" role="toolbar" aria-label={t("Selected library items", "已选资料库项目")}>
    <strong>{t(`${selectedCount} selected`, `已选 ${selectedCount} 项`)}</strong>
    <select aria-label={t("Move selected documents", "批量移动到分类")} defaultValue="" disabled={selectedCategories.size > 0} title={selectedCategories.size > 0 ? t("Categories cannot be moved in a batch", "分类不能批量移动") : undefined} onChange={(event) => { const target = event.currentTarget.value; selectedDocumentIds().forEach((id) => onMoveDocument(id, target === "uncategorized" ? undefined : target)); clearSelection(true); }}><option value="" disabled>{t("Move to…", "移动到…")}</option><option value="uncategorized">{t("Uncategorized", "未分类")}</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select>
    <button className="danger" type="button" aria-label={t("Delete selected items", "删除所选项目")} title={t("Delete selected items", "删除所选项目")} onClick={() => onDeleteSelection({ documentIds: [...selectedDocumentIds()], categoryIds: [...selectedCategories], selectedCount, folderCount })}><Trash2 size={14} /></button>
    <button type="button" onClick={() => clearSelection(true)} aria-label={t("Exit selection", "退出多选")} title={t("Exit selection", "退出多选")}><X size={14} /></button>
  </div>;
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
  const dropDocument = (event: React.DragEvent, categoryId?: string) => { event.preventDefault(); const documentId = event.dataTransfer.getData("application/x-manuslate-document"); if (documentId) onMoveDocument(documentId, categoryId); setDropTarget(null); };
  const selectRow = (event: React.MouseEvent, item: MarkdownDocument) => {
    if (selectionMode || event.metaKey || event.ctrlKey) { setSelectionMode(true); setSelectedIds((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; }); }
    else { clearSelection(); onSelect(item.id); }
  };

  const renderDocument = (item: MarkdownDocument, shortcut = false) => {
    const menuKey = shortcut ? `pinned:${item.id}` : item.id;
    return (
    <div className={`tree-document-wrap${selectedIds.has(item.id) ? " is-selected" : ""}`} key={`${shortcut ? "shortcut-" : ""}${item.id}`} draggable={!shortcut}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setDocumentMenuId(menuKey); setMenuId(null); }}
      onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-manuslate-document", item.id); }}>
      <button className={`tree-document${item.id === activeId ? " active" : ""}`} type="button" onClick={(event) => selectRow(event, item)}>
        {selectionMode ? selectedIds.has(item.id) ? <CircleCheck size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" /> : selectedIds.has(item.id) ? <Check size={15} aria-hidden="true" /> : item.pinned ? <Pin size={14} aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}
        <span><strong title={item.path || item.name}>{withoutExtension(item.name)}</strong><small>{item.path ? `${item.path.split("/").slice(0, -1).join("/")} · ${snippet(item.content, emptySnippet)}` : snippet(item.content, emptySnippet)}</small></span><time>{relativeTime(item.updatedAt, locale, t("Just now", "刚刚"), (count) => t(`${count}m ago`, `${count} 分钟前`), (count) => t(`${count}h ago`, `${count} 小时前`))}</time>
      </button>
      <button className="document-more" type="button" aria-label={t(`${withoutExtension(item.name)} actions`, `${withoutExtension(item.name)}文稿操作`)} aria-expanded={documentMenuId === menuKey} onClick={() => { setDocumentMenuId((current) => current === menuKey ? null : menuKey); setMenuId(null); }}><MoreHorizontal size={14} /></button>
      {documentMenuId === menuKey && <div className="category-menu document-menu" role="menu" aria-label={t(`${withoutExtension(item.name)} actions`, `${withoutExtension(item.name)}文稿操作`)}>
        <button type="button" role="menuitemcheckbox" aria-checked={Boolean(item.pinned)} onClick={() => { onTogglePinned(item.id); setDocumentMenuId(null); }}><Pin size={14} />{item.pinned ? t("Unpin", "取消置顶") : t("Pin document", "置顶文稿")}</button><div className="menu-separator" />
        <span>{t("Move to category", "修改分类")}</span>{categories.map((category) => <button className={item.categoryId === category.id ? "is-current" : ""} type="button" role="menuitemradio" aria-checked={item.categoryId === category.id} key={category.id} onClick={() => { onMoveDocument(item.id, category.id); setDocumentMenuId(null); }}><Folder size={14} />{category.name}{item.categoryId === category.id && <Check className="menu-check" size={13} />}</button>)}
        <button className={!item.categoryId ? "is-current" : ""} type="button" role="menuitemradio" aria-checked={!item.categoryId} onClick={() => { onMoveDocument(item.id); setDocumentMenuId(null); }}><Inbox size={14} />{t("Uncategorized", "未分类")}{!item.categoryId && <Check className="menu-check" size={13} />}</button><div className="menu-separator" />
        <button className="danger" type="button" role="menuitem" onClick={() => { onDeleteDocument(item.id); setDocumentMenuId(null); }}><Trash2 size={14} />{t("Move to recently deleted", "移到最近删除")}</button>
      </div>}
    </div>
    );
  };

  const renderPathFolder = (folder: PathFolder, categoryKey: string, depth = 0): React.ReactNode => {
    const key = `path:${categoryKey}:${folder.path}`;
    const isExpanded = expanded.has(key);
    const isSelected = selectedFolders.has(key);
    return <section className={`path-folder depth-${Math.min(depth, 3)}${isSelected ? " is-selected" : ""}`} key={key}>
      <button className="path-folder-toggle" type="button" onClick={(event) => { if (selectionMode || event.metaKey || event.ctrlKey) { setSelectionMode(true); toggleFolderSelection(key, folderDocumentIds(folder)); } else toggle(key); }} aria-expanded={isExpanded} aria-pressed={isSelected} title={folder.path}>
        {selectionMode ? isSelected ? <CircleCheck size={14} /> : <Circle size={14} /> : isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
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
    const isSelected = selectedCategories.has(category.id);
    return <section className={`category-group depth-${Math.min(depth, 3)}${dropTarget === category.id ? " is-drop-target" : ""}${isSelected ? " is-selected" : ""}`} style={{ "--tree-depth": depth } as React.CSSProperties} key={category.id} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; setDropTarget(category.id); }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => dropDocument(event, category.id)}>
      <div className="category-row" onContextMenu={(event) => { event.preventDefault(); setMenuId(category.id); setDocumentMenuId(null); }}>
        {editingId === category.id ? <div className="category-rename"><Folder size={16} /><input autoFocus value={editName} aria-label={t("Rename category", "重命名分类")} onChange={(event) => setEditName(event.target.value)} onBlur={() => commitRename(category.id)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { event.preventDefault(); setEditingId(null); } }} /></div> : <button className="category-toggle" type="button" onClick={(event) => { if (selectionMode || event.metaKey || event.ctrlKey) { setSelectionMode(true); toggleCategorySelection(category.id); } else toggle(category.id); }} aria-expanded={isExpanded} aria-pressed={isSelected}>{selectionMode ? isSelected ? <CircleCheck size={14} /> : <Circle size={14} /> : isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<Folder size={16} /><span>{category.name}</span><small>{children.length + nested.length}</small></button>}
        <button className="category-more" type="button" aria-label={t(`${category.name} category actions`, `${category.name}分类操作`)} aria-expanded={menuId === category.id} onClick={() => setMenuId((current) => current === category.id ? null : category.id)}><MoreHorizontal size={15} /></button>
        {menuId === category.id && <div className="category-menu" role="menu" aria-label={t(`${category.name} category actions`, `${category.name}分类操作`)}><button type="button" role="menuitem" onClick={() => { setCreatingParent(category.id); setExpanded((current) => new Set(current).add(category.id)); setMenuId(null); }}><FolderPlus size={14} />{t("New subcategory", "新建子分类")}</button><button type="button" role="menuitem" onClick={() => { setEditingId(category.id); setEditName(category.name); setMenuId(null); }}><Pencil size={14} />{t("Rename category", "重命名分类")}</button><button className="danger" type="button" role="menuitem" onClick={() => { onDeleteCategory(category.id); setMenuId(null); }}><Trash2 size={14} />{t("Delete category", "删除分类")}</button></div>}
      </div>
      {isExpanded && <div className="category-documents">{creatingParent === category.id && <div className="category-editor nested-editor"><Folder size={15} /><input autoFocus value={createName} onChange={(event) => setCreateName(event.target.value)} onBlur={commitCreate} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setCreatingParent(undefined); }} placeholder={t("Subcategory name", "子分类名称")} /></div>}{nested.map((item) => renderCategory(item, depth + 1))}{renderDocumentsWithPaths(children, category.id)}{!children.length && !nested.length && creatingParent !== category.id && <div className="category-empty">{t("Drag related documents here", "把相近的文稿拖到这里")}</div>}</div>}
    </section>;
  };

  if (searching) return <div className={`library-tree${selectionMode ? " selection-mode" : ""}`}>{batchBar}<div className="tree-section-title"><span>{t("Filtered results", "筛选结果")}</span><div className="tree-section-actions"><small>{sorted.length}</small><button className={selectionMode ? "active" : ""} type="button" onClick={() => { if (selectionMode) clearSelection(true); else setSelectionMode(true); }} aria-pressed={selectionMode} aria-label={t("Select results", "选择结果")} title={t("Select results", "选择结果")}><ListChecks size={15} /></button></div></div><div className="search-tree-results">{sorted.map((item) => renderDocument(item))}{!sorted.length && <div className="rail-empty">{t("No matching documents", "没有匹配的文稿")}</div>}</div></div>;

  return <div className={`library-tree${selectionMode ? " selection-mode" : ""}`}>
    {batchBar}
    {pinned.length > 0 && <section className="category-group pinned-group"><div className="category-row"><button className="category-toggle" type="button" onClick={() => toggle("pinned")} aria-expanded={expanded.has("pinned")}>{expanded.has("pinned") ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<Pin size={15} /><span>{t("Pinned", "置顶")}</span><small>{pinned.length}</small></button></div>{expanded.has("pinned") && <div className="category-documents">{pinned.map((item) => renderDocument(item, true))}</div>}</section>}
    <div className="tree-section-title"><span>{t("Knowledge tree", "知识树")}</span><div className="tree-section-actions"><button className={selectionMode ? "active" : ""} type="button" onClick={() => { if (selectionMode) clearSelection(true); else { setSelectionMode(true); setMenuId(null); setDocumentMenuId(null); } }} aria-pressed={selectionMode} aria-label={t("Select items", "多选项目")} title={t("Select items", "多选项目")}><ListChecks size={15} /></button><button type="button" onClick={() => { setCreatingParent(null); setMenuId(null); }} aria-label={t("New category", "新建分类")} title={t("New category", "新建分类")}><FolderPlus size={15} /></button></div></div><p className="tree-hint">{selectionMode ? t("Choose documents, folders, or categories", "选择文稿、文件夹或分类") : t("Drag to organize · Select or ⌘ click", "拖动归类 · 点多选或按 ⌘ 点击")}</p>
    {creatingParent === null && <div className="category-editor"><Folder size={15} /><input autoFocus value={createName} onChange={(event) => setCreateName(event.target.value)} onBlur={commitCreate} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setCreatingParent(undefined); }} placeholder={t("Category name", "分类名称")} aria-label={t("Category name", "分类名称")} /></div>}
    {rootCategories.map((category) => renderCategory(category))}
    {(uncategorized.length > 0 || categories.length === 0) && <section className={`category-group uncategorized${dropTarget === "uncategorized" ? " is-drop-target" : ""}${selectedFolders.has("virtual:uncategorized") ? " is-selected" : ""}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget("uncategorized"); }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => dropDocument(event)}><div className="category-row" onContextMenu={(event) => { event.preventDefault(); setMenuId("uncategorized"); setDocumentMenuId(null); }}>{editingId === "uncategorized" ? <div className="category-rename"><Folder size={16} /><input autoFocus value={editName} aria-label={t("Rename uncategorized", "重命名未分类")} onChange={(event) => setEditName(event.target.value)} onBlur={() => commitRename("uncategorized")} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setEditingId(null); }} /></div> : <button className="category-toggle" type="button" onClick={(event) => { if (selectionMode || event.metaKey || event.ctrlKey) { setSelectionMode(true); toggleFolderSelection("virtual:uncategorized", uncategorized.map((item) => item.id)); } else toggle("uncategorized"); }} aria-expanded={expanded.has("uncategorized")} aria-pressed={selectedFolders.has("virtual:uncategorized")}>{selectionMode ? selectedFolders.has("virtual:uncategorized") ? <CircleCheck size={14} /> : <Circle size={14} /> : expanded.has("uncategorized") ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<Inbox size={16} /><span>{t("Uncategorized", "未分类")}</span><small>{uncategorized.length}</small></button>}{menuId === "uncategorized" && <div className="category-menu uncategorized-menu" role="menu"><span>{t("Organize uncategorized", "整理未分类")}</span>{categories.map((category) => <button type="button" key={category.id} disabled={!uncategorized.length} onClick={() => { uncategorized.forEach((item) => onMoveDocument(item.id, category.id)); setMenuId(null); }}><Folder size={14} />{t(`Move all to “${category.name}”`, `全部移到“${category.name}”`)}</button>)}<button type="button" onClick={() => { setEditingId("uncategorized"); setEditName(t("Uncategorized", "未分类")); setMenuId(null); }}><Pencil size={14} />{t("Turn into a category", "重命名为分类")}</button></div>}</div>{expanded.has("uncategorized") && <div className="category-documents">{renderDocumentsWithPaths(uncategorized, "uncategorized")}</div>}</section>}
  </div>;
}
