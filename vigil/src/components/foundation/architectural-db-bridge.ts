/**
 * Maps between Neon `CanvasItem` rows and in-memory architectural `CanvasGraph` entities.
 */
import type {
  CanvasContentEntity,
  CanvasEntity,
  CanvasFolderEntity,
  CanvasGraph,
  CanvasSpace,
  ContentTheme,
  TapeVariant,
} from "@/src/components/foundation/architectural-types";
import type { CanvasItem } from "@/src/model/canvas-types";
import type { CameraState } from "@/src/model/canvas-types";

const UNIFIED_NODE_WIDTH = 340;
const FOLDER_CARD_WIDTH = 420;
const DEFAULT_NOTE_HTML = `<div contenteditable="true">Start typing...</div>`;

export type BootstrapSpaceRow = {
  id: string;
  name: string;
  parentSpaceId: string | null;
  updatedAt: string;
};

export type BootstrapResponse = {
  ok: boolean;
  demo?: boolean;
  spaceId: string | null;
  spaces: BootstrapSpaceRow[];
  items: CanvasItem[];
  camera: CameraState;
};

/** Stored in `items.content_json` alongside TipTap/HTML payload. */
export type HgArchPayload = {
  theme?: ContentTheme;
  tapeVariant?: TapeVariant;
  rotation?: number;
  tapeRotation?: number;
  folderColorScheme?: string;
};

export function htmlToPlainText(html: string): string {
  if (typeof document !== "undefined") {
    const d = document.createElement("div");
    d.innerHTML = html;
    const t = d.textContent ?? d.innerText ?? "";
    return t.replace(/\s+/g, " ").trim();
  }
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readRecord(obj: unknown): Record<string, unknown> | null {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : null;
}

function readHgArch(cj: Record<string, unknown> | null): HgArchPayload | null {
  if (!cj) return null;
  const raw = cj.hgArch;
  const o = readRecord(raw);
  if (!o) return null;
  return {
    theme: o.theme as ContentTheme | undefined,
    tapeVariant: o.tapeVariant as TapeVariant | undefined,
    rotation: typeof o.rotation === "number" ? o.rotation : undefined,
    tapeRotation: typeof o.tapeRotation === "number" ? o.tapeRotation : undefined,
    folderColorScheme:
      typeof o.folderColorScheme === "string" ? o.folderColorScheme : undefined,
  };
}

function readFolderMeta(cj: Record<string, unknown> | null): string | null {
  if (!cj) return null;
  const folder = readRecord(cj.folder);
  const id = folder?.childSpaceId;
  return typeof id === "string" ? id : null;
}

function readHtmlFromContentJson(cj: Record<string, unknown> | null): string | null {
  if (!cj) return null;
  if (cj.format === "html" && typeof cj.html === "string") return cj.html;
  return null;
}

function bodyHtmlFromCanvasItem(item: CanvasItem): string {
  const cj = readRecord(item.contentJson ?? null);
  const fromJson = readHtmlFromContentJson(cj);
  if (fromJson) return fromJson;
  if (item.itemType === "image" && item.imageUrl) {
    return `
        <div data-architectural-media-root="true">
          <img class="" src="${item.imageUrl}" alt="" />
        </div>
        <div data-architectural-media-notes="true"></div>`;
  }
  const plain = item.contentText?.trim();
  if (plain) {
    return `<div contenteditable="true">${plain.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
  }
  return DEFAULT_NOTE_HTML;
}

function themeFromItemType(item: CanvasItem, hg: HgArchPayload | null): ContentTheme {
  if (item.itemType === "checklist") return "task";
  if (item.itemType === "image") return "media";
  if (hg?.theme) return hg.theme;
  return "default";
}

function tapeVariantForTheme(theme: ContentTheme): TapeVariant {
  if (theme === "code") return "dark";
  if (theme === "task") return "masking";
  if (theme === "media") return "dark";
  return "clear";
}

export function canvasItemToEntity(
  item: CanvasItem,
  activeSpaceId: string,
): CanvasEntity | null {
  const cj = readRecord(item.contentJson ?? null);
  const hg = readHgArch(cj);

  if (item.itemType === "folder") {
    const childSpaceId = readFolderMeta(cj);
    if (!childSpaceId) return null;
    const folder: CanvasFolderEntity = {
      id: item.id,
      title: item.title || "Folder",
      kind: "folder",
      theme: "folder",
      childSpaceId,
      rotation: hg?.rotation ?? 0,
      width: item.width || FOLDER_CARD_WIDTH,
      tapeRotation: hg?.tapeRotation ?? 0,
      stackId: item.stackId ?? null,
      stackOrder: item.stackOrder ?? null,
      slots: {
        [activeSpaceId]: { x: item.x, y: item.y },
      },
    };
    if (hg?.folderColorScheme) {
      folder.folderColorScheme = hg.folderColorScheme as CanvasFolderEntity["folderColorScheme"];
    }
    return folder;
  }

  const theme = themeFromItemType(item, hg);
  const entity: CanvasContentEntity = {
    id: item.id,
    title: item.title || "Untitled",
    kind: "content",
    theme,
    rotation: hg?.rotation ?? 0,
    width: item.width || UNIFIED_NODE_WIDTH,
    tapeRotation: hg?.tapeRotation ?? 0,
    tapeVariant: hg?.tapeVariant ?? tapeVariantForTheme(theme),
    bodyHtml: bodyHtmlFromCanvasItem(item),
    stackId: item.stackId ?? null,
    stackOrder: item.stackOrder ?? null,
    slots: {
      [activeSpaceId]: { x: item.x, y: item.y },
    },
  };
  return entity;
}

export function findRootSpaceId(spaces: BootstrapSpaceRow[]): string {
  const roots = spaces.filter((s) => s.parentSpaceId == null);
  return roots[0]?.id ?? spaces[0]?.id ?? "";
}

export function buildCanvasGraphFromBootstrap(data: BootstrapResponse): CanvasGraph {
  const rootSpaceId = findRootSpaceId(data.spaces);

  const spacesRecord: Record<string, CanvasSpace> = {};
  for (const s of data.spaces) {
    spacesRecord[s.id] = {
      id: s.id,
      name: s.name,
      parentSpaceId: s.parentSpaceId,
      entityIds: [],
    };
  }

  const entities: Record<string, CanvasEntity> = {};

  for (const item of data.items) {
    const e = canvasItemToEntity(item, item.spaceId);
    if (!e) continue;
    entities[e.id] = e;
    const sp = spacesRecord[item.spaceId];
    if (sp && !sp.entityIds.includes(e.id)) sp.entityIds.push(e.id);
  }

  return {
    rootSpaceId,
    spaces: spacesRecord,
    entities,
    connections: {},
  };
}

function mergeEntityFromItem(
  prevEntity: CanvasEntity | undefined,
  item: CanvasItem,
): CanvasEntity | null {
  const fresh = canvasItemToEntity(item, item.spaceId);
  if (!fresh) return null;
  if (prevEntity && "slots" in prevEntity && "slots" in fresh) {
    return { ...fresh, slots: { ...prevEntity.slots, ...fresh.slots } } as CanvasEntity;
  }
  return fresh;
}

/**
 * Merge server rows into the in-memory graph. Bootstrap items are only guaranteed for the
 * active space subtree, so spaces with no items in the payload keep their previous `entityIds`.
 */
export function mergeBootstrapView(prev: CanvasGraph, data: BootstrapResponse): CanvasGraph {
  const rootSpaceId = findRootSpaceId(data.spaces);
  const affectedSpaceIds = new Set(data.items.map((i) => i.spaceId));

  const spacesRecord: Record<string, CanvasSpace> = { ...prev.spaces };
  for (const s of data.spaces) {
    const existing = spacesRecord[s.id];
    spacesRecord[s.id] = {
      id: s.id,
      name: s.name,
      parentSpaceId: s.parentSpaceId,
      entityIds: affectedSpaceIds.has(s.id) ? [] : (existing?.entityIds ?? []),
    };
  }

  const entities: Record<string, CanvasEntity> = { ...prev.entities };
  for (const item of data.items) {
    const merged = mergeEntityFromItem(entities[item.id], item);
    if (!merged) continue;
    entities[item.id] = merged;
    const sp = spacesRecord[item.spaceId];
    if (sp && !sp.entityIds.includes(merged.id)) sp.entityIds.push(merged.id);
  }

  for (const spaceId of affectedSpaceIds) {
    const prevIds = prev.spaces[spaceId]?.entityIds ?? [];
    const newIds = spacesRecord[spaceId]?.entityIds ?? [];
    for (const id of prevIds) {
      if (newIds.includes(id)) continue;
      delete entities[id];
      for (const sp of Object.values(spacesRecord)) {
        sp.entityIds = sp.entityIds.filter((e) => e !== id);
      }
    }
  }

  return {
    ...prev,
    rootSpaceId,
    spaces: spacesRecord,
    entities,
    connections: {},
  };
}

export function buildContentJsonForContentEntity(
  entity: CanvasContentEntity,
): Record<string, unknown> {
  const hgArch: HgArchPayload = {
    theme: entity.theme,
    tapeVariant: entity.tapeVariant,
    rotation: entity.rotation,
    tapeRotation: entity.tapeRotation,
  };
  return {
    format: "html",
    html: entity.bodyHtml,
    hgArch,
  };
}

export function buildContentJsonForFolderEntity(
  entity: CanvasFolderEntity,
): Record<string, unknown> {
  const hgArch: HgArchPayload = {
    rotation: entity.rotation,
    tapeRotation: entity.tapeRotation,
  };
  if (entity.folderColorScheme) {
    hgArch.folderColorScheme = entity.folderColorScheme;
  }
  return {
    folder: { childSpaceId: entity.childSpaceId },
    hgArch,
  };
}

export function architecturalItemType(entity: CanvasEntity): CanvasItem["itemType"] {
  if (entity.kind === "folder") return "folder";
  if (entity.theme === "task") return "checklist";
  if (entity.theme === "media") return "image";
  return "note";
}

export function entityGeometryOnSpace(entity: CanvasEntity, spaceId: string) {
  const slot = entity.slots[spaceId];
  return {
    x: slot?.x ?? 0,
    y: slot?.y ?? 0,
    width:
      entity.kind === "folder"
        ? entity.width ?? FOLDER_CARD_WIDTH
        : entity.width ?? UNIFIED_NODE_WIDTH,
    height: 280,
  };
}
