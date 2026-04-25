"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { CanvasViewportToast } from "@/src/components/foundation/CanvasViewportToast";

const meta: Meta<typeof CanvasViewportToast> = {
  args: {
    onDismiss: () => {},
    onShow: () => {},
  },
  component: CanvasViewportToast,
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--sem-surface-base)",
          height: "100vh",
          position: "relative",
          width: "100vw",
        }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
  title: "Heartgarden/Product UI/Canvas/Canvas viewport toast",
};

export default meta;
type Story = StoryObj<typeof CanvasViewportToast>;

/** Shown when panned/zoomed so some cards sit outside the viewport (Show / Dismiss). */
export const OffscreenCardsHint: Story = {};
