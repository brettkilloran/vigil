"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalLoreFactionArchiveCanvasNode } from "@/src/components/foundation/ArchitecturalLoreFactionArchiveCanvasNode";
import { createDefaultFactionRosterSeed } from "@/src/lib/faction-roster-link";
import { getLoreNodeSeedBodyHtml } from "@/src/lib/lore-node-seed-html";

const bodyHtml = getLoreNodeSeedBodyHtml("faction", "v4");
const factionRoster = createDefaultFactionRosterSeed();

const meta: Meta<typeof ArchitecturalLoreFactionArchiveCanvasNode> = {
  args: {
    activeTool: "select",
    bodyHtml,
    dragged: false,
    factionRoster,
    id: "story-lore-faction-archive091",
    onBodyCommit: () => {},
    selected: true,
    showTape: true,
    tapeRotation: 4,
    tapeVariant: "dark",
  },
  argTypes: {
    activeTool: { control: "radio", options: ["select", "pan"] },
    onBodyCommit: { control: false },
  },
  component: ArchitecturalLoreFactionArchiveCanvasNode,
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
          data-node-id="story-lore-faction-archive091"
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
  title: "Heartgarden/Product UI/Lore/Lore canvas · organization coverage",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalLoreFactionArchiveCanvasNode>;

export const ArchiveSlab: Story = {};
