"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { ArchitecturalLinksPanel } from "@/src/components/ui/ArchitecturalLinksPanel";
import { buildArchitecturalSeedGraph } from "@/src/components/foundation/architectural-seed";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

const seedGraph = buildArchitecturalSeedGraph(
  {
    taskItem: styles.taskItem,
    done: styles.done,
    taskCheckbox: styles.taskCheckbox,
    taskText: styles.taskText,
    mediaFrame: styles.mediaFrame,
    mediaImage: styles.mediaImage,
    mediaImageActions: styles.mediaImageActions,
    mediaUploadBtn: styles.mediaUploadBtn,
  },
  "default",
);

const meta = {
  title: "Heartgarden/Product UI/Canvas/Links panel (debug)",
  component: ArchitecturalLinksPanel,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Right-rail debug inspector for wiki targets in note HTML and (when `cloudEnabled` and UUID item ids) Neon links + FTS related items. Story uses **local** mode only — no network.",
      },
    },
  },
} satisfies Meta<typeof ArchitecturalLinksPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LocalNoteSelected: Story = {
  args: {
    graph: seedGraph,
    activeSpaceId: "root",
    selectedEntityIds: ["node-1"],
    cloudEnabled: false,
    onFocusEntity: fn(),
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-[360px] w-full max-w-2xl bg-[var(--sem-bg-canvas,#0c0e14)]">
        <Story />
      </div>
    ),
  ],
};

export const NothingSelected: Story = {
  args: {
    graph: seedGraph,
    activeSpaceId: "root",
    selectedEntityIds: [],
    cloudEnabled: false,
    onFocusEntity: fn(),
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-[200px] w-full max-w-xl rounded-lg border border-dashed border-[var(--vigil-border)] p-4 text-sm text-[var(--vigil-muted)]">
        <p className="mb-2">Panel returns `null` without a single selection — empty stage below.</p>
        <Story />
      </div>
    ),
  ],
};
