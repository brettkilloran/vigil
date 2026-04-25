"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import type { CanvasGraph } from "@/src/components/foundation/architectural-types";
import { CanvasMinimap } from "@/src/components/foundation/CanvasMinimap";
import {
  buildCollapsedStacksList,
  minimapLayoutSignature,
} from "@/src/lib/canvas-view-bounds";

const SPACE = "space-1";

const mockGraph: CanvasGraph = {
  connections: {},
  entities: {
    n1: {
      bodyHtml: "",
      id: "n1",
      kind: "content",
      rotation: 0,
      slots: { [SPACE]: { x: 40, y: 60 } },
      stackId: null,
      stackOrder: null,
      tapeRotation: 0,
      tapeVariant: "clear",
      theme: "default",
      title: "Alpha",
    },
    n2: {
      bodyHtml: "",
      id: "n2",
      kind: "content",
      rotation: 12,
      slots: { [SPACE]: { x: 520, y: 180 } },
      stackId: null,
      stackOrder: null,
      tapeRotation: 0,
      tapeVariant: "clear",
      theme: "default",
      title: "Beta",
      width: 300,
    },
    n3: {
      bodyHtml: "",
      id: "n3",
      kind: "content",
      rotation: 0,
      slots: { [SPACE]: { x: 900, y: 400 } },
      stackId: "st1",
      stackOrder: 0,
      tapeRotation: 0,
      tapeVariant: "clear",
      theme: "task",
      title: "Stack bottom",
    },
    n4: {
      bodyHtml: "",
      id: "n4",
      kind: "content",
      rotation: 0,
      slots: { [SPACE]: { x: 900, y: 400 } },
      stackId: "st1",
      stackOrder: 1,
      tapeRotation: 0,
      tapeVariant: "clear",
      theme: "task",
      title: "Stack top",
    },
  },
  rootSpaceId: SPACE,
  spaces: {
    [SPACE]: {
      entityIds: ["n1", "n2", "n3", "n4"],
      id: SPACE,
      name: "Garden",
      parentSpaceId: null,
    },
  },
};

const collapsed = buildCollapsedStacksList(mockGraph, SPACE);
const mockMinimapLayoutKey = minimapLayoutSignature(mockGraph, SPACE);

function MinimapDemo() {
  const [translateX, setTranslateX] = useState(120);
  const [translateY, setTranslateY] = useState(80);
  const [scale, setScale] = useState(0.45);

  return (
    <div
      style={{
        background: "var(--sem-surface-base, #0f1419)",
        height: "100vh",
        padding: 24,
        position: "relative",
        width: "100vw",
      }}
    >
      <CanvasMinimap
        activeSpaceId={SPACE}
        collapsedStacks={collapsed}
        graph={mockGraph}
        layoutSignature={mockMinimapLayoutKey}
        maxZoom={3}
        minZoom={0.3}
        onCenterOnWorld={(wx, wy) => {
          setTranslateX(960 / 2 - wx * scale);
          setTranslateY(640 / 2 - wy * scale);
        }}
        onFitAll={() => {
          setScale(0.35);
          setTranslateX(100);
          setTranslateY(60);
        }}
        onPanWorldDelta={(dw, dh) => {
          setTranslateX((x) => x - dw * scale);
          setTranslateY((y) => y - dh * scale);
        }}
        scale={scale}
        selectedNodeIds={["n2"]}
        translateX={translateX}
        translateY={translateY}
        viewportHeight={640}
        viewportWidth={960}
      />
      <p
        style={{
          color: "var(--vigil-muted, #8a93a3)",
          fontSize: 12,
          marginTop: 16,
        }}
      >
        Mock camera: scale {scale.toFixed(2)}, translate (
        {Math.round(translateX)}, {Math.round(translateY)}). Double-click
        background resets demo fit.
      </p>
    </div>
  );
}

const meta: Meta<typeof MinimapDemo> = {
  component: MinimapDemo,
  parameters: {
    layout: "fullscreen",
  },
  title: "Heartgarden/Product UI/Canvas/Canvas minimap",
};

export default meta;

type Story = StoryObj<typeof MinimapDemo>;

export const Default: Story = {
  render: () => <MinimapDemo />,
};
