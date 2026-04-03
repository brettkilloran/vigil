import type {
  CanvasEntity,
  CanvasContentEntity,
  CanvasGraph,
  CanvasNode,
  CanvasSpace,
} from "@/src/components/foundation/architectural-types";

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
      tapeVariant: "masking",
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
      width: 340,
      theme: "code",
      tapeRotation: -1.5,
      tapeVariant: "dark",
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
      width: 340,
      theme: "task",
      tapeRotation: 3,
      tapeVariant: "masking",
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
      tapeVariant: "clear",
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

function createContentSeedMap(tokens: StyleTokens): Record<string, CanvasEntity> {
  const nodes = buildArchitecturalSeedNodes(tokens);
  return Object.fromEntries(
    nodes.map((node) => [
      node.id,
      {
        ...node,
        kind: "content",
        slots: {
          root: { x: node.x, y: node.y },
        },
      } satisfies CanvasContentEntity,
    ]),
  ) as Record<string, CanvasEntity>;
}

export function buildArchitecturalSeedGraph(
  tokens: StyleTokens,
  scenario: "default" | "nested" | "corrupt" = "default",
): CanvasGraph {
  const entities = createContentSeedMap(tokens);
  const spaces: Record<string, CanvasSpace> = {
    root: {
      id: "root",
      name: "Root",
      parentSpaceId: null,
      entityIds: ["node-1", "node-2", "node-3", "node-4", "folder-1"],
    },
    "space-project-thesis": {
      id: "space-project-thesis",
      name: "Project Thesis",
      parentSpaceId: "root",
      entityIds: [],
    },
  };

  entities["folder-1"] = {
    id: "folder-1",
    title: "Project Thesis",
    kind: "folder",
    theme: "folder",
    childSpaceId: "space-project-thesis",
    rotation: -1.1,
    width: 340,
    tapeRotation: 0,
    slots: {
      root: { x: -430, y: -40 },
    },
  };

  if (entities["node-3"]) {
    entities["node-3"] = {
      ...entities["node-3"],
      slots: {
        ...entities["node-3"].slots,
        "space-project-thesis": { x: -100, y: 30 },
      },
    };
  }

  spaces["space-project-thesis"].entityIds.push("node-3");

  if (scenario === "nested") {
    spaces["space-subsystems"] = {
      id: "space-subsystems",
      name: "Subsystems",
      parentSpaceId: "space-project-thesis",
      entityIds: ["nested-note-1"],
    };

    entities["folder-2"] = {
      id: "folder-2",
      title: "Subsystems",
      kind: "folder",
      theme: "folder",
      childSpaceId: "space-subsystems",
      rotation: 0.5,
      width: 340,
      tapeRotation: 0,
      slots: {
        "space-project-thesis": { x: 220, y: -140 },
      },
    };

    entities["nested-note-1"] = {
      id: "nested-note-1",
      title: "Nested Note",
      kind: "content",
      theme: "default",
      rotation: -0.6,
      tapeRotation: 1.2,
      tapeVariant: "clear",
      bodyHtml:
        "<p>This note lives one level deeper to validate recursive folders and breadcrumb navigation.</p>",
      slots: {
        "space-subsystems": { x: -60, y: -20 },
      },
    };

    spaces["space-project-thesis"].entityIds.push("folder-2");
  }

  if (scenario === "corrupt") {
    entities["folder-1"] = {
      ...entities["folder-1"],
      childSpaceId: "missing-space-id",
    };
  }

  return {
    rootSpaceId: "root",
    spaces,
    entities,
  };
}
