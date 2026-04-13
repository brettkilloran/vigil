"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { CanvasMinimap } from "@/src/components/foundation/CanvasMinimap";
import type { CanvasGraph } from "@/src/components/foundation/architectural-types";
import { buildCollapsedStacksList, minimapLayoutSignature } from "@/src/lib/canvas-view-bounds";

const SPACE = "space-1";

const mockGraph: CanvasGraph = {
  rootSpaceId: SPACE,
  spaces: {
    [SPACE]: {
      id: SPACE,
      name: "Garden",
      parentSpaceId: null,
      entityIds: ["n1", "n2", "n3", "n4"],
    },
  },
  entities: {
    n1: {
      id: "n1",
      kind: "content",
      title: "Alpha",
      theme: "default",
      rotation: 0,
      tapeRotation: 0,
      tapeVariant: "clear",
      bodyHtml: "",
      stackId: null,
      stackOrder: null,
      slots: { [SPACE]: { x: 40, y: 60 } },
    },
    n2: {
      id: "n2",
      kind: "content",
      title: "Beta",
      theme: "default",
      rotation: 12,
      width: 300,
      tapeRotation: 0,
      tapeVariant: "clear",
      bodyHtml: "",
      stackId: null,
      stackOrder: null,
      slots: { [SPACE]: { x: 520, y: 180 } },
    },
    n3: {
      id: "n3",
      kind: "content",
      title: "Stack bottom",
      theme: "task",
      rotation: 0,
      tapeRotation: 0,
      tapeVariant: "clear",
      bodyHtml: "",
      stackId: "st1",
      stackOrder: 0,
      slots: { [SPACE]: { x: 900, y: 400 } },
    },
    n4: {
      id: "n4",
      kind: "content",
      title: "Stack top",
      theme: "task",
      rotation: 0,
      tapeRotation: 0,
      tapeVariant: "clear",
      bodyHtml: "",
      stackId: "st1",
      stackOrder: 1,
      slots: { [SPACE]: { x: 900, y: 400 } },
    },
  },
  connections: {},
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
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "var(--sem-surface-base, #0f1419)",
        padding: 24,
      }}
    >
      <CanvasMinimap
        graph={mockGraph}
        layoutSignature={mockMinimapLayoutKey}
        activeSpaceId={SPACE}
        collapsedStacks={collapsed}
        translateX={translateX}
        translateY={translateY}
        scale={scale}
        viewportWidth={960}
        viewportHeight={640}
        selectedNodeIds={["n2"]}
        minZoom={0.3}
        maxZoom={3}
        onPanWorldDelta={(dw, dh) => {
          setTranslateX((x) => x - dw * scale);
          setTranslateY((y) => y - dh * scale);
        }}
        onCenterOnWorld={(wx, wy) => {
          setTranslateX(960 / 2 - wx * scale);
          setTranslateY(640 / 2 - wy * scale);
        }}
        onFitAll={() => {
          setScale(0.35);
          setTranslateX(100);
          setTranslateY(60);
        }}
      />
      <p style={{ marginTop: 16, fontSize: 12, color: "var(--vigil-muted, #8a93a3)" }}>
        Mock camera: scale {scale.toFixed(2)}, translate ({Math.round(translateX)}, {Math.round(translateY)}).
        Double-click background resets demo fit.
      </p>
    </div>
  );
}

const meta: Meta<typeof MinimapDemo> = {
  title: "Heartgarden/Foundation/Canvas minimap",
  component: MinimapDemo,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof MinimapDemo>;

export const Default: Story = {
  render: () => <MinimapDemo />,
};
