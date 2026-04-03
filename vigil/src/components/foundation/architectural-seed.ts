import type { CanvasNode } from "@/src/components/foundation/architectural-types";

type StyleTokens = {
  taskItem: string;
  done: string;
  taskCheckbox: string;
  taskText: string;
  mediaPlaceholder: string;
};

export function buildArchitecturalSeedNodes(tokens: StyleTokens): CanvasNode[] {
  return [
    {
      id: "node-1",
      title: "Project Thesis",
      x: -300,
      y: -320,
      rotation: -1,
      theme: "default",
      tapeRotation: 2,
      bodyHtml: `
        <h1>A Structural Approach</h1>
        <p>Unlike fluid glass interfaces, this environment prioritizes rigid bounds and definitive states. It feels more like arranging physical blueprints than floating digital clouds.</p>
        <blockquote>Clarity over aesthetic blur. The architecture of thought requires solid foundations.</blockquote>
        <p>Notice the crosshair grid-it implies precision and measurement rather than passive atmosphere.</p>
      `,
    },
    {
      id: "node-2",
      title: "SYS // Configuration.js",
      x: 140,
      y: -210,
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
    },
    {
      id: "node-3",
      title: "Immediate Actions",
      x: 240,
      y: 210,
      rotation: -2,
      width: 280,
      theme: "task",
      tapeRotation: 3,
      bodyHtml: `
        <div class="${tokens.taskItem} ${tokens.done}">
          <div class="${tokens.taskCheckbox}"></div>
          <div class="${tokens.taskText}" contenteditable="true">Define variant palette</div>
        </div>
        <div class="${tokens.taskItem} ${tokens.done}">
          <div class="${tokens.taskCheckbox}"></div>
          <div class="${tokens.taskText}" contenteditable="true">Implement tape randomization</div>
        </div>
        <div class="${tokens.taskItem}">
          <div class="${tokens.taskCheckbox}"></div>
          <div class="${tokens.taskText}" contenteditable="true">Build "Focus Mode" overlay</div>
        </div>
        <div class="${tokens.taskItem}">
          <div class="${tokens.taskCheckbox}"></div>
          <div class="${tokens.taskText}" contenteditable="true">Review typographical hierarchy</div>
        </div>
      `,
    },
    {
      id: "node-4",
      title: "Reference // Structural",
      x: -200,
      y: 310,
      rotation: 1,
      theme: "media",
      tapeRotation: -2.5,
      bodyHtml: `
        <div class="${tokens.mediaPlaceholder}">
          <span>Image Placeholder</span>
        </div>
        <div contenteditable="true" style="font-size: 13px; color: #555;">
          Brutalist web design pattern reference. Note the heavy borders and lack of border-radius.
        </div>
      `,
    },
  ];
}
