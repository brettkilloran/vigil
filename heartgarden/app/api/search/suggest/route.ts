import { tryGetDb } from "@/src/db/index";
import {
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
  isHeartgardenPlayerBlocked,
} from "@/src/lib/heartgarden-api-boot-context";
import {
  applySuggestTierPolicy,
  finalizeHeartgardenSearchFiltersForDb,
} from "@/src/lib/heartgarden-search-tier-policy";
import { parseSearchFiltersFromUrl } from "@/src/lib/heartgarden-search-url-params";
import { suggestItems } from "@/src/lib/spaces";

export async function GET(req: Request) {
  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured", suggestions: [] },
      { status: 503 },
    );
  }
  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 1) {
    return Response.json({ ok: true, suggestions: [] });
  }
  const parsed = parseSearchFiltersFromUrl(url, "suggest");
  const tiered = applySuggestTierPolicy(bootCtx, parsed);
  if (!tiered.ok) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const finalized = await finalizeHeartgardenSearchFiltersForDb(db, bootCtx, tiered.filters);
  if (!finalized) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const filters = finalized;
  if (
    bootCtx.role === "gm" &&
    filters.spaceId &&
    !(await gmMayAccessSpaceIdAsync(db, bootCtx, filters.spaceId))
  ) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const rows = await suggestItems(db, q, filters);
  const suggestions = rows.map((row) => ({
    id: row.item.id,
    spaceId: row.space.id,
    spaceName: row.space.name,
    title: row.item.title,
    itemType: row.item.itemType,
    entityType: row.item.entityType,
    snippet: row.snippet ?? row.item.contentText.slice(0, 180),
    updatedAt: row.item.updatedAt,
  }));
  return Response.json({ ok: true, suggestions });
}
