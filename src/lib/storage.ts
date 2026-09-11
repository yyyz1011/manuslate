import type { MarkdownDocument, ThemeMode, ViewMode } from "../types";

const DOCUMENTS_KEY = "patchmark-core.documents.v1";
const ACTIVE_KEY = "patchmark-core.active-document.v1";
const VIEW_KEY = "patchmark-core.view-mode.v1";
const THEME_KEY = "patchmark-core.theme.v1";

export const welcomeDocument: MarkdownDocument = {
  id: "welcome-to-patchmark",
  name: "欢迎使用 PatchMark.md",
  source: "sample",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  content: `# 写作，应该从正文开始

PatchMark 是一款安静、本地优先的 Markdown 编辑器。它不会用仪表盘挡住你的文档，也不会要求你先理解一套工作区规则。

## 这一版先做好什么

- **打开即读**：已有文档默认以排版后的阅读视图出现
- **一键编辑**：切换到编辑后，格式工具才会靠近正文出现
- **可靠保存**：本地草稿自动恢复，文件保存状态始终可见
- **保持开放**：你的内容始终是普通的 \`.md\` 文件

> 极简不是减少能力，而是让能力只在需要时出现。

## Markdown 示例

行内可以使用 **粗体**、*斜体*、\`代码\` 与 [链接](https://commonmark.org/)。

\`\`\`ts
const principle = "The document is the interface";
\`\`\`

| 模式 | 适合 |
| --- | --- |
| 阅读 | 校对与沉浸阅读 |
| 编辑 | 专注写作 |
| 分栏 | 对照源码与结果 |

- [x] 打开就是 Markdown
- [x] 不依赖账号
- [ ] 由你写下下一篇文档

---

双击正文，或点击顶部的「编辑」开始书写。
`,
};

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function loadDocuments(): MarkdownDocument[] {
  const saved = safeParse<MarkdownDocument[]>(localStorage.getItem(DOCUMENTS_KEY), []);
  return saved.length ? saved : [welcomeDocument];
}

export function saveDocuments(documents: MarkdownDocument[]): void {
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
}

export function loadActiveDocumentId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveDocumentId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function loadViewMode(): ViewMode {
  const value = localStorage.getItem(VIEW_KEY);
  return value === "write" || value === "split" || value === "preview" ? value : "preview";
}

export function saveViewMode(mode: ViewMode): void {
  localStorage.setItem(VIEW_KEY, mode);
}

export function loadTheme(): ThemeMode {
  const value = localStorage.getItem(THEME_KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function saveTheme(theme: ThemeMode): void {
  localStorage.setItem(THEME_KEY, theme);
}

