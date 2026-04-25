"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalStatusMetric } from "@/src/components/foundation/architectural-status-bar";

const meta: Meta<typeof ArchitecturalStatusMetric> = {
  args: {
    children: "100%",
  },
  argTypes: {
    children: { control: "text" },
    icon: { control: false },
  },
  component: ArchitecturalStatusMetric,
  decorators: [
    (Story) => (
      <div style={{ background: "var(--sem-surface-base)", padding: 20 }}>
        <Story />
      </div>
    ),
  ],
  title: "Heartgarden/Product UI/Canvas/Status metric",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalStatusMetric>;

export const Default: Story = {};
