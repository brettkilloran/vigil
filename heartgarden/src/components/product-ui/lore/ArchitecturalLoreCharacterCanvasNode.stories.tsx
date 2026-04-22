"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalLoreCharacterCanvasNode } from "@/src/components/foundation/ArchitecturalLoreCharacterCanvasNode";
import { getLoreNodeSeedBodyHtml } from "@/src/lib/lore-node-seed-html";

const bodyHtml = getLoreNodeSeedBodyHtml("character", "v11");

const meta: Meta<typeof ArchitecturalLoreCharacterCanvasNode> = {
  title: "Heartgarden/Product UI/Lore/Lore canvas · character coverage",
  component: ArchitecturalLoreCharacterCanvasNode,
  args: {
    id: "story-lore-character-v11",
    tapeRotation: -3,
    bodyHtml,
    activeTool: "select",
    dragged: false,
    selected: true,
    onBodyCommit: () => {},
    tapeVariant: "dark",
    showTape: true,
  },
  argTypes: {
    activeTool: { control: "radio", options: ["select", "pan"] },
    onBodyCommit: { control: false },
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
          data-node-id="story-lore-character-v11"
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
type Story = StoryObj<typeof ArchitecturalLoreCharacterCanvasNode>;

export const CredentialPlate: Story = {};

export const PanToolChrome: Story = {
  args: {
    activeTool: "pan",
    selected: false,
  },
};
