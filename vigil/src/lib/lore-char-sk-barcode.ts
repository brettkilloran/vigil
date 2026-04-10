import { code128ToSvg } from "@/src/lib/code128";

/** Identity-only payload keeps the strip readable and stable while notes are edited. */
const BARCODE_PAYLOAD_MAX_CHARS = 34;

const BARCODE_DEBOUNCE_MS = 220;

const pendingByHost = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/** Collect visible field text from a v9 charSk shell for Code 128 payload (pipe-separated). */
export function collectCharSkBarcodePayload(shell: HTMLElement): string {
  const meta = shell.querySelector('[class*="charSkHeaderMeta"]')?.textContent?.trim() ?? "";
  const name = shell.querySelector('[class*="charSkDisplayName"]')?.textContent?.trim() ?? "";
  const role = shell.querySelector('[class*="charSkRole"]')?.textContent?.trim() ?? "";
  const metas = [...shell.querySelectorAll('[class*="charSkMetaValue"]')]
    .map((el) => el.textContent?.trim() ?? "")
    .filter(Boolean);
  const parts = [meta, name, role, ...metas];
  let payload = parts.filter(Boolean).join("|");
  if (payload.length > BARCODE_PAYLOAD_MAX_CHARS) payload = payload.slice(0, BARCODE_PAYLOAD_MAX_CHARS);
  return payload.length > 0 ? payload : " ";
}

function runBarcodeSync(host: HTMLElement): void {
  if (!host.isConnected) return;
  const slot = host.querySelector("[data-hg-lore-portrait-barcode]") as HTMLElement | null;
  if (!slot) return;
  const shell = host.querySelector('[class*="charSkShell"]');
  if (!(shell instanceof HTMLElement)) return;
  const payload = collectCharSkBarcodePayload(shell);
  if (slot.dataset.hgBarcodePayload === payload) return;
  slot.dataset.hgBarcodePayload = payload;
  slot.innerHTML = code128ToSvg(payload, { barHeight: 18, maxWidth: 168, padX: 6 });
}

function clearPending(host: HTMLElement): void {
  const t = pendingByHost.get(host);
  if (t !== undefined) {
    clearTimeout(t);
    pendingByHost.delete(host);
  }
}

/**
 * Render Code 128 SVG into the portrait barcode slot (if present) under `host`.
 * Use `debounceMs` while typing so the strip does not flicker on every keystroke; omit or `0` for immediate sync.
 */
export function syncLoreCharSkPortraitBarcode(
  host: HTMLElement | null,
  opts?: { debounceMs?: number },
): void {
  if (!host) return;
  const ms = opts?.debounceMs;
  if (ms == null || ms <= 0) {
    clearPending(host);
    runBarcodeSync(host);
    return;
  }
  clearPending(host);
  pendingByHost.set(
    host,
    setTimeout(() => {
      pendingByHost.delete(host);
      runBarcodeSync(host);
    }, ms),
  );
}

/** Apply pending barcode update immediately (e.g. on blur). */
export function flushLoreCharSkPortraitBarcode(host: HTMLElement | null): void {
  if (!host) return;
  clearPending(host);
  runBarcodeSync(host);
}

export { BARCODE_DEBOUNCE_MS };
