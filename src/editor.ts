import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorState, StateField, StateEffect } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLineGutter, keymap, lineNumbers, Decoration } from "@codemirror/view";
import { search } from "@codemirror/search";

const setCustomSearch = StateEffect.define<string>();

const customSearchField = StateField.define<string>({
  create: () => "",
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setCustomSearch)) return effect.value;
    }
    return value;
  },
  provide: (field) =>
    EditorView.decorations.compute([field], (state) => {
      const query = state.field(field);
      if (!query) return Decoration.none;

      const deco: Array<{ from: number; to: number; class: string }> = [];
      const doc = state.doc.toString();

      try {
        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        let match;
        while ((match = regex.exec(doc)) !== null) {
          deco.push({
            from: match.index,
            to: match.index + match[0].length,
            class: "cm-search-match",
          });
        }
      } catch {
        /* invalid regex, ignore */
      }

      return Decoration.set(
        deco.map((d) => Decoration.mark({ class: d.class }).range(d.from, d.to))
      );
    }),
});

export interface EditorHandle {
  view: EditorView;
  getDoc(): string;
  setDoc(contents: string): void;
  setSearchQuery(query: string): void;
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
      EditorView.lineWrapping,
      EditorState.tabSize.of(2),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      search(),
      customSearchField,
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
    setSearchQuery: (query: string) => {
      view.dispatch({ effects: setCustomSearch.of(query) });
    },
  };
}
