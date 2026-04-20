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
import { createDefaultFactionRosterSeed } from "@/src/lib/faction-roster-link";
import { hgDocToHtml } from "@/src/lib/hg-doc/html-export";
import {
  buildFactionArchive091BodyHtml,
  factionArchiveRailTextsFromObjectId,
} from "@/src/lib/lore-faction-archive-html";
import {
  buildLocationOrdoV7BodyHtml,
  getLoreNodeSeedBodyHtml,
  tapeVariantForLoreCard,
} from "@/src/lib/lore-node-seed-html";
import {
  DEMO_RESEARCH_DOSSIER_DOC,
  DEMO_ROOT_WELCOME_DOC,
  DEMO_STACK_HOME_BOTTOM_DOC,
  DEMO_STACK_HOME_MIDDLE_DOC,
  DEMO_STACK_HOME_TOP_DOC,
  demoRootTaskDoc,
} from "@/src/lib/hg-doc/seed-docs";

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
 * checklist under the welcome card; image card on the stack column (between stack and folder). Row 3 —
 * Demo notes folder below the image.
 */
const DEMO_ROOT_GRID_OX = -420;
const DEMO_ROOT_GRID_OY = -440;
/** Row distance between major horizontal bands (world px). */
const DEMO_ROOT_ROW_STEP = 600;
/** Sample stack column (same x as each stacked card slot). */
const DEMO_ROOT_STACK_COL_OX = DEMO_ROOT_GRID_OX + 500;
/** 420px-wide folder centered under the 340px-wide stack column. */
const DEMO_ROOT_FOLDER_X = DEMO_ROOT_STACK_COL_OX + (340 - 420) / 2;
/** Image row on the stack column; folder one row lower. */
const DEMO_ROOT_IMAGE_Y = DEMO_ROOT_GRID_OY + DEMO_ROOT_ROW_STEP;
const DEMO_ROOT_FOLDER_Y = DEMO_ROOT_GRID_OY + DEMO_ROOT_ROW_STEP * 2;

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

/** Demo folder — v11 character plate with placeholder fields filled for readability. */
function seedDemoCharacterBodyHtml(): string {
  return getLoreNodeSeedBodyHtml("character", "v11")
    .replace(
      'data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="Name"><br></div>',
      'data-hg-lore-field="1">Morgan Vale</div>',
    )
    .replace(
      'data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="Role"><br></span>',
      'data-hg-lore-field="1">Lead surveyor</span>',
    )
    .replace(
      'data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="Group"><br></span>',
      'data-hg-lore-field="1">Astroglass Survey</span>',
    )
    .replace(
      'data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="Origin"><br></span>',
      'data-hg-lore-field="1">Luna-born</span>',
    )
    .replace(
      'data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="Notes"><p><br></p></div>',
      'data-hg-lore-field="1"><p>Demo character — keeps the drydock manifest honest.</p></div>',
    );
}

function seedDemoFactionBodyHtml(): string {
  const { upper, lower } = factionArchiveRailTextsFromObjectId("demo-faction-seed");
  return buildFactionArchive091BodyHtml({
    orgPrimaryInnerHtml: "Astroglass Survey",
    orgAccentInnerHtml: "Independent cooperative",
    recordInnerHtml:
      "<p>Demo organization: joint survey and salvage auditors. Names and rails are placeholders for the demo folder.</p>",
    railUpper: upper,
    railLower: lower,
  });
}

function seedDemoLocationBodyHtml(): string {
  return buildLocationOrdoV7BodyHtml({
    name: "Orbital Drydock Nine",
    context: "Pacific orbital corridor",
    detail: "Civilian heavy repair berth",
    notesInnerHtml: "<p>Demo waypoint for maintenance skiffs and courier drops.</p>",
  });
}

export function buildArchitecturalSeedNodes(tokens: StyleTokens): CanvasNode[] {
  /* Root demo: welcome + stack (row 1); checklist + image on stack column (row 2); folder (row 3). */
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
    /* Row 3 — below the image on the stack column. */
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
  const DEMO_RESEARCH_ROW_STEP = 600;

  const folderIntro: CanvasNode = {
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
  };

  const folderLoreCharacter: CanvasNode = {
    id: "demo-lore-character",
    title: "Morgan Vale",
    x: DEMO_RESEARCH_OX + 500,
    y: DEMO_RESEARCH_OY,
    rotation: 0.9,
    width: 340,
    theme: "default",
    tapeRotation: -1.3,
    tapeVariant: tapeVariantForLoreCard("character", "v11"),
    bodyHtml: seedDemoCharacterBodyHtml(),
  };

  const folderLoreFaction: CanvasNode = {
    id: "demo-lore-faction",
    title: "Astroglass Survey Cooperative",
    x: DEMO_RESEARCH_OX,
    y: DEMO_RESEARCH_OY + DEMO_RESEARCH_ROW_STEP,
    rotation: -0.8,
    width: 340,
    theme: "default",
    tapeRotation: 1.0,
    tapeVariant: tapeVariantForLoreCard("faction", "v4"),
    bodyHtml: seedDemoFactionBodyHtml(),
  };

  const folderLoreLocation: CanvasNode = {
    id: "demo-lore-location",
    title: "Orbital Drydock Nine",
    x: DEMO_RESEARCH_OX + 500,
    y: DEMO_RESEARCH_OY + DEMO_RESEARCH_ROW_STEP,
    rotation: 1.1,
    width: 340,
    theme: "default",
    tapeRotation: -0.9,
    tapeVariant: tapeVariantForLoreCard("location", "v7"),
    bodyHtml: seedDemoLocationBodyHtml(),
  };

  const folderEntities: CanvasNode[] = [
    folderIntro,
    folderLoreCharacter,
    folderLoreFaction,
    folderLoreLocation,
  ];

  folderEntities.forEach((node) => {
    const isChar = node.id === "demo-lore-character";
    const isFaction = node.id === "demo-lore-faction";
    const isLoc = node.id === "demo-lore-location";
    entities[node.id] = {
      ...node,
      kind: "content",
      ...(isChar ? { loreCard: { kind: "character", variant: "v11" } as const } : {}),
      ...(isFaction
        ? {
            loreCard: { kind: "faction", variant: "v4" } as const,
            factionRoster: createDefaultFactionRosterSeed(),
          }
        : {}),
      ...(isLoc ? { loreCard: { kind: "location", variant: "v7" } as const } : {}),
      slots: {
        "space-project-thesis": { x: node.x, y: node.y },
      },
    } satisfies CanvasContentEntity;
    spaces["space-project-thesis"].entityIds.push(node.id);
  });

  /* Demo notes subspace: intro + lore specimen cards (no nested Archive). */

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
