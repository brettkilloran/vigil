"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalStatusMetric } from "@/src/components/foundation/ArchitecturalStatusBar";

const meta: Meta<typeof ArchitecturalStatusMetric> = {
  title: "Heartgarden/Product UI/Canvas/Status metric",
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

