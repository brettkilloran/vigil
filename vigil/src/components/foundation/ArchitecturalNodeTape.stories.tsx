"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalNodeTape } from "@/src/components/foundation/ArchitecturalNodeCard";

const meta: Meta<typeof ArchitecturalNodeTape> = {
  title: "Heartgarden/Architectural Shell/Primitives/Node Tape",
  component: ArchitecturalNodeTape,
  args: {
    variant: "clear",
    rotationDeg: -2,
  },
  argTypes: {
    variant: { control: "radio", options: ["clear", "masking", "dark"] },
    rotationDeg: { control: { type: "range", min: -10, max: 10, step: 0.5 } },
  },
  decorators: [
    (Story) => (
      <div style={{ position: "relative", width: 320, height: 120, background: "var(--sem-surface-base)" }}>
        <div style={{ position: "absolute", top: 52, left: 120 }}>
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ArchitecturalNodeTape>;

export const Default: Story = {};

