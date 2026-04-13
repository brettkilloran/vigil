# MCP canvas data model

Reference for LLM and MCP tools when creating or editing canvas rows. Canonical HTTP shapes live in `docs/API.md`.

## `items.item_type` (canvas surface)

| Value | Role |
|--------|------|
| `note` | Default prose / lore HTML card |
| `sticky` | Sticky note |
| `image` | Media card (`imageUrl` / `imageMeta`) |
| `checklist` | Task list (`hgDoc` + task theme) |
| `webclip` | Web clip |
| `folder` | Folder face; **must** create child space first — use **`heartgarden_create_folder`** (or UI), not raw `POST` without a child `space` row |

## Lore shells (`entity_type` + `content_json.hgArch.loreCard`)

Three dedicated templates (character / faction / location). Persisted as **`items.entity_type`** and optional **`hgArch.loreCard`**.

| Kind | Meaning | Variants |
|------|---------|----------|
| `character` | Person / NPC card | `v11` only (ID plate UI) |
| `faction` | Organization / group / company | `v1`, `v2`, `v3` |
| `location` | Place | `v1`, `v2`, `v3` (v3 picks strip from seed) |

**LLM synonyms:** “group”, “org”, “faction” → **`faction`**. “place”, “site” → **`location`**. “NPC”, “person” → **`character`** (or canonical **`npc`** → stored as **`character`**).

## Canonical import kinds (`canonical_entity_kind`)

Used by **`POST /api/spaces/:id/items`** and MCP to map into **`items.entity_type`** (see `persistedEntityTypeFromCanonical` in `src/lib/lore-object-registry.ts`).

| Canonical | Stored `entity_type` | Lore shell? |
|-----------|----------------------|-------------|
| `npc` | `character` | Yes |
| `faction` | `faction` | Yes |
| `location` | `location` | Yes |
| `quest`, `item`, `lore`, `other` | same string | No dedicated shell; use freeform note + metadata |

## MCP tools (write)

| Tool | Purpose |
|------|---------|
| `heartgarden_create_item` | Any non-folder **`itemType`**; **`lore_entity`** or **`canonical_entity_kind`**; **`image_url`** / **`entity_meta`** |
| `heartgarden_create_folder` | **`POST /api/spaces`** (child) + folder **`item`** on parent |
| `heartgarden_create_link` | `item_links` edge |
| `heartgarden_patch_item` | Geometry, **`space_id`** (move), **`entity_type`**, **`content_json`**, stacks, etc. |

`write_key` matches **`HEARTGARDEN_MCP_WRITE_KEY`** (may be omitted when set on the MCP process for some tools — see `AGENTS.md`).
