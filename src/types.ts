export type ViewMode = "live" | "source" | "preview" | "split";
export type ThemeMode = "system" | "light" | "dark";

export interface MarkdownDocument {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  source: "local" | "draft" | "sample";
}
export interface OutlineItem {
  id: string;
  level: number;
  text: string;
}
