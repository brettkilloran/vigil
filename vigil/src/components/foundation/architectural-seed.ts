import type {
  CanvasEntity,
  CanvasContentEntity,
  CanvasGraph,
  CanvasNode,
  CanvasSpace,
} from "@/src/components/foundation/architectural-types";
import { DS_COLOR } from "@/src/lib/design-system-tokens";

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
      title: "Brief // The second chance",
      x: -300,
      y: -320,
      rotation: -1,
      theme: "default",
      tapeRotation: 2,
      tapeVariant: "masking",
      bodyHtml: `
        <h1>The ring does not forgive nostalgia.</h1>
        <p>We fled the first world on fumes and liturgy. Out here, under a tired red sun, terraforming bought us time—but not innocence. Every colony landed with old grudges and new flags, and the planet learned our names too well.</p>
        <blockquote>Where certainty frays, the Stain seeps in: glitches in light, memory, and the small laws we pretended were permanent.</blockquote>
        <p>Wytches are what we call the ones who can touch it anyway—edit thought, bend seconds, bleed for a correction. This board is your orbit desk. Arrange the evidence before the wound widens.</p>
      `,
    },
    {
      id: "node-2",
      title: "DAT // sing_1r_boot.ts",
      x: 140,
      y: -210,
      rotation: 0.5,
      width: 340,
      theme: "code",
      tapeRotation: -1.5,
      tapeVariant: "dark",
      bodyHtml: `
        <span style="color: ${DS_COLOR.codeSampleKeyword};">const</span> <span style="color: ${DS_COLOR.codeSampleName};">dataterm</span> = {<br>
        &nbsp;&nbsp;<span style="color: ${DS_COLOR.codeSampleProperty};">host</span>: <span style="color: ${DS_COLOR.codeSampleString};">'nv.dataterm.local'</span>,<br>
        &nbsp;&nbsp;<span style="color: ${DS_COLOR.codeSampleProperty};">phase</span>: <span style="color: ${DS_COLOR.codeSampleString};">'Sing_1R_Jailbr3ak'</span>,<br>
        &nbsp;&nbsp;<span style="color: ${DS_COLOR.codeSampleProperty};">battery</span>: <span style="color: ${DS_COLOR.codeSampleProperty};">84</span>,<br>
        &nbsp;&nbsp;<span style="color: ${DS_COLOR.codeSampleProperty};">queue</span>: <span style="color: ${DS_COLOR.codeSampleString};">'awaiting_datashard'</span>,<br>
        };<br><br>
        <span style="color: ${DS_COLOR.codeSampleComment};">// [IN] Core modules loaded · [ST] Secure channel established · calibrating retrieval…</span>
      `,
    },
    {
      id: "node-3",
      title: "Coven // Field orders",
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
          <div class="${tokens.taskText}" contenteditable="true">Map Stain vents along the habitable ring</div>
        </div>
        <div class="${tokens.taskItem} ${tokens.done}">
          <div class="${tokens.taskCheckbox}"></div>
          <div class="${tokens.taskText}" contenteditable="true">Archive a false memory in Grimoire (new tab)</div>
        </div>
        <div class="${tokens.taskItem}">
          <div class="${tokens.taskCheckbox}"></div>
          <div class="${tokens.taskText}" contenteditable="true">Reconcile Builder output with Core Rules</div>
        </div>
        <div class="${tokens.taskItem}">
          <div class="${tokens.taskCheckbox}"></div>
          <div class="${tokens.taskText}" contenteditable="true">Escort datashard to terminus before curfew</div>
        </div>
      `,
    },
    {
      id: "node-4",
      title: "Survey // Orbital still",
      x: -200,
      y: 310,
      rotation: 1,
      theme: "media",
      tapeRotation: -2.5,
      tapeVariant: "clear",
      bodyHtml: `
        <div class="${tokens.mediaPlaceholder}">
          <span>Satellite frame · awaiting raster</span>
        </div>
        <div contenteditable="true" style="font-size: 13px; color: ${DS_COLOR.codeSampleCaption};">
          Cross-check terraforming scars against eyewitness drift. If the terrain disagrees with the archive, trust the bleed first—maps lie politely; the Stain does not.
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
      name: "Covenant dossier",
      parentSpaceId: "root",
      entityIds: [],
    },
  };

  entities["folder-1"] = {
    id: "folder-1",
    title: "Covenant dossier",
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
      name: "Aux shaft log",
      parentSpaceId: "space-project-thesis",
      entityIds: ["nested-note-1"],
    };

    entities["folder-2"] = {
      id: "folder-2",
      title: "Aux shaft log",
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
      title: "Deep stack // Proof",
      kind: "content",
      theme: "default",
      rotation: -0.6,
      tapeRotation: 1.2,
      tapeVariant: "clear",
      bodyHtml:
        "<p>Nesting still works when the fiction does: this card sits one ring below the dossier to exercise folders, crumbs, and the small superstition that order holds under pressure.</p>",
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
