import { useMemo } from "react";
import { renderMarkdown } from "../lib/markdown";

interface MarkdownPreviewProps {
  content: string;
  onNavigate?: (href: string) => boolean;
  assetUrls?: Record<string, string>;
}

export default function MarkdownPreview({ content, onNavigate, assetUrls = {} }: MarkdownPreviewProps) {
  const rendered = useMemo(() => {
    const html = renderMarkdown(content);
    if (!Object.keys(assetUrls).length) return html;
    const parsed = new DOMParser().parseFromString(html, "text/html");
    parsed.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
      const original = image.getAttribute("src");
      if (original && assetUrls[original]) image.src = assetUrls[original];
    });
    return parsed.body.innerHTML;
  }, [assetUrls, content]);
  return <article className="markdown-preview" onClick={(event) => { const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]"); if (!anchor || !onNavigate) return; if (onNavigate(anchor.getAttribute("href") || "")) event.preventDefault(); }} dangerouslySetInnerHTML={{ __html: rendered }} />;
}
