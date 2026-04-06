import {
  ROOT_SPACE_DISPLAY_NAME,
  type CanvasEntity,
  type CanvasContentEntity,
  type CanvasGraph,
  type CanvasNode,
  type CanvasSpace,
} from "@/src/components/foundation/architectural-types";
import { DS_COLOR } from "@/src/lib/design-system-tokens";

type StyleTokens = {
  taskItem: string;
  done: string;
  taskCheckbox: string;
  taskText: string;
  mediaFrame: string;
  mediaImage: string;
  mediaImageActions: string;
  mediaUploadBtn: string;
};

export function buildArchitecturalSeedNodes(tokens: StyleTokens): CanvasNode[] {
  return [
    {
      id: "node-1",
      title: "Welcome to this board",
      x: -140,
      y: -463,
      rotation: -2.6,
      theme: "default",
      tapeRotation: -2.2,
      tapeVariant: "masking",
      bodyHtml: `
        <h1>Start here</h1>
        <p>Heartgarden is a canvas for notes, tasks, images, and nested spaces. Drag cards, open folders to move inward, and use the trail at the top to climb back out.</p>
        <blockquote>Everything saves to the workspace you are signed into. Pinch or scroll to zoom; drag the background to pan.</blockquote>
        <p>Open the <strong>Research folder</strong> on the right when you are ready—the cards inside are different from what you see out here, so nothing is duplicated for the sake of a demo.</p>
      `,
    },
    {
      id: "node-2",
      title: "Sample sync config",
      x: 325,
      y: -334,
      rotation: 2.4,
      width: 340,
      theme: "code",
      tapeRotation: 2.8,
      tapeVariant: "dark",
      bodyHtml: `
        <span style="color: ${DS_COLOR.codeSampleComment};">// Example: how a small client might describe its session</span><br>
        <span style="color: ${DS_COLOR.codeSampleKeyword};">export const</span> <span style="color: ${DS_COLOR.codeSampleName};">workspaceSession</span> = {<br>
        &nbsp;&nbsp;<span style="color: ${DS_COLOR.codeSampleProperty};">id</span>: <span style="color: ${DS_COLOR.codeSampleString};">'hg-demo-01'</span>,<br>
        &nbsp;&nbsp;<span style="color: ${DS_COLOR.codeSampleProperty};">region</span>: <span style="color: ${DS_COLOR.codeSampleString};">'us-east'</span>,<br>
        &nbsp;&nbsp;<span style="color: ${DS_COLOR.codeSampleProperty};">lastSyncedAt</span>: <span style="color: ${DS_COLOR.codeSampleKeyword};">new</span> <span style="color: ${DS_COLOR.codeSampleName};">Date</span>(<span style="color: ${DS_COLOR.codeSampleString};">'2026-04-01T12:00:00Z'</span>),<br>
        &nbsp;&nbsp;<span style="color: ${DS_COLOR.codeSampleProperty};">status</span>: <span style="color: ${DS_COLOR.codeSampleString};">'idle'</span>,<br>
        } <span style="color: ${DS_COLOR.codeSampleKeyword};">as const</span>;<br>
      `,
    },
    {
      id: "node-3",
      title: "Try these next",
      x: 262,
      y: 108,
      rotation: -3.1,
      width: 340,
      theme: "task",
      tapeRotation: -2.4,
      tapeVariant: "masking",
      bodyHtml: `
        <div class="${tokens.taskItem} ${tokens.done}" contenteditable="false">
          <div class="${tokens.taskCheckbox}" contenteditable="false"></div>
          <div class="${tokens.taskText}" contenteditable="true">Pan and zoom until the layout feels comfortable</div>
        </div>
        <div class="${tokens.taskItem} ${tokens.done}" contenteditable="false">
          <div class="${tokens.taskCheckbox}" contenteditable="false"></div>
          <div class="${tokens.taskText}" contenteditable="true">Double-click the background to create a quick note</div>
        </div>
        <div class="${tokens.taskItem}" contenteditable="false">
          <div class="${tokens.taskCheckbox}" contenteditable="false"></div>
          <div class="${tokens.taskText}" contenteditable="true">Open the Research folder and read the cards one level down</div>
        </div>
        <div class="${tokens.taskItem}" contenteditable="false">
          <div class="${tokens.taskCheckbox}" contenteditable="false"></div>
          <div class="${tokens.taskText}" contenteditable="true">Use search (keyboard shortcut in the status bar) when the board grows</div>
        </div>
      `,
    },
    {
      id: "node-4",
      title: "Reference image",
      x: -202,
      y: 106,
      rotation: 2.2,
      width: 340,
      theme: "media",
      tapeRotation: 1.6,
      tapeVariant: "dark",
      bodyHtml: `
        <div class="${tokens.mediaFrame}" data-architectural-media-root="true">
          <img class="${tokens.mediaImage}" src="/caliginia-sphere.png" alt="Abstract sphere render used as sample media" />
          <div class="${tokens.mediaImageActions}" contenteditable="false">
            <button type="button" class="${tokens.mediaUploadBtn}" data-architectural-media-upload="true">Replace</button>
          </div>
        </div>
        <div data-architectural-media-notes="true"><p>Media cards accept uploads and keep captions here. Replace the image to try your own file.</p></div>
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
      name: ROOT_SPACE_DISPLAY_NAME,
      parentSpaceId: null,
      entityIds: ["node-1", "node-2", "node-3", "node-4", "folder-1"],
    },
    "space-project-thesis": {
      id: "space-project-thesis",
      name: "Research",
      parentSpaceId: "root",
      entityIds: [],
    },
  };

  entities["folder-1"] = {
    id: "folder-1",
    title: "Research folder",
    kind: "folder",
    theme: "folder",
    childSpaceId: "space-project-thesis",
    rotation: -4.2,
    width: 420,
    tapeRotation: 0,
    /* Clear of root cluster: sits mid-right, below the code card row */
    slots: {
      root: { x: 460, y: -40 },
    },
  };

  const folderMockNodes: CanvasNode[] = [
    {
      id: "dossier-01",
      title: "Source list",
      x: -460,
      y: -200,
      rotation: -1.2,
      width: 340,
      theme: "default",
      tapeRotation: -1.1,
      tapeVariant: "clear",
      bodyHtml:
        "<p><strong>Curated inputs</strong> for the demo workspace—articles, interview notes, and exports you would normally link from a real project.</p><p>In practice you might tag these, link cards together, or move them into a shared folder for review.</p>",
    },
    {
      id: "dossier-02",
      title: "Snippet: normalizer",
      x: 40,
      y: -200,
      rotation: 0.7,
      width: 340,
      theme: "code",
      tapeRotation: 1.4,
      tapeVariant: "dark",
      bodyHtml: `<span style="color: ${DS_COLOR.codeSampleComment};">// Strip noise from pasted text before indexing</span><br><span style="color: ${DS_COLOR.codeSampleKeyword};">function</span> <span style="color: ${DS_COLOR.codeSampleName};">normalize</span>(s: <span style="color: ${DS_COLOR.codeSampleName};">string</span>) {<br>
&nbsp;&nbsp;<span style="color: ${DS_COLOR.codeSampleKeyword};">return</span> s.<span style="color: ${DS_COLOR.codeSampleName};">replace</span>(<span style="color: ${DS_COLOR.codeSampleString};">/\\s+/g</span>, <span style="color: ${DS_COLOR.codeSampleString};">' '</span>).<span style="color: ${DS_COLOR.codeSampleName};">trim</span>();<br>
}`,
    },
  ];

  folderMockNodes.forEach((node) => {
    entities[node.id] = {
      ...node,
      kind: "content",
      slots: {
        "space-project-thesis": { x: node.x, y: node.y },
      },
    } satisfies CanvasContentEntity;
    spaces["space-project-thesis"].entityIds.push(node.id);
  });

  if (scenario === "nested") {
    spaces["space-subsystems"] = {
      id: "space-subsystems",
      name: "Archive",
      parentSpaceId: "space-project-thesis",
      entityIds: ["nested-note-1"],
    };

    entities["folder-2"] = {
      id: "folder-2",
      title: "Archive",
      kind: "folder",
      theme: "folder",
      childSpaceId: "space-subsystems",
      rotation: 0.5,
      width: 420,
      tapeRotation: 0,
      /* Below the top row of dossier cards, right side — no horizontal overlap with either card */
      slots: {
        "space-project-thesis": { x: 420, y: 200 },
      },
    };

    entities["nested-note-1"] = {
      id: "nested-note-1",
      title: "Third level",
      kind: "content",
      theme: "default",
      rotation: -0.6,
      tapeRotation: 1.2,
      tapeVariant: "clear",
      bodyHtml:
        "<p>You are two folders deep. Breadcrumbs at the top of the canvas show the path; use them to jump up without losing your place.</p><p>This card only exists here—nothing on the outer canvas repeats it—so nested spaces stay easy to tell apart.</p>",
      slots: {
        "space-subsystems": { x: -80, y: 40 },
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
    connections: {},
  };
}

/** Seed graph uses this id; Neon bootstrap uses a UUID active space. */
export const SEED_LOCAL_ROOT_SPACE_ID = "root";

/**
 * Remap the seed “root” space and all entity slots from `root` → `activeSpaceId`
 * so the same demo graph works after bootstrap (empty DB space still shows cards).
 */
export function pinSeedGraphToActiveSpace(seed: CanvasGraph, activeSpaceId: string): CanvasGraph {
  if (activeSpaceId === SEED_LOCAL_ROOT_SPACE_ID) {
    return structuredClone(seed);
  }

  const next = structuredClone(seed) as CanvasGraph;
  const spaces = { ...next.spaces } as Record<string, CanvasSpace>;
  const oldRoot = spaces[SEED_LOCAL_ROOT_SPACE_ID];
  if (!oldRoot) {
    return next;
  }

  delete spaces[SEED_LOCAL_ROOT_SPACE_ID];
  spaces[activeSpaceId] = {
    ...oldRoot,
    id: activeSpaceId,
  };

  for (const sid of Object.keys(spaces)) {
    const s = spaces[sid];
    if (s?.parentSpaceId === SEED_LOCAL_ROOT_SPACE_ID) {
      spaces[sid] = { ...s, parentSpaceId: activeSpaceId };
    }
  }

  next.spaces = spaces;

  const entities = { ...next.entities } as Record<string, CanvasEntity>;
  for (const entityId of Object.keys(entities)) {
    const e = entities[entityId]!;
    if (!("slots" in e) || !e.slots) continue;
    if (!(SEED_LOCAL_ROOT_SPACE_ID in e.slots)) continue;
    const slots = { ...e.slots };
    slots[activeSpaceId] = slots[SEED_LOCAL_ROOT_SPACE_ID]!;
    delete slots[SEED_LOCAL_ROOT_SPACE_ID];
    entities[entityId] = { ...e, slots } as CanvasEntity;
  }
  next.entities = entities;
  return next;
}
