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
    buttonTone: "card-light",
    onExpand: () => {},
  },
  argTypes: {
    title: { control: "text" },
    showExpand: { control: "boolean" },
    expandLabel: { control: "text" },
    buttonTone: {
      control: "radio",
      options: ["card-light", "card-dark", "focus-light", "focus-dark"],
    },
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

export const DarkCardActionTone: Story = {
  args: {
    title: "SYS // Configuration.js",
    buttonTone: "card-dark",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360, background: "#1c1c21", color: "#e0e0e0" }}>
        <Story />
      </div>
    ),
  ],
};
