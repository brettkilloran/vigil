"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalLoreCharacterCanvasNode } from "@/src/components/foundation/architectural-lore-character-canvas-node";
import { getLoreNodeSeedBodyHtml } from "@/src/lib/lore-node-seed-html";

const bodyHtml = getLoreNodeSeedBodyHtml("character", "v11");

const meta: Meta<typeof ArchitecturalLoreCharacterCanvasNode> = {
  args: {
    activeTool: "select",
    bodyHtml,
    dragged: false,
    id: "story-lore-character-v11",
    onBodyCommit: () => {
      /* storybook noop */
    },
    selected: true,
    showTape: true,
    tapeRotation: -3,
    tapeVariant: "dark",
  },
  argTypes: {
    activeTool: { control: "radio", options: ["select", "pan"] },
    onBodyCommit: { control: false },
  },
  component: ArchitecturalLoreCharacterCanvasNode,
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
          data-node-id="story-lore-character-v11"
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
  title: "Heartgarden/Product UI/Lore/Lore canvas · character coverage",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalLoreCharacterCanvasNode>;

export const CredentialPlate: Story = {};

export const PanToolChrome: Story = {
  args: {
    activeTool: "pan",
    selected: false,
  },
};
