import { mediaUploadActionLabel } from "@/src/components/foundation/architectural-media-html";
import {
  type CanvasConnectionPin,
  type CanvasContentEntity,
  type CanvasEntity,
  type CanvasGraph,
  type CanvasNode,
  type CanvasPinConnection,
  type CanvasSpace,
  ROOT_SPACE_DISPLAY_NAME,
} from "@/src/components/foundation/architectural-types";
import { createDefaultFactionRosterSeed } from "@/src/lib/faction-roster-link";
import { hgDocToHtml } from "@/src/lib/hg-doc/html-export";
import {
  DEMO_RESEARCH_DOSSIER_DOC,
  DEMO_ROOT_WELCOME_DOC,
  DEMO_STACK_HOME_BOTTOM_DOC,
  DEMO_STACK_HOME_MIDDLE_DOC,
  DEMO_STACK_HOME_TOP_DOC,
  demoRootTaskDoc,
} from "@/src/lib/hg-doc/seed-docs";
import { DEFAULT_LINK_SLACK_MULTIPLIER } from "@/src/lib/item-link-meta";
import {
  buildFactionArchive091BodyHtml,
  factionArchiveRailTextsFromObjectId,
} from "@/src/lib/lore-faction-archive-html";
import {
  buildLocationOrdoV7BodyHtml,
  getLoreNodeSeedBodyHtml,
  tapeVariantForLoreCard,
} from "@/src/lib/lore-node-seed-html";

interface StyleTokens {
  done: string;
  mediaFrame: string;
  mediaImage: string;
  mediaImageActions: string;
  mediaUploadBtn: string;
  taskCheckbox: string;
  taskItem: string;
  taskText: string;
}

/**
 * World-space offsets so the onboarding cluster sits around **world (0,0)** — matches how a
 * real GM “Main space” feels with viewport-centered `defaultCamera` (cards are not shoved into
 * the lower-right quadrant). Rhythm: 600px row step (clears `.a4DocumentNode` max height ≈ 340×√2).
 *
 * **Root demo layout:** Row 1 — welcome doc (left) + sample stack (right). Row 2 — “Try these steps”
 * checklist under the welcome card. Image card sits tighter under the stack (not a full `ROW_STEP`);
 * Demo subspace folder sits two row-steps below the grid origin, nudged 60px up for tighter grouping under the stack.
 */
const DEMO_ROOT_GRID_OX = -420;
const DEMO_ROOT_GRID_OY = -440;
/** Row distance between major horizontal bands (world px). */
const DEMO_ROOT_ROW_STEP = 600;
/** Sample stack column (same x as each stacked card slot). */
const DEMO_ROOT_STACK_COL_OX = DEMO_ROOT_GRID_OX + 500;
/** 420px-wide folder centered under the 340px-wide stack column. */
const DEMO_ROOT_FOLDER_X = DEMO_ROOT_STACK_COL_OX + (340 - 420) / 2;
/** Image: closer under the stack than a full row step (folder Y is independent). */
const DEMO_ROOT_IMAGE_Y = DEMO_ROOT_GRID_OY + 440;
/** Two row-steps below grid origin; −60px lifts the folder slightly toward the stack column. */
const DEMO_ROOT_FOLDER_Y = DEMO_ROOT_GRID_OY + DEMO_ROOT_ROW_STEP * 2 - 60;

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

/** Pin threads inside the demo subspace (`space-project-thesis`) linking intro + lore specimen cards. */
const DEMO_THESIS_THREAD_INTRO_CHAR = "hg-demo-thesis-intro-char";
const DEMO_THESIS_THREAD_CHAR_FACTION = "hg-demo-thesis-char-faction";
const DEMO_THESIS_THREAD_FACTION_LOC = "hg-demo-thesis-faction-loc";
const DEMO_THESIS_THREAD_LOC_CHAR = "hg-demo-thesis-loc-char";

function buildDemoRootPinThreadConnection(): CanvasPinConnection {
  const t = 1_700_000_000_000;
  return {
    color: "oklch(0.68 0.32 48)",
    createdAt: t,
    id: DEMO_ROOT_PIN_THREAD_ID,
    linkType: "pin",
    slackMultiplier: DEFAULT_LINK_SLACK_MULTIPLIER,
    sourceEntityId: "node-1",
    sourcePin: DEMO_SEED_CONTENT_PIN,
    syncError: null,
    syncState: "local-only",
    targetEntityId: "home-stack-c",
    targetPin: DEMO_SEED_CONTENT_PIN,
    updatedAt: t,
  };
}

function buildDemoThesisPinThread(
  id: string,
  sourceEntityId: string,
  targetEntityId: string,
  color: string,
  timeOffsetMs: number
): CanvasPinConnection {
  const t = 1_700_000_001_000 + timeOffsetMs;
  return {
    color,
    createdAt: t,
    id,
    linkType: "pin",
    slackMultiplier: DEFAULT_LINK_SLACK_MULTIPLIER,
    sourceEntityId,
    sourcePin: DEMO_SEED_CONTENT_PIN,
    syncError: null,
    syncState: "local-only",
    targetEntityId,
    targetPin: DEMO_SEED_CONTENT_PIN,
    updatedAt: t,
  };
}

/** Demo folder — v11 character plate with placeholder fields filled for readability. */
function seedDemoCharacterBodyHtml(): string {
  return getLoreNodeSeedBodyHtml("character", "v11")
    .replace(
      'data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="Name"><br></div>',
      'data-hg-lore-field="1">Morgan Vale</div>'
    )
    .replace(
      'data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="Role"><br></span>',
      'data-hg-lore-field="1">Lead warder</span>'
    )
    .replace(
      'data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="Group"><br></span>',
      'data-hg-lore-field="1">Ratcatchers</span>'
    )
    .replace(
      'data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="Origin"><br></span>',
      'data-hg-lore-field="1">Luna-born</span>'
    )
    .replace(
      'data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="Notes"><p><br></p></div>',
      'data-hg-lore-field="1"><p>Demo liaison: routes filings through <strong>Arbiter Station Lagrange 1</strong> for the Ratcatchers roster in this folder.</p></div>'
    );
}

function seedDemoFactionBodyHtml(): string {
  const { upper, lower } =
    factionArchiveRailTextsFromObjectId("demo-faction-seed");
  return buildFactionArchive091BodyHtml({
    orgAccentInnerHtml: "Warrant & recovery · L1 circuit",
    orgPrimaryInnerHtml: "Ratcatchers",
    railLower: lower,
    railUpper: upper,
    recordInnerHtml:
      "<p>Demo faction for the <strong>Demo subspace folder</strong>: a compact warrant unit tied to <strong>Arbiter Station Lagrange 1</strong>. The structured roster below lists sample members (including Morgan as lead warder).</p>",
  });
}

function seedDemoLocationBodyHtml(): string {
  return buildLocationOrdoV7BodyHtml({
    context: "Earth–Moon L1 · admin corridor",
    detail: "Ratcatchers field office · civilian hearings deck",
    name: "Arbiter Station Lagrange 1",
    notesInnerHtml:
      "<p>Demo station: neutral ground where the <strong>Ratcatchers</strong> log warrants and hand-offs. Threads on the board link this place to Morgan and the faction card.</p>",
  });
}

export function buildArchitecturalSeedNodes(tokens: StyleTokens): CanvasNode[] {
  /* Root demo: welcome + stack (row 1); checklist under welcome; image tight under stack; folder below (2× row step from grid). */
  return [
    {
      bodyDoc: DEMO_ROOT_WELCOME_DOC,
      bodyHtml: hgDocToHtml(DEMO_ROOT_WELCOME_DOC),
      id: "node-1",
      rotation: -2.6,
      tapeRotation: -2.2,
      tapeVariant: "masking",
      theme: "default",
      title: "Start here — how this board works",
      x: DEMO_ROOT_GRID_OX,
      y: DEMO_ROOT_GRID_OY,
    },
    {
      bodyDoc: demoRootTaskDoc(),
      bodyHtml: hgDocToHtml(demoRootTaskDoc()),
      id: "node-3",
      rotation: -3.1,
      tapeRotation: -2.4,
      tapeVariant: "masking",
      theme: "task",
      title: "Try these steps",
      width: 340,
      x: DEMO_ROOT_GRID_OX,
      y: DEMO_ROOT_GRID_OY + DEMO_ROOT_ROW_STEP,
    },
    {
      bodyHtml: `
        <div class="${tokens.mediaFrame}" data-architectural-media-root="true">
          <img class="${tokens.mediaImage}" src="/caliginia-sphere.png" alt="Abstract sphere render used as sample media" />
          <div class="${tokens.mediaImageActions}" contenteditable="false">
            <button type="button" class="vigil-btn ${tokens.mediaUploadBtn}" data-variant="ghost" data-size="sm" data-tone="glass" data-architectural-media-upload="true">${mediaUploadActionLabel(true)}</button>
          </div>
        </div>
        <div data-architectural-media-notes="true"><p>Media cards accept uploads and keep captions here. Replace the image to try your own file.</p></div>
      `,
      id: "node-4",
      rotation: 2.2,
      tapeRotation: 1.6,
      tapeVariant: "dark",
      theme: "media",
      title: "Image card (double-click for gallery)",
      width: 340,
      x: DEMO_ROOT_STACK_COL_OX,
      y: DEMO_ROOT_IMAGE_Y,
    },
  ];
}

function createContentSeedMap(
  tokens: StyleTokens
): Record<string, CanvasEntity> {
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
    ])
  ) as Record<string, CanvasEntity>;
}

export function buildArchitecturalSeedGraph(
  tokens: StyleTokens,
  scenario: "default" | "corrupt" = "default"
): CanvasGraph {
  const entities = createContentSeedMap(tokens);
  const spaces: Record<string, CanvasSpace> = {
    root: {
      entityIds: [
        "node-1",
        "home-stack-a",
        "home-stack-b",
        "home-stack-c",
        "node-3",
        "node-4",
        "folder-1",
      ],
      id: "root",
      name: ROOT_SPACE_DISPLAY_NAME,
      parentSpaceId: null,
    },
    "space-project-thesis": {
      entityIds: [],
      id: "space-project-thesis",
      name: "Demo subspace folder",
      parentSpaceId: "root",
    },
  };

  entities["folder-1"] = {
    childSpaceId: "space-project-thesis",
    id: "folder-1",
    kind: "folder",
    rotation: -4.2,
    /* Row 3 band — below the image on the stack column (see DEMO_ROOT_FOLDER_Y nudge). */
    slots: {
      root: { x: DEMO_ROOT_FOLDER_X, y: DEMO_ROOT_FOLDER_Y },
    },
    tapeRotation: 0,
    theme: "folder",
    title: "Demo subspace folder",
    width: 420,
  };

  /** Home-board stack (top-right of row 1); pin thread targets `home-stack-c`. */
  const DEMO_HOME_STACK_ID = "demo-home-stack";
  const homeStackSlot = { x: DEMO_ROOT_STACK_COL_OX, y: DEMO_ROOT_GRID_OY };
  entities["home-stack-a"] = {
    bodyDoc: DEMO_STACK_HOME_BOTTOM_DOC,
    bodyHtml: hgDocToHtml(DEMO_STACK_HOME_BOTTOM_DOC),
    id: "home-stack-a",
    kind: "content",
    rotation: 2.1,
    slots: { root: { ...homeStackSlot } },
    stackId: DEMO_HOME_STACK_ID,
    stackOrder: 0,
    tapeRotation: 1.7,
    tapeVariant: "masking",
    theme: "default",
    title: "Sample stack — back card",
    width: 340,
  } satisfies CanvasContentEntity;
  entities["home-stack-b"] = {
    bodyDoc: DEMO_STACK_HOME_MIDDLE_DOC,
    bodyHtml: hgDocToHtml(DEMO_STACK_HOME_MIDDLE_DOC),
    id: "home-stack-b",
    kind: "content",
    rotation: 2.1,
    slots: { root: { ...homeStackSlot } },
    stackId: DEMO_HOME_STACK_ID,
    stackOrder: 1,
    tapeRotation: 1.7,
    tapeVariant: "masking",
    theme: "task",
    title: "Sample stack — middle",
    width: 340,
  } satisfies CanvasContentEntity;
  entities["home-stack-c"] = {
    bodyDoc: DEMO_STACK_HOME_TOP_DOC,
    bodyHtml: hgDocToHtml(DEMO_STACK_HOME_TOP_DOC),
    id: "home-stack-c",
    kind: "content",
    rotation: 2.1,
    slots: { root: { ...homeStackSlot } },
    stackId: DEMO_HOME_STACK_ID,
    stackOrder: 2,
    tapeRotation: 1.7,
    tapeVariant: "masking",
    theme: "default",
    title: "Sample stack — top (click stack)",
    width: 340,
  } satisfies CanvasContentEntity;

  /**
   * Demo subspace inner space (`space-project-thesis`): camera centers world (0,0) on enter.
   * Place the 2×2 note grid symmetrically around the origin so all four cards are in view.
   */
  const DEMO_NOTES_CARD_W = 340;
  const DEMO_NOTES_GAP = 80;
  const DEMO_NOTES_HALF_CENTER_OFFSET =
    (DEMO_NOTES_CARD_W + DEMO_NOTES_GAP) / 2;
  const DEMO_NOTES_TOP_LEFT =
    -DEMO_NOTES_HALF_CENTER_OFFSET - DEMO_NOTES_CARD_W / 2;
  const DEMO_NOTES_TOP_RIGHT =
    DEMO_NOTES_HALF_CENTER_OFFSET - DEMO_NOTES_CARD_W / 2;

  const folderIntro: CanvasNode = {
    bodyDoc: DEMO_RESEARCH_DOSSIER_DOC,
    bodyHtml: hgDocToHtml(DEMO_RESEARCH_DOSSIER_DOC),
    id: "dossier-01",
    rotation: -1.2,
    tapeRotation: -1.1,
    tapeVariant: "clear",
    theme: "default",
    title: "Inside the folder",
    width: 340,
    x: DEMO_NOTES_TOP_LEFT,
    y: DEMO_NOTES_TOP_LEFT,
  };

  const folderLoreCharacter: CanvasNode = {
    bodyHtml: seedDemoCharacterBodyHtml(),
    id: "demo-lore-character",
    rotation: 0.9,
    tapeRotation: -1.3,
    tapeVariant: tapeVariantForLoreCard("character", "v11"),
    theme: "default",
    title: "Morgan Vale",
    width: 340,
    x: DEMO_NOTES_TOP_RIGHT,
    y: DEMO_NOTES_TOP_LEFT,
  };

  const folderLoreFaction: CanvasNode = {
    bodyHtml: seedDemoFactionBodyHtml(),
    id: "demo-lore-faction",
    rotation: -0.8,
    tapeRotation: 1.0,
    tapeVariant: tapeVariantForLoreCard("faction", "v4"),
    theme: "default",
    title: "Ratcatchers",
    width: 340,
    x: DEMO_NOTES_TOP_LEFT,
    y: DEMO_NOTES_TOP_RIGHT,
  };

  const folderLoreLocation: CanvasNode = {
    bodyHtml: seedDemoLocationBodyHtml(),
    id: "demo-lore-location",
    rotation: 1.1,
    tapeRotation: -0.9,
    tapeVariant: tapeVariantForLoreCard("location", "v7"),
    theme: "default",
    title: "Arbiter Station Lagrange 1",
    width: 340,
    x: DEMO_NOTES_TOP_RIGHT,
    y: DEMO_NOTES_TOP_RIGHT,
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
      ...(isChar
        ? { loreCard: { kind: "character", variant: "v11" } as const }
        : {}),
      ...(isFaction
        ? {
            factionRoster: createDefaultFactionRosterSeed(),
            loreCard: { kind: "faction", variant: "v4" } as const,
          }
        : {}),
      ...(isLoc
        ? { loreCard: { kind: "location", variant: "v7" } as const }
        : {}),
      slots: {
        "space-project-thesis": { x: node.x, y: node.y },
      },
    } satisfies CanvasContentEntity;
    spaces["space-project-thesis"].entityIds.push(node.id);
  });

  /* Demo subspace: intro + lore specimen cards (no nested Archive). */

  if (scenario === "corrupt") {
    entities["folder-1"] = {
      ...entities["folder-1"],
      childSpaceId: "missing-space-id",
    };
  }

  return {
    connections: {
      [DEMO_ROOT_PIN_THREAD_ID]: buildDemoRootPinThreadConnection(),
      [DEMO_THESIS_THREAD_INTRO_CHAR]: buildDemoThesisPinThread(
        DEMO_THESIS_THREAD_INTRO_CHAR,
        "dossier-01",
        "demo-lore-character",
        "oklch(0.62 0.14 250)",
        0
      ),
      [DEMO_THESIS_THREAD_CHAR_FACTION]: buildDemoThesisPinThread(
        DEMO_THESIS_THREAD_CHAR_FACTION,
        "demo-lore-character",
        "demo-lore-faction",
        "oklch(0.65 0.2 145)",
        1
      ),
      [DEMO_THESIS_THREAD_FACTION_LOC]: buildDemoThesisPinThread(
        DEMO_THESIS_THREAD_FACTION_LOC,
        "demo-lore-faction",
        "demo-lore-location",
        "oklch(0.7 0.18 55)",
        2
      ),
      [DEMO_THESIS_THREAD_LOC_CHAR]: buildDemoThesisPinThread(
        DEMO_THESIS_THREAD_LOC_CHAR,
        "demo-lore-location",
        "demo-lore-character",
        "oklch(0.58 0.22 310)",
        3
      ),
    },
    entities,
    rootSpaceId: "root",
    spaces,
  };
}

/** Seed graph uses this id; Neon bootstrap uses a UUID active space. */
export const SEED_LOCAL_ROOT_SPACE_ID = "root";

/**
 * Remap the seed “root” space and all entity slots from `root` → `activeSpaceId`
 * so the same demo graph works after bootstrap (empty DB space still shows cards).
 */
export function pinSeedGraphToActiveSpace(
  seed: CanvasGraph,
  activeSpaceId: string
): CanvasGraph {
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
    if (!("slots" in e && e.slots)) {
      continue;
    }
    if (!(SEED_LOCAL_ROOT_SPACE_ID in e.slots)) {
      continue;
    }
    const slots = { ...e.slots };
    slots[activeSpaceId] = slots[SEED_LOCAL_ROOT_SPACE_ID]!;
    delete slots[SEED_LOCAL_ROOT_SPACE_ID];
    entities[entityId] = { ...e, slots } as CanvasEntity;
  }
  next.entities = entities;
  return next;
}
