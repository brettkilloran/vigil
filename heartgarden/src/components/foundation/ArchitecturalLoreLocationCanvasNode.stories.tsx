"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalLoreLocationCanvasNode } from "@/src/components/foundation/ArchitecturalLoreLocationCanvasNode";
import { getLoreNodeSeedBodyHtml } from "@/src/lib/lore-node-seed-html";

const bodyHtml = getLoreNodeSeedBodyHtml("location", "v7");

const meta: Meta<typeof ArchitecturalLoreLocationCanvasNode> = {
  title: "Heartgarden/UI/Lore canvas · location coverage",
  component: ArchitecturalLoreLocationCanvasNode,
  args: {
    id: "story-lore-location-ordo-v7",
    tapeRotation: 2,
    bodyHtml,
    activeTool: "select",
    dragged: false,
    selected: true,
    onBodyCommit: () => {},
    showStaple: true,
  },
  argTypes: {
    activeTool: { control: "radio", options: ["select", "pan"] },
    onBodyCommit: { control: false },
    showStaple: { control: "boolean" },
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
          minHeight: "100vh",
          background: "var(--sem-surface-base)",
          padding: 32,
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
};

export default meta;
type Story = StoryObj<typeof ArchitecturalLoreLocationCanvasNode>;

export const CoverageCard: Story = {};

export const WithoutStaple: Story = {
  args: {
    showStaple: false,
  },
};
