"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  ArchitecturalCreateMenu,
  DEFAULT_CREATE_ACTIONS,
} from "@/src/components/foundation/ArchitecturalBottomDock";

const meta: Meta<typeof ArchitecturalCreateMenu> = {
  title: "Architectural Shell/Primitives/Create Menu",
  component: ArchitecturalCreateMenu,
  args: {
    actions: DEFAULT_CREATE_ACTIONS,
    onCreateNode: () => {},
  },
  argTypes: {
    actions: { control: "object" },
    onCreateNode: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ background: "var(--sem-surface-base)", padding: 20 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ArchitecturalCreateMenu>;

export const Default: Story = {};
