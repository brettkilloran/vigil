"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ArchitecturalNodeBody } from "@/src/components/foundation/ArchitecturalNodeCard";

const meta: Meta<typeof ArchitecturalNodeBody> = {
  title: "Architectural Shell/Primitives/Node Body",
  component: ArchitecturalNodeBody,
  args: {
    html: "<h1>A Structural Approach</h1><p>Body content with rich text html.</p>",
    editable: true,
    spellCheck: false,
    onHtmlCommit: () => {},
  },
  argTypes: {
    html: { control: "text" },
    editable: { control: "boolean" },
    spellCheck: { control: "boolean" },
    onHtmlCommit: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360, minHeight: 220, background: "#f4f2ec", color: "#1a1a1a" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ArchitecturalNodeBody>;

export const Default: Story = {};
