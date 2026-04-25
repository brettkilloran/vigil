"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { CommandPalette } from "@/src/components/ui/CommandPalette";
import type { RecentPaletteFolder } from "@/src/hooks/use-recent-folders";
import type { RecentPaletteItem } from "@/src/hooks/use-recent-items";

const now = Date.now();

const mockRecentItems: RecentPaletteItem[] = [
  {
    id: "item-note-1",
    title: "Welcome to this board",
    itemType: "note",
    spaceId: "root",
    spaceName: "Root",
    updatedAt: now,
  },
  {
    id: "item-code-1",
    title: "Sample sync config",
    itemType: "note",
    spaceId: "root",
    spaceName: "Root",
    updatedAt: now - 60_000,
  },
];

const mockRecentFolders: RecentPaletteFolder[] = [
  {
    id: "folder-1",
    title: "Research folder",
    parentSpaceId: "root",
    parentSpaceName: "Root",
    updatedAt: now,
  },
];

const meta = {
  title: "Heartgarden/Product UI/Canvas/Command palette",
  component: CommandPalette,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Cmd+K palette: recent items, folders, spaces, and actions. Remote suggestions load only after two+ characters (hits `/api/search/suggest` in production).",
      },
    },
  },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    open: true,
    onClose: fn(),
    currentSpaceId: "root",
    items: [],
    spaces: [],
    actions: [],
    recentItems: [],
    recentFolders: [],
    onSelectItem: fn(),
    onSelectSpace: fn(),
    onRecordRecentItem: fn(),
    onOpenRecentFolder: fn(),
    onRunAction: fn(),
  },
  render: () => (
    <CommandPalette
      actions={[
        {
          id: "new-note",
          label: "New note",
          keywords: ["create", "note"],
        },
        {
          id: "new-folder",
          label: "New folder",
          keywords: ["create", "folder"],
        },
      ]}
      currentSpaceId="root"
      items={[
        {
          id: "pal-1",
          title: "Try these next",
          itemType: "checklist",
          spaceId: "root",
          spaceName: "Root",
          snippet: "Open the Research folder",
        },
        {
          id: "pal-2",
          title: "Reference image",
          itemType: "image",
          spaceId: "root",
          spaceName: "Root",
        },
      ]}
      onClose={fn()}
      onOpenRecentFolder={fn()}
      onRecordRecentItem={fn()}
      onRunAction={fn()}
      onSelectItem={fn()}
      onSelectSpace={fn()}
      open
      recentFolders={mockRecentFolders}
      recentItems={mockRecentItems}
      spaces={[
        { id: "root", name: "Root", pathLabel: "/" },
        {
          id: "space-project-thesis",
          name: "Research",
          pathLabel: "/Research",
        },
      ]}
    />
  ),
};
