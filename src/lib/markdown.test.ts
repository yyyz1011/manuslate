import { describe, expect, it } from "vitest";
import {
  buildRecord,
  countWords,
  enrichWorkspaceIssues,
  extractLinks,
  extractOutline,
  matchesSearch,
  parseFrontmatter,
} from "./markdown";

describe("Markdown analysis", () => {
  it("counts Chinese characters and Latin tokens without counting syntax", () => {
    expect(countWords("# 标题\n\n这是 test document 42。\n\n[链接](other.md)"))
      .toBe(7);
  });

  it("parses valid frontmatter and reports malformed YAML", () => {
    const valid = parseFrontmatter("---\ntitle: 示例\ntags: [a, b]\n---\n# 正文");
    expect(valid.data).toEqual({ title: "示例", tags: ["a", "b"] });
    expect(valid.body).toBe("# 正文");

    const invalid = parseFrontmatter("---\ntitle: [broken\n---\n正文");
    expect(invalid.error).toBeTruthy();
  });

  it("extracts headings, inline links, images and wiki links", () => {
    const content = "# A\n## B\n[文档](./b.md) ![图](../a.png) [[知识/C]]";
    expect(extractOutline(content)).toEqual([
      { level: 1, text: "A", line: 1 },
      { level: 2, text: "B", line: 2 },
    ]);
    expect(extractLinks(content)).toMatchObject([
      { target: "./b.md", isImage: false },
      { target: "../a.png", isImage: true },
      { target: "知识/C", isWiki: true },
    ]);
  });

  it("distinguishes valid links and assets from missing targets", async () => {
    const a = await buildRecord(
      "docs/a.md",
      "# A\n\n[B](./b.md) ![ok](../assets/ok.png) ![missing](../assets/no.png)",
      1,
      "demo",
    );
    const b = await buildRecord("docs/b.md", "# B", 1, "demo");
    const enriched = enrichWorkspaceIssues(
      [a, b],
      new Set(["docs/a.md", "docs/b.md", "assets/ok.png"]),
    );
    const aIssues = enriched[0].issues;
    expect(aIssues.some((issue) => issue.target === "./b.md")).toBe(false);
    expect(aIssues.some((issue) => issue.target === "../assets/ok.png")).toBe(false);
    expect(aIssues.some((issue) => issue.target === "../assets/no.png")).toBe(true);
    expect(enriched[1].issues.some((issue) => issue.kind === "orphan")).toBe(false);
  });

  it("marks identical content and searches content, path and tags", async () => {
    const first = await buildRecord("a.md", "---\ntags: [alpha]\n---\n# Same", 1, "demo");
    const second = await buildRecord("folder/b.md", "---\ntags: [alpha]\n---\n# Same", 1, "demo");
    const third = await buildRecord("notes/c.md", "# Unique needle", 1, "demo");
    const enriched = enrichWorkspaceIssues([first, second, third]);
    expect(enriched[0].issues.some((issue) => issue.kind === "duplicate")).toBe(true);
    expect(matchesSearch(third, "needle")).toBe(true);
    expect(matchesSearch(first, "alpha")).toBe(true);
    expect(matchesSearch(first, "folder")).toBe(false);
  });

  it("keeps health checks idempotent and never promotes a subheading to title", async () => {
    const record = await buildRecord("inbox/note.md", "正文\n\n## 下一步\n\n[失效](./no.md)", 1, "demo");
    expect(record.title).toBe("note");
    const once = enrichWorkspaceIssues([record]);
    const twice = enrichWorkspaceIssues(once);
    expect(twice[0].issues).toHaveLength(once[0].issues.length);
    expect(new Set(twice[0].issues.map((issue) => issue.id)).size).toBe(twice[0].issues.length);
  });
});
