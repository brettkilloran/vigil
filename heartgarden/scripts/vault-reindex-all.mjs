/**
 * Reindex every item (chunk + embed + optional lore meta) via running Next app.
 *
 * Requires:
 * - NEON_DATABASE_URL in .env.local (to list item ids)
 * - `pnpm run dev` or `pnpm start` on HEARTGARDEN_APP_URL (default http://127.0.0.1:3000)
 * - Optional embedding provider (OPENAI_API_KEY). When missing, index calls return skipped:no_embedding_provider
 *
 * Env:
 * - HEARTGARDEN_APP_URL — base URL (no trailing slash)
 * - VAULT_REINDEX_SPACE_ID — optional UUID; only items in that space
 * - VAULT_REINDEX_SKIP_LORE=1 — POST body refreshLoreMeta: false
 * - VAULT_REINDEX_DRY=1 — print counts only, no HTTP
 * - VAULT_REINDEX_SKIP_FORBIDDEN=1 — treat HTTP 403 as skipped instead of fail (default 1)
 * - VAULT_REINDEX_DELAY_MS — ms between requests (default 120)
 * - HEARTGARDEN_MCP_SERVICE_KEY — optional Bearer token for protected /api/* routes
 *
 * Run: node ./scripts/vault-reindex-all.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

config({ path: join(root, ".env.local") });

const url = process.env.NEON_DATABASE_URL?.trim();
if (!url) {
  console.error("NEON_DATABASE_URL missing (.env.local)");
  process.exit(1);
}

const base = (process.env.HEARTGARDEN_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const spaceId = (process.env.VAULT_REINDEX_SPACE_ID || "").trim();
const skipLore = process.env.VAULT_REINDEX_SKIP_LORE === "1";
const dry = process.env.VAULT_REINDEX_DRY === "1";
const skipForbidden = process.env.VAULT_REINDEX_SKIP_FORBIDDEN !== "0";
const delayMs = Math.max(0, Number(process.env.VAULT_REINDEX_DELAY_MS) || 120);
const mcpServiceKey = (process.env.HEARTGARDEN_MCP_SERVICE_KEY || "").trim();

const sql = neon(url);

/** @type {{ id: string }[]} */
let rows;
if (spaceId) {
  rows = await sql`select id from items where space_id = ${spaceId}`;
} else {
  rows = await sql`select id from items`;
}

console.log(`Found ${rows.length} item(s)${spaceId ? ` in space ${spaceId}` : ""}.`);

if (dry) {
  console.log("VAULT_REINDEX_DRY=1 — no requests sent.");
  process.exit(0);
}

const body = skipLore ? JSON.stringify({ refreshLoreMeta: false }) : "{}";
let ok = 0;
let fail = 0;
let skippedForbidden = 0;

for (let i = 0; i < rows.length; i++) {
  const id = rows[i]?.id;
  if (!id) continue;
  try {
    const res = await fetch(`${base}/api/items/${encodeURIComponent(id)}/index`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(mcpServiceKey ? { Authorization: `Bearer ${mcpServiceKey}` } : {}),
      },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok !== false) {
      ok += 1;
      if (data.skipped) {
        console.log(`[${i + 1}/${rows.length}] ${id} skipped: ${data.skipped}`);
      }
    } else if (res.status === 403 && skipForbidden) {
      skippedForbidden += 1;
      console.warn(`[${i + 1}/${rows.length}] ${id} skipped: forbidden`);
    } else {
      fail += 1;
      console.error(`[${i + 1}/${rows.length}] ${id} HTTP ${res.status}`, data);
    }
  } catch (e) {
    fail += 1;
    console.error(`[${i + 1}/${rows.length}] ${id}`, e instanceof Error ? e.message : e);
  }
  if (delayMs && i < rows.length - 1) {
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

console.log(
  `Done. ok=${ok} skipped_forbidden=${skippedForbidden} fail=${fail} (base=${base})`,
);
if (fail > 0) process.exit(1);
