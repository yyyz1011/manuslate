import type { MarkdownDocument } from "../types";

export interface DocumentLink {
  label: string;
  href: string;
  documentId?: string;
  anchor?: string;
  broken: boolean;
}

const linkPattern = /(?<!!)\[([^\]]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;

function normalize(value: string): string {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* keep malformed input visible as broken */ }
  return decoded.replace(/^\.\//, "").replace(/\\/g, "/").toLocaleLowerCase();
}

function slug(value: string): string { return value.toLocaleLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").replace(/-+/g, "-"); }
function hasAnchor(document: MarkdownDocument, anchor?: string): boolean {
  if (!anchor) return true;
  return document.content.split("\n").some((line) => { const match = line.match(/^#{1,6}\s+(.+?)\s*#*$/); return Boolean(match && slug(match[1]) === normalize(anchor)); });
}

export function resolveDocumentLink(href: string, documents: MarkdownDocument[]): { documentId?: string; anchor?: string } {
  if (/^(https?:|mailto:|tel:)/i.test(href)) return {};
  const [rawPath, anchor] = href.split("#", 2);
  if (!rawPath) return { anchor };
  const needle = normalize(rawPath);
  const fileName = needle.split("/").at(-1);
  const target = documents.find((item) => {
    const path = normalize(item.path || item.name);
    return path === needle || path.endsWith(`/${needle}`) || path.split("/").at(-1) === fileName;
  });
  return { documentId: target?.id, anchor };
}

export function getOutgoingLinks(document: MarkdownDocument, documents: MarkdownDocument[]): DocumentLink[] {
  return Array.from(document.content.matchAll(linkPattern)).map((match) => {
    const label = match[1];
    const href = match[2];
    const resolved = resolveDocumentLink(href, documents);
    const external = /^(https?:|mailto:|tel:)/i.test(href);
    const target = href.startsWith("#") ? document : documents.find((item) => item.id === resolved.documentId);
    const broken = !external && (!target || !hasAnchor(target, resolved.anchor));
    return { label, href, ...resolved, broken };
  });
}

export function getBacklinks(documentId: string, documents: MarkdownDocument[]): MarkdownDocument[] {
  return documents.filter((item) => item.id !== documentId && getOutgoingLinks(item, documents).some((link) => link.documentId === documentId));
}
