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

export interface AltMentionRow {
  itemId: string;
  mentionCount: number;
  snippet?: string | null;
  title: string;
}

export interface AltSearchRow {
  id: string;
  itemType?: string | null;
  title?: string | null;
}
