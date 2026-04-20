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
  DEMO_RESEARCH_DOSSIER_DOC,
  DEMO_ROOT_WELCOME_DOC,
  DEMO_STACK_HOME_BOTTOM_DOC,
  DEMO_STACK_HOME_MIDDLE_DOC,
  DEMO_STACK_HOME_TOP_DOC,
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
 * the lower-right quadrant). Rhythm: 600px row step (clears `.a4DocumentNode` max height ≈ 340×√2).
 *
 * **Root demo layout:** Row 1 — welcome doc (left) + sample stack (right). Row 2 — “Try these steps”
 * checklist under the welcome card, Demo notes folder under the stack. Row 3 — image card under the folder.
 */
const DEMO_ROOT_GRID_OX = -420;
const DEMO_ROOT_GRID_OY = -440;
/** Row distance between major horizontal bands (world px). */
const DEMO_ROOT_ROW_STEP = 600;
/** Sample stack column (same x as each stacked card slot). */
const DEMO_ROOT_STACK_COL_OX = DEMO_ROOT_GRID_OX + 500;
/** 420px-wide folder centered under the 340px-wide stack column. */
const DEMO_ROOT_FOLDER_X = DEMO_ROOT_STACK_COL_OX + (340 - 420) / 2;
/** Folder sits in row 2 on the stack column; image in row 3 below it. */
const DEMO_ROOT_FOLDER_Y = DEMO_ROOT_GRID_OY + DEMO_ROOT_ROW_STEP;
const DEMO_ROOT_IMAGE_Y = DEMO_ROOT_GRID_OY + DEMO_ROOT_ROW_STEP * 2;

/** Pin anchors aligned with `ArchitecturalCanvasApp` `CONNECTION_PIN_DEFAULT_CONTENT`. */
const DEMO_SEED_CONTENT_PIN: CanvasConnectionPin = {
  anchor: "topLeftInset",
  insetX: 14,
  insetY: 18,
};

/**
 * Stable non-UUID id so this edge never collides with Neon `item_links` rows or looks like a DB key.
 * Endpoints use existing seed entity ids (`node-1` → top sheet of the home stack) on the root canvas only.
 */
const DEMO_ROOT_PIN_THREAD_ID = "hg-demo-pin-thread-main";

function buildDemoRootPinThreadConnection(): CanvasPinConnection {
  const t = 1_700_000_000_000;
  return {
    id: DEMO_ROOT_PIN_THREAD_ID,
    sourceEntityId: "node-1",
    targetEntityId: "home-stack-c",
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

/** Styled snippet for the in-folder demo card (`legacyCodeBodyHtmlToHgDocSeed`). */
const DEMO_DOSSIER_02_CODE_HTML = `<span style="color: ${DS_COLOR.codeSampleComment};">// Strip noise from pasted text before indexing</span><br><span style="color: ${DS_COLOR.codeSampleKeyword};">function</span> <span style="color: ${DS_COLOR.codeSampleName};">normalize</span>(s: <span style="color: ${DS_COLOR.codeSampleName};">string</span>) {<br>
&nbsp;&nbsp;<span style="color: ${DS_COLOR.codeSampleKeyword};">return</span> s.<span style="color: ${DS_COLOR.codeSampleName};">replace</span>(<span style="color: ${DS_COLOR.codeSampleString};">/\\s+/g</span>, <span style="color: ${DS_COLOR.codeSampleString};">' '</span>).<span style="color: ${DS_COLOR.codeSampleName};">trim</span>();<br>
}`;

const DEMO_DOSSIER_02_BODY_DOC = legacyCodeBodyHtmlToHgDocSeed(DEMO_DOSSIER_02_CODE_HTML);
const DEMO_DOSSIER_02_BODY_HTML = hgDocToHtml(DEMO_DOSSIER_02_BODY_DOC);

export function buildArchitecturalSeedNodes(tokens: StyleTokens): CanvasNode[] {
  /* Root demo: welcome + stack (row 1); checklist under welcome + folder under stack (row 2); image under folder (row 3). */
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
      id: "node-3",
      title: "Try these steps",
      x: DEMO_ROOT_GRID_OX,
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
      x: DEMO_ROOT_STACK_COL_OX,
      y: DEMO_ROOT_IMAGE_Y,
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
  scenario: "default" | "corrupt" = "default",
): CanvasGraph {
  const entities = createContentSeedMap(tokens);
  const spaces: Record<string, CanvasSpace> = {
    root: {
      id: "root",
      name: ROOT_SPACE_DISPLAY_NAME,
      parentSpaceId: null,
      entityIds: [
        "node-1",
        "home-stack-a",
        "home-stack-b",
        "home-stack-c",
        "node-3",
        "node-4",
        "folder-1",
      ],
    },
    "space-project-thesis": {
      id: "space-project-thesis",
      name: "Demo notes",
      parentSpaceId: "root",
      entityIds: [],
    },
  };

  entities["folder-1"] = {
    id: "folder-1",
    title: "Demo notes",
    kind: "folder",
    theme: "folder",
    childSpaceId: "space-project-thesis",
    rotation: -4.2,
    width: 420,
    tapeRotation: 0,
    /* Row 2 on the stack column, centered under the 340px cards. */
    slots: {
      root: { x: DEMO_ROOT_FOLDER_X, y: DEMO_ROOT_FOLDER_Y },
    },
  };

  /** Home-board stack (top-right of row 1); pin thread targets `home-stack-c`. */
  const DEMO_HOME_STACK_ID = "demo-home-stack";
  const homeStackSlot = { x: DEMO_ROOT_STACK_COL_OX, y: DEMO_ROOT_GRID_OY };
  entities["home-stack-a"] = {
    id: "home-stack-a",
    title: "Sample stack — back card",
    kind: "content",
    theme: "default",
    rotation: 2.1,
    width: 340,
    tapeRotation: 1.7,
    tapeVariant: "masking",
    bodyDoc: DEMO_STACK_HOME_BOTTOM_DOC,
    bodyHtml: hgDocToHtml(DEMO_STACK_HOME_BOTTOM_DOC),
    stackId: DEMO_HOME_STACK_ID,
    stackOrder: 0,
    slots: { root: { ...homeStackSlot } },
  } satisfies CanvasContentEntity;
  entities["home-stack-b"] = {
    id: "home-stack-b",
    title: "Sample stack — middle",
    kind: "content",
    theme: "task",
    rotation: 2.1,
    width: 340,
    tapeRotation: 1.7,
    tapeVariant: "masking",
    bodyDoc: DEMO_STACK_HOME_MIDDLE_DOC,
    bodyHtml: hgDocToHtml(DEMO_STACK_HOME_MIDDLE_DOC),
    stackId: DEMO_HOME_STACK_ID,
    stackOrder: 1,
    slots: { root: { ...homeStackSlot } },
  } satisfies CanvasContentEntity;
  entities["home-stack-c"] = {
    id: "home-stack-c",
    title: "Sample stack — top (click stack)",
    kind: "content",
    theme: "default",
    rotation: 2.1,
    width: 340,
    tapeRotation: 1.7,
    tapeVariant: "masking",
    bodyDoc: DEMO_STACK_HOME_TOP_DOC,
    bodyHtml: hgDocToHtml(DEMO_STACK_HOME_TOP_DOC),
    stackId: DEMO_HOME_STACK_ID,
    stackOrder: 2,
    slots: { root: { ...homeStackSlot } },
  } satisfies CanvasContentEntity;

  const DEMO_RESEARCH_OX = -420;
  const DEMO_RESEARCH_OY = -140;

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

  /* Demo notes subspace: two cards only (no third-level Archive folder). */

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
