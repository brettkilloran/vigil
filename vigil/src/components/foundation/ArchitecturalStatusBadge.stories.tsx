"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ArchitecturalStatusBadge } from "@/src/components/foundation/ArchitecturalStatusBar";

const meta: Meta<typeof ArchitecturalStatusBadge> = {
  title: "Architectural Shell/Primitives/Status Badge",
  component: ArchitecturalStatusBadge,
  args: {
    showPulse: true,
    label: "ARCH_ENV",
  },
  argTypes: {
    showPulse: { control: "boolean" },
    label: { control: "text" },
  },
  decorators: [
    (Story) => (
      <div style={{ background: "#0a0a0c", padding: 20 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ArchitecturalStatusBadge>;

export const Default: Story = {};
