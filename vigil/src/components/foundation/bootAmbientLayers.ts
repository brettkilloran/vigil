/**
 * Boot ambient: three samples and how they are mixed (gain + optional stereo pan).
 * Vapor Fingers has no `pan` → centered. Nature beds use pan for width.
 */
export type VigilBootAmbientLayer = {
  id: string;
  src: string;
  /** Linear gain when fully faded in (Web Audio gain node, or HTMLAudioElement.volume fallback). */
  gain: number;
  /** `StereoPanner` value −1 (L) … 1 (R). Omit for center — do not put music on this. */
  pan?: number;
};

/** Forest + meadow: slightly quieter than music so the bed sits behind the theme track. */
export const VIGIL_BOOT_AMBIENT_NATURE_GAIN = 0.24;
export const VIGIL_BOOT_AMBIENT_MUSIC_GAIN = 0.32;

export const VIGIL_BOOT_AMBIENT_LAYERS: readonly VigilBootAmbientLayer[] = [
  { id: "forest", src: "/audio/boot-forest-wind.aac", gain: VIGIL_BOOT_AMBIENT_NATURE_GAIN, pan: -0.95 },
  { id: "meadow", src: "/audio/boot-open-meadow-windy.aac", gain: VIGIL_BOOT_AMBIENT_NATURE_GAIN, pan: 0.95 },
  { id: "music", src: "/audio/boot-mourning-faraday-nv-theme.mp3", gain: VIGIL_BOOT_AMBIENT_MUSIC_GAIN },
];

export const VIGIL_BOOT_AMBIENT_LAYER_COUNT = VIGIL_BOOT_AMBIENT_LAYERS.length;
