"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  ArchitecturalBottomDock,
  DEFAULT_CREATE_ACTIONS,
  DEFAULT_FORMAT_ACTIONS,
} from "@/src/components/foundation/ArchitecturalBottomDock";

const meta: Meta<typeof ArchitecturalBottomDock> = {
  title: "Architectural Shell/Components/Bottom Dock",
  component: ArchitecturalBottomDock,
  args: {
    onFormat: () => {},
    onCreateNode: () => {},
    formatActions: DEFAULT_FORMAT_ACTIONS,
    createActions: DEFAULT_CREATE_ACTIONS,
  },
  argTypes: {
    onFormat: { control: false },
    onCreateNode: { control: false },
    formatActions: { control: "object" },
    createActions: { control: "object" },
  },
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div
        style={{
          position: "relative",
          width: "100vw",
          height: "100vh",
          background: "#0a0a0c",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ArchitecturalBottomDock>;

export const Default: Story = {};
