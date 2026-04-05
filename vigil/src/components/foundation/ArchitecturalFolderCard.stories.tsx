"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalFolderCard } from "@/src/components/foundation/ArchitecturalFolderCard";
import { FOLDER_COLOR_SCHEMES } from "@/src/components/foundation/architectural-folder-schemes";

const meta: Meta<typeof ArchitecturalFolderCard> = {
  title: "Heartgarden/UI/Folder card",
  component: ArchitecturalFolderCard,
  args: {
    id: "folder-story",
    title: "Covenant dossier",
    itemCount: 3,
    previewTitles: [
      "Telemetry sequence log",
      "Antenna timing memo",
      "Propulsion wake note",
    ],
    selected: false,
    dragOver: false,
    folderColorScheme: undefined,
    onOpen: () => {},
    onTitleCommit: () => {},
  },
  argTypes: {
    id: { control: "text" },
    title: { control: "text" },
    itemCount: { control: "number" },
    previewTitles: { control: "object" },
    selected: { control: "boolean" },
    dragOver: { control: "boolean" },
    folderColorScheme: {
      control: "select",
      options: [undefined, ...FOLDER_COLOR_SCHEMES.map((scheme) => scheme.id)],
    },
    onOpen: { control: false },
    onTitleCommit: { control: false },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          position: "relative",
          width: 420,
          height: 340,
          background: "var(--sem-surface-base)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Story />
      </div>
    ),
  ],
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

