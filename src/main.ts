import "@krill-software/desktop-ui/styles";
import "./styles.css";

import { mountChrome, showBootError } from "@krill-software/desktop-ui";

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize, LogicalPosition } from "@tauri-apps/api/window";
import { getMatches } from "@tauri-apps/plugin-cli";
import { confirm, open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";

import { redo, selectAll, undo } from "@codemirror/commands";

import { createEditor, type EditorHandle } from "./editor";

interface PersistedState {
  font_size?: number;
  window?: { width: number; height: number; x: number; y: number };
}

interface DocState {
  path: string | null;
  savedHash: number;
  currentHash: number;
}

const FONT_MIN = 12;
const FONT_MAX = 28;
const FONT_DEFAULT = 14;
const UNTITLED_NAME = "untitled.txt";

const persisted: PersistedState = {};
const docState: DocState = {
  path: null,
  savedHash: hash(""),
  currentHash: hash(""),
};

let editor: EditorHandle;
let saveStateTimer: number | undefined;
let titleEl: HTMLElement | null = null;

// ---- Hash + dirty tracking -------------------------------------------

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function isDirty(): boolean {
  return docState.currentHash !== docState.savedHash;
}

// ---- Font size --------------------------------------------------------

let fontSize = FONT_DEFAULT;

function applyFontSize(size: number) {
  fontSize = Math.max(FONT_MIN, Math.min(FONT_MAX, size));
  document.documentElement.style.setProperty("--fm-font-size", `${fontSize}px`);
  persisted.font_size = fontSize;
  schedulePersist();
}

function bumpFontSize(delta: number) {
  applyFontSize(fontSize + delta);
}

function resetFontSize() {
  applyFontSize(FONT_DEFAULT);
}

// ---- File helpers ----------------------------------------------------

function basename(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

function updateTitle() {
  const name = docState.path ? basename(docState.path) : UNTITLED_NAME;
  if (titleEl) titleEl.textContent = name;
  document.body.dataset.dirty = String(isDirty());
  const mark = isDirty() ? " •" : "";
  const label = `${name}${mark} — Text Editor`;
  document.title = label;
  getCurrentWindow().setTitle(label).catch(() => {});
}

function updateStatus(contents: string) {
  const wordsEl = document.getElementById("status-words")!;
  const words = contents.trim() ? contents.trim().split(/\s+/).length : 0;
  wordsEl.textContent = `${words.toLocaleString()} ${words === 1 ? "word" : "words"}`;
}

function onDocChange(contents: string) {
  docState.currentHash = hash(contents);
  updateTitle();
  updateStatus(contents);
}

// ---- File open / save ------------------------------------------------

async function openPath(path: string): Promise<void> {
  try {
    const res = await invoke<{ path: string; contents: string }>("read_file", { path });
    editor.setDoc(res.contents);
    const normalized = editor.getDoc();
    docState.path = res.path;
    docState.savedHash = hash(normalized);
    docState.currentHash = docState.savedHash;
    updateTitle();
    updateStatus(normalized);
  } catch (e) {
    console.error("open failed:", e);
  }
}

async function openViaDialog(): Promise<void> {
  if (!(await confirmDiscardIfDirty())) return;
  const selected = await openDialog({
    multiple: false,
    directory: false,
    filters: [
      { name: "Text", extensions: ["txt", "log", "conf", "ini"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (typeof selected === "string") await openPath(selected);
}

async function save(): Promise<boolean> {
  if (!docState.path) return saveAs();
  try {
    const contents = editor.getDoc();
    const written = await invoke<string>("write_file", { path: docState.path, contents });
    docState.path = written;
    docState.savedHash = hash(contents);
    docState.currentHash = docState.savedHash;
    updateTitle();
    return true;
  } catch (e) {
    console.error("save failed:", e);
    return false;
  }
}

async function saveAs(): Promise<boolean> {
  const defaultPath = docState.path ?? UNTITLED_NAME;
  const selected = await saveDialog({
    defaultPath,
    filters: [{ name: "Text", extensions: ["txt"] }],
  });
  if (typeof selected !== "string") return false;
  try {
    const contents = editor.getDoc();
    const written = await invoke<string>("write_file", { path: selected, contents });
    docState.path = written;
    docState.savedHash = hash(contents);
    docState.currentHash = docState.savedHash;
    updateTitle();
    return true;
  } catch (e) {
    console.error("saveAs failed:", e);
    return false;
  }
}

async function newFile(): Promise<void> {
  if (!(await confirmDiscardIfDirty())) return;
  editor.setDoc("");
  docState.path = null;
  docState.savedHash = hash("");
  docState.currentHash = docState.savedHash;
  updateTitle();
  updateStatus("");
  editor.view.focus();
}

async function confirmDiscardIfDirty(): Promise<boolean> {
  if (!isDirty()) return true;
  return await confirm("You have unsaved changes. Discard them?", {
    title: "Unsaved changes",
    kind: "warning",
  });
}

async function quit(): Promise<void> {
  if (!(await confirmDiscardIfDirty())) return;
  await getCurrentWindow().close();
}

// ---- Chrome ----------------------------------------------------------

function initChrome() {
  const chrome = mountChrome({
    productName: "Text Editor",
    actions: {
      "new":        () => void newFile(),
      "open":       () => void openViaDialog(),
      "save":       () => void save(),
      "save-as":    () => void saveAs(),
      "quit":       () => void quit(),
      "undo":       () => { undo(editor.view); editor.view.focus(); },
      "redo":       () => { redo(editor.view); editor.view.focus(); },
      "select-all": () => { selectAll(editor.view); editor.view.focus(); },
    },
    customMenu: [
      {
        group: "view",
        items: [
          { label: "Increase font size", shortcut: "Ctrl+=", action: () => bumpFontSize(1) },
          { label: "Decrease font size", shortcut: "Ctrl+-", action: () => bumpFontSize(-1) },
          { label: "Reset font size",    shortcut: "Ctrl+0", action: resetFontSize },
        ],
      },
    ],
    showStatusLine: true,
    updater: true,
  });
  titleEl = chrome.title;
  chrome.viewport.id = "viewport";

  // Editor root fills the main viewport.
  const editorRoot = document.createElement("section");
  editorRoot.id = "editor-root";
  chrome.viewport.appendChild(editorRoot);

  // Status line: just word + line counts. Filename lives in the titlebar;
  // dirty rides body[data-dirty="true"]. The info half stays empty since
  // a plain text file has no natural identity metrics worth surfacing.
  const wordsSpan = document.createElement("span");
  wordsSpan.id = "status-words";
  chrome.statusState!.appendChild(wordsSpan);

  // Build the actual editor inside #editor-root.
  editor = createEditor(editorRoot, "", onDocChange);
}

// ---- Window persistence ---------------------------------------------

function schedulePersist() {
  if (saveStateTimer !== undefined) clearTimeout(saveStateTimer);
  saveStateTimer = window.setTimeout(() => {
    invoke("save_state", { state: persisted }).catch(() => {});
  }, 300);
}

async function installWindowPersistence() {
  const w = getCurrentWindow();
  if (persisted.window) {
    const { width, height, x, y } = persisted.window;
    await w.setSize(new LogicalSize(width, height)).catch(() => {});
    await w.setPosition(new LogicalPosition(x, y)).catch(() => {});
  }
  const record = async () => {
    try {
      const size = await w.innerSize();
      const pos = await w.outerPosition();
      const factor = await w.scaleFactor();
      persisted.window = {
        width: Math.round(size.width / factor),
        height: Math.round(size.height / factor),
        x: Math.round(pos.x / factor),
        y: Math.round(pos.y / factor),
      };
      schedulePersist();
    } catch {
      /* ignore */
    }
  };
  await w.onResized(record);
  await w.onMoved(record);
  await w.onCloseRequested(async (event) => {
    if (!isDirty()) return;
    event.preventDefault();
    const ok = await confirm("You have unsaved changes. Close anyway?", {
      title: "Unsaved changes",
      kind: "warning",
    });
    if (ok) await w.destroy();
  });
}

async function boot() {
  try {
    const loaded = await invoke<PersistedState | null>("load_state");
    if (loaded) Object.assign(persisted, loaded);
  } catch {
    /* no prior state */
  }

  applyFontSize(persisted.font_size ?? FONT_DEFAULT);

  initChrome();
  await installWindowPersistence();

  let openedFromArg = false;
  try {
    const matches = await getMatches();
    const fileArg = matches.args.file?.value;
    if (typeof fileArg === "string" && fileArg.length > 0) {
      await openPath(fileArg);
      openedFromArg = true;
    }
  } catch {
    /* cli plugin unavailable or no args */
  }

  if (!openedFromArg && import.meta.env.DEV) {
    try {
      const devFile = await invoke<string | null>("dev_test_file");
      if (devFile) await openPath(devFile);
    } catch {
      /* no dev file available */
    }
  }

  updateTitle();
  updateStatus(editor.getDoc());
  editor.view.focus();
}

boot().catch((e) => {
  console.error("boot failed:", e);
  showBootError(e);
});
