import type { Preview } from "@storybook/nextjs";

import "../app/globals.css";
import "./preview-overrides.css";

const preview: Preview = {
  parameters: {
    a11y: {
      test: "todo",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
    },
    options: {
      // Serializable for `storybook build` (no functions). Nested tuples = group / nested path.
      storySort: {
        order: [
          "Heartgarden",
          ["Heartgarden", "Design System"],
          ["Heartgarden", "Product UI"],
          ["Heartgarden", "Experiments"],
          "*",
        ],
      },
    },
  },
};

export default preview;
