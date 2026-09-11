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

PatchMark 是一款安静、本地优先的 Markdown 编辑器。打开就是文稿，不需要账号，也不需要先理解一套工作区规则。

## 边写，边成为成稿

- **实时排版**：Markdown 标记只在光标所在行出现
- **原生资料库**：搜索、最近文稿和大纲保持在内容两侧
- **可靠保存**：恢复草稿自动保存，写入文件时状态清楚可见
- **开放格式**：内容始终是普通的 \`.md\` 文件

> 极简不是减少能力，而是让能力只在需要时出现。

## 丰富，但不笨重

行内可以使用 **粗体**、*斜体*、\`代码\` 与 [链接](https://commonmark.org/)。

公式也可以直接排版：$E = mc^2$。

\`\`\`ts
const principle = "The document is the interface";
\`\`\`

| 视图 | 适合 |
| --- | --- |
| 实时排版 | 日常写作 |
| 阅读 | 沉浸校对 |
| 源码 | 精确控制 Markdown |

- [x] 打开就是 Markdown
- [x] 不依赖账号
- [ ] 由你写下下一篇文档

---

顶部可以切换显示方式；底部的格式工具坞只在写作时出现。[^local]

[^local]: 草稿保存在当前浏览器，本地文件只会在你主动保存时写入。
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
  return saved.length
    ? saved.map((document) => {
        const untouchedLegacyWelcome = document.id === welcomeDocument.id
          && document.content.includes("## 这一版先做好什么")
          && document.content.includes("双击正文，或点击顶部的「编辑」开始书写。");
        return document.id === welcomeDocument.id && (document.source === "sample" || untouchedLegacyWelcome)
          ? welcomeDocument
          : document;
      })
    : [welcomeDocument];
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
  if (value === "write") return "live";
  return value === "live" || value === "source" || value === "split" || value === "preview" ? value : "live";
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
