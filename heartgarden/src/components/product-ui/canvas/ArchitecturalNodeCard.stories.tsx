"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { ArchitecturalNodeCard } from "@/src/components/foundation/ArchitecturalNodeCard";
import { buildArchitecturalSeedNodes } from "@/src/components/foundation/architectural-seed";

const seedNodes = buildArchitecturalSeedNodes({
  done: styles.done,
  mediaFrame: styles.mediaFrame,
  mediaImage: styles.mediaImage,
  mediaImageActions: styles.mediaImageActions,
  mediaUploadBtn: styles.mediaUploadBtn,
  taskCheckbox: styles.taskCheckbox,
  taskItem: styles.taskItem,
  taskText: styles.taskText,
});

function getSeed(theme: "default" | "code" | "task" | "media") {
  const node = seedNodes.find((item) => item.theme === theme);
  if (!node) {
    throw new Error(`Missing seed node for theme: ${theme}`);
  }
  return node;
}

const seedDefault = getSeed("default");
const seedCode = getSeed("code");
const seedTask = getSeed("task");
const seedMedia = getSeed("media");

const meta: Meta<typeof ArchitecturalNodeCard> = {
  args: {
    activeTool: "select",
    bodyDoc: seedDefault.bodyDoc ?? null,
    bodyHtml: seedDefault.bodyHtml,
    dragged: false,
    id: seedDefault.id,
    onBodyCommit: () => {},
    onExpand: () => {},
    selected: true,
    showExpandButton: true,
    tapeRotation: seedDefault.tapeRotation,
    tapeVariant: "clear",
    theme: seedDefault.theme,
    title: seedDefault.title,
    width: seedDefault.width ?? 340,
  },
  argTypes: {
    activeTool: {
      control: "radio",
      options: ["select", "pan"],
    },
    bodyHtml: { control: "text" },
    onBodyCommit: { control: false },
    onExpand: { control: false },
    tapeVariant: { control: "radio", options: ["clear", "masking", "dark"] },
    theme: { control: "radio", options: ["default", "code", "task", "media"] },
    title: { control: "text" },
    width: { control: "number" },
  },
  component: ArchitecturalNodeCard,
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--sem-surface-base)",
          height: "100vh",
          position: "relative",
          width: "100vw",
        }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
  title: "Heartgarden/Product UI/Canvas/Node card",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalNodeCard>;

export const Default: Story = {};

export const Code: Story = {
  args: {
    bodyHtml: seedCode.bodyHtml,
    id: seedCode.id,
    tapeRotation: seedCode.tapeRotation,
    tapeVariant: "dark",
    theme: seedCode.theme,
    title: seedCode.title,
    width: seedCode.width,
  },
};

export const Task: Story = {
  args: {
    bodyDoc: seedTask.bodyDoc ?? null,
    bodyHtml: seedTask.bodyHtml,
    id: seedTask.id,
    tapeRotation: seedTask.tapeRotation,
    tapeVariant: "masking",
    theme: seedTask.theme,
    title: seedTask.title,
    width: seedTask.width,
  },
};

export const Media: Story = {
  args: {
    bodyHtml: seedMedia.bodyHtml,
    id: seedMedia.id,
    tapeRotation: seedMedia.tapeRotation,
    tapeVariant: "dark",
    theme: seedMedia.theme,
    title: seedMedia.title,
    width: seedMedia.width,
  },
};
