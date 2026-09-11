import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function CodeEditor({ value, onChange, onSave }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
  }, [onChange, onSave]);

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const saveKeymap = keymap.of([
      {
        key: "Mod-s",
        preventDefault: true,
        run: () => {
          onSaveRef.current();
          return true;
        },
      },
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
    ]);

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        markdown(),
        saveKeymap,
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
        EditorView.theme({
          "&": { height: "100%", backgroundColor: "transparent" },
          ".cm-scroller": {
            fontFamily: '"IBM Plex Mono", monospace',
            lineHeight: "1.72",
            padding: "26px 30px 80px",
          },
          ".cm-content": { maxWidth: "820px", margin: "0 auto", caretColor: "#2e7774" },
          ".cm-gutters": {
            backgroundColor: "transparent",
            border: "none",
            color: "#92a39f",
          },
          ".cm-activeLine": { backgroundColor: "rgba(46,119,116,.055)" },
          ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#2e7774" },
          ".cm-selectionBackground, ::selection": { backgroundColor: "rgba(46,119,116,.18) !important" },
          "&.cm-focused": { outline: "none" },
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    return () => view.destroy();
  }, []);

  return <div ref={hostRef} className="code-editor" aria-label="Markdown 编辑器" />;
}
