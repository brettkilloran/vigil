"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import {
  ArchitecturalFormatToolbar,
  DEFAULT_DOC_INSERT_ACTIONS,
  DEFAULT_FORMAT_ACTIONS,
} from "@/src/components/foundation/ArchitecturalBottomDock";

const meta: Meta<typeof ArchitecturalFormatToolbar> = {
  title: "Heartgarden/Product UI/Canvas/Format toolbar",
  component: ArchitecturalFormatToolbar,
  args: {
    insertDocActions: DEFAULT_DOC_INSERT_ACTIONS,
    formatActions: DEFAULT_FORMAT_ACTIONS,
    showDocInsertCluster: true,
    onFormat: () => {},
  },
  argTypes: {
    insertDocActions: { control: "object" },
    formatActions: { control: "object" },
    showDocInsertCluster: { control: "boolean" },
    actionTone: { control: "select", options: ["glass", "card-dark"] },
    onFormat: { control: false },
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
type Story = StoryObj<typeof ArchitecturalFormatToolbar>;

export const Default: Story = {};

export const OnBlackDock: Story = {
  args: { actionTone: "card-dark" },
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--sys-color-black)",
          padding: "12px 16px",
          borderRadius: 8,
          display: "inline-block",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

