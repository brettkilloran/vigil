"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  ArchitecturalFormatToolbar,
  DEFAULT_FORMAT_ACTIONS,
} from "@/src/components/foundation/ArchitecturalBottomDock";

const meta: Meta<typeof ArchitecturalFormatToolbar> = {
  title: "Architectural Shell/Primitives/Format Toolbar",
  component: ArchitecturalFormatToolbar,
  args: {
    actions: DEFAULT_FORMAT_ACTIONS,
    onFormat: () => {},
  },
  argTypes: {
    actions: { control: "object" },
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
