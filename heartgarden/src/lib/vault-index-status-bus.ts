type VaultIndexListener = () => void;

const pendingIds = new Set<string>();
const inFlightIds = new Set<string>();
let lastError: { message: string; at: number } | null = null;
const listeners = new Set<VaultIndexListener>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function vaultIndexMarkPending(itemId: string) {
  pendingIds.add(itemId);
  emit();
}

export function vaultIndexClearPending(itemId: string) {
  pendingIds.delete(itemId);
  emit();
}

export function vaultIndexMarkInFlight(itemId: string) {
  inFlightIds.add(itemId);
  emit();
}

export function vaultIndexClearInFlight(itemId: string) {
  inFlightIds.delete(itemId);
  emit();
}

export function vaultIndexSetError(message: string) {
  lastError = { at: Date.now(), message };
  emit();
  const started = lastError.at;
  window.setTimeout(() => {
    if (lastError && lastError.at === started) {
      lastError = null;
      emit();
    }
  }, 12_000);
}

export function getVaultIndexStatusSnapshot() {
  const errorLine =
    lastError && Date.now() - lastError.at < 12_500 ? lastError.message : null;
  return {
    errorLine,
    inFlightCount: inFlightIds.size,
    pendingCount: pendingIds.size,
  };
}

export function subscribeVaultIndexStatus(
  listener: VaultIndexListener
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
