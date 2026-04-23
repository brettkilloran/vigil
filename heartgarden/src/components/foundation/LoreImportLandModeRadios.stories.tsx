"use client";

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import styles from "./ArchitecturalCanvasApp.module.css";
import {
  LoreImportLandModeRadios,
  type LoreImportUploadMode,
} from "./LoreImportLandModeRadios";

const meta = {
  title: "Heartgarden/Foundation/Lore import land mode",
  component: LoreImportLandModeRadios,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Same component as the import upload popover (“How should this import land?”). Edit `LoreImportLandModeRadios.tsx` to change labels; the app imports this module.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        className="p-6"
        style={{
          minWidth: "min(100vw - 2rem, 32rem)",
          background: "var(--sem-surface-elevated, #12151c)",
        }}
      >
        <Story />
      </div>
    ),
  ],
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
      <h3 className={styles.importUploadPopoverSectionTitle}>How should this import land?</h3>
      <LoreImportLandModeRadios
        name={name}
        mode={mode}
        onModeChange={(next) => {
          onModeChangeLog?.(next);
          setMode(next);
        }}
      />
    </section>
  );
}

export const DefaultManyLoose: Story = {
  name: "Interactive (default many loose)",
  args: {
    mode: "many_loose",
    onModeChange: fn(),
  },
  render: () => (
    <LandModeInPopoverSection
      initialMode="many_loose"
      onModeChangeLog={fn()}
    />
  ),
};

export const OneNote: Story = {
  name: "Interactive (one note selected)",
  args: {
    mode: "one_note",
    onModeChange: fn(),
  },
  render: () => (
    <LandModeInPopoverSection initialMode="one_note" onModeChangeLog={fn()} />
  ),
};

export const ManyInFolders: Story = {
  name: "Interactive (many in folders selected)",
  args: {
    mode: "many_folders",
    onModeChange: fn(),
  },
  render: () => (
    <LandModeInPopoverSection
      initialMode="many_folders"
      onModeChangeLog={fn()}
    />
  ),
};
