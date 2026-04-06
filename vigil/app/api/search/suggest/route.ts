import { tryGetDb } from "@/src/db/index";
import {
  getHeartgardenApiBootContext,
  gmMayAccessSpaceId,
  heartgardenApiForbiddenJsonResponse,
  isHeartgardenPlayerBlocked,
} from "@/src/lib/heartgarden-api-boot-context";
import { applySuggestTierPolicy } from "@/src/lib/heartgarden-search-tier-policy";
import { suggestItems, type SearchFilters } from "@/src/lib/spaces";

function parseBool(raw: string | null): boolean | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

function parseCsv(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseFilters(url: URL): SearchFilters {
  const limitRaw = Number(url.searchParams.get("limit"));
  return {
    spaceId: url.searchParams.get("spaceId") ?? undefined,
    itemTypes: parseCsv(url.searchParams.get("types")),
    entityTypes: parseCsv(url.searchParams.get("entityTypes")),
    hasLinks: parseBool(url.searchParams.get("hasLinks")),
    inStack: parseBool(url.searchParams.get("inStack")),
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
  };
}

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
  const parsed = parseFilters(url);
  const tiered = applySuggestTierPolicy(bootCtx, parsed);
  if (!tiered.ok) {
    return heartgardenApiForbiddenJsonResponse();
  }
  const filters = tiered.filters;
  if (bootCtx.role === "gm" && filters.spaceId && !gmMayAccessSpaceId(bootCtx, filters.spaceId)) {
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
