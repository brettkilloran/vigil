"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import {
  ArchitecturalFormatToolbar,
  DEFAULT_DOC_INSERT_ACTIONS,
  DEFAULT_FORMAT_ACTIONS,
} from "@/src/components/foundation/architectural-bottom-dock";

const meta: Meta<typeof ArchitecturalFormatToolbar> = {
  args: {
    formatActions: DEFAULT_FORMAT_ACTIONS,
    insertDocActions: DEFAULT_DOC_INSERT_ACTIONS,
    onFormat: () => {
      /* noop */
    },
    showDocInsertCluster: true,
  },
  argTypes: {
    actionTone: { control: "select", options: ["glass", "card-dark"] },
    formatActions: { control: "object" },
    insertDocActions: { control: "object" },
    onFormat: { control: false },
    showDocInsertCluster: { control: "boolean" },
  },
  component: ArchitecturalFormatToolbar,
  decorators: [
    (Story) => (
      <div style={{ background: "var(--sem-surface-base)", padding: 20 }}>
        <Story />
      </div>
    ),
  ],
  title: "Heartgarden/Product UI/Canvas/Format toolbar",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalFormatToolbar>;

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
