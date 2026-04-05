"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalNodeBody } from "@/src/components/foundation/ArchitecturalNodeCard";

const meta: Meta<typeof ArchitecturalNodeBody> = {
  title: "Heartgarden/UI/Node body",
  component: ArchitecturalNodeBody,
  args: {
    html: "<h1>The ring does not forgive nostalgia.</h1><p>Body content with rich text html.</p>",
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
      <div style={{ width: 360, minHeight: 220, background: "var(--theme-default-bg)", color: "var(--theme-default-text)" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ArchitecturalNodeBody>;

export const Default: Story = {};

