import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import taskLists from "markdown-it-task-lists";
import { katex } from "@mdit/plugin-katex";
import { slugify } from "./document";
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
  return renderer.render(content);
}
