import type { CanvasContentEntity } from "@/src/components/foundation/architectural-types";
import {
  shouldRenderLoreCharacterCredentialCanvasNode,
  shouldRenderLoreLocationCanvasNode,
} from "@/src/lib/lore-node-seed-html";

/** Default/task prose cards use TipTap hgDoc; lore templates, code, and media use HTML paths. */
export function contentEntityUsesHgDoc(entity: CanvasContentEntity): boolean {
  if (entity.theme !== "default" && entity.theme !== "task") return false;
  if (shouldRenderLoreCharacterCredentialCanvasNode(entity)) return false;
  if (shouldRenderLoreLocationCanvasNode(entity)) return false;
  return true;
}
