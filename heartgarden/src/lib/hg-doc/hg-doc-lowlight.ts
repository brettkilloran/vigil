import { common, createLowlight } from "lowlight";

/**
 * Shared lowlight instance for hgDoc TipTap + any server-side HTML helpers that need the same grammar set.
 */
export const hgDocLowlight = createLowlight(common);
