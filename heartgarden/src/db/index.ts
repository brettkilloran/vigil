import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";

import * as schema from "./schema";
import { resolvePostgresUrlFromEnv } from "./postgres-env-url";

export { schema };

type Db = ReturnType<typeof drizzleNeon<typeof schema>>;

let cachedDb: Db | undefined;

function postgresConnectionString(): string | undefined {
  return resolvePostgresUrlFromEnv();
}

/** Neon's serverless driver speaks WS-over-HTTP to `*.neon.tech` only; everything else (local Postgres, self-hosted) needs the raw wire-protocol driver. */
function isNeonUrl(url: string): boolean {
  return /\.neon\.tech(\b|\/|:)/i.test(url);
}

export function tryGetDb() {
  const connectionString = postgresConnectionString();
  if (!connectionString) return undefined;
  if (!cachedDb) {
    cachedDb = isNeonUrl(connectionString)
      ? drizzleNeon(connectionString, { schema })
      : (drizzleNode(connectionString, { schema }) as unknown as Db);
  }
  return cachedDb;
}

