import packageJson from "../../package.json";

/**
 * Shipped app semver — single source of truth is app-root `package.json` → `version`.
 * Bump with `pnpm run release:patch` (or minor/major) from the Next app directory; see `docs/VERSIONING.md`.
 */
export const HEARTGARDEN_APP_VERSION: string = packageJson.version;

const deploySha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ?? "";
const shortDeploySha =
  deploySha.length >= 7
    ? deploySha.slice(0, 7)
    : deploySha.length > 0
      ? deploySha
      : "";

/**
 * Display string for boot / about: semver, plus SemVer build metadata when a deploy SHA exists
 * (Vercel sets `VERCEL_GIT_COMMIT_SHA` at build; `next.config.ts` forwards it for the client).
 */
export const HEARTGARDEN_APP_VERSION_LABEL: string = shortDeploySha
  ? `${HEARTGARDEN_APP_VERSION}+${shortDeploySha}`
  : HEARTGARDEN_APP_VERSION;
