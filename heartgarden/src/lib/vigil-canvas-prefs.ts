/** localStorage: `"1"` = full canvas effects (default); `"0"` = focus / performance (no flow overlay, minimal chrome). */
export const VIGIL_CANVAS_EFFECTS_STORAGE_KEY = "vigil-canvas-effects-enabled";

/** localStorage: `"1"` = canvas minimap visible; omitted/`"0"` = hidden (default). */
export const VIGIL_MINIMAP_VISIBLE_STORAGE_KEY = "vigil-canvas-minimap-visible";

export function readCanvasMinimapVisibleFromStorage(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return (
      window.localStorage.getItem(VIGIL_MINIMAP_VISIBLE_STORAGE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

export function writeCanvasMinimapVisibleToStorage(visible: boolean): void {
  try {
    window.localStorage.setItem(
      VIGIL_MINIMAP_VISIBLE_STORAGE_KEY,
      visible ? "1" : "0"
    );
  } catch {
    /* ignore quota / private mode */
  }
}
