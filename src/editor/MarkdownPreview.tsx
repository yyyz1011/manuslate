import { useMemo } from "react";
import { renderMarkdown } from "../lib/markdown";

interface MarkdownPreviewProps {
  content: string;
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const rendered = useMemo(() => renderMarkdown(content), [content]);
  return <article className="markdown-preview" dangerouslySetInnerHTML={{ __html: rendered }} />;
}
