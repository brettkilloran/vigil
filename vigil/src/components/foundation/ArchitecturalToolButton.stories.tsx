"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalToolButton } from "@/src/components/foundation/ArchitecturalToolRail";

const meta: Meta<typeof ArchitecturalToolButton> = {
  title: "Heartgarden/Architectural Shell/Primitives/Tool Button",
  component: ArchitecturalToolButton,
  args: {
    label: "Select",
    active: false,
    icon: "+",
    onClick: () => {},
  },
  argTypes: {
    label: { control: "text" },
    active: { control: "boolean" },
    icon: { control: "text" },
    onClick: { control: false },
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
type Story = StoryObj<typeof ArchitecturalToolButton>;

export const Default: Story = {};

export const Active: Story = {
  args: {
    active: true,
  },
};

