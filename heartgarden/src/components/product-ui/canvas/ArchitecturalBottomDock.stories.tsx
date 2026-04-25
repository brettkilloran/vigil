"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import {
  ArchitecturalBottomDock,
  ArchitecturalConnectionToolbar,
  type ConnectionDockMode,
  DEFAULT_CREATE_ACTIONS,
  DEFAULT_DOC_INSERT_ACTIONS,
  DEFAULT_FORMAT_ACTIONS,
} from "@/src/components/foundation/ArchitecturalBottomDock";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import type { ConnectionKind } from "@/src/lib/connection-kind-colors";

const meta: Meta<typeof ArchitecturalBottomDock> = {
  args: {
    createActions: DEFAULT_CREATE_ACTIONS,
    formatActions: DEFAULT_FORMAT_ACTIONS,
    insertDocActions: DEFAULT_DOC_INSERT_ACTIONS,
    onCreateNode: () => {},
    onFormat: () => {},
  },
  argTypes: {
    createActions: { control: "object" },
    formatActions: { control: "object" },
    insertDocActions: { control: "object" },
    onCreateNode: { control: false },
    onFormat: { control: false },
    showDocInsertCluster: { control: "boolean" },
    showFormatToolbar: { control: "boolean" },
    variant: { control: "select", options: ["canvas", "editor"] },
  },
  component: ArchitecturalBottomDock,
  decorators: [
    (Story) => (
      <div className={styles.shell}>
        <div className={styles.viewport} />
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
  title: "Heartgarden/Product UI/Canvas/Bottom dock",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalBottomDock>;

export const Default: Story = {};

export const WithoutFormatToolbar: Story = {
  args: { showFormatToolbar: false },
};

export const WithSelectionDelete: Story = {
  args: {
    canRedo: false,
    canUndo: true,
    onRedo: () => {},
    onUndo: () => {},
    selectionDelete: { onDelete: () => {}, selectedCount: 2 },
  },
};

export const WithSelectionStack: Story = {
  args: {
    canRedo: false,
    canUndo: true,
    onRedo: () => {},
    onUndo: () => {},
    selectionDelete: { onDelete: () => {}, selectedCount: 2 },
    selectionStack: {
      canMerge: true,
      canUnstack: false,
      mergeTitle: "Create stack (Ctrl+S)",
      onMerge: () => {},
      onUnstack: () => {},
      unstackTitle: "Unstack",
    },
  },
};

export const WithSelectionStackMergeAndUnstack: Story = {
  args: {
    canRedo: false,
    canUndo: true,
    onRedo: () => {},
    onUndo: () => {},
    selectionDelete: { onDelete: () => {}, selectedCount: 4 },
    selectionStack: {
      canMerge: true,
      canUnstack: true,
      mergeTitle: "Merge stacks (Ctrl+S)",
      onMerge: () => {},
      onUnstack: () => {},
      unstackTitle: "Unstack",
    },
  },
};

/** Solid black dock + `card-dark` icon tones â€” matches focus / editor overlay. */
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

function ConnectionToolbarDemo() {
  const [mode, setMode] = useState<ConnectionDockMode>("move");
  const [connectionKind, setConnectionKind] = useState<ConnectionKind>("pin");
  return (
    <div style={{ position: "absolute", right: 24, top: 24 }}>
      <div className={styles.rootDockPanel}>
        <ArchitecturalConnectionToolbar
          connectionKind={connectionKind}
          mode={mode}
          onSetConnectionKind={setConnectionKind}
          onSetMode={setMode}
        />
      </div>
    </div>
  );
}

export const WithConnectionToolbar: Story = {
  render: () => <ConnectionToolbarDemo />,
};
