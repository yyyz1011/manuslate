export type ViewName = "overview" | "library" | "editor" | "inbox" | "settings";

export type IssueKind =
  | "missing-title"
  | "invalid-frontmatter"
  | "broken-link"
  | "missing-asset"
  | "orphan"
  | "duplicate";

export type IssueSeverity = "error" | "warning" | "info";

export interface FileIssue {
  id: string;
  kind: IssueKind;
  severity: IssueSeverity;
  label: string;
  detail: string;
  target?: string;
}

export interface MarkdownLink {
  target: string;
  isImage: boolean;
  isWiki: boolean;
}

export interface OutlineItem {
  level: number;
  text: string;
  line: number;
}

export interface MarkdownRecord {
  id: string;
  name: string;
  relativePath: string;
  folder: string;
  title: string;
  excerpt: string;
  content: string;
  originalContent: string;
  wordCount: number;
  lineCount: number;
  updatedAt: number;
  tags: string[];
  status: string;
  frontmatter: Record<string, unknown>;
  links: MarkdownLink[];
  outline: OutlineItem[];
  issues: FileIssue[];
  hash: string;
  handle?: FileSystemFileHandle;
  source: "demo" | "local";
}

export interface WorkspaceSnapshot {
  name: string;
  files: MarkdownRecord[];
  source: "demo" | "local";
  scannedAt: number;
}

export interface ScanProgress {
  scanned: number;
  currentPath: string;
}

export interface AiConnectionDraft {
  provider: "openai-compatible" | "ollama" | "lm-studio";
  endpoint: string;
  model: string;
  apiKey: string;
}
