import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import type { OutlineItem } from "../types";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "section";
}
const renderer = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

renderer.use(taskLists, { enabled: true, label: true });

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
  return renderer.render(content);
}

export function getOutline(content: string): OutlineItem[] {
  return content
    .split("\n")
    .flatMap((line) => {
      const match = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
      if (!match) return [];
      return [{ id: slugify(match[2]), level: match[1].length, text: match[2] }];
    });
}

export function getWordStats(content: string): { words: number; characters: number; minutes: number } {
  const withoutSyntax = content.replace(/[#>*_`~\[\]()!-]/g, " ");
  const cjk = withoutSyntax.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
  const latin = withoutSyntax.match(/[\p{Letter}\p{Number}]+/gu)?.length ?? 0;
  const words = cjk + latin;
  return {
    words,
    characters: content.replace(/\s/g, "").length,
    minutes: Math.max(1, Math.ceil(words / 300)),
  };
}
