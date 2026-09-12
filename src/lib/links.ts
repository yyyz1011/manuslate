import type { MarkdownDocument } from "../types";

export interface DocumentLink {
  label: string;
  href: string;
  documentId?: string;
  anchor?: string;
  broken: boolean;
  ambiguous?: boolean;
  candidates?: string[];
}

const linkPattern = /(?<!!)\[([^\]]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;

function decode(value: string): string {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* keep malformed input visible as broken */ }
  return decoded.replace(/\\/g, "/");
}

function normalizePath(value: string): string {
  const segments: string[] = [];
  for (const segment of decode(value).split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return segments.join("/").toLocaleLowerCase();
}

function directoryOf(value?: string): string {
  const normalized = decode(value || "");
  const slash = normalized.lastIndexOf("/");
  return slash < 0 ? "" : normalized.slice(0, slash);
}

function slug(value: string): string { return value.toLocaleLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").replace(/-+/g, "-"); }
function hasAnchor(document: MarkdownDocument, anchor?: string): boolean {
  if (!anchor) return true;
  return document.content.split("\n").some((line) => { const match = line.match(/^#{1,6}\s+(.+?)\s*#*$/); return Boolean(match && slug(match[1]) === decode(anchor).toLocaleLowerCase()); });
}

export function resolveDocumentLink(
  href: string,
  documents: MarkdownDocument[],
  fromDocument?: MarkdownDocument,
): { documentId?: string; anchor?: string; ambiguous?: boolean; candidates?: string[] } {
  if (/^(https?:|mailto:|tel:)/i.test(href)) return {};
  const [rawPath, anchor] = href.split("#", 2);
  if (!rawPath) return { anchor };
  const needle = normalizePath(rawPath);
  const relativeNeedle = normalizePath(`${directoryOf(fromDocument?.path)}/${rawPath}`);
  const fileName = needle.split("/").at(-1);
  const exact = documents.find((item) => {
    const path = normalizePath(item.path || item.name);
    return path === relativeNeedle || path === needle;
  });
  if (exact) return { documentId: exact.id, anchor };

  const basenameMatches = documents.filter((item) => normalizePath(item.path || item.name).split("/").at(-1) === fileName);
  if (basenameMatches.length === 1) return { documentId: basenameMatches[0].id, anchor };
  if (basenameMatches.length > 1) {
    return {
      anchor,
      ambiguous: true,
      candidates: basenameMatches.map((item) => item.path || item.name),
    };
  }
  return { anchor };
}

export function getOutgoingLinks(document: MarkdownDocument, documents: MarkdownDocument[]): DocumentLink[] {
  return Array.from(document.content.matchAll(linkPattern)).map((match) => {
    const label = match[1];
    const href = match[2];
    const resolved = resolveDocumentLink(href, documents, document);
    const external = /^(https?:|mailto:|tel:)/i.test(href);
    const target = href.startsWith("#") ? document : documents.find((item) => item.id === resolved.documentId);
    const broken = !external && (!target || !hasAnchor(target, resolved.anchor));
    return { label, href, ...resolved, broken };
  });
}

export function getBacklinks(documentId: string, documents: MarkdownDocument[]): MarkdownDocument[] {
  return documents.filter((item) => item.id !== documentId && getOutgoingLinks(item, documents).some((link) => link.documentId === documentId));
}
