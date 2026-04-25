/**
 * Shared row types for term-based discovery (Alt-hover graph card and the
 * full Graph panel). Used by:
 * - `GET /api/mentions` response items
 * - `GET /api/search` response items (subset)
 * - `AltGraphCard`, `ArchitecturalCanvasApp` Alt-hover state, and downstream
 *   panels that render the same payload shape.
 *
 * Promote new fields here (not in component-local copies) so adding a column
 * needs only one edit.
 */

export type AltMentionRow = {
  itemId: string;
  title: string;
  mentionCount: number;
  snippet?: string | null;
};

export type AltSearchRow = {
  id: string;
  title?: string | null;
  itemType?: string | null;
};
