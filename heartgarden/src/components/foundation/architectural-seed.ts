import {
  ROOT_SPACE_DISPLAY_NAME,
  type CanvasConnectionPin,
  type CanvasEntity,
  type CanvasContentEntity,
  type CanvasGraph,
  type CanvasNode,
  type CanvasPinConnection,
  type CanvasSpace,
} from "@/src/components/foundation/architectural-types";
import { DEFAULT_LINK_SLACK_MULTIPLIER } from "@/src/lib/item-link-meta";
import { mediaUploadActionLabel } from "@/src/components/foundation/architectural-media-html";
import { legacyCodeBodyHtmlToHgDocSeed } from "@/src/lib/hg-doc/html-to-doc";
import { hgDocToHtml } from "@/src/lib/hg-doc/html-export";
import {
  DEMO_ARCHIVE_EXTRA_DOC,
  DEMO_ARCHIVE_NOTE_DOC,
  DEMO_RESEARCH_COL3_DOC,
  DEMO_RESEARCH_DOSSIER_DOC,
  DEMO_RESEARCH_SCRATCH_DOC,
  DEMO_ROOT_WELCOME_DOC,
  DEMO_STACK_RESEARCH_BOTTOM_DOC,
  DEMO_STACK_RESEARCH_MIDDLE_DOC,
  DEMO_STACK_RESEARCH_TOP_DOC,
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
 * the lower-right quadrant). Same 2×2 rhythm: ~160px gutters, 600px row step.
 *
 * **Vertical gap:** On-canvas notes use `.a4DocumentNode` (max height ≈ 340×√2). The third row
 * (folder) must start below the second row by at least that height plus margin, or cards overlap
 * the folder after the newer tall-card shell shipped.
 */
const DEMO_ROOT_GRID_OX = -420;
const DEMO_ROOT_GRID_OY = -440;
/** Row distance between the two card rows (world px). */
const DEMO_ROOT_ROW_STEP = 600;
/**
 * Y offset from `DEMO_ROOT_GRID_OY` to the folder’s top edge. ~600 (row) + ~520 (max card body column
 * + header, rounded up) + margin — keeps the Research folder clear of row two.
 */
const DEMO_ROOT_FOLDER_Y_FROM_GRID_ORIGIN = DEMO_ROOT_ROW_STEP + 600;
/** 420px-wide folder centered under the 2×2 grid (grid spans x ≈ −420…420). */
const DEMO_ROOT_FOLDER_LEFT = DEMO_ROOT_GRID_OX + 210;

/** Pin anchors aligned with `ArchitecturalCanvasApp` `CONNECTION_PIN_DEFAULT_CONTENT`. */
const DEMO_SEED_CONTENT_PIN: CanvasConnectionPin = {
  anchor: "topLeftInset",
  insetX: 14,
  insetY: 18,
};

/**
 * Stable non-UUID id so this edge never collides with Neon `item_links` rows or looks like a DB key.
 * Endpoints use existing seed entity ids (`node-1` → `node-2`) on the root canvas only.
 */
const DEMO_ROOT_PIN_THREAD_ID = "hg-demo-pin-thread-main";

function buildDemoRootPinThreadConnection(): CanvasPinConnection {
  const t = 1_700_000_000_000;
  return {
    id: DEMO_ROOT_PIN_THREAD_ID,
    sourceEntityId: "node-1",
    targetEntityId: "node-2",
    sourcePin: DEMO_SEED_CONTENT_PIN,
    targetPin: DEMO_SEED_CONTENT_PIN,
    color: "oklch(0.68 0.32 48)",
    linkType: "pin",
    slackMultiplier: DEFAULT_LINK_SLACK_MULTIPLIER,
    createdAt: t,
    updatedAt: t,
    syncState: "local-only",
    syncError: null,
  };
}

/** Styled HTML from the pre-hgDoc era; canvas code cards now use hgDoc (`legacyCodeBodyHtmlToHgDocSeed`). */
const DEMO_NODE_2_CODE_HTML = `
        <span style="color: ${DS_COLOR.codeSampleComment};">// Example: how a small client might describe its session</span><br>
        <span style="color: ${DS_COLOR.codeSampleKeyword};">export const</span> <span style="color: ${DS_COLOR.codeSampleName};">workspaceSession</span> = {<br>
        &nbsp;&nbsp;<span style="color: ${DS_COLOR.codeSampleProperty};">id</span>: <span style="color: ${DS_COLOR.codeSampleString};">'hg-demo-01'</span>,<br>
        &nbsp;&nbsp;<span style="color: ${DS_COLOR.codeSampleProperty};">region</span>: <span style="color: ${DS_COLOR.codeSampleString};">'us-east'</span>,<br>
        &nbsp;&nbsp;<span style="color: ${DS_COLOR.codeSampleProperty};">lastSyncedAt</span>: <span style="color: ${DS_COLOR.codeSampleKeyword};">new</span> <span style="color: ${DS_COLOR.codeSampleName};">Date</span>(<span style="color: ${DS_COLOR.codeSampleString};">'2026-04-01T12:00:00Z'</span>),<br>
        &nbsp;&nbsp;<span style="color: ${DS_COLOR.codeSampleProperty};">status</span>: <span style="color: ${DS_COLOR.codeSampleString};">'idle'</span>,<br>
        } <span style="color: ${DS_COLOR.codeSampleKeyword};">as const</span>;<br>
      `;

const DEMO_NODE_2_BODY_DOC = legacyCodeBodyHtmlToHgDocSeed(DEMO_NODE_2_CODE_HTML);
const DEMO_NODE_2_BODY_HTML = hgDocToHtml(DEMO_NODE_2_BODY_DOC);

const DEMO_DOSSIER_02_CODE_HTML = `<span style="color: ${DS_COLOR.codeSampleComment};">// Strip noise from pasted text before indexing</span><br><span style="color: ${DS_COLOR.codeSampleKeyword};">function</span> <span style="color: ${DS_COLOR.codeSampleName};">normalize</span>(s: <span style="color: ${DS_COLOR.codeSampleName};">string</span>) {<br>
&nbsp;&nbsp;<span style="color: ${DS_COLOR.codeSampleKeyword};">return</span> s.<span style="color: ${DS_COLOR.codeSampleName};">replace</span>(<span style="color: ${DS_COLOR.codeSampleString};">/\\s+/g</span>, <span style="color: ${DS_COLOR.codeSampleString};">' '</span>).<span style="color: ${DS_COLOR.codeSampleName};">trim</span>();<br>
}`;

const DEMO_DOSSIER_02_BODY_DOC = legacyCodeBodyHtmlToHgDocSeed(DEMO_DOSSIER_02_CODE_HTML);
const DEMO_DOSSIER_02_BODY_HTML = hgDocToHtml(DEMO_DOSSIER_02_BODY_DOC);

export function buildArchitecturalSeedNodes(tokens: StyleTokens): CanvasNode[] {
  /* Root demo: 2×2 grid centered on the viewport focal point, then the Research folder on a third row. */
  return [
    {
      id: "node-1",
      title: "Start here — how this board works",
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
      title: "Sample code card",
      x: DEMO_ROOT_GRID_OX + 500,
      y: DEMO_ROOT_GRID_OY,
      rotation: 2.4,
      width: 340,
      theme: "code",
      tapeRotation: 2.8,
      tapeVariant: "dark",
      bodyDoc: DEMO_NODE_2_BODY_DOC,
      bodyHtml: DEMO_NODE_2_BODY_HTML,
    },
    {
      id: "node-3",
      title: "Try these steps",
      x: DEMO_ROOT_GRID_OX + 500,
      y: DEMO_ROOT_GRID_OY + DEMO_ROOT_ROW_STEP,
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
      title: "Image card (double-click for gallery)",
      x: DEMO_ROOT_GRID_OX,
      y: DEMO_ROOT_GRID_OY + DEMO_ROOT_ROW_STEP,
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
    title: "Sample Research space — open this folder",
    kind: "folder",
    theme: "folder",
    childSpaceId: "space-project-thesis",
    rotation: -4.2,
    width: 420,
    tapeRotation: 0,
    /* Third row: centered under the 2×2 grid — Y chosen so tall a4-style cards do not cover it. */
    slots: {
      root: { x: DEMO_ROOT_FOLDER_LEFT, y: DEMO_ROOT_GRID_OY + DEMO_ROOT_FOLDER_Y_FROM_GRID_ORIGIN },
    },
  };

  const DEMO_RESEARCH_OX = -420;
  const DEMO_RESEARCH_OY = -140;
  const DEMO_RESEARCH_FOLDER_LEFT = DEMO_RESEARCH_OX + 210;
  /**
   * Second row in Research: starts below row one’s tallest on-card layout (~481px) + gap so
   * nothing collides with the first row.
   */
  const DEMO_RESEARCH_ROW2_Y = DEMO_RESEARCH_OY + 581;
  /**
   * Nested Archive folder sits below row two for the `nested` scenario (tall a4-style cards +
   * margin — mirrors the spacing fix used for the root Research folder).
   */
  const DEMO_RESEARCH_NESTED_FOLDER_Y = DEMO_RESEARCH_ROW2_Y + 481 + 120;
  /** Shared id for the three-card Research stack (local demo; not persisted to Neon). */
  const DEMO_RESEARCH_STACK_ID = "demo-research-stack";

  const folderMockNodes: CanvasNode[] = [
    {
      id: "dossier-01",
      title: "Inside the folder",
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
      title: "Another sample card",
      x: DEMO_RESEARCH_OX + 500,
      y: DEMO_RESEARCH_OY,
      rotation: 0.7,
      width: 340,
      theme: "code",
      tapeRotation: 1.4,
      tapeVariant: "dark",
      bodyDoc: DEMO_DOSSIER_02_BODY_DOC,
      bodyHtml: DEMO_DOSSIER_02_BODY_HTML,
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

  /* Third column + second row + a three-high stack — dense but spaced for a4 max-height cards. */
  entities["research-col3-tip"] = {
    id: "research-col3-tip",
    title: "Wide layout tip",
    kind: "content",
    theme: "default",
    rotation: 1.1,
    width: 340,
    tapeRotation: 0.9,
    tapeVariant: "masking",
    bodyDoc: DEMO_RESEARCH_COL3_DOC,
    bodyHtml: hgDocToHtml(DEMO_RESEARCH_COL3_DOC),
    slots: {
      "space-project-thesis": { x: DEMO_RESEARCH_OX + 1000, y: DEMO_RESEARCH_OY },
    },
  } satisfies CanvasContentEntity;
  spaces["space-project-thesis"].entityIds.push("research-col3-tip");

  entities["research-scratch"] = {
    id: "research-scratch",
    title: "Loose notes",
    kind: "content",
    theme: "default",
    rotation: -0.9,
    width: 340,
    tapeRotation: -1.3,
    tapeVariant: "clear",
    bodyDoc: DEMO_RESEARCH_SCRATCH_DOC,
    bodyHtml: hgDocToHtml(DEMO_RESEARCH_SCRATCH_DOC),
    slots: {
      "space-project-thesis": { x: DEMO_RESEARCH_OX, y: DEMO_RESEARCH_ROW2_Y },
    },
  } satisfies CanvasContentEntity;
  spaces["space-project-thesis"].entityIds.push("research-scratch");

  const stackSlot = { x: DEMO_RESEARCH_OX + 500, y: DEMO_RESEARCH_ROW2_Y };
  entities["research-stack-a"] = {
    id: "research-stack-a",
    title: "Sample stack — back card",
    kind: "content",
    theme: "default",
    rotation: 2.1,
    width: 340,
    tapeRotation: 1.7,
    tapeVariant: "masking",
    bodyDoc: DEMO_STACK_RESEARCH_BOTTOM_DOC,
    bodyHtml: hgDocToHtml(DEMO_STACK_RESEARCH_BOTTOM_DOC),
    stackId: DEMO_RESEARCH_STACK_ID,
    stackOrder: 0,
    slots: {
      "space-project-thesis": { ...stackSlot },
    },
  } satisfies CanvasContentEntity;
  entities["research-stack-b"] = {
    id: "research-stack-b",
    title: "Sample stack — middle",
    kind: "content",
    theme: "task",
    rotation: 2.1,
    width: 340,
    tapeRotation: 1.7,
    tapeVariant: "masking",
    bodyDoc: DEMO_STACK_RESEARCH_MIDDLE_DOC,
    bodyHtml: hgDocToHtml(DEMO_STACK_RESEARCH_MIDDLE_DOC),
    stackId: DEMO_RESEARCH_STACK_ID,
    stackOrder: 1,
    slots: {
      "space-project-thesis": { ...stackSlot },
    },
  } satisfies CanvasContentEntity;
  entities["research-stack-c"] = {
    id: "research-stack-c",
    title: "Sample stack — top (click stack)",
    kind: "content",
    theme: "default",
    rotation: 2.1,
    width: 340,
    tapeRotation: 1.7,
    tapeVariant: "masking",
    bodyDoc: DEMO_STACK_RESEARCH_TOP_DOC,
    bodyHtml: hgDocToHtml(DEMO_STACK_RESEARCH_TOP_DOC),
    stackId: DEMO_RESEARCH_STACK_ID,
    stackOrder: 2,
    slots: {
      "space-project-thesis": { ...stackSlot },
    },
  } satisfies CanvasContentEntity;
  spaces["space-project-thesis"].entityIds.push(
    "research-stack-a",
    "research-stack-b",
    "research-stack-c",
  );

  if (scenario === "nested") {
    spaces["space-subsystems"] = {
      id: "space-subsystems",
      name: "Archive",
      parentSpaceId: "space-project-thesis",
      entityIds: ["nested-note-1", "nested-note-2"],
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
        "space-project-thesis": { x: DEMO_RESEARCH_FOLDER_LEFT, y: DEMO_RESEARCH_NESTED_FOLDER_Y },
      },
    };

    entities["nested-note-1"] = {
      id: "nested-note-1",
      title: "Nested space (third level)",
      kind: "content",
      theme: "default",
      rotation: -0.6,
      tapeRotation: 1.2,
      tapeVariant: "clear",
      bodyDoc: DEMO_ARCHIVE_NOTE_DOC,
      bodyHtml: hgDocToHtml(DEMO_ARCHIVE_NOTE_DOC),
      slots: {
        /* Single card centered on the archive’s focal point */
        "space-subsystems": { x: -170, y: -140 },
      },
    };

    entities["nested-note-2"] = {
      id: "nested-note-2",
      title: "Dummy vault list",
      kind: "content",
      theme: "task",
      rotation: 1.4,
      tapeRotation: -0.8,
      tapeVariant: "clear",
      bodyDoc: DEMO_ARCHIVE_EXTRA_DOC,
      bodyHtml: hgDocToHtml(DEMO_ARCHIVE_EXTRA_DOC),
      slots: {
        /* Below nested-note-1 — spaced for a4-style max height on the first card. */
        "space-subsystems": { x: -170, y: 440 },
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
    connections: {
      [DEMO_ROOT_PIN_THREAD_ID]: buildDemoRootPinThreadConnection(),
    },
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
