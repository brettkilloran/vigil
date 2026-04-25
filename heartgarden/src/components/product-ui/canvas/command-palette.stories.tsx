"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { CommandPalette } from "@/src/components/ui/command-palette";
import type { RecentPaletteFolder } from "@/src/hooks/use-recent-folders";
import type { RecentPaletteItem } from "@/src/hooks/use-recent-items";

const now = Date.now();

const mockRecentItems: RecentPaletteItem[] = [
  {
    id: "item-note-1",
    itemType: "note",
    spaceId: "root",
    spaceName: "Root",
    title: "Welcome to this board",
    updatedAt: now,
  },
  {
    id: "item-code-1",
    itemType: "note",
    spaceId: "root",
    spaceName: "Root",
    title: "Sample sync config",
    updatedAt: now - 60_000,
  },
];

const mockRecentFolders: RecentPaletteFolder[] = [
  {
    id: "folder-1",
    parentSpaceId: "root",
    parentSpaceName: "Root",
    title: "Research folder",
    updatedAt: now,
  },
];

const meta = {
  component: CommandPalette,
  parameters: {
    docs: {
      description: {
        component:
          "Cmd+K palette: recent items, folders, spaces, and actions. Remote suggestions load only after two+ characters (hits `/api/search/suggest` in production).",
      },
    },
    layout: "fullscreen",
  },
  title: "Heartgarden/Product UI/Canvas/Command palette",
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    actions: [],
    currentSpaceId: "root",
    items: [],
    onClose: fn(),
    onOpenRecentFolder: fn(),
    onRecordRecentItem: fn(),
    onRunAction: fn(),
    onSelectItem: fn(),
    onSelectSpace: fn(),
    open: true,
    recentFolders: [],
    recentItems: [],
    spaces: [],
  },
  render: () => (
    <CommandPalette
      actions={[
        {
          id: "new-note",
          keywords: ["create", "note"],
          label: "New note",
        },
        {
          id: "new-folder",
          keywords: ["create", "folder"],
          label: "New folder",
        },
      ]}
      currentSpaceId="root"
      items={[
        {
          id: "pal-1",
          itemType: "checklist",
          snippet: "Open the Research folder",
          spaceId: "root",
          spaceName: "Root",
          title: "Try these next",
        },
        {
          id: "pal-2",
          itemType: "image",
          spaceId: "root",
          spaceName: "Root",
          title: "Reference image",
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
