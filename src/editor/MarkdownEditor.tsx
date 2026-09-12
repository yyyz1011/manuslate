import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { openSearchPanel, searchKeymap } from "@codemirror/search";
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
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

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
  onImageFile?: (file: File) => Promise<string | null>;
}

interface FloatingPosition { left: number; top: number }
interface SlashState extends FloatingPosition { from: number; to: number; query: string }

const slashActions = [
  { key: "标题1 h1", label: "一级标题", detail: "大标题", text: "# " },
  { key: "标题2 h2", label: "二级标题", detail: "章节标题", text: "## " },
  { key: "任务 todo", label: "任务列表", detail: "可勾选事项", text: "- [ ] " },
  { key: "引用 quote", label: "引用", detail: "突出一段话", text: "> " },
  { key: "代码 code", label: "代码块", detail: "带语法高亮", text: "```\n\n```" },
  { key: "表格 table", label: "表格", detail: "两列起步", text: "| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |" },
  { key: "分割线 divider", label: "分割线", detail: "分隔章节", text: "---" },
];

const lightHighlight = HighlightStyle.define([
  { tag: tags.heading, color: "#155fb4", fontWeight: "650" },
  { tag: tags.strong, color: "#20242a", fontWeight: "700" },
  { tag: tags.emphasis, color: "#434a54", fontStyle: "italic" },
  { tag: [tags.link, tags.url], color: "#0a6dcc", textDecoration: "underline" },
  { tag: [tags.monospace, tags.processingInstruction], color: "#a33c25" },
  { tag: tags.quote, color: "#747c87", fontStyle: "italic" },
  { tag: tags.meta, color: "#9a6472" },
]);

const darkHighlight = HighlightStyle.define([
  { tag: tags.heading, color: "#80b9ff", fontWeight: "650" },
  { tag: tags.strong, color: "#f2f4f7", fontWeight: "700" },
  { tag: tags.emphasis, color: "#c7ccd4", fontStyle: "italic" },
  { tag: [tags.link, tags.url], color: "#66a9f4", textDecoration: "underline" },
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

function liveDecorations(view: EditorView): DecorationSet {
  const ranges: ReturnType<Decoration["range"]>[] = [];
  const active = view.state.doc.lineAt(view.state.selection.main.head);
  const hiddenMarks = new Set(["HeaderMark", "EmphasisMark", "CodeMark", "CodeInfo", "QuoteMark"]);
  const decoratedLines = new Set<number>();

  for (const visible of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from: visible.from,
      to: visible.to,
      enter(node) {
        const line = view.state.doc.lineAt(node.from);
        const isActiveLine = active.number === line.number;

        if (/^ATXHeading[1-6]$/.test(node.name)) {
          const level = node.name.slice(-1);
          ranges.push(Decoration.line({ class: `cm-live-heading cm-live-h${level}` }).range(line.from));
        }

        if (node.name === "FencedCode") {
          for (let n = line.number; n <= view.state.doc.lineAt(node.to).number; n += 1) {
            ranges.push(Decoration.line({ class: "cm-live-codeblock" }).range(view.state.doc.line(n).from));
          }
        }

        if (node.name === "Blockquote") {
          for (let n = line.number; n <= view.state.doc.lineAt(node.to).number; n += 1) {
            ranges.push(Decoration.line({ class: "cm-live-quote" }).range(view.state.doc.line(n).from));
          }
        }

        const parent = node.node.parent;
        const parentText = parent ? view.state.sliceDoc(parent.from, parent.to) : "";
        const hiddenLinkPart = parent?.name === "Link"
          && !parentText.startsWith("[^")
          && (node.name === "LinkMark" || node.name === "URL");

        if (!isActiveLine && (hiddenMarks.has(node.name) || hiddenLinkPart)) {
          ranges.push(Decoration.replace({}).range(node.from, node.to));
        }

        if (!isActiveLine && node.name === "ListMark") {
          const marker = view.state.sliceDoc(node.from, node.to);
          const isTask = /^\s*[-+*]\s+\[[ xX]\]/.test(line.text);
          const label = isTask ? "" : /^\s*\d/.test(marker) ? marker.trim() : "•";
          ranges.push(Decoration.replace(label ? { widget: new LiveTokenWidget(label, "cm-live-list-token") } : {}).range(node.from, node.to));
        }

        if (!isActiveLine && node.name === "TaskMarker") {
          const checked = /[xX]/.test(view.state.sliceDoc(node.from, node.to));
          ranges.push(Decoration.replace({ widget: new LiveTokenWidget(checked ? "☑" : "☐", `cm-live-task${checked ? " is-checked" : ""}`) }).range(node.from, node.to));
        }
      },
    });

    const firstLine = view.state.doc.lineAt(visible.from).number;
    const lastLine = view.state.doc.lineAt(visible.to).number;
    let inMathBlock = false;
    for (let number = 1; number <= lastLine; number += 1) {
      const line = view.state.doc.line(number);
      const trimmed = line.text.trim();
      if (trimmed === "$$") {
        if (number >= firstLine && number !== active.number) ranges.push(Decoration.replace({}).range(line.from, line.to));
        inMathBlock = !inMathBlock;
        continue;
      }
      if (number < firstLine || number === active.number) continue;

      if (inMathBlock) ranges.push(Decoration.line({ class: "cm-live-math" }).range(line.from));

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

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = liveDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = liveDecorations(update.view);
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

function makeTheme(dark: boolean, livePreview: boolean) {
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
          ? '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif'
          : '"SFMono-Regular", "SF Mono", ui-monospace, Menlo, Consolas, monospace',
        lineHeight: livePreview ? "1.72" : "1.82",
        overflowX: "hidden",
        overflowY: "auto",
      },
      ".cm-content": {
        width: "100%",
        maxWidth: "760px",
        minWidth: "0",
        margin: "0 auto",
        padding: "76px 42px 190px",
        caretColor: dark ? "#67aefc" : "#0878e6",
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
      ".cm-live-task.is-checked": { color: dark ? "#67aefc" : "#0878e6" },
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
        color: dark ? "#67aefc" : "#0878e6",
        fontSize: ".72em",
        verticalAlign: "super",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: dark ? "#67aefc" : "#0878e6",
        borderLeftWidth: "2px",
      },
      ".cm-selectionBackground, ::selection": {
        backgroundColor: dark ? "#1f4b75 !important" : "#cae4ff !important",
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
        backgroundColor: dark ? "#24272c" : "#ffffff",
        color: dark ? "#e8eaed" : "#202329",
        borderColor: dark ? "#353940" : "#dfe3e8",
      },
      ".cm-search": {
        padding: "10px 12px",
      },
      ".cm-search input": {
        border: `1px solid ${dark ? "#454a53" : "#cfd5dc"}`,
        borderRadius: "8px",
        background: dark ? "#191b1f" : "#f8f9fa",
        color: "inherit",
        padding: "5px 8px",
      },
      ".cm-search button": {
        border: "0",
        borderRadius: "7px",
        background: dark ? "#393d44" : "#e9edf1",
        color: "inherit",
        padding: "5px 9px",
      },
      ".cm-tooltip": {
        border: `1px solid ${dark ? "#3d4148" : "#dfe3e8"}`,
        backgroundColor: dark ? "#25282d" : "#ffffff",
      },
    },
    { dark },
  );
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ value, onChange, dark, focusMode, livePreview, onImageFile }, ref) => {
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
      const alt = file.name.replace(/\.[^.]+$/, "") || "图片";
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
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
          placeholder("从这里开始写…"),
          themeCompartment.current.of(makeTheme(dark, livePreview)),
          highlightCompartment.current.of(syntaxHighlighting(dark ? darkHighlight : lightHighlight)),
          focusCompartment.current.of(focusMode ? paragraphFocus : []),
          liveCompartment.current.of(livePreview ? livePreviewPlugin : []),
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
          themeCompartment.current.reconfigure(makeTheme(dark, livePreview)),
          highlightCompartment.current.reconfigure(syntaxHighlighting(dark ? darkHighlight : lightHighlight)),
        ],
      });
    }, [dark, livePreview]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({ effects: liveCompartment.current.reconfigure(livePreview ? livePreviewPlugin : []) });
    }, [livePreview]);

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
      surround: (before, after = before, placeholderText = "文字") => {
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
        <div ref={hostRef} className={`markdown-editor${focusMode ? " is-focus-mode" : ""}${livePreview ? " is-live-preview" : " is-source"}`} aria-label="Markdown 编辑器" />
        {selectionToolbar && <div className="selection-toolbar" style={{ left: selectionToolbar.left, top: selectionToolbar.top }} role="toolbar" aria-label="所选文字格式"><button type="button" onMouseDown={(event) => { event.preventDefault(); viewRef.current && (() => { const view = viewRef.current!; const s = view.state.selection.main; const text = view.state.sliceDoc(s.from, s.to); view.dispatch({ changes: { from: s.from, to: s.to, insert: `**${text}**` }, selection: EditorSelection.range(s.from + 2, s.to + 2) }); view.focus(); })(); }}>B</button><button type="button" className="italic-control" onMouseDown={(event) => { event.preventDefault(); const view = viewRef.current; if (!view) return; const s = view.state.selection.main; const text = view.state.sliceDoc(s.from, s.to); view.dispatch({ changes: { from: s.from, to: s.to, insert: `*${text}*` }, selection: EditorSelection.range(s.from + 1, s.to + 1) }); view.focus(); }}>I</button><button type="button" onMouseDown={(event) => { event.preventDefault(); const view = viewRef.current; if (!view) return; const s = view.state.selection.main; const text = view.state.sliceDoc(s.from, s.to); const inserted = `[${text}](https://)`; view.dispatch({ changes: { from: s.from, to: s.to, insert: inserted }, selection: EditorSelection.range(s.from + text.length + 3, s.from + text.length + 11) }); view.focus(); }}>链接</button><button type="button" onMouseDown={(event) => { event.preventDefault(); const view = viewRef.current; if (!view) return; const s = view.state.selection.main; const text = view.state.sliceDoc(s.from, s.to); view.dispatch({ changes: { from: s.from, to: s.to, insert: `\`${text}\`` }, selection: EditorSelection.range(s.from + 1, s.to + 1) }); view.focus(); }}>&lt;/&gt;</button></div>}
        {slash && <div className="slash-menu" style={{ left: slash.left, top: slash.top }} role="menu" aria-label="快速插入"><span>快速插入</span>{slashActions.filter((action) => !slash.query || action.key.includes(slash.query) || action.label.toLocaleLowerCase().includes(slash.query)).map((action) => <button type="button" role="menuitem" key={action.label} onMouseDown={(event) => { event.preventDefault(); const view = viewRef.current; if (!view) return; view.dispatch({ changes: { from: slash.from, to: slash.to, insert: action.text }, selection: { anchor: slash.from + (action.text.includes("\n\n") ? action.text.indexOf("\n\n") + 1 : action.text.length) }, scrollIntoView: true }); setSlash(null); view.focus(); }}><strong>{action.label}</strong><small>{action.detail}</small></button>)}</div>}
      </div>
    );
  },
);

MarkdownEditor.displayName = "MarkdownEditor";

export default MarkdownEditor;
