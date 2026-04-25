import { eq, max } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { itemLinks, items } from "@/src/db/schema";
import { DS_COLOR } from "@/src/lib/design-system-tokens";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import {
  heartgardenImportLegacyEnabled,
  heartgardenImportLegacyGoneResponse,
} from "@/src/lib/heartgarden-import-legacy-gate";
import { invalidateItemLinksRevisionForSpace } from "@/src/lib/item-links-space-revision";
import { validateLinkTargetsInBrane } from "@/src/lib/item-links-validation";
import { normalizeCanonicalEntityKind } from "@/src/lib/lore-import-canonical-kinds";
import { buildLoreNoteContentJson } from "@/src/lib/lore-import-commit";
import { normalizeImportItemLinkType } from "@/src/lib/lore-import-item-link";
import { placeImportCards } from "@/src/lib/lore-import-placement";
import { persistedEntityTypeFromCanonical } from "@/src/lib/lore-object-registry";
import { scheduleVaultReindexAfterResponse } from "@/src/lib/schedule-vault-index-after";
import { buildSearchBlob } from "@/src/lib/search-blob";
import { assertSpaceExists, type VigilDb } from "@/src/lib/spaces";

export const runtime = "nodejs";

const entitySchema = z.object({
  kind: z.string().max(64).optional(),
  name: z.string().min(1).max(255),
  summary: z.string().max(8000).optional(),
});

const linkSchema = z.object({
  fromName: z.string().min(1).max(255),
  linkType: z.string().max(64).optional(),
  toName: z.string().min(1).max(255),
});

const bodySchema = z.object({
  entities: z.array(entitySchema).max(200),
  layout: z
    .object({
      originX: z.number().finite(),
      originY: z.number().finite(),
    })
    .optional(),
  sourceDocument: z
    .object({
      text: z.string().max(500_000).optional(),
      title: z.string().max(255).optional(),
    })
    .optional(),
  spaceId: z.string().uuid(),
  suggestedLinks: z.array(linkSchema).max(500).optional(),
});

function dedupeEntities(
  list: z.infer<typeof entitySchema>[]
): { canonicalName: string; kind?: string; summary?: string }[] {
  const byKey = new Map<
    string,
    { canonicalName: string; kind?: string; summary?: string }
  >();
  for (const e of list) {
    const name = e.name.trim();
    if (!name) {
      continue;
    }
    const key = name.toLowerCase();
    if (byKey.has(key)) {
      continue;
    }
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
  raw: string
): string | undefined {
  const t = raw.trim();
  if (!t) {
    return;
  }
  return nameToId.get(t.toLowerCase());
}

export async function POST(req: Request) {
  if (!heartgardenImportLegacyEnabled()) {
    return heartgardenImportLegacyGoneResponse("/api/lore/import/commit");
  }

  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) {
    return denied;
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { error: "Database not configured", ok: false },
      { status: 503 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON", ok: false }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.flatten(), ok: false },
      { status: 400 }
    );
  }

  const { spaceId, sourceDocument, suggestedLinks } = parsed.data;
  const sourceText = sourceDocument?.text?.trim() ?? "";
  const deduped = dedupeEntities(parsed.data.entities);

  if (!sourceText && deduped.length < 1) {
    return Response.json(
      { error: "Provide source text and/or at least one entity", ok: false },
      { status: 400 }
    );
  }

  const space = await assertSpaceExists(db, spaceId);
  if (!space) {
    return Response.json(
      { error: "Space not found", ok: false },
      { status: 404 }
    );
  }
  if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const ox = parsed.data.layout?.originX ?? 0;
  const oy = parsed.data.layout?.originY ?? 0;
  const linkPairs = (suggestedLinks ?? []).map((l) => ({
    from: l.fromName.trim().toLowerCase(),
    to: l.toName.trim().toLowerCase(),
  }));
  const layout = placeImportCards({
    entities: deduped.map((e) => ({
      affinities: linkPairs
        .filter(
          (l) =>
            l.from === e.canonicalName.toLowerCase() ||
            l.to === e.canonicalName.toLowerCase()
        )
        .map((l) => (l.from === e.canonicalName.toLowerCase() ? l.to : l.from)),
      clientId: e.canonicalName.toLowerCase(),
    })),
    originX: ox,
    originY: oy,
    source: sourceText.length > 0 ? { height: 360, width: 420 } : undefined,
  });

  const embeddingRows: (typeof items.$inferSelect)[] = [];

  const { createdIds, sourceItemId, linksCreated, linkWarnings } =
    await db.transaction(async (tx) => {
      const [mz] = await tx
        .select({ z: max(items.zIndex) })
        .from(items)
        .where(eq(items.spaceId, spaceId));
      let zNext =
        mz?.z != null && Number.isFinite(Number(mz.z)) ? Number(mz.z) + 1 : 101;

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
          contentJson: args.contentJson,
          contentText: args.contentText,
          entityMeta: args.entityMeta ?? null,
          entityType: args.entityType ?? null,
          imageMeta: null,
          imageUrl: null,
          loreAliases: null,
          loreSummary: null,
          title: args.title,
        });
        const [row] = await tx
          .insert(items)
          .values({
            color: DS_COLOR.itemDefaultNote,
            contentJson: args.contentJson,
            contentText: args.contentText,
            entityMeta: args.entityMeta ?? null,
            entityType: args.entityType ?? null,
            height: args.height,
            itemType: "note",
            searchBlob,
            spaceId,
            title: args.title,
            width: args.width,
            x: args.x,
            y: args.y,
            zIndex: zNext++,
          })
          .returning();
        if (row) {
          createdIds.push(row.id);
          embeddingRows.push(row);
        }
        return row?.id;
      };

      if (sourceText.length > 0 && layout.source) {
        const title =
          sourceDocument?.title?.trim() ||
          (deduped.length ? "Import source" : "Imported note");
        const contentJson = buildLoreNoteContentJson(sourceText, {
          aiPending: true,
        });
        const id = await insertNote({
          contentJson,
          contentText: sourceText.slice(0, 120_000),
          entityMeta: { aiReview: "pending", import: true },
          entityType: "lore_source",
          height: layout.source.height,
          title,
          width: layout.source.width,
          x: layout.source.x,
          y: layout.source.y,
        });
        sourceItemId = id;
      }

      for (let i = 0; i < deduped.length; i++) {
        const e = deduped[i]!;
        const pos = layout.entities[e.canonicalName.toLowerCase()] ?? {
          height: 260,
          width: 280,
          x: ox,
          y: oy,
        };
        const summary = e.summary ?? "";
        const contentJson = buildLoreNoteContentJson(summary || "—", {
          aiPending: true,
        });
        const canonKind = normalizeCanonicalEntityKind(e.kind ?? "lore");
        const persistedEntityType = persistedEntityTypeFromCanonical(canonKind);
        const id = await insertNote({
          contentJson,
          contentText: summary.slice(0, 120_000),
          entityMeta: {
            aiReview: "pending",
            canonicalEntityKind: canonKind,
            import: true,
            kind: e.kind ?? null,
          },
          entityType: persistedEntityType,
          height: pos.height,
          title: e.canonicalName.slice(0, 255),
          width: pos.width,
          x: pos.x,
          y: pos.y,
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
        if (!(fromId && toId)) {
          linkErrors.push(
            `Skipped link "${link.fromName}" → "${link.toName}" (unknown name)`
          );
          continue;
        }
        if (fromId === toId) {
          continue;
        }

        const validated = await validateLinkTargetsInBrane(
          tx as unknown as VigilDb,
          fromId,
          [toId]
        );
        if (!validated.ok) {
          linkErrors.push(validated.error);
          continue;
        }

        const linkType = normalizeImportItemLinkType(link.linkType);
        const [row] = await tx
          .insert(itemLinks)
          .values({
            color: null,
            label: null,
            linkType,
            meta: { import: true },
            sourceItemId: fromId,
            sourcePin: null,
            targetItemId: toId,
            targetPin: null,
          })
          .onConflictDoNothing({
            target: [
              itemLinks.sourceItemId,
              itemLinks.targetItemId,
              itemLinks.sourcePin,
              itemLinks.targetPin,
            ],
          })
          .returning();
        if (row) {
          linksCreated += 1;
        }
      }

      return {
        createdIds,
        linksCreated,
        linkWarnings: linkErrors.length ? linkErrors : undefined,
        sourceItemId,
      };
    });

  for (const row of embeddingRows) {
    if (row.contentText.trim().length > 0 || row.title.trim().length > 0) {
      scheduleVaultReindexAfterResponse(row.id);
    }
  }
  if (linksCreated > 0) {
    invalidateItemLinksRevisionForSpace(parsed.data.spaceId);
  }

  return Response.json({
    createdItemIds: createdIds,
    linksCreated,
    linkWarnings,
    ok: true,
    sourceItemId: sourceItemId ?? null,
  });
}
