import type { CanvasContentEntity } from "@/src/components/foundation/architectural-types";
import {
  shouldRenderLoreCharacterCredentialCanvasNode,
  shouldRenderLoreFactionArchive091CanvasNode,
  shouldRenderLoreLocationCanvasNode,
} from "@/src/lib/lore-node-seed-html";

/** Default/task/code prose cards use TipTap hgDoc; lore hybrid shells and media stay HTML-backed. */
export function contentEntityUsesHgDoc(entity: CanvasContentEntity): boolean {
  if (shouldRenderLoreCharacterCredentialCanvasNode(entity)) return false;
  if (shouldRenderLoreLocationCanvasNode(entity)) return false;
  if (shouldRenderLoreFactionArchive091CanvasNode(entity)) return false;
  return entity.theme === "default" || entity.theme === "task" || entity.theme === "code";
}
