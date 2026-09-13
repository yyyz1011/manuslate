import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import taskLists from "markdown-it-task-lists";
import { katex } from "@mdit/plugin-katex";
import { parseMarkdownHeading, slugify } from "./document";
const renderer = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

renderer.use(taskLists, { enabled: true, label: true });
renderer.use(footnote);
renderer.use(katex, { throwOnError: false });

const defaultHeadingOpen = renderer.renderer.rules.heading_open;
renderer.renderer.rules.heading_open = (tokens, index, options, env, self) => {
  const inline = tokens[index + 1];
  const id = slugify(inline?.content ?? "section");
  tokens[index].attrSet("id", id);
  return defaultHeadingOpen
    ? defaultHeadingOpen(tokens, index, options, env, self)
    : self.renderToken(tokens, index, options);
};

const defaultLinkOpen = renderer.renderer.rules.link_open;
renderer.renderer.rules.link_open = (tokens, index, options, env, self) => {
  tokens[index].attrSet("target", "_blank");
  tokens[index].attrSet("rel", "noreferrer noopener");
  return defaultLinkOpen
    ? defaultLinkOpen(tokens, index, options, env, self)
    : self.renderToken(tokens, index, options);
};

export function renderMarkdown(content: string): string {
  let fence: { marker: string; length: number } | null = null;
  const compatible = content.split("\n").map((line) => {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = { marker, length: fenceMatch[1].length };
      else if (fence.marker === marker && fenceMatch[1].length >= fence.length) fence = null;
      return line;
    }
    if (fence) return line;
    const heading = parseMarkdownHeading(line);
    if (!heading?.compatibility) return line;
    const indent = line.slice(0, Math.min(3, line.length - line.trimStart().length));
    return `${indent}${"#".repeat(heading.level)} ${heading.sourceText}`;
  }).join("\n");
  return renderer.render(compatible);
}
