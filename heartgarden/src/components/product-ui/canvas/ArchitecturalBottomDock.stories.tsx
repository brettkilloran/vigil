"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import {
  ArchitecturalBottomDock,
  ArchitecturalConnectionToolbar,
  DEFAULT_CREATE_ACTIONS,
  DEFAULT_DOC_INSERT_ACTIONS,
  DEFAULT_FORMAT_ACTIONS,
  type ConnectionDockMode,
} from "@/src/components/foundation/ArchitecturalBottomDock";
import { type ConnectionKind } from "@/src/lib/connection-kind-colors";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

const meta: Meta<typeof ArchitecturalBottomDock> = {
  title: "Heartgarden/Product UI/Canvas/Bottom dock",
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

export const WithSelectionDelete: Story = {
  args: {
    onUndo: () => {},
    onRedo: () => {},
    canUndo: true,
    canRedo: false,
    selectionDelete: { selectedCount: 2, onDelete: () => {} },
  },
};

export const WithSelectionStack: Story = {
  args: {
    onUndo: () => {},
    onRedo: () => {},
    canUndo: true,
    canRedo: false,
    selectionDelete: { selectedCount: 2, onDelete: () => {} },
    selectionStack: {
      canMerge: true,
      onMerge: () => {},
      mergeTitle: "Create stack (Ctrl+S)",
      canUnstack: false,
      onUnstack: () => {},
      unstackTitle: "Unstack",
    },
  },
};

export const WithSelectionStackMergeAndUnstack: Story = {
  args: {
    onUndo: () => {},
    onRedo: () => {},
    canUndo: true,
    canRedo: false,
    selectionDelete: { selectedCount: 4, onDelete: () => {} },
    selectionStack: {
      canMerge: true,
      onMerge: () => {},
      mergeTitle: "Merge stacks (Ctrl+S)",
      canUnstack: true,
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
    <div style={{ position: "absolute", top: 24, right: 24 }}>
      <div className={styles.rootDockPanel}>
        <ArchitecturalConnectionToolbar
          mode={mode}
          onSetMode={setMode}
          connectionKind={connectionKind}
          onSetConnectionKind={setConnectionKind}
        />
      </div>
    </div>
  );
}

export const WithConnectionToolbar: Story = {
  render: () => <ConnectionToolbarDemo />,
};

