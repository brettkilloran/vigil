"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalToolButton } from "@/src/components/foundation/ArchitecturalToolRail";

const meta: Meta<typeof ArchitecturalToolButton> = {
  args: {
    active: false,
    icon: "+",
    label: "Select",
    onClick: () => {},
  },
  argTypes: {
    active: { control: "boolean" },
    icon: { control: "text" },
    label: { control: "text" },
    onClick: { control: false },
  },
  component: ArchitecturalToolButton,
  decorators: [
    (Story) => (
      <div style={{ background: "var(--sem-surface-base)", padding: 20 }}>
        <Story />
      </div>
    ),
  ],
  title: "Heartgarden/Product UI/Canvas/Tool button",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalToolButton>;

export const Default: Story = {};

export const Active: Story = {
  args: {
    active: true,
  },
};
