"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ArchitecturalNodeCard } from "@/src/components/foundation/ArchitecturalNodeCard";
import { buildArchitecturalSeedNodes } from "@/src/components/foundation/architectural-seed";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

const seedNodes = buildArchitecturalSeedNodes({
  taskItem: styles.taskItem,
  done: styles.done,
  taskCheckbox: styles.taskCheckbox,
  taskText: styles.taskText,
  mediaPlaceholder: styles.mediaPlaceholder,
});

function getSeed(theme: "default" | "code" | "task" | "media") {
  const node = seedNodes.find((item) => item.theme === theme);
  if (!node) throw new Error(`Missing seed node for theme: ${theme}`);
  return node;
}

const seedDefault = getSeed("default");
const seedCode = getSeed("code");
const seedTask = getSeed("task");
const seedMedia = getSeed("media");

const meta: Meta<typeof ArchitecturalNodeCard> = {
  title: "Architectural Shell/Components/Node Card",
  component: ArchitecturalNodeCard,
  args: {
    id: seedDefault.id,
    title: seedDefault.title,
    width: seedDefault.width ?? 340,
    theme: seedDefault.theme,
    tapeRotation: seedDefault.tapeRotation,
    bodyHtml: seedDefault.bodyHtml,
    activeTool: "select",
    dragged: false,
    selected: true,
    onBodyInput: () => {},
    onExpand: () => {},
    showExpandButton: true,
    tapeVariant: "clear",
  },
  argTypes: {
    activeTool: {
      control: "radio",
      options: ["select", "pan"],
    },
    onBodyInput: { control: false },
    onExpand: { control: false },
    bodyHtml: { control: "text" },
    title: { control: "text" },
    theme: { control: "radio", options: ["default", "code", "task", "media"] },
    tapeVariant: { control: "radio", options: ["clear", "masking", "dark"] },
    width: { control: "number" },
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
type Story = StoryObj<typeof ArchitecturalNodeCard>;

export const Default: Story = {};

export const Code: Story = {
  args: {
    id: seedCode.id,
    title: seedCode.title,
    width: seedCode.width,
    theme: seedCode.theme,
    tapeRotation: seedCode.tapeRotation,
    bodyHtml: seedCode.bodyHtml,
    tapeVariant: "dark",
  },
};

export const Task: Story = {
  args: {
    id: seedTask.id,
    title: seedTask.title,
    width: seedTask.width,
    theme: seedTask.theme,
    tapeRotation: seedTask.tapeRotation,
    bodyHtml: seedTask.bodyHtml,
    tapeVariant: "masking",
  },
};

export const Media: Story = {
  args: {
    id: seedMedia.id,
    title: seedMedia.title,
    width: seedMedia.width,
    theme: seedMedia.theme,
    tapeRotation: seedMedia.tapeRotation,
    bodyHtml: seedMedia.bodyHtml,
    tapeVariant: "clear",
  },
};
