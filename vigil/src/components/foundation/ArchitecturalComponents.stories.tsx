"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { ArchitecturalBottomDock } from "@/src/components/foundation/ArchitecturalBottomDock";
import { ArchitecturalNodeCard } from "@/src/components/foundation/ArchitecturalNodeCard";
import { ArchitecturalStatusBar } from "@/src/components/foundation/ArchitecturalStatusBar";
import { ArchitecturalToolRail } from "@/src/components/foundation/ArchitecturalToolRail";
import type {
  CanvasNode,
  CanvasTool,
} from "@/src/components/foundation/architectural-types";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

const noteNode: CanvasNode = {
  id: "story-node-note",
  title: "Project Thesis",
  x: 120,
  y: 80,
  rotation: -1,
  theme: "default",
  tapeRotation: 2,
  bodyHtml: `
    <h1>A Structural Approach</h1>
    <p>Unlike fluid glass interfaces, this environment prioritizes rigid bounds and definitive states.</p>
    <blockquote>Clarity over aesthetic blur. The architecture of thought requires solid foundations.</blockquote>
  `,
};

const checklistNode: CanvasNode = {
  id: "story-node-task",
  title: "Immediate Actions",
  x: 120,
  y: 80,
  rotation: -2,
  width: 280,
  theme: "task",
  tapeRotation: 3,
  bodyHtml: `
    <div class="${styles.taskItem} ${styles.done}">
      <div class="${styles.taskCheckbox}"></div>
      <div class="${styles.taskText}" contenteditable="true">Define variant palette</div>
    </div>
    <div class="${styles.taskItem}">
      <div class="${styles.taskCheckbox}"></div>
      <div class="${styles.taskText}" contenteditable="true">Review typographical hierarchy</div>
    </div>
  `,
};

const codeNode: CanvasNode = {
  id: "story-node-code",
  title: "SYS // Configuration.js",
  x: 120,
  y: 80,
  rotation: 0.5,
  width: 420,
  theme: "code",
  tapeRotation: -1.5,
  bodyHtml: `
    <span style="color: #c678dd;">const</span> <span style="color: #e5c07b;">environment</span> = {<br>
    &nbsp;&nbsp;<span style="color: #d19a66;">mode</span>: <span style="color: #98c379;">'architectural'</span>,<br>
    &nbsp;&nbsp;<span style="color: #d19a66;">friction</span>: <span style="color: #d19a66;">0.85</span>,<br>
    &nbsp;&nbsp;<span style="color: #d19a66;">snapToGrid</span>: <span style="color: #c678dd;">false</span>,<br>
    &nbsp;&nbsp;<span style="color: #d19a66;">theme</span>: {<br>
    &nbsp;&nbsp;&nbsp;&nbsp;base: <span style="color: #98c379;">'#0a0a0c'</span>,<br>
    &nbsp;&nbsp;&nbsp;&nbsp;accent: <span style="color: #98c379;">'#3b82f6'</span><br>
    &nbsp;&nbsp;}<br>
    };<br><br>
    <span style="color: #5c6370;">// Awaiting secondary confirmation...</span>
  `,
};

const mediaNode: CanvasNode = {
  id: "story-node-media",
  title: "Reference // Structural",
  x: 120,
  y: 80,
  rotation: 1,
  theme: "media",
  tapeRotation: -2.5,
  bodyHtml: `
    <div class="${styles.mediaPlaceholder}">
      <span>Image Placeholder</span>
    </div>
    <div contenteditable="true" style="font-size: 13px; color: #555;">
      Brutalist web design pattern reference. Note the heavy borders and lack of border-radius.
    </div>
  `,
};

function ComponentStage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "#0a0a0c",
      }}
    >
      {children}
    </div>
  );
}

const meta: Meta = {
  title: "Architectural Shell/Extracted Components",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj;

export const NodeCardDefault: Story = {
  render: () => (
    <ComponentStage>
      <ArchitecturalNodeCard
        node={noteNode}
        activeTool="select"
        dragged={false}
        selected
        zIndex={2}
        onBodyInput={() => {}}
        onExpand={() => {}}
      />
    </ComponentStage>
  ),
};

export const NodeCardChecklist: Story = {
  render: () => (
    <ComponentStage>
      <ArchitecturalNodeCard
        node={checklistNode}
        activeTool="select"
        dragged={false}
        selected
        zIndex={2}
        onBodyInput={() => {}}
        onExpand={() => {}}
      />
    </ComponentStage>
  ),
};

export const NodeCardCode: Story = {
  render: () => (
    <ComponentStage>
      <ArchitecturalNodeCard
        node={codeNode}
        activeTool="select"
        dragged={false}
        selected
        zIndex={2}
        onBodyInput={() => {}}
        onExpand={() => {}}
      />
    </ComponentStage>
  ),
};

export const NodeCardMedia: Story = {
  render: () => (
    <ComponentStage>
      <ArchitecturalNodeCard
        node={mediaNode}
        activeTool="select"
        dragged={false}
        selected
        zIndex={2}
        onBodyInput={() => {}}
        onExpand={() => {}}
      />
    </ComponentStage>
  ),
};

export const StatusBar: Story = {
  render: () => (
    <ComponentStage>
      <ArchitecturalStatusBar centerWorldX={0} centerWorldY={0} scale={1} />
    </ComponentStage>
  ),
};

export const BottomDock: Story = {
  render: () => (
    <ComponentStage>
      <ArchitecturalBottomDock onFormat={() => {}} onCreateNode={() => {}} />
    </ComponentStage>
  ),
};

export const ToolRail: Story = {
  render: () => {
    const [tool, setTool] = useState<CanvasTool>("select");
    return (
      <ComponentStage>
        <ArchitecturalToolRail
          activeTool={tool}
          onSetTool={setTool}
          onZoomIn={() => {}}
          onZoomOut={() => {}}
          onRecenter={() => {}}
        />
      </ComponentStage>
    );
  },
};
