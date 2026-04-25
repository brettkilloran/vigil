"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { fn } from "storybook/test";

import styles from "./ArchitecturalCanvasApp.module.css";
import {
  LoreImportLandModeRadios,
  type LoreImportUploadMode,
} from "./lore-import-land-mode-radios";

const meta = {
  component: LoreImportLandModeRadios,
  decorators: [
    (Story) => (
      <div
        className="p-6"
        style={{
          background: "var(--sem-surface-elevated, #12151c)",
          minWidth: "min(100vw - 2rem, 32rem)",
        }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Same component as the import upload popover (“How should this import land?”). Edit `LoreImportLandModeRadios.tsx` to change labels; the app imports this module.",
      },
    },
    layout: "centered",
  },
  title: "Heartgarden/Foundation/Lore import land mode",
} satisfies Meta<typeof LoreImportLandModeRadios>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Renders the same layout as the popover section: title + [LoreImportLandModeRadios](source).
 */
function LandModeInPopoverSection(props: {
  initialMode: LoreImportUploadMode;
  name?: string;
  onModeChangeLog?: (mode: LoreImportUploadMode) => void;
}) {
  const { initialMode, name, onModeChangeLog } = props;
  const [mode, setMode] = useState(initialMode);
  return (
    <section className={styles.importUploadPopoverSection}>
      <h3 className={styles.importUploadPopoverSectionTitle}>
        How should this import land?
      </h3>
      <LoreImportLandModeRadios
        mode={mode}
        name={name}
        onModeChange={(next) => {
          onModeChangeLog?.(next);
          setMode(next);
        }}
      />
    </section>
  );
}

export const DefaultManyLoose: Story = {
  args: {
    mode: "many_loose",
    onModeChange: fn(),
  },
  name: "Interactive (default many loose)",
  render: () => (
    <LandModeInPopoverSection initialMode="many_loose" onModeChangeLog={fn()} />
  ),
};

export const OneNote: Story = {
  args: {
    mode: "one_note",
    onModeChange: fn(),
  },
  name: "Interactive (one note selected)",
  render: () => (
    <LandModeInPopoverSection initialMode="one_note" onModeChangeLog={fn()} />
  ),
};

export const ManyInFolders: Story = {
  args: {
    mode: "many_folders",
    onModeChange: fn(),
  },
  name: "Interactive (many in folders selected)",
  render: () => (
    <LandModeInPopoverSection
      initialMode="many_folders"
      onModeChangeLog={fn()}
    />
  ),
};
