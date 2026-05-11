# Text Editor — Spec (v1)

A minimal plain-text editor for Linux. Open a text file, edit it, save it. Quiet by design — the kind of app you reach for to jot a config tweak, scratch a `TODO`, or read a log without ceremony.

## Goals

- Open, edit, save one plain-text file at a time — fast launch, no project/workspace concept.
- Feel like a native Linux desktop app (`.desktop` entry, file associations, XDG dirs).
- Stay out of the writer's way: no toolbars, no minimap, no inline previews of anything.

## Non-goals (v1)

- No syntax highlighting, no language modes — this is not a code editor.
- No multi-tab or multi-window session management (one file per window).
- No find-and-replace UI beyond CodeMirror's built-in search bar.
- No autosave, no recent-files menu, no settings panel.
- No Windows/macOS builds.

## Stack

- **Shell:** Tauri 2 (Rust backend + system webview).
- **Frontend:** TypeScript + Vite. Editor: CodeMirror 6 (history, search, lineNumbers, lineWrapping — no language support).
- **Chrome:** [`@krill-software/desktop-ui`](https://github.com/krill-software/desktop-ui) provides the titlebar, menu, status line, palette, and canonical action registry.
- **State / fs / dev helpers:** [`krill-desktop-core`](https://github.com/krill-software/desktop-core).

## Typography

- **Default typeface:** Hasklig (bundled WOFF2), with `Source Code Pro` / `JetBrains Mono` / `ui-monospace` fallbacks.
- **Size:** 14px default, adjustable via `Ctrl+=` / `Ctrl+-` / `Ctrl+0` (range 12–28, persisted to state).
- **Line height:** 1.6.
- **Column:** soft-wrapped, with a generous `90ch` max width. Lines past the column wrap rather than scroll horizontally.
- **Gutter:** line numbers visible (this *is* an editor, not a writer's surface).

## UX

### Window

- Single window per file. A new file = a new window.
- Filename centered in the titlebar; dirty state shown as a leading `•`.
- Window size/position remembered in `$XDG_STATE_HOME/krill-text-editor/state.json`.

### Status line

- Left half: empty (the filename lives in the titlebar).
- Right half: word count and line count. Updates live.

### Actions

Canonical actions only; bindings come from `@krill-software/desktop-ui`'s action registry.

| Action      | Key            |
|-------------|----------------|
| New         | `Ctrl+N`       |
| Open        | `Ctrl+O`       |
| Save        | `Ctrl+S`       |
| Save As     | `Ctrl+Shift+S` |
| Quit        | `Ctrl+Q`       |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Select All  | `Ctrl+A`       |
| Find        | `Ctrl+F` (CodeMirror's search panel) |

Custom menu (View): increase / decrease / reset font size.

## File handling

- **Formats:** any text file. Default save extension is `.txt`; file associations cover `.txt`, `.log`, `.conf`, `.ini`.
- **Encoding:** UTF-8 only in v1.
- **Open from CLI:** `krill-text-editor path/to/file.txt`.
- **Open with no arg:** empty untitled buffer.
- **Dirty tracking:** compare current buffer hash to last-saved hash. Confirm on close / new / open if dirty.
- **No autosave** in v1.

## Linux integration

- Slug / binary / identifier / state dir: `krill-text-editor` (`software.krill.text-editor`).
- MIME association: `text/plain` with extensions `txt`, `log`, `conf`, `ini`.
- Distribution: AppImage + `.deb`.

## Milestones

1. **M1 — Editor works.** Tauri app launches, opens a file via CLI, edits, saves. Bundled Hasklig, soft-wrapped column, line numbers, status word/line counts. Done.
2. **M2 — Polish.** External-change detection, find-and-replace, line endings indicator if it ever matters.
