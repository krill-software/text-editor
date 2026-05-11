# Text Editor

A minimal, single-window plain-text editor for Linux. Open a text file, edit it, save it. Quiet by design.

Built on Tauri 2 (Rust + system webview) with a TypeScript frontend and CodeMirror 6 (no language modes). See [SPEC.md](SPEC.md) for the design rationale.

## Features

- **Open** — file-open dialog, CLI arg, `Ctrl+O`. Default format is `.txt`; file associations cover `.txt`, `.log`, `.conf`, `.ini`.
- **Save / Save As** — `Ctrl+S` / `Ctrl+Shift+S`. Dirty state marked with a leading `•` in the titlebar.
- **Soft-wrapped column** — long lines wrap; no horizontal scrollbar.
- **Line numbers + find** — gutter line numbers and CodeMirror's `Ctrl+F` search.
- **Adjustable font size** — `Ctrl+=` / `Ctrl+-` / `Ctrl+0`, persisted between sessions.
- **Quiet by design** — no settings panel, no toolbar, no theme switcher.

## Keybindings

| Action          | Key            |
|-----------------|----------------|
| New             | `Ctrl+N`       |
| Open            | `Ctrl+O`       |
| Save            | `Ctrl+S`       |
| Save As         | `Ctrl+Shift+S` |
| Undo / Redo     | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Select All      | `Ctrl+A`       |
| Find            | `Ctrl+F`       |
| Font size       | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` |
| Quit            | `Ctrl+Q`       |

## Run from CLI

```sh
krill-text-editor path/to/file.txt
```

Without an arg, the app starts on an empty untitled buffer.

## Build from source

Requires Rust 1.77+, Node 20+, pnpm, and Tauri 2's Linux build deps.

```sh
pnpm install
pnpm tauri dev      # development with hot reload
pnpm tauri build    # release artifacts in src-tauri/target/release/bundle/
```

## Releasing

Bump the version in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` (all three must match), then:

```sh
pnpm release
```

This runs `tauri build` and gathers AppImage + .deb under `release/v<version>/` with SHA256 checksums. Tag and push to trigger the GitHub Release workflow.

## License

MIT.
