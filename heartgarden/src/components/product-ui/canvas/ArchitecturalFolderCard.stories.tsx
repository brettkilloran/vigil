"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalFolderCard } from "@/src/components/foundation/ArchitecturalFolderCard";
import { FOLDER_COLOR_SCHEMES } from "@/src/components/foundation/architectural-folder-schemes";

const meta: Meta<typeof ArchitecturalFolderCard> = {
  args: {
    dragOver: false,
    folderColorScheme: undefined,
    id: "folder-story",
    itemCount: 3,
    onOpen: () => {},
    onTitleCommit: () => {},
    previewTitles: ["Source list", "Snippet: normalizer", "Archive"],
    selected: false,
    title: "Research folder",
  },
  argTypes: {
    dragOver: { control: "boolean" },
    folderColorScheme: {
      control: "select",
      options: [undefined, ...FOLDER_COLOR_SCHEMES.map((scheme) => scheme.id)],
    },
    id: { control: "text" },
    itemCount: { control: "number" },
    onOpen: { control: false },
    onTitleCommit: { control: false },
    previewTitles: { control: "object" },
    selected: { control: "boolean" },
    title: { control: "text" },
  },
  component: ArchitecturalFolderCard,
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--sem-surface-base)",
          display: "grid",
          height: 340,
          placeItems: "center",
          position: "relative",
          width: 420,
        }}
      >
        <Story />
      </div>
    ),
  ],
  title: "Heartgarden/Product UI/Canvas/Folder card",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalFolderCard>;

export const Default: Story = {};

export const Selected: Story = {
  args: {
    selected: true,
  },
};

export const DragOver: Story = {
  args: {
    dragOver: true,
  },
};
