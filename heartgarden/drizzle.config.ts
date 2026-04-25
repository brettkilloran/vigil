import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

import { resolvePostgresUrlFromEnv } from "./src/db/postgres-env-url";

// drizzle-kit does not load `.env.local` automatically (Next.js does).
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: resolvePostgresUrlFromEnv() ?? "",
  },
});
