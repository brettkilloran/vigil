"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  ArchitecturalBottomDock,
  DEFAULT_CREATE_ACTIONS,
  DEFAULT_FORMAT_ACTIONS,
} from "@/src/components/foundation/ArchitecturalBottomDock";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

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
      <div className={styles.shell}>
        <div className={styles.viewport} />
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ArchitecturalBottomDock>;

export const Default: Story = {};
