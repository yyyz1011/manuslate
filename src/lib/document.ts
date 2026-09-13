import type { OutlineItem } from "../types";

export interface ParsedMarkdownHeading {
  level: number;
  text: string;
  sourceText: string;
  markerStart: number;
  markerEnd: number;
  compatibility: boolean;
}

function headingText(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

export function parseMarkdownHeading(line: string): ParsedMarkdownHeading | null {
  const boldWrapped = /^( {0,3})\*\*(#{1,6})([ \t]*)(.+?)\*\*[ \t]*$/.exec(line);
  if (boldWrapped) {
    const sourceText = boldWrapped[4].replace(/[ \t]+#+[ \t]*$/, "").trim();
    if (!sourceText) return null;
    return {
      level: boldWrapped[2].length,
      text: headingText(sourceText),
      sourceText,
      markerStart: boldWrapped[1].length + 2,
      markerEnd: boldWrapped[1].length + 2 + boldWrapped[2].length + boldWrapped[3].length,
      compatibility: true,
    };
  }

  const standard = /^( {0,3})(#{1,6})([ \t]+)(.+)$/.exec(line);
  if (standard) {
    const sourceText = standard[4].replace(/[ \t]+#+[ \t]*$/, "").trim();
    if (!sourceText) return null;
    return {
      level: standard[2].length,
      text: headingText(sourceText),
      sourceText,
      markerStart: standard[1].length,
      markerEnd: standard[1].length + standard[2].length + standard[3].length,
      compatibility: false,
    };
  }

  const compactCjk = /^( {0,3})(#{1,6})(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])(.+)$/u.exec(line);
  if (!compactCjk) return null;
  const sourceText = compactCjk[3].replace(/[ \t]+#+[ \t]*$/, "").trim();
  if (!sourceText) return null;
  return {
    level: compactCjk[2].length,
    text: headingText(sourceText),
    sourceText,
    markerStart: compactCjk[1].length,
    markerEnd: compactCjk[1].length + compactCjk[2].length,
    compatibility: true,
  };
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "section";
}

export function getOutline(content: string): OutlineItem[] {
  let fence: { marker: string; length: number } | null = null;
  return content.split("\n").flatMap((line, index) => {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = { marker, length: fenceMatch[1].length };
      else if (fence.marker === marker && fenceMatch[1].length >= fence.length) fence = null;
      return [];
    }
    if (fence) return [];
    const heading = parseMarkdownHeading(line);
    if (!heading) return [];
    return [{ id: slugify(heading.text), level: heading.level, text: heading.text, line: index + 1 }];
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
    minutes: words === 0 ? 0 : Math.max(1, Math.ceil(words / 300)),
  };
}
