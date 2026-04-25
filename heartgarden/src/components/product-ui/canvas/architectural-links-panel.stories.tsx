"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { buildArchitecturalSeedGraph } from "@/src/components/foundation/architectural-seed";
import { ArchitecturalLinksPanel } from "@/src/components/ui/architectural-links-panel";

const seedGraph = buildArchitecturalSeedGraph(
  {
    done: styles.done,
    mediaFrame: styles.mediaFrame,
    mediaImage: styles.mediaImage,
    mediaImageActions: styles.mediaImageActions,
    mediaUploadBtn: styles.mediaUploadBtn,
    taskCheckbox: styles.taskCheckbox,
    taskItem: styles.taskItem,
    taskText: styles.taskText,
  },
  "default"
);

const meta = {
  component: ArchitecturalLinksPanel,
  parameters: {
    docs: {
      description: {
        component:
          "Right-rail debug inspector for wiki targets in note HTML and (when `cloudEnabled` and UUID item ids) Neon links + FTS related items. Story uses **local** mode only — no network.",
      },
    },
    layout: "fullscreen",
  },
  title: "Heartgarden/Product UI/Canvas/Links panel (debug)",
} satisfies Meta<typeof ArchitecturalLinksPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LocalNoteSelected: Story = {
  args: {
    activeSpaceId: "root",
    cloudEnabled: false,
    graph: seedGraph,
    onFocusEntity: fn(),
    selectedEntityIds: ["node-1"],
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
    activeSpaceId: "root",
    cloudEnabled: false,
    graph: seedGraph,
    onFocusEntity: fn(),
    selectedEntityIds: [],
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-[200px] w-full max-w-xl rounded-lg border border-[var(--vigil-border)] border-dashed p-4 text-[var(--vigil-muted)] text-sm">
        <p className="mb-2">
          Panel returns `null` without a single selection — empty stage below.
        </p>
        <Story />
      </div>
    ),
  ],
};
