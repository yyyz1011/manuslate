import { parse as parseYaml } from "yaml";
import type {
  FileIssue,
  MarkdownLink,
  MarkdownRecord,
  OutlineItem,
} from "../types";

const FRONTMATTER = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/;
const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".mdown", ".mkdn"];

export function isMarkdownFile(name: string): boolean {
  const lower = name.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export function countWords(content: string): number {
  const withoutSyntax = content
    .replace(FRONTMATTER, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!?(?:\[[^\]]*\])\([^)]*\)/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_~|=-]/g, " ");
  const cjk = withoutSyntax.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g)?.length ?? 0;
  const latin = withoutSyntax.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)?.length ?? 0;
  return cjk + latin;
}

export function parseFrontmatter(content: string): {
  data: Record<string, unknown>;
  body: string;
  error?: string;
} {
  const match = content.match(FRONTMATTER);
  if (!match) return { data: {}, body: content };

  try {
    const parsed = parseYaml(match[1]);
    if (parsed == null) return { data: {}, body: content.slice(match[0].length) };
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        data: {},
        body: content.slice(match[0].length),
        error: "Frontmatter 顶层必须是键值对象",
      };
    }
    return { data: parsed as Record<string, unknown>, body: content.slice(match[0].length) };
  } catch (error) {
    return {
      data: {},
      body: content.slice(match[0].length),
      error: error instanceof Error ? error.message : "无法解析 Frontmatter",
    };
  }
}

export function extractOutline(content: string): OutlineItem[] {
  let inFence = false;
  const items: OutlineItem[] = [];
  content.split(/\r?\n/).forEach((line, index) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (match) items.push({ level: match[1].length, text: match[2], line: index + 1 });
  });
  return items;
}

export function extractLinks(content: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  const inline = /(!?)\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  const wiki = /(!?)\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = inline.exec(content))) {
    links.push({ target: stripAngleBrackets(match[2]), isImage: match[1] === "!", isWiki: false });
  }
  while ((match = wiki.exec(content))) {
    links.push({ target: match[2].trim(), isImage: match[1] === "!", isWiki: true });
  }
  return links;
}

function stripAngleBrackets(value: string): string {
  return value.startsWith("<") && value.endsWith(">") ? value.slice(1, -1) : value;
}

export async function sha256(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content.replace(/\r\n/g, "\n").trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function scalarString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function tagsFrom(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(scalarString).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

export async function buildRecord(
  relativePath: string,
  content: string,
  updatedAt: number,
  source: "demo" | "local",
  handle?: FileSystemFileHandle,
): Promise<MarkdownRecord> {
  const frontmatterResult = parseFrontmatter(content);
  const outline = extractOutline(content);
  const name = relativePath.split("/").pop() ?? relativePath;
  const title =
    scalarString(frontmatterResult.data.title) ||
    outline.find((item) => item.level === 1)?.text ||
    name.replace(/\.[^.]+$/, "");
  const plainBody = frontmatterResult.body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_~`\[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const issues: FileIssue[] = [];

  if (!scalarString(frontmatterResult.data.title) && !outline.some((item) => item.level === 1)) {
    issues.push({
      id: `${relativePath}:missing-title`,
      kind: "missing-title",
      severity: "warning",
      label: "缺少明确标题",
      detail: "没有 title 字段或一级标题，分类与发布时容易产生歧义。",
    });
  }
  if (frontmatterResult.error) {
    issues.push({
      id: `${relativePath}:frontmatter`,
      kind: "invalid-frontmatter",
      severity: "error",
      label: "Frontmatter 无效",
      detail: frontmatterResult.error,
    });
  }

  return {
    id: relativePath,
    name,
    relativePath,
    folder: relativePath.includes("/") ? relativePath.slice(0, relativePath.lastIndexOf("/")) : "根目录",
    title,
    excerpt: plainBody.slice(0, 150),
    content,
    originalContent: content,
    wordCount: countWords(content),
    lineCount: content.split(/\r?\n/).length,
    updatedAt,
    tags: tagsFrom(frontmatterResult.data.tags ?? frontmatterResult.data.tag),
    status: scalarString(frontmatterResult.data.status) || "未分类",
    frontmatter: frontmatterResult.data,
    links: extractLinks(frontmatterResult.body),
    outline,
    issues,
    hash: await sha256(content),
    handle,
    source,
  };
}

function cleanTarget(target: string): string {
  try {
    return decodeURIComponent(target.split("#")[0].split("?")[0]).replace(/\\/g, "/");
  } catch {
    return target.split("#")[0].split("?")[0].replace(/\\/g, "/");
  }
}

function normalizeSegments(path: string): string {
  const stack: string[] = [];
  for (const segment of path.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") stack.pop();
    else stack.push(segment);
  }
  return stack.join("/");
}

function candidateTargets(record: MarkdownRecord, link: MarkdownLink): string[] {
  const raw = cleanTarget(link.target);
  const base = record.folder === "根目录" ? "" : record.folder;
  const combined = raw.startsWith("/") ? raw.slice(1) : `${base}/${raw}`;
  const normalized = normalizeSegments(combined);
  if (link.isWiki && !/\.[a-z0-9]+$/i.test(normalized)) {
    return [`${normalized}.md`, normalized, `${normalized}/index.md`];
  }
  if (!link.isImage && !/\.[a-z0-9]+$/i.test(normalized)) {
    return [normalized, `${normalized}.md`, `${normalized}/index.md`];
  }
  return [normalized];
}

export function enrichWorkspaceIssues(
  files: MarkdownRecord[],
  availablePaths: ReadonlySet<string> = new Set(files.map((file) => file.relativePath)),
): MarkdownRecord[] {
  const markdownPaths = new Set(files.map((file) => file.relativePath));
  const allNames = new Map<string, string[]>();
  files.forEach((file) => {
    const stem = file.name.replace(/\.[^.]+$/, "").toLowerCase();
    allNames.set(stem, [...(allNames.get(stem) ?? []), file.relativePath]);
  });
  const linkedPaths = new Set<string>();
  const duplicates = new Map<string, string[]>();
  files.forEach((file) => duplicates.set(file.hash, [...(duplicates.get(file.hash) ?? []), file.relativePath]));

  const withLinks = files.map((file) => {
    const issues = file.issues.filter(
      (issue) => issue.kind === "missing-title" || issue.kind === "invalid-frontmatter",
    );
    for (const link of file.links) {
      if (/^(?:https?:|mailto:|tel:|data:|#)/i.test(link.target)) continue;
      const candidates = candidateTargets(file, link);
      const resolved = candidates.find((candidate) =>
        link.isImage ? availablePaths.has(candidate) : markdownPaths.has(candidate),
      );
      if (resolved) {
        if (!link.isImage) linkedPaths.add(resolved);
        continue;
      }
      if (link.isWiki) {
        const byName = allNames.get(cleanTarget(link.target).toLowerCase());
        if (byName?.length === 1) {
          linkedPaths.add(byName[0]);
          continue;
        }
      }
      issues.push({
        id: `${file.relativePath}:${link.isImage ? "asset" : "link"}:${link.target}`,
        kind: link.isImage ? "missing-asset" : "broken-link",
        severity: link.isImage ? "error" : "warning",
        label: link.isImage ? "资源可能缺失" : "链接可能失效",
        detail: `未找到目标：${link.target}`,
        target: link.target,
      });
    }
    return { ...file, issues };
  });

  return withLinks.map((file) => {
    const issues = [...file.issues];
    if (!linkedPaths.has(file.relativePath) && files.length > 1) {
      issues.push({
        id: `${file.relativePath}:orphan`,
        kind: "orphan",
        severity: "info",
        label: "孤立文档",
        detail: "当前没有其他 Markdown 文件链接到它。",
      });
    }
    const matches = duplicates.get(file.hash) ?? [];
    if (matches.length > 1) {
      issues.push({
        id: `${file.relativePath}:duplicate`,
        kind: "duplicate",
        severity: "warning",
        label: "内容重复",
        detail: `与 ${matches.filter((path) => path !== file.relativePath).join("、")} 内容相同。`,
      });
    }
    return { ...file, issues };
  });
}

export function updateRecordContent(record: MarkdownRecord, content: string): Promise<MarkdownRecord> {
  return buildRecord(record.relativePath, content, Date.now(), record.source, record.handle);
}

export function matchesSearch(record: MarkdownRecord, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [record.title, record.relativePath, record.content, record.tags.join(" "), record.status]
    .join("\n")
    .toLocaleLowerCase()
    .includes(normalized);
}
