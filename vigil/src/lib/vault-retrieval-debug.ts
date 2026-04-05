/**
 * Opt-in retrieval diagnostics (avoids noisy logs on every dev search).
 * Set `HEARTGARDEN_VAULT_DEBUG=1` when tuning hybrid / RRF.
 */
export function isVaultRetrievalDebugEnabled(): boolean {
  const flag = (process.env.HEARTGARDEN_VAULT_DEBUG ?? "").trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function logVaultHybridRetrieval(payload: Record<string, unknown>): void {
  if (!isVaultRetrievalDebugEnabled()) return;
  console.debug("[vault-hybrid]", JSON.stringify(payload));
}
