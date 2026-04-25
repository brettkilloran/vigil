import { eq, max } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import { HG_DOC_FORMAT } from "@/src/lib/hg-doc/constants";
import { newTaskHgDocSeed } from "@/src/lib/hg-doc/new-node-seeds";
import { buildLoreNoteContentJson } from "@/src/lib/lore-import-commit";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

/** Small rotation jitter in degrees (±2°) for hand-placed look. */
export function jitterHgRotationDeg(): number {
  return Math.random() * 4 - 2;
}

/**
 * Next z-index for a new item when the client omits `zIndex` (matches lore import: start 101 if empty).
 */
export async function nextZIndexForSpace(
  db: VigilDb,
  spaceId: string
): Promise<number> {
  const [mz] = await db
    .select({ z: max(items.zIndex) })
    .from(items)
    .where(eq(items.spaceId, spaceId));
  return mz?.z != null && Number.isFinite(Number(mz.z))
    ? Number(mz.z) + 1
    : 101;
}

export function defaultItemDimensions(
  itemType: string,
  entityType: string | null | undefined
): { width: number; height: number } {
  if (
    entityType === "character" ||
    entityType === "faction" ||
    entityType === "location"
  ) {
    return { width: 340, height: 280 };
  }
  switch (itemType) {
    case "note":
      return { width: 340, height: 270 };
    case "checklist":
      return { width: 340, height: 188 };
    default:
      return { width: 280, height: 200 };
  }
}

export type CreateItemTheme = "default" | "code" | "task";

/**
 * When `contentJson` is omitted, build a minimal renderer-safe payload (HTML or hgDoc + hgArch).
 */
export function synthesizeContentJsonForCreateItem(args: {
  itemType: "note" | "sticky" | "image" | "checklist" | "webclip" | "folder";
  contentText: string;
  theme: CreateItemTheme;
}): Record<string, unknown> | null {
  const rot = jitterHgRotationDeg();
  const tapeRot = jitterHgRotationDeg();
  const tapeVariant = "clear" as const;

  if (args.itemType === "checklist") {
    return {
      format: HG_DOC_FORMAT,
      doc: newTaskHgDocSeed(),
      hgArch: {
        theme: "task",
        tapeVariant,
        rotation: rot,
        tapeRotation: tapeRot,
      },
    };
  }

  if (args.itemType === "note" || args.itemType === "sticky") {
    const base = buildLoreNoteContentJson(args.contentText);
    const hg = (
      base.hgArch && typeof base.hgArch === "object" ? base.hgArch : {}
    ) as Record<string, unknown>;
    const theme =
      args.theme === "code"
        ? "code"
        : args.theme === "task"
          ? "task"
          : "default";
    return {
      ...base,
      hgArch: {
        ...hg,
        theme,
        tapeVariant: hg.tapeVariant ?? tapeVariant,
        rotation: rot,
        tapeRotation: tapeRot,
      },
    };
  }

  return null;
}
