/**
 * Opt-in client logging for PATCH / space-change sync (set `NEXT_PUBLIC_HEARTGARDEN_SYNC_DEBUG=1` in `.env.local`).
 */

export function isHeartgardenSyncDebugEnabled(): boolean {
  if (typeof process === "undefined") {
    return false;
  }
  return (process.env.NEXT_PUBLIC_HEARTGARDEN_SYNC_DEBUG ?? "").trim() === "1";
}

export function heartgardenSyncDebugLog(
  message: string,
  data?: Record<string, unknown>
): void {
  if (!isHeartgardenSyncDebugEnabled()) {
    return;
  }
  if (data) {
    console.debug(`[heartgarden sync] ${message}`, data);
  } else {
    console.debug(`[heartgarden sync] ${message}`);
  }
}
