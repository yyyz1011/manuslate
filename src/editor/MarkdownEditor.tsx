import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
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
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

export interface MarkdownEditorHandle {
  focus: () => void;
  surround: (before: string, after?: string, placeholderText?: string) => void;
  prefixLine: (prefix: string) => void;
  insert: (text: string) => void;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  dark: boolean;
  focusMode: boolean;
}

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

function makeTheme(dark: boolean) {
  return EditorView.theme(
    {
      "&": {
        height: "100%",
        backgroundColor: "transparent",
        color: dark ? "#e8eaed" : "#202329",
        fontSize: "16px",
      },
      ".cm-scroller": {
        fontFamily: '"SFMono-Regular", "SF Mono", ui-monospace, Menlo, Consolas, monospace',
        lineHeight: "1.82",
        overflow: "auto",
      },
      ".cm-content": {
        width: "min(100%, 720px)",
        margin: "0 auto",
        padding: "72px 34px 180px",
        caretColor: dark ? "#67aefc" : "#0878e6",
      },
      ".cm-line": {
        padding: "0",
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
  ({ value, onChange, dark, focusMode }, ref) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const themeCompartment = useRef(new Compartment());
    const highlightCompartment = useRef(new Compartment());
    const focusCompartment = useRef(new Compartment());

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
          themeCompartment.current.of(makeTheme(dark)),
          highlightCompartment.current.of(syntaxHighlighting(dark ? darkHighlight : lightHighlight)),
          focusCompartment.current.of(focusMode ? paragraphFocus : []),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
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
          themeCompartment.current.reconfigure(makeTheme(dark)),
          highlightCompartment.current.reconfigure(syntaxHighlighting(dark ? darkHighlight : lightHighlight)),
        ],
      });
    }, [dark]);

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
    }));

    return (
      <div
        ref={hostRef}
        className={`markdown-editor${focusMode ? " is-focus-mode" : ""}`}
        aria-label="Markdown 编辑器"
      />
    );
  },
);

MarkdownEditor.displayName = "MarkdownEditor";

export default MarkdownEditor;
