/**
 * One-time (or rare) Neon cleanup: remove all player-world items, cross-world item_links,
 * and folder spaces under player roots. Preserves `__heartgarden_player_root__` and env UUID rows.
 *
 * Requires `.env.local` with the same DB URL the app uses (`NEON_DATABASE_URL` or
 * `HEARTGARDEN_NEON_DATABASE_URL` per `src/db/postgres-env-url.ts`).
 *
 * Usage:
 *   HEARTGARDEN_SEVER_WORLDS_DRY=1 npx tsx scripts/sever-player-gm-worlds.ts   # counts only
 *   HEARTGARDEN_SEVER_WORLDS_CONFIRM=1 npx tsx scripts/sever-player-gm-worlds.ts # destructive
 */
import { resolve } from "node:path";

import { config } from "dotenv";

import { tryGetDb } from "@/src/db/index";
import { severHeartgardenPlayerGmWorlds } from "@/src/lib/heartgarden-sever-player-gm-worlds";

config({ path: resolve(process.cwd(), ".env.local") });

const dry = process.env.HEARTGARDEN_SEVER_WORLDS_DRY === "1";
const confirm = process.env.HEARTGARDEN_SEVER_WORLDS_CONFIRM === "1";

if (!dry && !confirm) {
  console.error(
    "Refusing to run: set HEARTGARDEN_SEVER_WORLDS_DRY=1 (preview counts) or HEARTGARDEN_SEVER_WORLDS_CONFIRM=1 (destructive).",
  );
  process.exit(1);
}

const db = tryGetDb();
if (!db) {
  console.error("Database not configured (set NEON_DATABASE_URL or HEARTGARDEN_NEON_DATABASE_URL).");
  process.exit(1);
}

void (async () => {
  const report = await severHeartgardenPlayerGmWorlds(db, { dryRun: dry });
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
