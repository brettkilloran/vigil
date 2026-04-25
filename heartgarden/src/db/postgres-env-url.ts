/**
 * Resolves a Postgres connection string from environment variables.
 * Order matches common Heartgarden + Vercel / Neon setups.
 */
export function resolvePostgresUrlFromEnv(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const keys = [
    "NEON_DATABASE_URL",
    "DATABASE_URL",
    /** Vercel Postgres / some Neon templates */
    "POSTGRES_URL",
    /** Pooled URL (serverless-friendly) when using Vercel storage integrations */
    "POSTGRES_PRISMA_URL",
  ] as const;
  for (const k of keys) {
    const v = env[k]?.trim();
    if (v) {
      return v;
    }
  }
  return;
}
