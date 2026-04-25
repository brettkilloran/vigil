import type {
  BindingSlotDefinition,
  BindingSlotId,
} from "@/src/lib/bindings-catalog";
import { BINDING_SLOT_BY_ID } from "@/src/lib/bindings-catalog";
import { LINK_SEMANTICS_STRUCTURED_MIRROR } from "@/src/lib/item-link-meta";

export interface ItemEntityTypeRow {
  entityType: string | null;
  id: string;
}

function readLinkSemantics(
  meta: Record<string, unknown> | null | undefined
): typeof LINK_SEMANTICS_STRUCTURED_MIRROR | "association" {
  if (!meta || typeof meta !== "object") {
    return "association";
  }
  const raw = meta.linkSemantics;
  if (raw === LINK_SEMANTICS_STRUCTURED_MIRROR) {
    return LINK_SEMANTICS_STRUCTURED_MIRROR;
  }
  return "association";
}

function readBindingSlotId(
  meta: Record<string, unknown> | null | undefined
): string | undefined {
  if (!meta || typeof meta !== "object") {
    return;
  }
  const raw = meta.bindingSlotId;
  if (typeof raw !== "string" || !raw.trim()) {
    return;
  }
  return raw.trim();
}

/**
 * When `meta.linkSemantics` is `structured_mirror`, require `meta.bindingSlotId` and ensure
 * one endpoint matches the slot's shell and the other matches an allowed target entity type.
 */
export function validateStructuredMirrorItemLink(
  meta: Record<string, unknown> | null | undefined,
  source: ItemEntityTypeRow,
  target: ItemEntityTypeRow
): { ok: true } | { ok: false; error: string; status: number } {
  if (readLinkSemantics(meta) !== LINK_SEMANTICS_STRUCTURED_MIRROR) {
    return { ok: true };
  }

  const slotId = readBindingSlotId(meta);
  if (!slotId) {
    return {
      ok: false,
      error:
        "structured_mirror links require meta.bindingSlotId (see bindings-catalog BindingSlotId)",
      status: 400,
    };
  }

  const slot = BINDING_SLOT_BY_ID[slotId as BindingSlotId];
  if (!slot) {
    return {
      ok: false,
      error: `Unknown meta.bindingSlotId: ${slotId}`,
      status: 400,
    };
  }

  return validateSlotEndpoints(slot, source, target);
}

export function validateSlotEndpoints(
  slot: BindingSlotDefinition,
  source: ItemEntityTypeRow,
  target: ItemEntityTypeRow
): { ok: true } | { ok: false; error: string; status: number } {
  const shell = slot.shell;
  const st = source.entityType ?? "";
  const tt = target.entityType ?? "";
  const sourceMatches = st === shell;
  const targetMatches = tt === shell;

  if (!(sourceMatches || targetMatches)) {
    return {
      ok: false,
      error: `structured_mirror for ${slot.id} requires one ${shell} card among the endpoints`,
      status: 400,
    };
  }
  if (sourceMatches && targetMatches) {
    return {
      ok: false,
      error:
        "structured_mirror endpoints are ambiguous (both match slot shell)",
      status: 400,
    };
  }

  const boundType = sourceMatches ? tt : st;
  if (!(boundType && slot.targetEntityTypes.includes(boundType))) {
    return {
      ok: false,
      error: `structured_mirror target must be entity type: ${slot.targetEntityTypes.join(", ")}`,
      status: 400,
    };
  }

  return { ok: true };
}
