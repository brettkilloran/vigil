/**
 * Legacy lore-import routes (`/api/lore/import/extract` and `/api/lore/import/commit`)
 * are deprecated in favor of the smart pipeline (`/api/lore/import/jobs` + review UI).
 *
 * Set `HEARTGARDEN_IMPORT_LEGACY_ENABLED=1` in the environment to keep the old
 * routes reachable during the transition window; otherwise they return HTTP 410.
 */
const ENV_FLAG = "HEARTGARDEN_IMPORT_LEGACY_ENABLED";

export function heartgardenImportLegacyEnabled(): boolean {
  const raw = process.env[ENV_FLAG]?.trim();
  if (!raw) {
    return false;
  }
  return raw === "1" || raw.toLowerCase() === "true";
}

export function heartgardenImportLegacyGoneResponse(
  routeLabel: string
): Response {
  return Response.json(
    {
      code: "legacy_import_disabled",
      error: `Legacy lore import route ${routeLabel} is deprecated. Use /api/lore/import/jobs with the smart import review UI. Set HEARTGARDEN_IMPORT_LEGACY_ENABLED=1 to temporarily re-enable the legacy path.`,
      ok: false,
    },
    { status: 410 }
  );
}
