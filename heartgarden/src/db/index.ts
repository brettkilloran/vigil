import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";

import { resolvePostgresUrlFromEnv } from "./postgres-env-url";
// biome-ignore lint/performance/noNamespaceImport: drizzle-orm requires the full schema bag passed as { schema } to type-infer relations across every table
// biome-ignore lint/style/noExportedImports: schema namespace is also re-exported so callers can `import { schema }` from the db barrel alongside `tryGetDb`
import * as schema from "./schema";

export { schema };

type Db = ReturnType<typeof drizzleNeon<typeof schema>>;

let cachedDb: Db | undefined;

const NEON_HOST_RE = /\.neon\.tech(\b|\/|:)/i;

function postgresConnectionString(): string | undefined {
  return resolvePostgresUrlFromEnv();
}

/** Neon's serverless driver speaks WS-over-HTTP to `*.neon.tech` only; everything else (local Postgres, self-hosted) needs the raw wire-protocol driver. */
function isNeonUrl(url: string): boolean {
  return NEON_HOST_RE.test(url);
}

export function tryGetDb() {
  const connectionString = postgresConnectionString();
  if (!connectionString) {
    return;
  }
  if (!cachedDb) {
    cachedDb = isNeonUrl(connectionString)
      ? drizzleNeon(connectionString, { schema })
      : (drizzleNode(connectionString, { schema }) as unknown as Db);
  }
  return cachedDb;
}
