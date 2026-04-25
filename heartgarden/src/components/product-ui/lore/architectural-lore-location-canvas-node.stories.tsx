"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalLoreLocationCanvasNode } from "@/src/components/foundation/architectural-lore-location-canvas-node";
import { getLoreNodeSeedBodyHtml } from "@/src/lib/lore-node-seed-html";

const bodyHtml = getLoreNodeSeedBodyHtml("location", "v7");

const meta: Meta<typeof ArchitecturalLoreLocationCanvasNode> = {
  args: {
    activeTool: "select",
    bodyHtml,
    dragged: false,
    id: "story-lore-location-ordo-v7",
    onBodyCommit: () => {
      /* storybook noop */
    },
    selected: true,
    showStaple: true,
    tapeRotation: 2,
  },
  argTypes: {
    activeTool: { control: "radio", options: ["select", "pan"] },
    onBodyCommit: { control: false },
    showStaple: { control: "boolean" },
  },
  component: ArchitecturalLoreLocationCanvasNode,
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--sem-surface-base)",
          minHeight: "100vh",
          padding: 32,
          position: "relative",
          width: "100vw",
        }}
      >
        <div
          data-node-id="story-lore-location-ordo-v7"
          data-space-id="story-space"
          style={{ display: "inline-block" }}
        >
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
  title: "Heartgarden/Product UI/Lore/Lore canvas · location coverage",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalLoreLocationCanvasNode>;

export const CoverageCard: Story = {};

export const WithoutStaple: Story = {
  args: {
    showStaple: false,
  },
};
