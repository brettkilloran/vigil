"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalLoreFactionArchiveCanvasNode } from "@/src/components/foundation/ArchitecturalLoreFactionArchiveCanvasNode";
import { createDefaultFactionRosterSeed } from "@/src/lib/faction-roster-link";
import { getLoreNodeSeedBodyHtml } from "@/src/lib/lore-node-seed-html";

const bodyHtml = getLoreNodeSeedBodyHtml("faction", "v4");
const factionRoster = createDefaultFactionRosterSeed();

const meta: Meta<typeof ArchitecturalLoreFactionArchiveCanvasNode> = {
  title: "Heartgarden/Product UI/Lore/Lore canvas · organization coverage",
  component: ArchitecturalLoreFactionArchiveCanvasNode,
  args: {
    id: "story-lore-faction-archive091",
    tapeRotation: 4,
    bodyHtml,
    factionRoster,
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
          data-node-id="story-lore-faction-archive091"
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
type Story = StoryObj<typeof ArchitecturalLoreFactionArchiveCanvasNode>;

export const ArchiveSlab: Story = {};
