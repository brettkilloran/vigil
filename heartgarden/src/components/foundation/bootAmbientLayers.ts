/**
 * Boot ambient: samples and how they are mixed (gain + optional stereo pan).
 * Omit `pan` for a centered stereo image (music + single nature bed).
 */
export interface VigilBootAmbientLayer {
  /** Linear gain when fully faded in (Web Audio gain node, or HTMLAudioElement.volume fallback). */
  gain: number;
  id: string;
  /** `StereoPanner` value −1 (L) … 1 (R). Omit for center — do not put music on this. */
  pan?: number;
  src: string;
}

/** Nature bed: same gain as the legacy single forest layer (0.42). */
export const VIGIL_BOOT_AMBIENT_NATURE_GAIN = 0.42;
export const VIGIL_BOOT_AMBIENT_MUSIC_GAIN = 0.32;

export const VIGIL_BOOT_AMBIENT_LAYERS: readonly VigilBootAmbientLayer[] = [
  {
    id: "forest",
    src: "/audio/boot-forest-wind.aac",
    gain: VIGIL_BOOT_AMBIENT_NATURE_GAIN,
  },
  {
    id: "music",
    src: "/audio/boot-mourning-faraday-nv-theme.mp3",
    gain: VIGIL_BOOT_AMBIENT_MUSIC_GAIN,
  },
];

export const VIGIL_BOOT_AMBIENT_LAYER_COUNT = VIGIL_BOOT_AMBIENT_LAYERS.length;
