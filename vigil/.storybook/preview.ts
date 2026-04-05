import type { Preview } from "@storybook/nextjs";

import "../app/globals.css";

const preview: Preview = {
  parameters: {
    options: {
      // Serializable for `storybook build` (no functions). Nested tuples = group / nested path.
      storySort: {
        order: [
          "Heartgarden",
          ["Heartgarden", "Overview"],
          ["Heartgarden", "Design System"],
          ["Heartgarden", "Architectural Shell"],
          "*",
        ],
      },
    },
    nextjs: {
      appDirectory: true,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
  },
};

export default preview;