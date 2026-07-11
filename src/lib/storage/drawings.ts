import { createStore, entries, del, get, set, clear } from "idb-keyval";
import type { ExcalidrawImperativeAPI, AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export interface SavedDrawing {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  sceneData: {
    elements: readonly ExcalidrawElement[];
    appState: Partial<AppState>;
    files: BinaryFiles;
  };
}

const drawingsStore = createStore("sketter-drawings", "drawings");

/** localStorage key used to hand a proposed name from the chat to the autosave writer. */
export function pendingDrawingNameKey(drawingId: string): string {
  return `sketter.pendingName.${drawingId}`;
}

const MAX_DRAWING_NAME_LENGTH = 40;

/**
 * Formats a raw string (first message, plan summary, etc.) into a concise,
 * lowercase drawing name that matches the app's quiet copy style.
 */
export function formatDrawingName(input: string): string {
  const cleaned = input
    .replace(/\s+/g, " ")
    .replace(/[.!?;:,]$/, "")
    .trim()
    .toLowerCase();
  if (cleaned.length === 0) return "";
  if (cleaned.length <= MAX_DRAWING_NAME_LENGTH) return cleaned;
  return cleaned.slice(0, MAX_DRAWING_NAME_LENGTH).replace(/\s+\S*$/, "") + "…";
}

const PERSISTED_APP_STATE_KEYS: (keyof AppState)[] = [
  "viewBackgroundColor",
  "currentItemStrokeColor",
  "currentItemBackgroundColor",
];

function pickAppState(appState: AppState): Partial<AppState> {
  const picked: Partial<AppState> = {};
  for (const key of PERSISTED_APP_STATE_KEYS) {
    (picked as Record<string, unknown>)[key] = appState[key];
  }
  return picked;
}

export async function listDrawings(): Promise<SavedDrawing[]> {
  const all = await entries<string, SavedDrawing>(drawingsStore);
  return all.map(([, value]) => value).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadDrawing(id: string): Promise<SavedDrawing | undefined> {
  return get<SavedDrawing>(id, drawingsStore);
}

export async function saveDrawing(
  api: ExcalidrawImperativeAPI,
  opts: { id: string; name: string },
): Promise<SavedDrawing> {
  const elements = api.getSceneElements();
  const appState = api.getAppState();
  const files = api.getFiles();

  const existing = await loadDrawing(opts.id);
  const now = Date.now();

  let thumbnail: string | undefined = existing?.thumbnail;
  if (elements.length > 0) {
    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const blob = await exportToBlob({
        elements,
        appState: { ...appState, exportBackground: true },
        files,
        mimeType: "image/png",
        maxWidthOrHeight: 240,
      });
      thumbnail = await blobToDataUrl(blob);
    } catch {
      // Thumbnail generation is best-effort; keep whatever we had before.
    }
  }

  const record: SavedDrawing = {
    id: opts.id,
    name: opts.name,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    thumbnail,
    sceneData: {
      elements,
      appState: pickAppState(appState),
      files,
    },
  };

  await set(opts.id, record, drawingsStore);
  return record;
}

export async function renameDrawing(id: string, name: string): Promise<void> {
  const existing = await loadDrawing(id);
  if (!existing) return;
  await set(id, { ...existing, name, updatedAt: Date.now() }, drawingsStore);
}

export async function deleteDrawing(id: string): Promise<void> {
  await del(id, drawingsStore);
  await del(`messages-${id}`, drawingsStore);
}

export async function saveMessages(id: string, messages: unknown[]): Promise<void> {
  await set(`messages-${id}`, messages, drawingsStore);
}

export async function loadMessages(id: string): Promise<unknown[]> {
  return (await get<unknown[]>(`messages-${id}`, drawingsStore)) ?? [];
}

export async function clearAllDrawings(): Promise<void> {
  await clear(drawingsStore);
}

export async function drawingsCount(): Promise<number> {
  return (await listDrawings()).length;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
