import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { search, searchKeymap } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";

export interface EditorHandle {
  view: EditorView;
  getDoc(): string;
  setDoc(contents: string): void;
}

export function createEditor(
  parent: HTMLElement,
  initial: string,
  onChange: (doc: string) => void,
  onCursor?: (line: number, col: number) => void,
): EditorHandle {
  const state = EditorState.create({
    doc: initial,
    extensions: [
      history(),
      drawSelection(),
      lineNumbers(),
      highlightActiveLineGutter(),
      search({ top: true }),
      EditorView.lineWrapping,
      EditorState.tabSize.of(2),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onChange(u.state.doc.toString());
        if (onCursor && (u.docChanged || u.selectionSet)) {
          const head = u.state.selection.main.head;
          const line = u.state.doc.lineAt(head);
          onCursor(line.number, head - line.from + 1);
        }
      }),
    ],
  });

  const view = new EditorView({ state, parent });

  return {
    view,
    getDoc: () => view.state.doc.toString(),
    setDoc: (contents: string) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: contents },
      });
    },
  };
}
