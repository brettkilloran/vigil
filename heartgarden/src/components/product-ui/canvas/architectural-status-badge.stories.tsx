"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalStatusBadge } from "@/src/components/foundation/architectural-status-bar";

const meta: Meta<typeof ArchitecturalStatusBadge> = {
  args: {
    label: "波途画電",
    showPulse: true,
  },
  argTypes: {
    label: { control: "text" },
    showPulse: { control: "boolean" },
  },
  component: ArchitecturalStatusBadge,
  decorators: [
    (Story) => (
      <div style={{ background: "var(--sem-surface-base)", padding: 20 }}>
        <Story />
      </div>
    ),
  ],
  title: "Heartgarden/Product UI/Canvas/Status badge",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalStatusBadge>;

export const Default: Story = {};
