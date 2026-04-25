"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalNodeHeader } from "@/src/components/foundation/ArchitecturalNodeCard";

const meta: Meta<typeof ArchitecturalNodeHeader> = {
  args: {
    buttonTone: "card-light",
    expandLabel: "Focus Mode",
    onExpand: () => {},
    showExpand: true,
    title: "Brief // The second chance",
  },
  argTypes: {
    buttonTone: {
      control: "radio",
      options: ["card-light", "card-dark", "focus-light", "focus-dark"],
    },
    expandLabel: { control: "text" },
    onExpand: { control: false },
    showExpand: { control: "boolean" },
    title: { control: "text" },
  },
  component: ArchitecturalNodeHeader,
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--theme-default-bg)",
          color: "var(--theme-default-text)",
          width: 360,
        }}
      >
        <Story />
      </div>
    ),
  ],
  title: "Heartgarden/Product UI/Canvas/Node header",
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
    buttonTone: "card-dark",
    title: "DAT // sing_1r_boot.ts",
  },
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--sys-color-neutral-900)",
          color: "var(--sem-text-secondary)",
          width: 360,
        }}
      >
        <Story />
      </div>
    ),
  ],
};
