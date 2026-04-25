"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalNodeTape } from "@/src/components/foundation/architectural-node-card";

const meta: Meta<typeof ArchitecturalNodeTape> = {
  args: {
    rotationDeg: -2,
    variant: "clear",
  },
  argTypes: {
    rotationDeg: { control: { max: 10, min: -10, step: 0.5, type: "range" } },
    variant: { control: "radio", options: ["clear", "masking", "dark"] },
  },
  component: ArchitecturalNodeTape,
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--sem-surface-base)",
          height: 120,
          position: "relative",
          width: 320,
        }}
      >
        <div style={{ left: 120, position: "absolute", top: 52 }}>
          <Story />
        </div>
      </div>
    ),
  ],
  title: "Heartgarden/Product UI/Canvas/Node tape",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalNodeTape>;

export const Default: Story = {};
