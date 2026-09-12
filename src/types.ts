export type ViewMode = "live" | "source" | "preview" | "split";
export type ThemeMode = "system" | "light" | "dark";
export type ManuscriptTypeface = "sans" | "serif";

export interface EditorPreferences {
  manuscriptFontSize: number;
  sourceFontSize: number;
  lineHeight: number;
  manuscriptWidth: 640 | 760 | 900;
  typeface: ManuscriptTypeface;
}

export interface MarkdownDocument {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  source: "local" | "draft" | "sample";
  categoryId?: string;
  path?: string;
  nativePath?: string;
  diskModifiedAt?: number;
  diskContent?: string;
  pinned?: boolean;
}

export interface FileConflict {
  documentId: string;
  diskContent: string;
  diskModifiedAt: number;
}
export interface LibraryCategory {
  id: string;
  name: string;
  createdAt: number;
  parentId?: string;
}
export interface OutlineItem {
  id: string;
  level: number;
  text: string;
  line: number;
}

export interface VersionSnapshot {
  id: string;
  documentId: string;
  name: string;
  content: string;
  createdAt: number;
  kind: "auto" | "named";
}

export interface TrashEntry {
  document: MarkdownDocument;
  deletedAt: number;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
}
