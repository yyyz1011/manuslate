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
  workspaceRoot?: string;
  source: "demo" | "local" | "desktop";
}

export interface IndexStatus {
  databasePath: string;
  databaseBytes: number;
  fileCount: number;
  lastScannedAt?: number;
  contentIndexed: boolean;
}

export interface ScanWarning {
  path: string;
  message: string;
}

export interface WorkspaceSnapshot {
  name: string;
  files: MarkdownRecord[];
  source: "demo" | "local" | "desktop";
  scannedAt: number;
  root?: string;
  index?: IndexStatus;
  warnings?: ScanWarning[];
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
