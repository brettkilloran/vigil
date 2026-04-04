"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  ArchitecturalBottomDock,
  DEFAULT_CREATE_ACTIONS,
  DEFAULT_DOC_INSERT_ACTIONS,
  DEFAULT_FORMAT_ACTIONS,
} from "@/src/components/foundation/ArchitecturalBottomDock";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

const meta: Meta<typeof ArchitecturalBottomDock> = {
  title: "Architectural Shell/Components/Bottom Dock",
  component: ArchitecturalBottomDock,
  args: {
    onFormat: () => {},
    onCreateNode: () => {},
    insertDocActions: DEFAULT_DOC_INSERT_ACTIONS,
    formatActions: DEFAULT_FORMAT_ACTIONS,
    createActions: DEFAULT_CREATE_ACTIONS,
  },
  argTypes: {
    onFormat: { control: false },
    onCreateNode: { control: false },
    insertDocActions: { control: "object" },
    formatActions: { control: "object" },
    createActions: { control: "object" },
    variant: { control: "select", options: ["canvas", "editor"] },
    showFormatToolbar: { control: "boolean" },
    showDocInsertCluster: { control: "boolean" },
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

export const WithoutFormatToolbar: Story = {
  args: { showFormatToolbar: false },
};

/** Solid black dock + `card-dark` icon tones — matches focus / editor overlay. */
export const Editor: Story = {
  args: { variant: "editor" },
  decorators: [
    (Story) => (
      <div className={styles.shell}>
        <div
          className={styles.viewport}
          style={{
            background:
              "linear-gradient(180deg, oklch(0.97 0 0) 0%, oklch(0.92 0 0) 100%)",
          }}
        />
        <Story />
      </div>
    ),
  ],
};
