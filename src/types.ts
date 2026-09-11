export type ViewMode = "live" | "source" | "preview" | "split";
export type ThemeMode = "system" | "light" | "dark";

export interface MarkdownDocument {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  source: "local" | "draft" | "sample";
  categoryId?: string;
  path?: string;
}
export interface LibraryCategory {
  id: string;
  name: string;
  createdAt: number;
}
export interface OutlineItem {
  id: string;
  level: number;
  text: string;
}
