import { tryGetDb } from "@/src/db/index";
import {
  getHeartgardenApiBootContext,
  heartgardenApiForbiddenJsonResponse,
  isHeartgardenPlayerBlocked,
} from "@/src/lib/heartgarden-api-boot-context";
import { rowToCanvasItem } from "@/src/lib/item-mapper";
import { parseSpaceIdParam } from "@/src/lib/space-id";
import { fetchPlayerSubtreeSpacesFull } from "@/src/lib/heartgarden-space-subtree";
import {
  listItemsForSpaceSubtree,
  parseCameraFromRow,
  resolveActiveSpaceGmWorkspace,
} from "@/src/lib/spaces";

export async function GET(req: Request) {
  /**
   * Playwright sets `PLAYWRIGHT_E2E=1` on the dev server (see `playwright.config.ts`)
   * so tests get an empty demo space even when Neon is configured locally.
   * Do not set this variable in production deployments.
   */
  if (process.env.PLAYWRIGHT_E2E === "1") {
    return Response.json({
      ok: true,
      demo: true,
      spaceId: null,
      spaces: [] as { id: string; name: string; updatedAt: string }[],
      items: [],
      camera: { x: 0, y: 0, zoom: 1 },
    });
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json({
      ok: true,
      demo: true,
      spaceId: null,
      spaces: [] as { id: string; name: string; updatedAt: string }[],
      items: [],
      camera: { x: 0, y: 0, zoom: 1 },
    });
  }

  const url = new URL(req.url);
  const requested = parseSpaceIdParam(url.searchParams.get("space"));

  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }

  if (bootCtx.role === "player") {
    const subtreeRows = await fetchPlayerSubtreeSpacesFull(db, bootCtx.playerSpaceId);
    if (subtreeRows.length === 0) {
      return heartgardenApiForbiddenJsonResponse();
    }
    const rootRow = subtreeRows.find((s) => s.id === bootCtx.playerSpaceId);
    if (!rootRow) {
      return heartgardenApiForbiddenJsonResponse();
    }
    let activeSpace = rootRow;
    if (requested && subtreeRows.some((s) => s.id === requested)) {
      activeSpace = subtreeRows.find((s) => s.id === requested)!;
    }
    const spaceRows = subtreeRows.map((s) => ({
      id: s.id,
      parentSpaceId: s.parentSpaceId ?? null,
    }));
    const itemRows = await listItemsForSpaceSubtree(db, activeSpace.id, spaceRows);
    const items = itemRows.map(rowToCanvasItem);
    const camera = parseCameraFromRow(activeSpace.canvasState);
    return Response.json({
      ok: true,
      demo: false,
      spaceId: activeSpace.id,
      spaces: subtreeRows.map((s) => ({
        id: s.id,
        name: s.name,
        parentSpaceId: s.parentSpaceId ?? null,
        updatedAt:
          s.updatedAt instanceof Date
            ? s.updatedAt.toISOString()
            : String(s.updatedAt),
      })),
      items,
      camera,
    });
  }

  const { activeSpace, allSpaces } = await resolveActiveSpaceGmWorkspace(db, requested);

  const spaceRows = allSpaces.map((s) => ({
    id: s.id,
    parentSpaceId: s.parentSpaceId ?? null,
  }));

  const itemRows = await listItemsForSpaceSubtree(db, activeSpace.id, spaceRows);

  const items = itemRows.map(rowToCanvasItem);
  const camera = parseCameraFromRow(activeSpace.canvasState);

  return Response.json({
    ok: true,
    demo: false,
    spaceId: activeSpace.id,
    spaces: allSpaces.map((s) => ({
      id: s.id,
      name: s.name,
      parentSpaceId: s.parentSpaceId ?? null,
      updatedAt:
        s.updatedAt instanceof Date
          ? s.updatedAt.toISOString()
          : String(s.updatedAt),
    })),
    items,
    camera,
  });
}
