import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // drizzle-kit v0.31.10 types are strict; cast so Next build can typecheck.
    connectionString: (process.env.NEON_DATABASE_URL ?? "") as string,
  } as any,
});

