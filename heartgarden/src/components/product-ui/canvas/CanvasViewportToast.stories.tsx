"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { CanvasViewportToast } from "@/src/components/foundation/CanvasViewportToast";

const meta: Meta<typeof CanvasViewportToast> = {
  title: "Heartgarden/Product UI/Canvas/Canvas viewport toast",
  component: CanvasViewportToast,
  args: {
    onShow: () => {},
    onDismiss: () => {},
  },
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div
        style={{
          position: "relative",
          width: "100vw",
          height: "100vh",
          background: "var(--sem-surface-base)",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CanvasViewportToast>;

/** Shown when panned/zoomed so some cards sit outside the viewport (Show / Dismiss). */
export const OffscreenCardsHint: Story = {};
