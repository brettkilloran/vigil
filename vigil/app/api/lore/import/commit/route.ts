import { eq, max } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { itemLinks, items } from "@/src/db/schema";
import { DS_COLOR } from "@/src/lib/design-system-tokens";
import { scheduleItemEmbeddingRefresh } from "@/src/lib/item-embedding";
import {
  buildLoreNoteContentJson,
  normalizeLoreLinkType,
  planLoreImportCardLayout,
} from "@/src/lib/lore-import-commit";
import { validateLinkTargetsInSourceSpace } from "@/src/lib/item-links-validation";
import { buildSearchBlob } from "@/src/lib/search-blob";
import { assertSpaceExists } from "@/src/lib/spaces";

export const runtime = "nodejs";

const entitySchema = z.object({
  name: z.string().min(1).max(255),
  kind: z.string().max(64).optional(),
  summary: z.string().max(8000).optional(),
});

const linkSchema = z.object({
  fromName: z.string().min(1).max(255),
  toName: z.string().min(1).max(255),
  linkType: z.string().max(64).optional(),
});

const bodySchema = z.object({
  spaceId: z.string().uuid(),
  sourceDocument: z
    .object({
      title: z.string().max(255).optional(),
      text: z.string().max(500_000).optional(),
    })
    .optional(),
  entities: z.array(entitySchema).max(200),
  suggestedLinks: z.array(linkSchema).max(500).optional(),
  layout: z
    .object({
      originX: z.number().finite(),
      originY: z.number().finite(),
    })
    .optional(),
});

function dedupeEntities(
  list: z.infer<typeof entitySchema>[],
): { canonicalName: string; kind?: string; summary?: string }[] {
  const byKey = new Map<string, { canonicalName: string; kind?: string; summary?: string }>();
  for (const e of list) {
    const name = e.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (byKey.has(key)) continue;
    byKey.set(key, {
      canonicalName: name,
      kind: e.kind?.trim() || undefined,
      summary: e.summary?.trim() || undefined,
    });
  }
  return [...byKey.values()];
}

function resolveNameToId(
  nameToId: Map<string, string>,
  raw: string,
): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  return nameToId.get(t.toLowerCase());
}

export async function POST(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { spaceId, sourceDocument, suggestedLinks } = parsed.data;
  const sourceText = sourceDocument?.text?.trim() ?? "";
  const deduped = dedupeEntities(parsed.data.entities);

  if (!sourceText && deduped.length < 1) {
    return Response.json(
      { ok: false, error: "Provide source text and/or at least one entity" },
      { status: 400 },
    );
  }

  const space = await assertSpaceExists(db, spaceId);
  if (!space) {
    return Response.json({ ok: false, error: "Space not found" }, { status: 404 });
  }

  const [mz] = await db
    .select({ z: max(items.zIndex) })
    .from(items)
    .where(eq(items.spaceId, spaceId));
  let zNext =
    mz?.z != null && Number.isFinite(Number(mz.z)) ? Number(mz.z) + 1 : 101;

  const ox = parsed.data.layout?.originX ?? 0;
  const oy = parsed.data.layout?.originY ?? 0;
  const layout = planLoreImportCardLayout(ox, oy, sourceText.length > 0, deduped.length);

  const nameToId = new Map<string, string>();
  const createdIds: string[] = [];
  let sourceItemId: string | undefined;

  const insertNote = async (args: {
    title: string;
    contentText: string;
    contentJson: Record<string, unknown>;
    x: number;
    y: number;
    width: number;
    height: number;
    entityType?: string | null;
    entityMeta?: Record<string, unknown> | null;
  }) => {
    const searchBlob = buildSearchBlob({
      title: args.title,
      contentText: args.contentText,
      contentJson: args.contentJson,
      entityType: args.entityType ?? null,
      entityMeta: args.entityMeta ?? null,
      imageUrl: null,
      imageMeta: null,
    });
    const [row] = await db
      .insert(items)
      .values({
        spaceId,
        itemType: "note",
        x: args.x,
        y: args.y,
        width: args.width,
        height: args.height,
        zIndex: zNext++,
        title: args.title,
        contentText: args.contentText,
        searchBlob,
        contentJson: args.contentJson,
        color: DS_COLOR.itemDefaultNote,
        entityType: args.entityType ?? null,
        entityMeta: args.entityMeta ?? null,
      })
      .returning();
    if (row) {
      createdIds.push(row.id);
      scheduleItemEmbeddingRefresh(db, row);
    }
    return row?.id;
  };

  if (sourceText.length > 0 && layout.source) {
    const title =
      sourceDocument?.title?.trim() ||
      (deduped.length ? "Import source" : "Imported note");
    const contentJson = buildLoreNoteContentJson(sourceText);
    const id = await insertNote({
      title,
      contentText: sourceText.slice(0, 120_000),
      contentJson,
      x: layout.source.x,
      y: layout.source.y,
      width: layout.source.width,
      height: layout.source.height,
      entityType: "lore_source",
      entityMeta: { import: true },
    });
    sourceItemId = id;
  }

  for (let i = 0; i < deduped.length; i++) {
    const e = deduped[i]!;
    const pos = layout.entities[i]!;
    const summary = e.summary ?? "";
    const contentJson = buildLoreNoteContentJson(summary || "—");
    const id = await insertNote({
      title: e.canonicalName.slice(0, 255),
      contentText: summary.slice(0, 120_000),
      contentJson,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      entityType: e.kind ?? "lore",
      entityMeta: { import: true, kind: e.kind ?? null },
    });
    if (id) {
      nameToId.set(e.canonicalName.toLowerCase(), id);
    }
  }

  let linksCreated = 0;
  const linkErrors: string[] = [];

  const links = suggestedLinks ?? [];
  for (const link of links) {
    const fromId = resolveNameToId(nameToId, link.fromName);
    const toId = resolveNameToId(nameToId, link.toName);
    if (!fromId || !toId) {
      linkErrors.push(`Skipped link "${link.fromName}" → "${link.toName}" (unknown name)`);
      continue;
    }
    if (fromId === toId) continue;

    const validated = await validateLinkTargetsInSourceSpace(db, fromId, [toId]);
    if (!validated.ok) {
      linkErrors.push(validated.error);
      continue;
    }

    const linkType = normalizeLoreLinkType(link.linkType);
    const [row] = await db
      .insert(itemLinks)
      .values({
        sourceItemId: fromId,
        targetItemId: toId,
        linkType,
        label: null,
        sourcePin: null,
        targetPin: null,
        color: null,
        meta: { import: true },
      })
      .onConflictDoNothing({
        target: [itemLinks.sourceItemId, itemLinks.targetItemId, itemLinks.sourcePin, itemLinks.targetPin],
      })
      .returning();
    if (row) linksCreated += 1;
  }

  return Response.json({
    ok: true,
    createdItemIds: createdIds,
    sourceItemId: sourceItemId ?? null,
    linksCreated,
    linkWarnings: linkErrors.length ? linkErrors : undefined,
  });
}
