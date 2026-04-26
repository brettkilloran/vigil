import { tryGetDb } from "@/src/db/index";
import {
  GRAPH_LAYOUT_CACHE_LAYOUT_VERSION,
  GRAPH_LAYOUT_CACHE_MAX_BYTES,
  GRAPH_LAYOUT_CACHE_MAX_NODES,
  graphLayoutPositionsByteSize,
  sanitizeGraphLayoutPositions,
} from "@/src/lib/graph-layout-cache-contract";
import { getHeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";
import { writeSpaceGraphLayoutCache } from "@/src/lib/space-graph-layout-cache";

function parseNodeCount(input: unknown, fallback: number): number {
  if (typeof input !== "number" || !Number.isFinite(input)) return fallback;
  return Math.max(0, Math.min(Math.trunc(input), GRAPH_LAYOUT_CACHE_MAX_NODES));
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ spaceId: string }> },
) {
  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }
  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) return access.response;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
    return Response.json({ ok: false, error: "Body must be an object" }, { status: 400 });
  }
  const body = rawBody as Record<string, unknown>;
  const graphRevision = typeof body.graphRevision === "string" ? body.graphRevision.trim() : "";
  if (!graphRevision) {
    return Response.json({ ok: false, error: "graphRevision is required" }, { status: 400 });
  }
  if (graphRevision.length > 255) {
    return Response.json({ ok: false, error: "graphRevision exceeds 255 chars" }, { status: 400 });
  }
  const layoutVersion =
    typeof body.layoutVersion === "string" && body.layoutVersion.trim().length > 0
      ? body.layoutVersion.trim().slice(0, 64)
      : GRAPH_LAYOUT_CACHE_LAYOUT_VERSION;
  const positions = sanitizeGraphLayoutPositions(body.positions, GRAPH_LAYOUT_CACHE_MAX_NODES);
  if (!positions) {
    return Response.json({ ok: false, error: "positions must be an object map of nodeId => {x,y,z?}" }, { status: 400 });
  }
  const byteSize = graphLayoutPositionsByteSize(positions);
  if (byteSize > GRAPH_LAYOUT_CACHE_MAX_BYTES) {
    return Response.json(
      {
        ok: false,
        error: `positions payload exceeds ${GRAPH_LAYOUT_CACHE_MAX_BYTES} bytes`,
      },
      { status: 413 },
    );
  }
  const nodeCount = parseNodeCount(body.nodeCount, Object.keys(positions).length);
  await writeSpaceGraphLayoutCache(db, {
    spaceId,
    graphRevision,
    layoutVersion,
    positions,
    nodeCount,
  });
  return Response.json({
    ok: true,
    graphRevision,
    layoutVersion,
    nodeCount,
    byteSize,
  });
}
