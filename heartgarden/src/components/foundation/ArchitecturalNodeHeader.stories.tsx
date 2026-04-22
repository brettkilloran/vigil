"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalNodeHeader } from "@/src/components/foundation/ArchitecturalNodeCard";

const meta: Meta<typeof ArchitecturalNodeHeader> = {
  title: "Heartgarden/UI/Node header",
  component: ArchitecturalNodeHeader,
  args: {
    title: "Brief // The second chance",
    showExpand: true,
    expandLabel: "Focus Mode",
    buttonTone: "card-light",
    aiReviewPending: false,
    onExpand: () => {},
  },
  argTypes: {
    title: { control: "text" },
    showExpand: { control: "boolean" },
    expandLabel: { control: "text" },
    aiReviewPending: { control: "boolean" },
    buttonTone: {
      control: "radio",
      options: ["card-light", "card-dark", "focus-light", "focus-dark"],
    },
    onExpand: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360, background: "var(--theme-default-bg)", color: "var(--theme-default-text)" }}>
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

export const WithAiReviewBadge: Story = {
  args: {
    aiReviewPending: true,
    title: "Merged import",
  },
};

export const DarkCardActionTone: Story = {
  args: {
    title: "DAT // sing_1r_boot.ts",
    buttonTone: "card-dark",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360, background: "var(--sys-color-neutral-900)", color: "var(--sem-text-secondary)" }}>
        <Story />
      </div>
    ),
  ],
};

