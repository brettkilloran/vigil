"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ArchitecturalStatusBar } from "@/src/components/foundation/ArchitecturalStatusBar";

const meta: Meta<typeof ArchitecturalStatusBar> = {
  title: "Architectural Shell/Components/Status Bar",
  component: ArchitecturalStatusBar,
  args: {
    centerWorldX: 0,
    centerWorldY: 0,
    scale: 1,
    envLabel: "heartgarden",
    showPulse: true,
    zoomPrefixIcon: true,
  },
  argTypes: {
    centerWorldX: { control: { type: "number", step: 10 } },
    centerWorldY: { control: { type: "number", step: 10 } },
    scale: { control: { type: "range", min: 0.3, max: 3, step: 0.1 } },
    envLabel: { control: "text" },
    showPulse: { control: "boolean" },
    zoomPrefixIcon: { control: "boolean" },
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
          background: "#0a0a0a",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ArchitecturalStatusBar>;

export const Default: Story = {};

export const NoPulse: Story = {
  args: {
    showPulse: false,
  },
};
