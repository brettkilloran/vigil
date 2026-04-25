"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import {
  ArchitecturalCreateMenu,
  DEFAULT_CREATE_ACTIONS,
} from "@/src/components/foundation/ArchitecturalBottomDock";

const meta: Meta<typeof ArchitecturalCreateMenu> = {
  args: {
    actions: DEFAULT_CREATE_ACTIONS,
    onCreateNode: () => {},
  },
  argTypes: {
    actions: { control: "object" },
    actionTone: { control: "select", options: ["menu", "card-dark"] },
    onCreateNode: { control: false },
  },
  component: ArchitecturalCreateMenu,
  decorators: [
    (Story) => (
      <div style={{ background: "var(--sem-surface-base)", padding: 20 }}>
        <Story />
      </div>
    ),
  ],
  title: "Heartgarden/Product UI/Canvas/Create menu",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalCreateMenu>;

export const Default: Story = {};

export const OnBlackDock: Story = {
  args: { actionTone: "card-dark" },
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--sys-color-black)",
          borderRadius: 8,
          display: "inline-block",
          padding: "12px 16px",
        }}
      >
        <Story />
      </div>
    ),
  ],
};
