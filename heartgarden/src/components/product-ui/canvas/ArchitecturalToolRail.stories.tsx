"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { ArchitecturalToolRail } from "@/src/components/foundation/ArchitecturalToolRail";
import type { CanvasTool } from "@/src/components/foundation/architectural-types";

const meta: Meta<typeof ArchitecturalToolRail> = {
  args: {
    showRecenter: true,
    showSelectPan: true,
    showZoom: true,
  },
  argTypes: {
    showRecenter: { control: "boolean" },
    showSelectPan: { control: "boolean" },
    showZoom: { control: "boolean" },
  },
  component: ArchitecturalToolRail,
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--sem-surface-base)",
          height: "100vh",
          position: "relative",
          width: "100vw",
        }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
  title: "Heartgarden/Product UI/Canvas/Tool rail",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalToolRail>;

export const Default: Story = {
  render: (args) => (
    <ToolRailHarnessWithArgs args={args} initialTool="select" />
  ),
};

export const PanSelected: Story = {
  render: (args) => <ToolRailHarnessWithArgs args={args} initialTool="pan" />,
};

function ToolRailHarnessWithArgs({
  initialTool,
  args,
}: {
  initialTool: CanvasTool;
  args: {
    showSelectPan?: boolean;
    showZoom?: boolean;
    showRecenter?: boolean;
  };
}) {
  const [tool, setTool] = useState<CanvasTool>(initialTool);
  return (
    <ArchitecturalToolRail
      activeTool={tool}
      onRecenter={() => {}}
      onSetTool={setTool}
      onZoomIn={() => {}}
      onZoomOut={() => {}}
      showRecenter={args.showRecenter}
      showSelectPan={args.showSelectPan}
      showZoom={args.showZoom}
    />
  );
}
