import type { OutlineItem } from "../types";

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "section";
}

export function getOutline(content: string): OutlineItem[] {
  return content
    .split("\n")
    .flatMap((line, index) => {
      const match = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
      if (!match) return [];
      return [{ id: slugify(match[2]), level: match[1].length, text: match[2], line: index + 1 }];
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
