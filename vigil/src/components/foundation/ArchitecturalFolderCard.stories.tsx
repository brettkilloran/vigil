"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ArchitecturalFolderCard } from "@/src/components/foundation/ArchitecturalFolderCard";

const meta: Meta<typeof ArchitecturalFolderCard> = {
  title: "Architectural Shell/Components/Folder Card",
  component: ArchitecturalFolderCard,
  args: {
    id: "folder-story",
    title: "Covenant dossier",
    itemCount: 3,
    selected: false,
    dragOver: false,
    onOpen: () => {},
    onTitleCommit: () => {},
  },
  argTypes: {
    id: { control: "text" },
    title: { control: "text" },
    itemCount: { control: "number" },
    selected: { control: "boolean" },
    dragOver: { control: "boolean" },
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
