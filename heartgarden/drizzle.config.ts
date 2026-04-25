import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

import { resolvePostgresUrlFromEnv } from "./src/db/postgres-env-url";

// drizzle-kit does not load `.env.local` automatically (Next.js does).
config({ path: ".env.local" });

export default defineConfig({
  dbCredentials: {
    url: resolvePostgresUrlFromEnv() ?? "",
  },
  dialect: "postgresql",
  out: "./drizzle/migrations",
  schema: "./src/db/schema.ts",
});
