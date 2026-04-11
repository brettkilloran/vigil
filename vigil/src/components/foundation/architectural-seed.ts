import {
  ROOT_SPACE_DISPLAY_NAME,
  type CanvasEntity,
  type CanvasContentEntity,
  type CanvasGraph,
  type CanvasNode,
  type CanvasSpace,
} from "@/src/components/foundation/architectural-types";
import { mediaUploadActionLabel } from "@/src/components/foundation/architectural-media-html";
import { hgDocToHtml } from "@/src/lib/hg-doc/html-export";
import {
  DEMO_RESEARCH_DOSSIER_DOC,
  DEMO_ROOT_WELCOME_DOC,
  demoRootTaskDoc,
} from "@/src/lib/hg-doc/seed-docs";
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

/**
 * World-space offsets so the onboarding cluster sits around **world (0,0)** — matches how a
 * real GM “Main space” feels with viewport-centered `defaultCamera` (cards are not shoved into
 * the lower-right quadrant). Same 2×2 rhythm as before: ~160px gutters, 600px row step.
 */
const DEMO_ROOT_GRID_OX = -420;
const DEMO_ROOT_GRID_OY = -440;
/** 420px-wide folder centered under the 2×2 grid (grid spans x ≈ −420…420). */
const DEMO_ROOT_FOLDER_LEFT = DEMO_ROOT_GRID_OX + 210;

export function buildArchitecturalSeedNodes(tokens: StyleTokens): CanvasNode[] {
  /* Root demo: 2×2 grid of 340×280 cards centered on the viewport focal point, then the Research
   * folder on a third row (420×280) under the grid — mirrors typical live-board composition. */
  return [
    {
      id: "node-1",
      title: "Welcome to this board",
      x: DEMO_ROOT_GRID_OX,
      y: DEMO_ROOT_GRID_OY,
      rotation: -2.6,
      theme: "default",
      tapeRotation: -2.2,
      tapeVariant: "masking",
      bodyDoc: DEMO_ROOT_WELCOME_DOC,
      bodyHtml: hgDocToHtml(DEMO_ROOT_WELCOME_DOC),
    },
    {
      id: "node-2",
      title: "Sample sync config",
      x: DEMO_ROOT_GRID_OX + 500,
      y: DEMO_ROOT_GRID_OY,
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
      x: DEMO_ROOT_GRID_OX + 500,
      y: DEMO_ROOT_GRID_OY + 600,
      rotation: -3.1,
      width: 340,
      theme: "task",
      tapeRotation: -2.4,
      tapeVariant: "masking",
      bodyDoc: demoRootTaskDoc(),
      bodyHtml: hgDocToHtml(demoRootTaskDoc()),
    },
    {
      id: "node-4",
      title: "Reference image",
      x: DEMO_ROOT_GRID_OX,
      y: DEMO_ROOT_GRID_OY + 600,
      rotation: 2.2,
      width: 340,
      theme: "media",
      tapeRotation: 1.6,
      tapeVariant: "dark",
      bodyHtml: `
        <div class="${tokens.mediaFrame}" data-architectural-media-root="true">
          <img class="${tokens.mediaImage}" src="/caliginia-sphere.png" alt="Abstract sphere render used as sample media" />
          <div class="${tokens.mediaImageActions}" contenteditable="false">
            <button type="button" class="vigil-btn ${tokens.mediaUploadBtn}" data-variant="ghost" data-size="sm" data-tone="glass" data-architectural-media-upload="true">${mediaUploadActionLabel(true)}</button>
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
    /* Third row: centered under the 2×2 grid (same relative placement as before, shifted with grid). */
    slots: {
      root: { x: DEMO_ROOT_FOLDER_LEFT, y: DEMO_ROOT_GRID_OY + 960 },
    },
  };

  const DEMO_RESEARCH_OX = -420;
  const DEMO_RESEARCH_OY = -140;
  const DEMO_RESEARCH_FOLDER_LEFT = DEMO_RESEARCH_OX + 210;

  const folderMockNodes: CanvasNode[] = [
    {
      id: "dossier-01",
      title: "Source list",
      x: DEMO_RESEARCH_OX,
      y: DEMO_RESEARCH_OY,
      rotation: -1.2,
      width: 340,
      theme: "default",
      tapeRotation: -1.1,
      tapeVariant: "clear",
      bodyDoc: DEMO_RESEARCH_DOSSIER_DOC,
      bodyHtml: hgDocToHtml(DEMO_RESEARCH_DOSSIER_DOC),
    },
    {
      id: "dossier-02",
      title: "Snippet: normalizer",
      x: DEMO_RESEARCH_OX + 500,
      y: DEMO_RESEARCH_OY,
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
      /* Below the two research cards, centered like the root folder */
      slots: {
        "space-project-thesis": { x: DEMO_RESEARCH_FOLDER_LEFT, y: DEMO_RESEARCH_OY + 360 },
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
        /* Single card centered on the archive’s focal point */
        "space-subsystems": { x: -170, y: -140 },
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
