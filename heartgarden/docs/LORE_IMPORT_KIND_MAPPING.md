---
title: Lore import — canonical kind → canvas & DB
status: canonical
audience: [agent, human]
last_reviewed: 2026-04-11
related:
  - heartgarden/docs/DATA_PIPELINE_AUDIT_2026-04-11.md
  - heartgarden/src/lib/lore-object-registry.ts
---

# Lore import — canonical kind mapping

Import plans label each note with a **`canonicalEntityKind`** (`npc`, `location`, `faction`, `quest`, `item`, `lore`, `other`). The canvas only has **three** specialized lore card shells today (**character**, **faction**, **location**). Everything else stays a **default note** card while preserving the canonical label in **`entity_meta.canonicalEntityKind`**.

## Matrix

| `canonicalEntityKind` | Persisted `items.entity_type` | Lore card shell on canvas | Notes |
|------------------------|------------------------------|----------------------------|--------|
| `npc` | **`character`** | Yes (character ID plate / v11) | Semantic “NPC” is preserved in `entity_meta.canonicalEntityKind` |
| `faction` | `faction` | Yes | |
| `location` | `location` | Yes | |
| `quest` | `quest` | No (default note) | Search / filters can key off `entity_type` + meta |
| `item` | `item` | No | |
| `lore` | `lore` | No | |
| `other` | `other` | No | |

**Source of truth in code:** [`src/lib/lore-object-registry.ts`](../src/lib/lore-object-registry.ts) (`persistedEntityTypeFromCanonical`, `loreShellKindFromCanonical`). *If the file is missing, apply the “Implementation handoff” in [`.cursor/plans/data_pipeline_import_hardening.plan.md`](../../.cursor/plans/data_pipeline_import_hardening.plan.md) and wire [`lore-import-apply.ts`](../src/lib/lore-import-apply.ts).*

**Hydration:** [`architectural-db-bridge.ts`](../src/components/foundation/architectural-db-bridge.ts) infers `loreCard` when `entity_type` is `character` | `faction` | `location` (or `hgArch.loreCard` / body heuristics).

## Adding a new canonical kind

1. Add the string to [`lore-import-canonical-kinds.ts`](../src/lib/lore-import-canonical-kinds.ts) (`CANONICAL_ENTITY_KINDS`).
2. Extend [`lore-object-registry.ts`](../src/lib/lore-object-registry.ts) and this table.
3. Update Zod / plan schemas if needed ([`lore-import-plan-types.ts`](../src/lib/lore-import-plan-types.ts)).
4. Run **`src/lib/lore-import-registry-wiring.test.ts`** (registry + `buildSearchBlob` smoke).
