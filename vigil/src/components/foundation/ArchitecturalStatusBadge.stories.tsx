"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ArchitecturalStatusBadge } from "@/src/components/foundation/ArchitecturalStatusBar";

const meta: Meta<typeof ArchitecturalStatusBadge> = {
  title: "Architectural Shell/Primitives/Status Badge",
  component: ArchitecturalStatusBadge,
  args: {
    showPulse: true,
    label: "heartgarden",
  },
  argTypes: {
    showPulse: { control: "boolean" },
    label: { control: "text" },
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
type Story = StoryObj<typeof ArchitecturalStatusBadge>;

export const Default: Story = {};
