"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { ArchitecturalToolRail } from "@/src/components/foundation/ArchitecturalToolRail";
import type { CanvasTool } from "@/src/components/foundation/architectural-types";

const meta: Meta<typeof ArchitecturalToolRail> = {
  title: "Heartgarden/Architectural Shell/Components/Tool Rail",
  component: ArchitecturalToolRail,
  args: {
    showSelectPan: true,
    showZoom: true,
    showRecenter: true,
  },
  argTypes: {
    showSelectPan: { control: "boolean" },
    showZoom: { control: "boolean" },
    showRecenter: { control: "boolean" },
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
          height: "100vh",
          background: "var(--sem-surface-base)",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ArchitecturalToolRail>;

export const Default: Story = {
  render: (args) => (
    <ToolRailHarnessWithArgs initialTool="select" args={args} />
  ),
};

export const PanSelected: Story = {
  render: (args) => <ToolRailHarnessWithArgs initialTool="pan" args={args} />,
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
      onSetTool={setTool}
      onZoomIn={() => {}}
      onZoomOut={() => {}}
      onRecenter={() => {}}
      showSelectPan={args.showSelectPan}
      showZoom={args.showZoom}
      showRecenter={args.showRecenter}
    />
  );
}

