"use client";

import { Code, GearSix } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { useMemo, useRef, type ReactNode } from "react";

import { ArchitecturalButton } from "@/src/components/foundation/ArchitecturalButton";
import { ArchitecturalNodeCard } from "@/src/components/foundation/ArchitecturalNodeCard";
import { buildArchitecturalSeedNodes } from "@/src/components/foundation/architectural-seed";
import type { CanvasNode } from "@/src/components/foundation/architectural-types";
import canvasStyles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { VigilDataCorruptionGlitchAttached } from "@/src/components/transition-experiment/VigilDataCorruptionGlitchAttached";
import { VigilDataCorruptionGlitchOverlay } from "@/src/components/transition-experiment/VigilDataCorruptionGlitchOverlay";
import { Button } from "@/src/components/ui/Button";

/**
 * Must match the tile’s `backgroundColor` passed into the overlay so `u_bgColor` matches the snapshot.
 * (Approximates a light shell surface behind nodes.)
 */
const TILE_BG = "#e5e9f0";
const TILE_BG_RGB: [number, number, number] = [229 / 255, 233 / 255, 240 / 255];

const DEMO_BG = "#9bb3c2";
const DEMO_BG_RGB: [number, number, number] = [0.608, 0.702, 0.761];

const seedNodes = buildArchitecturalSeedNodes({
  taskItem: canvasStyles.taskItem,
  done: canvasStyles.done,
  taskCheckbox: canvasStyles.taskCheckbox,
  taskText: canvasStyles.taskText,
  mediaFrame: canvasStyles.mediaFrame,
  mediaImage: canvasStyles.mediaImage,
  mediaImageActions: canvasStyles.mediaImageActions,
  mediaUploadBtn: canvasStyles.mediaUploadBtn,
});

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], seed: number) {
  const rand = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j]!;
    arr[j] = t!;
  }
}

type Sample = { id: string; label: string; node: ReactNode };

function nodeSample(node: CanvasNode): Sample {
  return {
    id: `node-${node.id}`,
    label: `ArchitecturalNodeCard · ${node.theme}`,
    node: (
      <ArchitecturalNodeCard
        id={node.id}
        title={node.title}
        width={Math.min(node.width ?? 340, 300)}
        theme={node.theme}
        tapeRotation={node.tapeRotation}
        bodyHtml={node.bodyHtml}
        activeTool="select"
        dragged={false}
        selected
        bodyEditable={false}
        tapeVariant={node.tapeVariant}
        showExpandButton
        onBodyCommit={() => {}}
        onExpand={() => {}}
      />
    ),
  };
}

function buildSamples(): Sample[] {
  const [n1, n2, n3, n4] = seedNodes;
  if (!n1 || !n2 || !n3 || !n4) throw new Error("Expected four seed nodes");

  return [
    nodeSample(n1),
    nodeSample(n2),
    nodeSample(n3),
    nodeSample(n4),
    {
      id: "buttons-ds",
      label: "Design system · Button matrix",
      node: (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {(["neutral", "primary", "danger", "ghost"] as const).map((variant) => (
            <Button key={variant} variant={variant} size="sm">
              {variant}
            </Button>
          ))}
        </div>
      ),
    },
    {
      id: "buttons-arch",
      label: "Architectural chrome",
      node: (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
          <ArchitecturalButton size="pill" tone="glass">
            Open folder
          </ArchitecturalButton>
          <ArchitecturalButton
            size="menu"
            tone="menu"
            leadingIcon={<Code size={14} weight="bold" aria-hidden />}
          >
            Inspect graph
          </ArchitecturalButton>
          <ArchitecturalButton size="icon" tone="focus-light" iconOnly aria-label="Settings">
            <GearSix size={16} weight="bold" aria-hidden />
          </ArchitecturalButton>
        </div>
      ),
    },
  ];
}

type StoryArgs = {
  seed: number;
  captureIntervalMs: number;
};

const meta = {
  title: "Heartgarden/Experiments/Data Corruption Glitch",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "**VigilDataCorruptionGlitchOverlay** wraps content (canvas is a DOM sibling over the capture subtree). Ancestor **`overflow: hidden`** still clips that canvas. **VigilDataCorruptionGlitchAttached** does not wrap the node: it portals a `fixed` WebGL layer aligned to `targetRef`, so the glitch is not clipped by the card frame. Motion is **`u_time`** in the fragment shader; **`captureIntervalMs` defaults to 0**.",
      },
    },
  },
  argTypes: {
    seed: { control: { type: "number", min: 0, max: 99999, step: 1 } },
    captureIntervalMs: {
      control: { type: "range", min: 0, max: 2000, step: 50 },
      description: "0 = snapshot only on mount/resize (smooth shader animation). >0 repaints DOM to texture on an interval (heavy; can stutter).",
    },
  },
  args: {
    seed: 42,
    captureIntervalMs: 0,
  },
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<StoryArgs>;

export const RandomizedComponentGrid: Story = {
  render: ({ seed, captureIntervalMs }) => {
    const tiles = useMemo(() => {
      const samples = buildSamples();
      shuffleInPlace(samples, seed);
      return samples.slice(0, 6);
    }, [seed]);

    return (
      <div
        style={{
          minHeight: "100vh",
          boxSizing: "border-box",
          padding: 24,
          background: "linear-gradient(160deg, #6b7d88 0%, #4a5860 100%)",
        }}
      >
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 12,
            color: "rgba(255,255,255,0.88)",
            fontFamily: "var(--font-mono, monospace)",
            maxWidth: 720,
            lineHeight: 1.45,
          }}
        >
          Tiles use seed <strong>ArchitecturalNodeCard</strong> variants (default / code / task / media) plus design-system and
          architectural buttons. Glitch motion is <strong>shader-only</strong> (<code style={{ color: "#b8d4ff" }}>u_time</code>);
          keep <strong>Capture interval</strong> at <strong>0</strong> unless you need live DOM updates. Tile fill{" "}
          <code style={{ color: "#b8d4ff" }}>{TILE_BG}</code> matches <code style={{ color: "#b8d4ff" }}>backgroundRgb</code>.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          {tiles.map((s) => (
            <div
              key={s.id}
              style={{
                borderRadius: 10,
                outline: "1px solid rgba(17,19,26,0.12)",
                overflow: "visible",
                minHeight: 160,
              }}
            >
              <VigilDataCorruptionGlitchOverlay
                captureIntervalMs={captureIntervalMs}
                backgroundRgb={TILE_BG_RGB}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 12,
                  backgroundColor: TILE_BG,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: "0.12em",
                      color: "rgba(17,19,26,0.45)",
                      textTransform: "uppercase",
                    }}
                  >
                    {s.label}
                  </span>
                  {s.node}
                </div>
              </VigilDataCorruptionGlitchOverlay>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

export const SingleButton: Story = {
  args: {
    captureIntervalMs: 0,
  },
  render: ({ captureIntervalMs }) => (
    <div style={{ padding: 40, background: "var(--sem-surface-base)" }}>
      <VigilDataCorruptionGlitchOverlay
        captureIntervalMs={captureIntervalMs}
        backgroundRgb={DEMO_BG_RGB}
        style={{ padding: 20, backgroundColor: DEMO_BG, borderRadius: 12 }}
      >
        <Button variant="danger" size="lg">
          SYSTEM FAILURE
        </Button>
      </VigilDataCorruptionGlitchOverlay>
    </div>
  ),
};

/** Dark shell behind the code card; aligns with `backgroundRgb` for shader gaps. */
const PORTAL_DEMO_SURFACE = "#0e0e16";
const PORTAL_DEMO_SURFACE_RGB: [number, number, number] = [14 / 255, 14 / 255, 22 / 255];

function CodeNodePortalAttachedDemo({ captureIntervalMs }: { captureIntervalMs: number }) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const codeSeed = seedNodes.find((n) => n.theme === "code");
  if (!codeSeed) {
    return <div style={{ color: "#fff", padding: 24 }}>Missing code seed node.</div>;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 40,
        background: PORTAL_DEMO_SURFACE,
        boxSizing: "border-box",
      }}
    >
      <p
        style={{
          color: "rgba(255,255,255,0.78)",
          fontSize: 13,
          maxWidth: 680,
          lineHeight: 1.55,
          margin: "0 0 24px",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        The <strong>code</strong> node is not wrapped by the glitch layer.{" "}
        <code style={{ color: "#9ccfff" }}>VigilDataCorruptionGlitchAttached</code> reads{" "}
        <code style={{ color: "#9ccfff" }}>targetRef</code> and draws a portaled <code style={{ color: "#9ccfff" }}>fixed</code>{" "}
        canvas on top. The orange dashed frame uses <code style={{ color: "#9ccfff" }}>overflow: hidden</code>—that would clip
        an in-tree overlay, but the portaled WebGL surface is outside this subtree.
      </p>
      <div
        style={{
          width: "fit-content",
          borderRadius: 14,
          outline: "2px dashed rgba(255, 170, 120, 0.55)",
          outlineOffset: 6,
          overflow: "hidden",
          padding: 6,
        }}
      >
        <div ref={targetRef} style={{ width: "fit-content" }}>
          <ArchitecturalNodeCard
            id={codeSeed.id}
            title={codeSeed.title}
            width={Math.min(codeSeed.width ?? 340, 320)}
            theme="code"
            tapeRotation={codeSeed.tapeRotation}
            bodyHtml={codeSeed.bodyHtml}
            activeTool="select"
            dragged={false}
            selected
            bodyEditable={false}
            tapeVariant={codeSeed.tapeVariant}
            showExpandButton
            onBodyCommit={() => {}}
            onExpand={() => {}}
          />
        </div>
      </div>
      <VigilDataCorruptionGlitchAttached
        targetRef={targetRef}
        backgroundRgb={PORTAL_DEMO_SURFACE_RGB}
        captureIntervalMs={captureIntervalMs}
      />
    </div>
  );
}

/** Glitch applied without wrapping the node (portal + fixed alignment). */
export const CodeNodePortalAttached: Story = {
  args: {
    captureIntervalMs: 0,
  },
  render: ({ captureIntervalMs }) => <CodeNodePortalAttachedDemo captureIntervalMs={captureIntervalMs} />,
};
