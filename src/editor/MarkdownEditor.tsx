import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import {
  closeSearchPanel, findNext, findPrevious, getSearchQuery, openSearchPanel, replaceAll, replaceNext,
  search, searchKeymap, SearchQuery, setSearchQuery,
} from "@codemirror/search";
import { Compartment, EditorSelection, EditorState } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  Decoration,
  EditorView,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  placeholder,
  rectangularSelection,
  ViewPlugin,
  WidgetType,
  type Panel,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useI18n } from "../i18n";
import { renderMarkdown } from "../lib/markdown";
import { parseMarkdownHeading } from "../lib/document";
import type { EditorPreferences } from "../types";

export interface MarkdownEditorHandle {
  focus: () => void;
  scrollToLine: (lineNumber: number) => void;
  surround: (before: string, after?: string, placeholderText?: string) => void;
  prefixLine: (prefix: string) => void;
  insert: (text: string) => void;
  openSearch: () => void;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  dark: boolean;
  focusMode: boolean;
  livePreview: boolean;
  preferences: EditorPreferences;
  onImageFile?: (file: File) => Promise<string | null>;
  assetUrls?: Record<string, string>;
}

interface FloatingPosition { left: number; top: number }
interface SlashState extends FloatingPosition { from: number; to: number; query: string }

function searchIcon(paths: string[], size = 16) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  paths.forEach((value) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", value);
    svg.append(path);
  });
  return svg;
}

function searchButton(label: string, paths: string[], onClick: () => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pm-search-icon-button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(searchIcon(paths));
  button.addEventListener("click", onClick);
  return button;
}

function ui(english: string, chinese: string): string {
  return document.documentElement.lang === "zh-CN" ? chinese : english;
}

class ManuslateSearchPanel implements Panel {
  readonly dom: HTMLElement;
  readonly top = true;
  private query: SearchQuery;
  private searchField: HTMLInputElement;
  private replaceField: HTMLInputElement;
  private count: HTMLElement;
  private replaceRow: HTMLElement;
  private options: HTMLElement;
  private expandButton: HTMLButtonElement;
  private caseField: HTMLInputElement;
  private wordField: HTMLInputElement;
  private regexpField: HTMLInputElement;

  constructor(private readonly view: EditorView) {
    this.query = getSearchQuery(view.state);
    this.dom = document.createElement("div");
    this.dom.className = "pm-search-panel";

    const searchRow = document.createElement("div");
    searchRow.className = "pm-search-row";

    this.expandButton = searchButton(ui("Show replace", "展开替换"), ["m9 18 6-6-6-6"], () => this.toggleReplace()) as HTMLButtonElement;
    this.expandButton.classList.add("pm-search-expand");
    this.expandButton.setAttribute("aria-expanded", "false");

    const fieldWrap = document.createElement("label");
    fieldWrap.className = "pm-search-field";
    fieldWrap.append(searchIcon(["m21 21-4.35-4.35", "M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"], 15));
    this.searchField = document.createElement("input");
    this.searchField.value = this.query.search;
    this.searchField.placeholder = ui("Find in document", "查找文稿");
    this.searchField.setAttribute("aria-label", ui("Find in document", "查找文稿"));
    this.searchField.setAttribute("main-field", "true");
    this.searchField.autocomplete = "off";
    this.searchField.spellcheck = false;
    this.searchField.addEventListener("input", () => this.commit());
    fieldWrap.append(this.searchField);
    this.count = document.createElement("span");
    this.count.className = "pm-search-count";
    this.count.setAttribute("aria-live", "polite");
    fieldWrap.append(this.count);

    const previous = searchButton(ui("Previous", "上一个"), ["m18 15-6-6-6 6"], () => this.navigate(findPrevious));
    const next = searchButton(ui("Next", "下一个"), ["m6 9 6 6 6-6"], () => this.navigate(findNext));
    const more = document.createElement("button");
    more.type = "button";
    more.className = "pm-search-icon-button pm-search-more";
    more.setAttribute("aria-label", ui("Match options", "匹配选项"));
    more.setAttribute("aria-expanded", "false");
    more.title = ui("Match options", "匹配选项");
    more.textContent = "•••";
    more.addEventListener("click", () => {
      const open = Boolean(this.options.hidden);
      this.options.hidden = !open;
      more.setAttribute("aria-expanded", String(open));
    });
    const close = searchButton(ui("Close find", "关闭查找"), ["M18 6 6 18", "m6 6 12 12"], () => closeSearchPanel(this.view));
    searchRow.append(this.expandButton, fieldWrap, previous, next, more, close);

    this.replaceRow = document.createElement("div");
    this.replaceRow.className = "pm-replace-row";
    this.replaceRow.hidden = true;
    const replaceWrap = document.createElement("label");
    replaceWrap.className = "pm-search-field pm-replace-field";
    this.replaceField = document.createElement("input");
    this.replaceField.value = this.query.replace;
    this.replaceField.placeholder = ui("Replace with", "替换为");
    this.replaceField.setAttribute("aria-label", ui("Replace with", "替换为"));
    this.replaceField.autocomplete = "off";
    this.replaceField.spellcheck = false;
    this.replaceField.addEventListener("input", () => this.commit());
    replaceWrap.append(this.replaceField);
    const replaceOne = document.createElement("button");
    replaceOne.type = "button";
    replaceOne.textContent = ui("Replace", "替换");
    replaceOne.addEventListener("click", () => this.replace(false));
    const replaceEvery = document.createElement("button");
    replaceEvery.type = "button";
    replaceEvery.textContent = ui("Replace all", "全部替换");
    replaceEvery.addEventListener("click", () => this.replace(true));
    this.replaceRow.append(replaceWrap, replaceOne, replaceEvery);

    this.options = document.createElement("div");
    this.options.className = "pm-search-options";
    this.options.hidden = true;
    this.caseField = this.option(ui("Match case", "区分大小写"), this.query.caseSensitive);
    this.wordField = this.option(ui("Whole words", "全词匹配"), this.query.wholeWord);
    this.regexpField = this.option(ui("Regular expression", "正则表达式"), this.query.regexp);

    this.dom.append(searchRow, this.replaceRow, this.options);
    this.dom.addEventListener("keydown", (event) => this.keydown(event));
    this.updateCount();
  }

  private option(label: string, checked: boolean) {
    const wrapper = document.createElement("label");
    const field = document.createElement("input");
    field.type = "checkbox";
    field.checked = checked;
    field.addEventListener("change", () => this.commit());
    const indicator = document.createElement("span");
    const text = document.createElement("span");
    text.textContent = label;
    wrapper.append(field, indicator, text);
    this.options?.append(wrapper);
    return field;
  }

  private toggleReplace() {
    const open = Boolean(this.replaceRow.hidden);
    this.replaceRow.hidden = !open;
    this.dom.classList.toggle("is-replacing", open);
    this.expandButton.classList.toggle("is-open", open);
    this.expandButton.setAttribute("aria-expanded", String(open));
    this.expandButton.setAttribute("aria-label", open ? ui("Hide replace", "收起替换") : ui("Show replace", "展开替换"));
    if (open) this.replaceField.focus();
  }

  private commit() {
    const next = new SearchQuery({
      search: this.searchField.value,
      replace: this.replaceField.value,
      caseSensitive: this.caseField.checked,
      wholeWord: this.wordField.checked,
      regexp: this.regexpField.checked,
    });
    if (!next.eq(this.query)) {
      this.query = next;
      this.view.dispatch({ effects: setSearchQuery.of(next) });
    }
    this.updateCount();
  }

  private navigate(command: typeof findNext) {
    command(this.view);
    window.requestAnimationFrame(() => { this.updateCount(); this.searchField.focus(); });
  }

  private replace(all: boolean) {
    (all ? replaceAll : replaceNext)(this.view);
    window.requestAnimationFrame(() => { this.updateCount(); this.replaceField.focus(); });
  }

  private updateCount() {
    if (!this.query.search || !this.query.valid) {
      this.count.textContent = this.query.search && !this.query.valid ? ui("Invalid expression", "表达式有误") : "0 / 0";
      this.dom.classList.toggle("has-error", Boolean(this.query.search && !this.query.valid));
      return;
    }
    const matches: Array<{ from: number; to: number }> = [];
    const cursor = this.query.getCursor(this.view.state, 0, this.view.state.doc.length);
    for (let result = cursor.next(); !result.done; result = cursor.next()) matches.push(result.value);
    const selection = this.view.state.selection.main;
    let current = matches.findIndex((match) => match.from === selection.from && match.to === selection.to);
    if (current < 0) current = matches.findIndex((match) => match.from >= selection.head);
    if (current < 0 && matches.length) current = 0;
    this.count.textContent = matches.length ? `${current + 1} / ${matches.length}` : "0 / 0";
    this.dom.classList.remove("has-error");
  }

  private keydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      if (!this.options.hidden) this.options.hidden = true;
      else closeSearchPanel(this.view);
      event.preventDefault();
    } else if (event.key === "Enter" && event.target === this.searchField) {
      event.preventDefault();
      this.navigate(event.shiftKey ? findPrevious : findNext);
    } else if (event.key === "Enter" && event.target === this.replaceField) {
      event.preventDefault();
      this.replace(false);
    }
  }

  update(update: ViewUpdate) {
    const next = getSearchQuery(update.state);
    const queryChanged = !next.eq(this.query);
    if (queryChanged) {
      this.query = next;
      this.searchField.value = next.search;
      this.replaceField.value = next.replace;
      this.caseField.checked = next.caseSensitive;
      this.wordField.checked = next.wholeWord;
      this.regexpField.checked = next.regexp;
    }
    if (update.docChanged || update.selectionSet || queryChanged) this.updateCount();
  }

  mount() { this.searchField.select(); }
}

function createManuslateSearchPanel(view: EditorView) {
  return new ManuslateSearchPanel(view);
}

const slashActions = [
  { key: "heading1 h1 标题1", en: "Heading 1", zh: "一级标题", enDetail: "Large heading", zhDetail: "大标题", text: "# " },
  { key: "heading2 h2 标题2", en: "Heading 2", zh: "二级标题", enDetail: "Section heading", zhDetail: "章节标题", text: "## " },
  { key: "task todo 任务", en: "Task list", zh: "任务列表", enDetail: "Checkable items", zhDetail: "可勾选事项", text: "- [ ] " },
  { key: "quote 引用", en: "Quote", zh: "引用", enDetail: "Emphasize a passage", zhDetail: "突出一段话", text: "> " },
  { key: "code 代码", en: "Code block", zh: "代码块", enDetail: "Syntax-highlighted block", zhDetail: "带语法高亮", text: "```\n\n```" },
  { key: "table 表格", en: "Table", zh: "表格", enDetail: "Start with two columns", zhDetail: "两列起步", text: "| Column 1 | Column 2 |\n| --- | --- |\n| Content | Content |" },
  { key: "divider 分割线", en: "Divider", zh: "分割线", enDetail: "Separate sections", zhDetail: "分隔章节", text: "---" },
];

const lightHighlight = HighlightStyle.define([
  { tag: tags.heading, color: "#a92f3b", fontWeight: "650" },
  { tag: tags.strong, color: "#20242a", fontWeight: "700" },
  { tag: tags.emphasis, color: "#434a54", fontStyle: "italic" },
  { tag: [tags.link, tags.url], color: "#b33440", textDecoration: "underline" },
  { tag: [tags.monospace, tags.processingInstruction], color: "#a33c25" },
  { tag: tags.quote, color: "#747c87", fontStyle: "italic" },
  { tag: tags.meta, color: "#9a6472" },
]);

const darkHighlight = HighlightStyle.define([
  { tag: tags.heading, color: "#ff878a", fontWeight: "650" },
  { tag: tags.strong, color: "#f2f4f7", fontWeight: "700" },
  { tag: tags.emphasis, color: "#c7ccd4", fontStyle: "italic" },
  { tag: [tags.link, tags.url], color: "#ff7f84", textDecoration: "underline" },
  { tag: [tags.monospace, tags.processingInstruction], color: "#f09a7f" },
  { tag: tags.quote, color: "#959ca6", fontStyle: "italic" },
  { tag: tags.meta, color: "#c894a4" },
]);

class LiveTokenWidget extends WidgetType {
  constructor(private readonly text: string, private readonly className: string) { super(); }

  eq(other: LiveTokenWidget) {
    return other.text === this.text && other.className === this.className;
  }

  toDOM() {
    const token = document.createElement("span");
    token.className = this.className;
    token.textContent = this.text;
    token.setAttribute("aria-hidden", "true");
    return token;
  }

  ignoreEvent() { return true; }
}

class LiveBlockWidget extends WidgetType {
  constructor(
    private readonly markdownSource: string,
    private readonly className: string,
    private readonly sourcePosition: number,
    private readonly assetUrls: Record<string, string>,
  ) { super(); }

  eq(other: LiveBlockWidget) {
    return other.markdownSource === this.markdownSource
      && other.className === this.className
      && other.sourcePosition === this.sourcePosition
      && other.assetUrls === this.assetUrls;
  }

  toDOM(view: EditorView) {
    const block = document.createElement("div");
    block.className = `cm-live-block ${this.className}`;
    block.innerHTML = renderMarkdown(this.markdownSource);
    block.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
      const original = image.getAttribute("src");
      if (original && this.assetUrls[original]) image.src = this.assetUrls[original];
    });
    block.setAttribute("role", "button");
    block.setAttribute("tabindex", "-1");
    block.setAttribute("aria-label", ui("Click to edit Markdown source", "点击编辑 Markdown 源码"));
    block.addEventListener("mousedown", (event) => {
      event.preventDefault();
      view.dispatch({ selection: EditorSelection.cursor(this.sourcePosition), scrollIntoView: true });
      view.focus();
    });
    return block;
  }

  ignoreEvent() { return false; }
}

function liveBlockDecorations(state: EditorState, assetUrls: Record<string, string>, editorFocused: boolean) {
  const ranges: ReturnType<Decoration["range"]>[] = [];
  const blockedLines = new Set<number>();
  const editableLines = new Set<number>();
  const activeLine = editorFocused ? state.doc.lineAt(state.selection.main.head).number : -1;
  const lineCount = state.doc.lines;

  const addBlock = (start: number, end: number, className: string) => {
    if (activeLine >= start && activeLine <= end) {
      for (let line = start; line <= end; line += 1) editableLines.add(line);
      return;
    }
    const first = state.doc.line(start);
    const last = state.doc.line(end);
    const source = state.sliceDoc(first.from, last.to);
    ranges.push(Decoration.replace({ widget: new LiveBlockWidget(source, className, first.from, assetUrls), block: true }).range(first.from, last.to));
    for (let line = start; line <= end; line += 1) blockedLines.add(line);
  };

  for (let number = 1; number <= lineCount; number += 1) {
    const line = state.doc.line(number);
    const trimmed = line.text.trim();

    const fence = trimmed.match(/^(`{3,}|~{3,})/);
    if (fence) {
      let end = number;
      while (end < lineCount) {
        end += 1;
        if (state.doc.line(end).text.trim().startsWith(fence[1])) break;
      }
      addBlock(number, end, "cm-live-block-code");
      number = end;
      continue;
    }

    if (trimmed === "$$") {
      let end = number;
      while (end < lineCount) {
        end += 1;
        if (state.doc.line(end).text.trim() === "$$") break;
      }
      if (end > number) {
        addBlock(number, end, "cm-live-block-math");
        number = end;
        continue;
      }
    }

    const nextLine = number < lineCount ? state.doc.line(number + 1).text : "";
    if (/^\s*\|.*\|\s*$/.test(line.text) && /^\s*\|?\s*:?-{3,}/.test(nextLine)) {
      let end = number + 1;
      while (end < lineCount && /^\s*\|.*\|\s*$/.test(state.doc.line(end + 1).text)) end += 1;
      addBlock(number, end, "cm-live-block-table");
      number = end;
      continue;
    }

    if (/^\s*!\[[^\]]*\]\([^)]+\)\s*$/.test(line.text)) addBlock(number, number, "cm-live-block-image");
  }
  return { ranges, blockedLines, editableLines };
}

function paragraphDecorations(view: EditorView): DecorationSet {
  const current = view.state.doc.lineAt(view.state.selection.main.head);
  let start = current.number;
  let end = current.number;

  while (start > 1 && view.state.doc.line(start - 1).text.trim()) start -= 1;
  while (end < view.state.doc.lines && view.state.doc.line(end + 1).text.trim()) end += 1;

  const mark = Decoration.line({ class: "cm-focusParagraph" });
  const ranges = [];
  for (let lineNumber = start; lineNumber <= end; lineNumber += 1) {
    ranges.push(mark.range(view.state.doc.line(lineNumber).from));
  }
  return Decoration.set(ranges);
}

function liveDecorations(state: EditorState, assetUrls: Record<string, string>, editorFocused: boolean): DecorationSet {
  const blocks = liveBlockDecorations(state, assetUrls, editorFocused);
  const ranges: ReturnType<Decoration["range"]>[] = [...blocks.ranges];
  const activeLine = editorFocused ? state.doc.lineAt(state.selection.main.head).number : -1;
  const hiddenMarks = new Set(["HeaderMark", "EmphasisMark", "CodeMark", "CodeInfo", "QuoteMark"]);
  const decoratedLines = new Set<number>();

  for (const visible of [{ from: 0, to: state.doc.length }]) {
    syntaxTree(state).iterate({
      from: visible.from,
      to: visible.to,
      enter(node) {
        const line = state.doc.lineAt(node.from);
        if (blocks.blockedLines.has(line.number)) return false;
        const isActiveLine = activeLine === line.number || blocks.editableLines.has(line.number);

        if (/^ATXHeading[1-6]$/.test(node.name)) {
          const level = node.name.slice(-1);
          ranges.push(Decoration.line({ class: `cm-live-heading cm-live-h${level}` }).range(line.from));
        }

        if (node.name === "FencedCode") {
          for (let n = line.number; n <= state.doc.lineAt(node.to).number; n += 1) {
            ranges.push(Decoration.line({ class: "cm-live-codeblock" }).range(state.doc.line(n).from));
          }
        }

        if (node.name === "Blockquote") {
          for (let n = line.number; n <= state.doc.lineAt(node.to).number; n += 1) {
            ranges.push(Decoration.line({ class: "cm-live-quote" }).range(state.doc.line(n).from));
          }
        }

        const parent = node.node.parent;
        const parentText = parent ? state.sliceDoc(parent.from, parent.to) : "";
        const hiddenLinkPart = parent?.name === "Link"
          && !parentText.startsWith("[^")
          && (node.name === "LinkMark" || node.name === "URL");

        if (!isActiveLine && (hiddenMarks.has(node.name) || hiddenLinkPart)) {
          ranges.push(Decoration.replace({}).range(node.from, node.to));
        }

        if (!isActiveLine && node.name === "ListMark") {
          const marker = state.sliceDoc(node.from, node.to);
          const isTask = /^\s*[-+*]\s+\[[ xX]\]/.test(line.text);
          const label = isTask ? "" : /^\s*\d/.test(marker) ? marker.trim() : "•";
          ranges.push(Decoration.replace(label ? { widget: new LiveTokenWidget(label, "cm-live-list-token") } : {}).range(node.from, node.to));
        }

        if (!isActiveLine && node.name === "TaskMarker") {
          const checked = /[xX]/.test(state.sliceDoc(node.from, node.to));
          ranges.push(Decoration.replace({ widget: new LiveTokenWidget(checked ? "☑" : "☐", `cm-live-task${checked ? " is-checked" : ""}`) }).range(node.from, node.to));
        }
      },
    });

    const firstLine = state.doc.lineAt(visible.from).number;
    const lastLine = state.doc.lineAt(visible.to).number;
    let inMathBlock = false;
    for (let number = 1; number <= lastLine; number += 1) {
      const line = state.doc.line(number);
      if (blocks.blockedLines.has(number)) continue;
      const trimmed = line.text.trim();
      if (trimmed === "$$") {
        if (number >= firstLine && number !== activeLine) ranges.push(Decoration.replace({}).range(line.from, line.to));
        inMathBlock = !inMathBlock;
        continue;
      }
      if (number < firstLine || number === activeLine || blocks.editableLines.has(number)) continue;

      if (inMathBlock) ranges.push(Decoration.line({ class: "cm-live-math" }).range(line.from));

      const compatibleHeading = parseMarkdownHeading(line.text);
      if (compatibleHeading?.compatibility) {
        ranges.push(Decoration.line({ class: `cm-live-heading cm-live-h${compatibleHeading.level}` }).range(line.from));
        const markerFrom = line.from + compatibleHeading.markerStart;
        const markerTo = line.from + compatibleHeading.markerEnd;
        if (markerTo > markerFrom) ranges.push(Decoration.replace({}).range(markerFrom, markerTo));
      }

      const isTable = /^\s*\|.*\|\s*$/.test(line.text);
      if (isTable && !decoratedLines.has(number)) {
        decoratedLines.add(number);
        if (/^\s*\|?\s*:?-{3,}/.test(line.text)) {
          ranges.push(Decoration.replace({ widget: new LiveTokenWidget("", "cm-live-table-rule") }).range(line.from, line.to));
        } else {
          ranges.push(Decoration.line({ class: "cm-live-table-row" }).range(line.from));
          for (const match of line.text.matchAll(/\|/g)) {
            const from = line.from + (match.index ?? 0);
            ranges.push(Decoration.replace({ widget: new LiveTokenWidget("", "cm-live-table-gap") }).range(from, from + 1));
          }
        }
      }

      if (!line.text.includes("`")) {
        for (const match of line.text.matchAll(/\$([^$\n]+)\$/g)) {
          const start = line.from + (match.index ?? 0);
          const end = start + match[0].length;
          ranges.push(Decoration.replace({}).range(start, start + 1));
          ranges.push(Decoration.mark({ class: "cm-live-inline-math" }).range(start + 1, end - 1));
          ranges.push(Decoration.replace({}).range(end - 1, end));
        }
        for (const match of line.text.matchAll(/\[\^([^\]]+)\]/g)) {
          if (line.text.slice(match.index! + match[0].length).startsWith(":")) continue;
          const start = line.from + (match.index ?? 0);
          ranges.push(Decoration.replace({ widget: new LiveTokenWidget(match[1], "cm-live-footnote") }).range(start, start + match[0].length));
        }
      }
    }
  }

  return Decoration.set(ranges, true);
}

const makeLivePreviewExtension = (assetUrls: Record<string, string>) => ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = liveDecorations(view.state, assetUrls, view.hasFocus);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.focusChanged) {
        this.decorations = liveDecorations(update.state, assetUrls, update.view.hasFocus);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const paragraphFocus = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = paragraphDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet) this.decorations = paragraphDecorations(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function makeTheme(dark: boolean, livePreview: boolean, preferences: EditorPreferences) {
  const manuscriptTypeface = preferences.typeface === "serif"
    ? '"Songti SC", "STSong", "Noto Serif CJK SC", Georgia, serif'
    : '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';
  return EditorView.theme(
    {
      "&": {
        height: "100%",
        backgroundColor: "transparent",
        color: dark ? "#e8eaed" : "#202329",
        fontSize: "16px",
      },
      ".cm-scroller": {
        fontFamily: livePreview
          ? manuscriptTypeface
          : '"SFMono-Regular", "SF Mono", ui-monospace, Menlo, Consolas, monospace',
        fontSize: `${livePreview ? preferences.manuscriptFontSize : preferences.sourceFontSize}px`,
        lineHeight: livePreview ? String(preferences.lineHeight) : "1.82",
        overflowX: "hidden",
        overflowY: "auto",
      },
      ".cm-content": {
        width: "100%",
        maxWidth: `${preferences.manuscriptWidth}px`,
        minWidth: "0",
        margin: "0 auto",
        padding: "76px 42px 190px",
        caretColor: dark ? "#ff7d82" : "#bd3541",
      },
      ".cm-line": {
        padding: "0",
        overflowWrap: "anywhere",
      },
      ".cm-live-heading": {
        color: dark ? "#f5f5f7" : "#1d1d1f",
        fontWeight: "730",
        letterSpacing: "-0.025em",
        lineHeight: "1.24",
      },
      // CodeMirror measures the line box for pointer mapping; vertical margins sit
      // outside that box and make clicks drift progressively down the document.
      ".cm-live-h1": { fontSize: "2.1em", paddingBottom: "0.5em" },
      ".cm-live-h2": { fontSize: "1.5em", paddingTop: "1.15em", paddingBottom: "0.3em" },
      ".cm-live-h3": { fontSize: "1.2em", paddingTop: "0.9em", fontWeight: "690" },
      ".cm-live-h4, .cm-live-h5, .cm-live-h6": { fontSize: "1.05em", paddingTop: "0.7em", fontWeight: "680" },
      ".cm-live-codeblock": {
        backgroundColor: dark ? "rgba(255,255,255,.045)" : "rgba(35,42,52,.045)",
        fontFamily: '"SFMono-Regular", "SF Mono", ui-monospace, Menlo, Consolas, monospace',
        fontSize: "0.88em",
      },
      ".cm-live-quote": {
        color: dark ? "#a9adb5" : "#646970",
        fontStyle: "italic",
        borderLeft: `1px solid ${dark ? "#454951" : "#d2d2d7"}`,
        paddingLeft: "15px",
      },
      ".cm-live-list-token": {
        display: "inline-block",
        width: "1.4em",
        color: dark ? "#aeb4bd" : "#646970",
        fontWeight: "600",
      },
      ".cm-live-task": {
        display: "inline-block",
        width: "1.55em",
        color: dark ? "#aeb4bd" : "#646970",
        fontSize: "1.05em",
      },
      ".cm-live-task.is-checked": { color: dark ? "#ff7d82" : "#bd3541" },
      ".cm-live-table-row": {
        backgroundColor: dark ? "rgba(255,255,255,.025)" : "rgba(35,42,52,.025)",
        fontVariantNumeric: "tabular-nums",
      },
      ".cm-live-table-gap": {
        display: "inline-block",
        width: "1.35em",
        height: "1.05em",
        margin: "0 .3em",
        borderLeft: `1px solid ${dark ? "#454951" : "#d2d2d7"}`,
        verticalAlign: "-.1em",
      },
      ".cm-live-table-rule": {
        display: "inline-block",
        width: "100%",
        height: "1px",
        backgroundColor: dark ? "#454951" : "#d2d2d7",
        verticalAlign: "middle",
      },
      ".cm-live-math": {
        color: dark ? "#f2f2f7" : "#242426",
        fontFamily: '"STIX Two Math", "Cambria Math", serif',
        fontSize: "1.08em",
        textAlign: "center",
      },
      ".cm-live-inline-math": {
        fontFamily: '"STIX Two Math", "Cambria Math", serif',
        fontStyle: "italic",
      },
      ".cm-live-footnote": {
        color: dark ? "#ff7d82" : "#bd3541",
        fontSize: ".72em",
        verticalAlign: "super",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: dark ? "#ff7d82" : "#bd3541",
        borderLeftWidth: "2px",
      },
      ".cm-selectionBackground, ::selection": {
        backgroundColor: dark ? "#642d34 !important" : "#f3ccd0 !important",
      },
      ".cm-activeLine": {
        backgroundColor: "transparent",
      },
      ".cm-gutters": {
        display: "none",
      },
      ".cm-placeholder": {
        color: dark ? "#a1a7b0" : "#66707a",
        fontStyle: "normal",
      },
      ".cm-panels": {
        color: dark ? "#e8eaed" : "#202329",
        backgroundColor: "transparent",
        borderColor: "transparent",
      },
      ".cm-searchMatch": { backgroundColor: dark ? "rgba(255,100,104,.26)" : "rgba(200,64,73,.16)", borderRadius: "3px" },
      ".cm-searchMatch-selected": { backgroundColor: dark ? "rgba(255,179,64,.46)" : "rgba(255,159,10,.28)", outline: `1px solid ${dark ? "rgba(255,190,92,.65)" : "rgba(218,125,0,.42)"}` },
      ".cm-tooltip": {
        border: `1px solid ${dark ? "#3d4148" : "#dfe3e8"}`,
        backgroundColor: dark ? "#25282d" : "#ffffff",
      },
    },
    { dark },
  );
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ value, onChange, dark, focusMode, livePreview, preferences, onImageFile, assetUrls = {} }, ref) => {
    const { t } = useI18n();
    const hostRef = useRef<HTMLDivElement>(null);
    const shellRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const themeCompartment = useRef(new Compartment());
    const highlightCompartment = useRef(new Compartment());
    const focusCompartment = useRef(new Compartment());
    const liveCompartment = useRef(new Compartment());
    const [selectionToolbar, setSelectionToolbar] = useState<FloatingPosition | null>(null);
    const [slash, setSlash] = useState<SlashState | null>(null);

    const updateFloatingUI = (view: EditorView) => {
      const shell = shellRef.current;
      if (!shell || !view.hasFocus) { setSelectionToolbar(null); setSlash(null); return; }
      const selection = view.state.selection.main;
      const shellRect = shell.getBoundingClientRect();
      if (!selection.empty) {
        const start = view.coordsAtPos(selection.from); const end = view.coordsAtPos(selection.to);
        if (start && end) setSelectionToolbar({ left: Math.min(shellRect.width - 130, Math.max(130, (start.left + end.right) / 2 - shellRect.left)), top: Math.max(8, start.top - shellRect.top - 48) });
      } else setSelectionToolbar(null);
      const line = view.state.doc.lineAt(selection.head);
      const before = view.state.sliceDoc(line.from, selection.head);
      const match = before.match(/^\/(.*)$/);
      if (selection.empty && match && !match[1].includes(" ")) {
        const coords = view.coordsAtPos(selection.head);
        if (coords) setSlash({ from: line.from, to: line.to, query: match[1].toLocaleLowerCase(), left: Math.min(shellRect.width - 292, Math.max(12, coords.left - shellRect.left)), top: Math.min(shellRect.height - 300, coords.bottom - shellRect.top + 8) });
      } else setSlash(null);
    };

    const insertImage = async (file: File) => {
      const view = viewRef.current;
      if (!view || !onImageFile) return;
      const selection = view.state.selection.main;
      const path = await onImageFile(file);
      if (!path || !viewRef.current) return;
      const alt = file.name.replace(/\.[^.]+$/, "") || t("image", "图片");
      const markdown = `![${alt}](${path})`;
      viewRef.current.dispatch({ changes: { from: selection.from, to: selection.to, insert: markdown }, selection: { anchor: selection.from + markdown.length }, scrollIntoView: true });
      viewRef.current.focus();
    };

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      if (!hostRef.current) return;

      const state = EditorState.create({
        doc: value,
        extensions: [
          history(),
          highlightSpecialChars(),
          drawSelection(),
          dropCursor(),
          rectangularSelection(),
          highlightActiveLine(),
          EditorView.lineWrapping,
          markdown({ base: markdownLanguage }),
          search({ top: true, createPanel: createManuslateSearchPanel }),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
          placeholder(t("Start writing here…", "从这里开始写…")),
          themeCompartment.current.of(makeTheme(dark, livePreview, preferences)),
          highlightCompartment.current.of(syntaxHighlighting(dark ? darkHighlight : lightHighlight)),
          focusCompartment.current.of(focusMode ? paragraphFocus : []),
          liveCompartment.current.of(livePreview ? makeLivePreviewExtension(assetUrls) : []),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
            if (update.docChanged || update.selectionSet || update.focusChanged || update.viewportChanged) updateFloatingUI(update.view);
          }),
        ],
      });

      const view = new EditorView({ state, parent: hostRef.current });
      viewRef.current = view;
      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: [
          themeCompartment.current.reconfigure(makeTheme(dark, livePreview, preferences)),
          highlightCompartment.current.reconfigure(syntaxHighlighting(dark ? darkHighlight : lightHighlight)),
        ],
      });
    }, [dark, livePreview, preferences]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({ effects: liveCompartment.current.reconfigure(livePreview ? makeLivePreviewExtension(assetUrls) : []) });
    }, [assetUrls, livePreview]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({ effects: focusCompartment.current.reconfigure(focusMode ? paragraphFocus : []) });
    }, [focusMode]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view || view.state.doc.toString() === value) return;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }, [value]);

    useImperativeHandle(ref, () => ({
      focus: () => viewRef.current?.focus(),
      scrollToLine: (lineNumber) => {
        const view = viewRef.current;
        if (!view) return;
        const safeLine = Math.max(1, Math.min(lineNumber, view.state.doc.lines));
        const line = view.state.doc.line(safeLine);
        view.dispatch({
          selection: EditorSelection.cursor(line.from),
          effects: EditorView.scrollIntoView(line.from, { y: "start", yMargin: 64 }),
        });
        view.focus();
      },
      surround: (before, after = before, placeholderText = t("text", "文字")) => {
        const view = viewRef.current;
        if (!view) return;
        const selection = view.state.selection.main;
        const selected = view.state.sliceDoc(selection.from, selection.to);
        const middle = selected || placeholderText;
        const insertText = `${before}${middle}${after}`;
        const anchor = selection.from + before.length;
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: insertText },
          selection: EditorSelection.range(anchor, anchor + middle.length),
          scrollIntoView: true,
        });
        view.focus();
      },
      prefixLine: (prefix) => {
        const view = viewRef.current;
        if (!view) return;
        const line = view.state.doc.lineAt(view.state.selection.main.head);
        const lineText = view.state.sliceDoc(line.from, line.to);
        const remove = lineText.startsWith(prefix);
        view.dispatch({
          changes: remove
            ? { from: line.from, to: line.from + prefix.length, insert: "" }
            : { from: line.from, insert: prefix },
          scrollIntoView: true,
        });
        view.focus();
      },
      insert: (text) => {
        const view = viewRef.current;
        if (!view) return;
        const selection = view.state.selection.main;
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: text },
          selection: { anchor: selection.from + text.length },
          scrollIntoView: true,
        });
        view.focus();
      },
      openSearch: () => {
        const view = viewRef.current;
        if (!view) return;
        openSearchPanel(view); view.focus();
      },
    }));

    return (
      <div ref={shellRef} className="markdown-editor-shell" onPasteCapture={(event) => { const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/")); if (image && onImageFile) { event.preventDefault(); void insertImage(image); } }} onDragOver={(event) => { if (Array.from(event.dataTransfer.items).some((item) => item.type.startsWith("image/"))) event.preventDefault(); }} onDropCapture={(event) => { const image = Array.from(event.dataTransfer.files).find((file) => file.type.startsWith("image/")); if (image && onImageFile) { event.preventDefault(); void insertImage(image); } }}>
        <div ref={hostRef} className={`markdown-editor${focusMode ? " is-focus-mode" : ""}${livePreview ? " is-live-preview" : " is-source"}`} aria-label={t("Markdown editor", "Markdown 编辑器")} />
        {selectionToolbar && <div className="selection-toolbar" style={{ left: selectionToolbar.left, top: selectionToolbar.top }} role="toolbar" aria-label={t("Selected text formatting", "所选文字格式")}><button type="button" onMouseDown={(event) => { event.preventDefault(); viewRef.current && (() => { const view = viewRef.current!; const s = view.state.selection.main; const text = view.state.sliceDoc(s.from, s.to); view.dispatch({ changes: { from: s.from, to: s.to, insert: `**${text}**` }, selection: EditorSelection.range(s.from + 2, s.to + 2) }); view.focus(); })(); }}>B</button><button type="button" className="italic-control" onMouseDown={(event) => { event.preventDefault(); const view = viewRef.current; if (!view) return; const s = view.state.selection.main; const text = view.state.sliceDoc(s.from, s.to); view.dispatch({ changes: { from: s.from, to: s.to, insert: `*${text}*` }, selection: EditorSelection.range(s.from + 1, s.to + 1) }); view.focus(); }}>I</button><button type="button" onMouseDown={(event) => { event.preventDefault(); const view = viewRef.current; if (!view) return; const s = view.state.selection.main; const text = view.state.sliceDoc(s.from, s.to); const inserted = `[${text}](https://)`; view.dispatch({ changes: { from: s.from, to: s.to, insert: inserted }, selection: EditorSelection.range(s.from + text.length + 3, s.from + text.length + 11) }); view.focus(); }}>{t("Link", "链接")}</button><button type="button" onMouseDown={(event) => { event.preventDefault(); const view = viewRef.current; if (!view) return; const s = view.state.selection.main; const text = view.state.sliceDoc(s.from, s.to); view.dispatch({ changes: { from: s.from, to: s.to, insert: `\`${text}\`` }, selection: EditorSelection.range(s.from + 1, s.to + 1) }); view.focus(); }}>&lt;/&gt;</button></div>}
        {slash && <div className="slash-menu" style={{ left: slash.left, top: slash.top }} role="menu" aria-label={t("Quick insert", "快速插入")}><span>{t("Quick insert", "快速插入")}</span>{slashActions.filter((action) => !slash.query || action.key.includes(slash.query) || action.en.toLocaleLowerCase().includes(slash.query) || action.zh.includes(slash.query)).map((action) => <button type="button" role="menuitem" key={action.key} onMouseDown={(event) => { event.preventDefault(); const view = viewRef.current; if (!view) return; view.dispatch({ changes: { from: slash.from, to: slash.to, insert: action.text }, selection: { anchor: slash.from + (action.text.includes("\n\n") ? action.text.indexOf("\n\n") + 1 : action.text.length) }, scrollIntoView: true }); setSlash(null); view.focus(); }}><strong>{t(action.en, action.zh)}</strong><small>{t(action.enDetail, action.zhDetail)}</small></button>)}</div>}
      </div>
    );
  },
);

MarkdownEditor.displayName = "MarkdownEditor";

export default MarkdownEditor;
