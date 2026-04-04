import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

/** Matches `--sys-color-accent-500` (saturated orange, OKLCH). */
const accent = "oklch(0.74 0.31 50)";

addons.setConfig({
  theme: create({
    base: "dark",
    brandTitle: "heartgarden",
    colorPrimary: accent,
    colorSecondary: accent,
    barSelectedColor: accent,
    barHoverColor: "oklch(0.74 0.31 50 / 0.22)",
  }),
});
