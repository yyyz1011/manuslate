import type { DocumentTemplate, EditorPreferences, LibraryCategory, MarkdownDocument, ThemeMode, TrashEntry, VersionSnapshot, ViewMode } from "../types";

const DOCUMENTS_KEY = "patchmark-core.documents.v1";
const ACTIVE_KEY = "patchmark-core.active-document.v1";
const VIEW_KEY = "patchmark-core.view-mode.v1";
const THEME_KEY = "patchmark-core.theme.v1";
const CATEGORIES_KEY = "patchmark-core.categories.v1";
const VERSIONS_KEY = "patchmark-core.versions.v1";
const TRASH_KEY = "patchmark-core.trash.v1";
const EDITOR_PREFERENCES_KEY = "patchmark-core.editor-preferences.v1";

export const defaultEditorPreferences: EditorPreferences = {
  manuscriptFontSize: 17,
  sourceFontSize: 15,
  lineHeight: 1.75,
  manuscriptWidth: 760,
  typeface: "sans",
};

export const welcomeDocument: MarkdownDocument = {
  id: "welcome-to-patchmark",
  name: "Welcome to Manuslate.md",
  source: "sample",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  content: `# Writing should begin with the document

Manuslate is a refined, local-first Markdown editor. It opens directly into your work—no account and no workspace ritual required.

## Write at the speed of thought

- **Live typesetting**: Markdown marks appear only where you are editing
- **Organized library**: import folders, classify documents, and keep the outline close
- **Reliable saves**: recovery drafts are automatic and disk writes stay visible
- **Open format**: your work always remains an ordinary \`.md\` file

> Minimal does not mean less capable. It means capability appears exactly when needed.

## Rich, never heavy

Use **bold**, *italic*, \`code\`, and [links](https://commonmark.org/) inline.

Typeset math directly: $E = mc^2$.

\`\`\`ts
const principle = "The document is the interface";
\`\`\`

| View | Best for |
| --- | --- |
| Live | Everyday writing |
| Reading | Focused review |
| Source | Exact Markdown control |

- [x] Open directly into Markdown
- [x] No account required
- [ ] Write your next document

---

Switch views from the title bar. The formatting dock appears only while you write.[^local]

[^local]: Recovery drafts stay on this device. Manuslate writes local files only when you save.
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

export function loadCategories(): LibraryCategory[] {
  return safeParse<LibraryCategory[]>(localStorage.getItem(CATEGORIES_KEY), []);
}

export function saveCategories(categories: LibraryCategory[]): void {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export function loadVersions(): VersionSnapshot[] {
  return safeParse<VersionSnapshot[]>(localStorage.getItem(VERSIONS_KEY), []);
}

export function saveVersions(versions: VersionSnapshot[]): void {
  localStorage.setItem(VERSIONS_KEY, JSON.stringify(versions));
}

export function loadTrash(): TrashEntry[] {
  return safeParse<TrashEntry[]>(localStorage.getItem(TRASH_KEY), []);
}

export function saveTrash(entries: TrashEntry[]): void {
  localStorage.setItem(TRASH_KEY, JSON.stringify(entries));
}

export const builtInTemplates: DocumentTemplate[] = [
  { id: "blank", name: "空白文稿", description: "从一个安静页面开始", content: "" },
  { id: "meeting", name: "会议记录", description: "议题、结论和待办", content: "# 会议记录\n\n**日期：** \n**参与人：** \n\n## 议题\n\n- \n\n## 结论\n\n- \n\n## 待办\n\n- [ ] \n" },
  { id: "project", name: "项目计划", description: "目标、里程碑和风险", content: "# 项目计划\n\n## 目标\n\n\n## 里程碑\n\n- [ ] 第一阶段\n- [ ] 第二阶段\n\n## 风险与决策\n\n" },
  { id: "readme", name: "README", description: "适合开源项目说明", content: "# 项目名称\n\n一句话说明这个项目。\n\n## 特点\n\n- \n\n## 开始使用\n\n```bash\n\n```\n\n## License\n\nMIT\n" },
  { id: "daily", name: "每日笔记", description: "聚焦今天和下一步", content: "# 今日笔记\n\n## 今天最重要的事\n\n- \n\n## 记录\n\n\n## 下一步\n\n- [ ] \n" },
];

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

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function loadEditorPreferences(): EditorPreferences {
  const saved = safeParse<Partial<EditorPreferences>>(localStorage.getItem(EDITOR_PREFERENCES_KEY), {});
  const width = saved.manuscriptWidth;
  return {
    manuscriptFontSize: Math.round(clamp(saved.manuscriptFontSize, 13, 24, defaultEditorPreferences.manuscriptFontSize)),
    sourceFontSize: Math.round(clamp(saved.sourceFontSize, 12, 20, defaultEditorPreferences.sourceFontSize)),
    lineHeight: Math.round(clamp(saved.lineHeight, 1.4, 2, defaultEditorPreferences.lineHeight) * 20) / 20,
    manuscriptWidth: width === 640 || width === 760 || width === 900 ? width : defaultEditorPreferences.manuscriptWidth,
    typeface: saved.typeface === "serif" ? "serif" : "sans",
  };
}

export function saveEditorPreferences(preferences: EditorPreferences): void {
  localStorage.setItem(EDITOR_PREFERENCES_KEY, JSON.stringify(preferences));
}
