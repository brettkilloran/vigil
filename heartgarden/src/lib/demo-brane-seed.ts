import { readFile } from "node:fs/promises";
import path from "node:path";

import { and, eq, isNull } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { itemLinks, items, spaces } from "@/src/db/schema";
import { normalizeLinkTypeAlias } from "@/src/lib/connection-kind-colors";
import { rescanItemEntityMentions } from "@/src/lib/entity-mentions";
import { buildSearchBlob } from "@/src/lib/search-blob";
import { resolveOrCreateBraneByType } from "@/src/lib/spaces";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

type DemoSeed = {
  spaces: Array<{
    id: string;
    name: string;
    parentSpaceId: string | null;
  }>;
  items: Array<{
    id: string;
    spaceId: string;
    itemType: "note" | "sticky" | "image" | "checklist" | "webclip" | "folder";
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    title: string;
    contentText: string;
    contentJson: Record<string, unknown> | null;
    entityType: string | null;
  }>;
  links: Array<{
    id: string;
    sourceItemId: string;
    targetItemId: string;
    linkType: string;
  }>;
};

let demoSeedCache: DemoSeed | null = null;

async function readDemoSeedFixture(): Promise<DemoSeed> {
  if (demoSeedCache) {
    return demoSeedCache;
  }
  const fixturePath = path.join(process.cwd(), "seed", "demo-brane.json");
  const raw = await readFile(fixturePath, "utf8");
  const parsed = JSON.parse(raw) as DemoSeed;
  demoSeedCache = parsed;
  return parsed;
}

export async function ensureDemoBraneSeed(db: VigilDb): Promise<void> {
  const demoBrane = await resolveOrCreateBraneByType(db, "demo");
  const [existing] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(eq(spaces.braneId, demoBrane.id))
    .limit(1);
  if (existing) {
    return;
  }

  const seed = await readDemoSeedFixture();
  await db.transaction(async (tx) => {
    for (const space of seed.spaces) {
      await tx
        .insert(spaces)
        .values({
          id: space.id,
          name: space.name,
          parentSpaceId: space.parentSpaceId,
          braneId: demoBrane.id,
        })
        .onConflictDoNothing();
    }

    for (const item of seed.items) {
      await tx
        .insert(items)
        .values({
          id: item.id,
          spaceId: item.spaceId,
          itemType: item.itemType,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          zIndex: item.zIndex,
          title: item.title,
          contentText: item.contentText,
          contentJson: item.contentJson,
          searchBlob: buildSearchBlob({
            title: item.title,
            contentText: item.contentText,
            contentJson: item.contentJson,
            entityType: item.entityType,
          }),
          entityType: item.entityType,
        })
        .onConflictDoNothing();
    }

    for (const link of seed.links) {
      const [sourceRow, targetRow] = await Promise.all([
        tx
          .select({ id: items.id })
          .from(items)
          .where(eq(items.id, link.sourceItemId))
          .limit(1),
        tx
          .select({ id: items.id })
          .from(items)
          .where(eq(items.id, link.targetItemId))
          .limit(1),
      ]);
      if (!(sourceRow[0] && targetRow[0])) {
        continue;
      }
      await tx
        .insert(itemLinks)
        .values({
          id: link.id,
          sourceItemId: link.sourceItemId,
          targetItemId: link.targetItemId,
          linkType: normalizeLinkTypeAlias(link.linkType),
          sourcePin: null,
          targetPin: null,
        })
        .onConflictDoNothing({
          target: [
            itemLinks.sourceItemId,
            itemLinks.targetItemId,
            itemLinks.sourcePin,
            itemLinks.targetPin,
          ],
        });
    }
  });

  // REVIEW_2026-04-25_1730 H7: build entity_mentions for the seeded brane so
  // Alt-hover discovery works on first boot. Without this, demo users see an
  // empty mention card until they edit a title (which triggers a rescan).
  // We do this synchronously after the seed transaction so it's deterministic
  // for tests and the very first request after first boot.
  for (const item of seed.items) {
    await rescanItemEntityMentions(db, item.id).catch(() => {
      /* best effort: a missing mention does not break demo boot */
    });
  }
}

export async function getDemoBraneRootSpaceId(
  db: VigilDb
): Promise<string | undefined> {
  const demoBrane = await resolveOrCreateBraneByType(db, "demo");
  const [row] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(and(eq(spaces.braneId, demoBrane.id), isNull(spaces.parentSpaceId)))
    .orderBy(spaces.createdAt)
    .limit(1);
  return row?.id;
}
