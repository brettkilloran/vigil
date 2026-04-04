"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ArchitecturalStatusMetric } from "@/src/components/foundation/ArchitecturalStatusBar";

const meta: Meta<typeof ArchitecturalStatusMetric> = {
  title: "Architectural Shell/Primitives/Status Metric",
  component: ArchitecturalStatusMetric,
  args: {
    children: "100%",
  },
  argTypes: {
    icon: { control: false },
    children: { control: "text" },
  },
  decorators: [
    (Story) => (
      <div style={{ background: "var(--sem-surface-base)", padding: 20 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ArchitecturalStatusMetric>;

export const Default: Story = {};
