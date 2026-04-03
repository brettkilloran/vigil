"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ArchitecturalNodeHeader } from "@/src/components/foundation/ArchitecturalNodeCard";

const meta: Meta<typeof ArchitecturalNodeHeader> = {
  title: "Architectural Shell/Primitives/Node Header",
  component: ArchitecturalNodeHeader,
  args: {
    title: "Project Thesis",
    showExpand: true,
    expandLabel: "Focus Mode",
    onExpand: () => {},
  },
  argTypes: {
    title: { control: "text" },
    showExpand: { control: "boolean" },
    expandLabel: { control: "text" },
    onExpand: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360, background: "#f4f2ec", color: "#1a1a1a" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ArchitecturalNodeHeader>;

export const Default: Story = {};

export const NoExpandButton: Story = {
  args: {
    showExpand: false,
  },
};
