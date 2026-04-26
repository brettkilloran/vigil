"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BatchedText, Text } from "troika-three-text";

import styles from "@/src/components/product-ui/canvas/entity-graph-three-canvas.module.css";
import type { GraphCanvasSharedProps } from "@/src/lib/graph-canvas-types";
import { getEntityTypeStyle } from "@/src/lib/entity-graph-type-style";
import type { GraphNode } from "@/src/lib/graph-types";
import { initForce3dSim, type Force3dSession } from "@/src/lib/entity-graph-force3d-client";

type OverlayState = {
  nodeId: string;
  title: string;
  body: string;
};

type HoverPreviewState = {
  nodeId: string;
  title: string;
  entityType: string | null;
  x: number;
  y: number;
};

const DEFAULT_CAMERA_ZOOM = 1.45;
const MAX_CAMERA_ZOOM = 2.2;
const MIN_CAMERA_ZOOM = 0.22;
const CAMERA_ZOOM_STEP = 1.35;
// --sys-color-accent-500: oklch(0.74 0.31 50)
const EDGE_MUTED_OKLCH = "oklch(0.72 0.003 252 / 0.28)";
const EDGE_ACTIVE_OKLCH = "oklch(0.74 0.31 50 / 0.95)";
const EDGE_HOVER_RGB = "oklch(0.74 0.31 50 / 1.0)";
const PILL_OVERLAY_NODE_LIMIT = 12000;

function sentimentForNode(nodeId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < nodeId.length; i += 1) {
    hash ^= nodeId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 2000) / 1000 - 1;
}

function bodyForNode(title: string): string {
  return `${title} is part of this synthetic stress scenario. Body content stays in the DOM overlay so we keep the WebGL buffers optimized for graph geometry and labels only.`;
}

function buildNodeIndex(nodes: GraphNode[]): Map<string, GraphNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function parseRgbTuple(input: string): [number, number, number] {
  const oklchMatch = input.match(/oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+))?\s*\)/i);
  if (oklchMatch) {
    const l = Number(oklchMatch[1] ?? 0);
    const c = Number(oklchMatch[2] ?? 0);
    const h = Number(oklchMatch[3] ?? 0);
    if (Number.isFinite(l) && Number.isFinite(c) && Number.isFinite(h)) {
      const hr = (h * Math.PI) / 180;
      const a = Math.cos(hr) * c;
      const b = Math.sin(hr) * c;
      const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
      const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
      const s_ = l - 0.0894841775 * a - 1.291485548 * b;
      const l3 = l_ * l_ * l_;
      const m3 = m_ * m_ * m_;
      const s3 = s_ * s_ * s_;
      const rLinear = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
      const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
      const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
      const toSrgb = (value: number) => {
        const v = Math.max(0, Math.min(1, value));
        if (v <= 0.0031308) return v * 12.92;
        return 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
      };
      return [toSrgb(rLinear), toSrgb(gLinear), toSrgb(bLinear)];
    }
  }
  const match = input.match(/rgba?\(([^)]+)\)/i);
  if (!match) return [0.82, 0.86, 0.92];
  const parts = (match[1] ?? "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value));
  if (parts.length < 3) return [0.82, 0.86, 0.92];
  return [parts[0]! / 255, parts[1]! / 255, parts[2]! / 255];
}

function colorFromStyle(input: string): THREE.Color {
  const [r, g, b] = parseRgbTuple(input);
  return new THREE.Color(r, g, b);
}

function projectToScreen(
  x: number,
  y: number,
  z: number,
  camera: THREE.OrthographicCamera,
  viewport: { width: number; height: number },
): { x: number; y: number } {
  const p = new THREE.Vector3(x, y, z).project(camera);
  return {
    x: (p.x * 0.5 + 0.5) * viewport.width,
    y: (-p.y * 0.5 + 0.5) * viewport.height,
  };
}

function seedFromId(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: number): number {
  let t = seed | 0;
  t = Math.imul(t ^ (t >>> 16), 0x45d9f3b);
  t = Math.imul(t ^ (t >>> 16), 0x45d9f3b);
  t = t ^ (t >>> 16);
  return (t >>> 0) / 4294967296;
}

function hash11(value: number): number {
  let p = value;
  p = p - Math.floor(p);
  p *= 0.1031;
  p = p - Math.floor(p);
  p *= p + 33.33;
  p *= p + p;
  return p - Math.floor(p);
}

function computeSharedBreathAmp(usePillOverlay: boolean, simStatus: "active" | "idle" | "frozen"): number {
  // Keep a subtle ambient motion in pill mode while maintaining lockstep across
  // connectors, dots, and pills.
  if (usePillOverlay) return simStatus === "active" ? 0.14 : 0.4;
  return simStatus === "active" ? 0.3 : 1.6;
}

function applyBreathOffset(
  x: number,
  y: number,
  z: number,
  nodeIndex: number,
  t: number,
  amp: number,
): { x: number; y: number; z: number } {
  if (amp <= 0) return { x, y, z };
  const pa = hash11(nodeIndex + 0.13) * Math.PI * 2;
  const pb = hash11(nodeIndex + 0.71) * Math.PI * 2;
  const freq = 0.94 + hash11(nodeIndex + 1.37) * 0.16;
  const wobble = 0.97 + hash11(nodeIndex + 2.11) * 0.12;
  const ampScale = 0.92 + hash11(nodeIndex + 3.29) * 0.16;
  const omega = t * 1.382 * freq;
  const finalAmp = amp * ampScale;
  return {
    x: x + Math.sin(omega + pa) * finalAmp,
    y: y + Math.cos(omega * 1.13 * wobble + pb) * finalAmp,
    z: z + Math.sin(omega * 0.87 / wobble + pa) * 0.4 * finalAmp,
  };
}



export function EntityGraphThreeCanvas({
  nodes,
  edges,
  layout,
  blurEffectsEnabled = true,
  selectedId,
  neighborIds,
  activeEdgeIds,
  worldWidth,
  worldHeight,
  cameraActionKey,
  cameraActionType,
  rightPanelOcclusionPx = 0,
  bottomPanelOcclusionPx = 0,
  showStatsFooter = false,
  enableNodeOverlayCard = false,
  statsFooterLabel = "three.js · worker force3d",
  onSelect,
  onLayoutChange,
  onCameraZoomChange,
}: GraphCanvasSharedProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const starfieldCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const composerTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const nodeMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const edgeLineRef = useRef<THREE.LineSegments | null>(null);
  const edgeActiveLineRef = useRef<THREE.LineSegments | null>(null);
  const labelBatchRef = useRef<BatchedText | null>(null);
  const onLayoutChangeRef = useRef(onLayoutChange);
  const overlayPackCacheRef = useRef<{
    key: string;
    entries: Array<{
      id: string;
      title: string;
      entityType: string | null;
      nodeIndex: number;
      selected: boolean;
      neighbor: boolean;
      estWidth: number;
      estHeight: number;
      worldX: number;
      worldY: number;
      worldZ: number;
    }>;
  }>({ key: "", entries: [] });
  const frameRef = useRef<number | null>(null);
  const cameraTweenFrameRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const dragRef = useRef<{ active: boolean; x: number; y: number; moved: boolean }>({
    active: false,
    x: 0,
    y: 0,
    moved: false,
  });
  const autoClusterFocusRef = useRef(true);
  const forceClusterFocusActionKeyRef = useRef<number | null>(null);
  // Smooth opacity lerp targets — written by the layout effect, consumed by the frame loop.
  const edgeMutedOpacityTargetRef = useRef(0.38);
  const edgeActiveOpacityTargetRef = useRef(0.46);
  const lastSelectedIdRef = useRef<string | null>(selectedId);
  const nodeOrderRef = useRef<string[]>([]);
  const positionsRef = useRef<Float32Array>(new Float32Array());
  const previousPositionsRef = useRef<Float32Array>(new Float32Array());
  const tickTimingRef = useRef<{ lastTickAt: number; intervalMs: number }>({ lastTickAt: 0, intervalMs: 32 });
  const selectedIdRef = useRef<string | null>(selectedId);
  const sessionRef = useRef<Force3dSession | null>(null);
  const simStatusRef = useRef<"active" | "idle" | "frozen">("idle");
  const hoverPerturbRef = useRef<{ id: string | null; at: number }>({ id: null, at: 0 });
  const hoverPickAtRef = useRef(0);

  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(null);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [cameraRevision, setCameraRevision] = useState(0);
  const [viewport, setViewport] = useState({ width: 1000, height: 760 });
  const [simStatus, setSimStatus] = useState<"active" | "idle" | "frozen">("idle");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const sentiments = useMemo(() => nodes.map((node) => sentimentForNode(node.id)), [nodes]);
  const nodeById = useMemo(() => buildNodeIndex(nodes), [nodes]);
  const usePillOverlay = nodes.length <= PILL_OVERLAY_NODE_LIMIT || selectedId !== null;
  const usePillOverlayRef = useRef(usePillOverlay);
  const layoutRef = useRef(layout);
  const overlayNodeIdsRef = useRef<Set<string>>(new Set());
  const breathTimeRef = useRef(0);
  const hoverNeighborIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    const next = new Set<string>();
    for (const edge of edges) {
      if (edge.source === hoveredNodeId) next.add(edge.target);
      else if (edge.target === hoveredNodeId) next.add(edge.source);
    }
    return next;
  }, [edges, hoveredNodeId]);
  const hoverActiveEdgeIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    const next = new Set<string>();
    for (const edge of edges) {
      if (edge.source === hoveredNodeId || edge.target === hoveredNodeId) next.add(edge.id);
    }
    return next;
  }, [edges, hoveredNodeId]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (selectedId && selectedId !== lastSelectedIdRef.current) {
      // A deliberate node selection should re-engage focus mode.
      autoClusterFocusRef.current = true;
    }
    lastSelectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    onLayoutChangeRef.current = onLayoutChange;
  }, [onLayoutChange]);

  const buildInterpolatedPositions = (ids: string[]): Float32Array | null => {
    const target = positionsRef.current;
    const previous = previousPositionsRef.current;
    if (ids.length === 0 || target.length === 0) return null;
    if (previous.length !== target.length) return null;
    const elapsed = performance.now() - tickTimingRef.current.lastTickAt;
    const interval = Math.max(8, tickTimingRef.current.intervalMs);
    const t = Math.max(0, Math.min(1, elapsed / interval));
    if (t >= 0.999) return target;
    const out = new Float32Array(target.length);
    for (let i = 0; i < target.length; i += 1) {
      const a = previous[i] ?? 0;
      const b = target[i] ?? 0;
      out[i] = a + (b - a) * t;
    }
    return out;
  };

  const sameNodeOrder = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  };

  useEffect(() => {
    usePillOverlayRef.current = usePillOverlay;
  }, [usePillOverlay]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(root.clientWidth, root.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.setClearAlpha(0);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.zIndex = "1";
    renderer.domElement.style.background = "transparent";
    root.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(-500, 500, 380, -380, -5000, 5000);
    camera.position.set(worldWidth * 0.5, worldHeight * 0.5, 1200);
    camera.lookAt(worldWidth * 0.5, worldHeight * 0.5, 0);
    camera.zoom = DEFAULT_CAMERA_ZOOM;
    camera.updateProjectionMatrix();
    cameraRef.current = camera;

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.5);
    dir.position.set(0, 0, 900);
    scene.add(dir);

    let composerTarget: THREE.WebGLRenderTarget | null = null;
    if (renderer.capabilities.isWebGL2) {
      composerTarget = new THREE.WebGLRenderTarget(
        Math.max(1, Math.floor(root.clientWidth * pixelRatio)),
        Math.max(1, Math.floor(root.clientHeight * pixelRatio)),
      );
      composerTarget.samples = 4;
      composerTargetRef.current = composerTarget;
    }
    const composer = composerTarget ? new EffectComposer(renderer, composerTarget) : new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    renderPass.clearAlpha = 0;
    renderPass.clearColor = null;
    composer.addPass(renderPass);
    const bloom = new UnrealBloomPass(new THREE.Vector2(root.clientWidth, root.clientHeight), 0.24, 0.2, 0.92);
    composer.addPass(bloom);
    bloomPassRef.current = bloom;
    composerRef.current = composer;

    const baseGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const nodeGeometry = new THREE.InstancedBufferGeometry();
    nodeGeometry.index = baseGeometry.index;
    for (const [key, attr] of Object.entries(baseGeometry.attributes)) {
      nodeGeometry.setAttribute(key, attr);
    }
    const sentimentAttr = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, nodes.length)), 1);
    const baseColorAttr = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, nodes.length) * 3), 3);
    const opacityAttr = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, nodes.length)), 1);
    nodeGeometry.setAttribute("instanceSentiment", sentimentAttr);
    nodeGeometry.setAttribute("instanceBaseColor", baseColorAttr);
    nodeGeometry.setAttribute("instanceOpacity", opacityAttr);

    const nodeMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSelectedIndex: { value: -1 },
        uTime: { value: 0 },
        uBreathAmp: { value: 1.1 },
      },
      vertexShader: `
        attribute float instanceSentiment;
        attribute vec3 instanceBaseColor;
        attribute float instanceOpacity;
        varying float vSentiment;
        varying vec3 vBaseColor;
        varying float vOpacity;
        varying float vSelectionMix;
        varying vec2 vUv;
        uniform float uSelectedIndex;
        uniform float uTime;
        uniform float uBreathAmp;

        // Cheap per-instance hash (Dave Hoskins).
        float hash11(float p) {
          p = fract(p * 0.1031);
          p *= p + 33.33;
          p *= p + p;
          return fract(p);
        }

        void main() {
          vSentiment = instanceSentiment;
          vBaseColor = instanceBaseColor;
          vOpacity = instanceOpacity;
          vUv = uv;
          float scale = 6.2;
          vec3 scaled = position * scale;
          vec4 worldPos = instanceMatrix * vec4(scaled, 1.0);
          // Subtle "alive" breath. Amplitude is sub-pixel at typical zoom, so
          // picking offsets stay imperceptible while edges (anchored to layout
          // positions) provide the steady visual frame.
          float fid = float(gl_InstanceID);
          float pa = hash11(fid + 0.13) * 6.2831853;
          float pb = hash11(fid + 0.71) * 6.2831853;
          float freq = 0.94 + hash11(fid + 1.37) * 0.16;
          float wobble = 0.97 + hash11(fid + 2.11) * 0.12;
          float ampScale = 0.92 + hash11(fid + 3.29) * 0.16;
          float omega = uTime * 1.382 * freq;
          float amp = uBreathAmp * ampScale;
          vec3 breath = vec3(
            sin(omega + pa),
            cos(omega * 1.13 * wobble + pb),
            sin(omega * 0.87 / wobble + pa) * 0.4
          ) * amp;
          worldPos.xyz += breath;
          vec4 mvPosition = modelViewMatrix * worldPos;
          gl_Position = projectionMatrix * mvPosition;
          vSelectionMix = float(abs(float(gl_InstanceID) - uSelectedIndex) < 0.5);
        }
      `,
      fragmentShader: `
        varying float vSentiment;
        varying vec3 vBaseColor;
        varying float vOpacity;
        varying float vSelectionMix;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float d = dot(p, p);
          if (d > 1.0) discard;
          float t = clamp(vSentiment * 0.5 + 0.5, 0.0, 1.0);
          vec3 cool = vec3(0.77, 0.83, 0.98);
          vec3 warm = vec3(0.98, 0.73, 0.64);
          vec3 sentimentTint = mix(cool, warm, t);
          vec3 base = mix(vBaseColor, sentimentTint, 0.06);
          vec3 selected = mix(base, vec3(1.0), 0.26);
          vec3 finalColor = mix(base, selected, vSelectionMix);
          float edge = smoothstep(1.0, 0.7, d);
          gl_FragColor = vec4(finalColor, vOpacity * edge);
        }
      `,
    });

    const nodeMesh = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, Math.max(1, nodes.length));
    nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    nodeMesh.frustumCulled = true;
    scene.add(nodeMesh);
    nodeMeshRef.current = nodeMesh;

    const edgeBreathVertex = `
      attribute float aNodeIdx;
      uniform float uTime;
      uniform float uBreathAmp;
      float hash11(float p) {
        p = fract(p * 0.1031);
        p *= p + 33.33;
        p *= p + p;
        return fract(p);
      }
      void main() {
        float fid = aNodeIdx;
        float pa = hash11(fid + 0.13) * 6.2831853;
        float pb = hash11(fid + 0.71) * 6.2831853;
        float freq = 0.94 + hash11(fid + 1.37) * 0.16;
        float wobble = 0.97 + hash11(fid + 2.11) * 0.12;
        float ampScale = 0.92 + hash11(fid + 3.29) * 0.16;
        float omega = uTime * 1.382 * freq;
        float amp = uBreathAmp * ampScale;
        vec3 breath = vec3(
          sin(omega + pa),
          cos(omega * 1.13 * wobble + pb),
          sin(omega * 0.87 / wobble + pa) * 0.4
        ) * amp;
        vec3 pos = position + breath;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;

    const edgeVertCount = Math.max(2, edges.length * 2);
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(edgeVertCount * 3), 3));
    edgeGeometry.setAttribute("aNodeIdx", new THREE.BufferAttribute(new Float32Array(edgeVertCount), 1));
    const edgeMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uBreathAmp: { value: 1.1 },
        uOpacity: { value: 0.38 },
        uColor: { value: colorFromStyle(EDGE_MUTED_OKLCH) },
      },
      vertexShader: edgeBreathVertex,
      fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uColor;
        void main() { gl_FragColor = vec4(uColor, uOpacity); }
      `,
    });
    const lines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    lines.frustumCulled = true;
    scene.add(lines);
    edgeLineRef.current = lines;

    const edgeActiveGeometry = new THREE.BufferGeometry();
    edgeActiveGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(edgeVertCount * 3), 3));
    edgeActiveGeometry.setAttribute("aNodeIdx", new THREE.BufferAttribute(new Float32Array(edgeVertCount), 1));
    const edgeActiveMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uBreathAmp: { value: 1.1 },
        uOpacity: { value: 0.68 },
        uColor: { value: colorFromStyle(EDGE_ACTIVE_OKLCH) },
      },
      vertexShader: edgeBreathVertex,
      fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uColor;
        void main() { gl_FragColor = vec4(uColor, uOpacity); }
      `,
    });
    const activeLines = new THREE.LineSegments(edgeActiveGeometry, edgeActiveMaterial);
    activeLines.frustumCulled = true;
    scene.add(activeLines);
    edgeActiveLineRef.current = activeLines;

    const labels = new BatchedText();
    labels.frustumCulled = true;
    scene.add(labels);
    labelBatchRef.current = labels;

    const onResize = () => {
      const w = Math.max(1, root.clientWidth);
      const h = Math.max(1, root.clientHeight);
      setViewport({ width: w, height: h });
      renderer.setSize(w, h);
      const halfW = w * 0.5;
      const halfH = h * 0.5;
      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfH;
      camera.bottom = -halfH;
      camera.updateProjectionMatrix();
    };
    onResize();

    const observer = new ResizeObserver(onResize);
    observer.observe(root);
    resizeObserverRef.current = observer;

    const startTime = performance.now();
    const renderLoop = () => {
      const t = (performance.now() - startTime) / 1000;
      breathTimeRef.current = t;
      const breathAmp = computeSharedBreathAmp(usePillOverlayRef.current, simStatusRef.current);
      const nowMesh = nodeMeshRef.current;
      if (nowMesh) {
        const mat = nowMesh.material as THREE.ShaderMaterial;
        if (mat?.uniforms?.uTime) mat.uniforms.uTime.value = t;
        if (mat?.uniforms?.uBreathAmp) mat.uniforms.uBreathAmp.value = breathAmp;
      }
      const el = edgeLineRef.current;
      if (el) {
        const mat = el.material as THREE.ShaderMaterial;
        if (mat?.uniforms?.uTime) mat.uniforms.uTime.value = t;
        if (mat?.uniforms?.uBreathAmp) mat.uniforms.uBreathAmp.value = breathAmp;
        // Smooth lerp toward the target opacity set by the layout effect.
        if (mat?.uniforms?.uOpacity) {
          const target = edgeMutedOpacityTargetRef.current;
          mat.uniforms.uOpacity.value += (target - mat.uniforms.uOpacity.value) * 0.07;
        }
      }
      const al = edgeActiveLineRef.current;
      if (al) {
        const mat = al.material as THREE.ShaderMaterial;
        if (mat?.uniforms?.uTime) mat.uniforms.uTime.value = t;
        if (mat?.uniforms?.uBreathAmp) mat.uniforms.uBreathAmp.value = breathAmp;
        if (mat?.uniforms?.uOpacity) {
          const target = edgeActiveOpacityTargetRef.current;
          mat.uniforms.uOpacity.value += (target - mat.uniforms.uOpacity.value) * 0.07;
        }
      }
      renderer.render(scene, camera);
      frameRef.current = window.requestAnimationFrame(renderLoop);
    };
    frameRef.current = window.requestAnimationFrame(renderLoop);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      if (cameraTweenFrameRef.current !== null) {
        window.cancelAnimationFrame(cameraTweenFrameRef.current);
        cameraTweenFrameRef.current = null;
      }
      resizeObserverRef.current?.disconnect();
      root.removeChild(renderer.domElement);
      labelBatchRef.current = null;
      nodeMeshRef.current = null;
      edgeLineRef.current = null;
      edgeActiveLineRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      bloomPassRef.current = null;
      composerRef.current = null;
      composerTargetRef.current?.dispose();
      composerTargetRef.current = null;
      renderer.dispose();
      baseGeometry.dispose();
      nodeMaterial.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
      edgeActiveGeometry.dispose();
      edgeActiveMaterial.dispose();
    };
  }, [edges.length, nodes.length, worldHeight, worldWidth]);

  useEffect(() => {
    const canvas = starfieldCanvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;

    const PARTICLE_COUNT = 6000;
    const SPHERE_RADIUS = 1000;
    const BG_COLOR = new THREE.Color(0x020202);

    const starScene = new THREE.Scene();
    starScene.background = BG_COLOR;
    starScene.fog = new THREE.FogExp2(BG_COLOR, 0.0008);

    const starCamera = new THREE.PerspectiveCamera(60, root.clientWidth / root.clientHeight, 1, 3000);
    starCamera.position.z = 600;

    const starRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    starRenderer.setSize(root.clientWidth, root.clientHeight);
    starRenderer.setPixelRatio(window.devicePixelRatio);
    starRenderer.outputColorSpace = THREE.SRGBColorSpace;
    starRenderer.setClearColor(0x020202, 1);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const phases = new Float32Array(PARTICLE_COUNT);
    const twinklingSpeeds = new Float32Array(PARTICLE_COUNT);
    // Power-law brightness: most stars are very dim, a tail reaches full brightness.
    // Exponent 2.4 puts ~80% of stars below 0.25 brightness while ~8% exceed 0.75.
    const brightnesses = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const radius = SPHERE_RADIUS * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
      sizes[i] = Math.random() * 1.1 + 0.35;
      phases[i] = Math.random() * Math.PI * 2;
      twinklingSpeeds[i] = Math.random() * 2.2 + 0.9;
      brightnesses[i] = Math.pow(Math.random(), 2.4);
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("twinklingSpeed", new THREE.BufferAttribute(twinklingSpeeds, 1));
    geometry.setAttribute("brightness", new THREE.BufferAttribute(brightnesses, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0.0 } },
      vertexShader: `
        attribute float size;
        attribute float phase;
        attribute float twinklingSpeed;
        attribute float brightness;
        varying float vAlpha;
        varying float vGlow;
        varying float vBrightness;
        uniform float time;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(size * (300.0 / -mvPosition.z), 0.5, 2.8);
          gl_Position = projectionMatrix * mvPosition;
          float blink = (sin(time * twinklingSpeed + phase) + 1.0) / 2.0;
          vAlpha = 0.1 + (blink * 0.9);
          vGlow = size;
          vBrightness = brightness;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying float vGlow;
        varying float vBrightness;

        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;
          float core = smoothstep(0.5, 0.1, dist);
          float halo = smoothstep(0.5, 0.3, dist) * 0.5;
          float strength = core + halo;
          gl_FragColor = vec4(1.0, 1.0, 1.0, strength * vAlpha * vBrightness * 0.35);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    starScene.add(particles);

    const onResize = () => {
      const width = Math.max(1, root.clientWidth);
      const height = Math.max(1, root.clientHeight);
      starCamera.aspect = width / height;
      starCamera.updateProjectionMatrix();
      starRenderer.setSize(width, height);
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(root);

    const clock = new THREE.Clock();
    let rafId: number | null = null;
    // How much the starfield parallax-drifts per world-unit of graph pan.
    // Stars are "infinitely far" so the ratio is tiny — just enough to feel
    // like depth without being distracting.
    const PARALLAX = 0.048;
    // FOV exponent: zoom-in tightens the star field slightly (< 1 = very subtle).
    const FOV_ZOOM_EXP = 0.11;
    const animate = () => {
      rafId = window.requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      material.uniforms.time.value = elapsedTime;

      // Drive the star camera from the graph camera so stars respond to pan/zoom
      // as if they sit at infinity behind the graph canvas.
      const graphCam = cameraRef.current;
      if (graphCam) {
        const panX = (graphCam.position.x - worldWidth * 0.5) * PARALLAX;
        const panY = (graphCam.position.y - worldHeight * 0.5) * PARALLAX;
        // lookAt offset: panning the graph right tilts stars left (parallax depth).
        starCamera.lookAt(panX, panY, 0);
        // Subtle FOV response: graph zoom-in slightly narrows the starfield FOV.
        starCamera.fov = 60 / Math.pow(graphCam.zoom / DEFAULT_CAMERA_ZOOM, FOV_ZOOM_EXP);
        starCamera.updateProjectionMatrix();
      } else {
        starCamera.lookAt(0, 0, 0);
      }

      starRenderer.render(starScene, starCamera);
    };

    onResize();
    animate();

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      starRenderer.dispose();
    };
  }, [worldHeight, worldWidth]);

  useEffect(() => {
    const bloom = bloomPassRef.current;
    if (!bloom) return;
    bloom.enabled = blurEffectsEnabled;
  }, [blurEffectsEnabled]);

  useEffect(() => {
    const applyTick = (ids: string[], positions: Float32Array, emitLayout: boolean) => {
      if (ids.length === 0 || positions.length === 0) return;
      const now = performance.now();
      const prevIds = nodeOrderRef.current;
      const prevPositions = positionsRef.current;
      if (sameNodeOrder(prevIds, ids) && prevPositions.length === positions.length) {
        // Blend continuity: start the next segment from what is currently
        // displayed, not from the last target keyframe.
        const displayed = buildInterpolatedPositions(prevIds) ?? prevPositions;
        previousPositionsRef.current = new Float32Array(displayed);
      } else {
        previousPositionsRef.current = new Float32Array(positions);
      }
      nodeOrderRef.current = ids;
      positionsRef.current = positions;
      const prevTickAt = tickTimingRef.current.lastTickAt;
      const nextInterval = prevTickAt > 0 ? Math.max(12, Math.min(80, now - prevTickAt)) : 32;
      tickTimingRef.current = { lastTickAt: now, intervalMs: nextInterval };
      if (emitLayout) {
        const nextLayout = new Map<string, { x: number; y: number }>();
        for (let i = 0; i < ids.length; i += 1) {
          const id = ids[i];
          if (!id) continue;
          nextLayout.set(id, { x: positions[i * 3] ?? 0, y: positions[i * 3 + 1] ?? 0 });
        }
        onLayoutChangeRef.current?.(nextLayout);
      }
      setStats({ nodes: ids.length, edges: edges.length });
      setLayoutRevision((current) => current + 1);
    };

    const ids = nodes.map((node) => node.id);
    const quick = new Float32Array(ids.length * 3);
    const seedLayout = layoutRef.current;
    const radius = 220 + Math.sqrt(Math.max(1, ids.length)) * 40;
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i] ?? `${i}`;
      const seeded = seedLayout.get(id);
      if (seeded) {
        quick[i * 3] = seeded.x;
        quick[i * 3 + 1] = seeded.y;
        quick[i * 3 + 2] = 0;
        continue;
      }
      const seed = seedFromId(id);
      const a = seededUnit(seed + 11) * Math.PI * 2;
      const r = Math.sqrt(seededUnit(seed + 29)) * radius;
      quick[i * 3] = worldWidth * 0.5 + Math.cos(a) * r;
      quick[i * 3 + 1] = worldHeight * 0.5 + Math.sin(a) * r;
      quick[i * 3 + 2] = (seededUnit(seed + 47) - 0.5) * 24;
    }
    applyTick(ids, quick, true);

    sessionRef.current?.stop();
    sessionRef.current = initForce3dSim(
      nodes,
      edges,
      {
        width: worldWidth,
        height: worldHeight,
        // Emit more frequently so node motion appears continuous.
        progressEvery: nodes.length >= 10000 ? 6 : nodes.length >= 4000 ? 2 : 1,
        alphaThreshold: 0.003,
        warmNodeThreshold: 4000,
        initialTicks: nodes.length >= 10000 ? 140 : nodes.length >= 4000 ? 200 : 300,
      },
      (tick) => {
        applyTick(tick.ids, tick.positions, true);
      },
      (nextStatus) => {
        simStatusRef.current = nextStatus;
        setSimStatus(nextStatus);
      },
    );

    return () => {
      sessionRef.current?.stop();
      sessionRef.current = null;
      simStatusRef.current = "idle";
      setSimStatus("idle");
    };
  }, [edges, nodes, worldHeight, worldWidth]);

  const [overlayMotionRevision, setOverlayMotionRevision] = useState(0);
  useEffect(() => {
    if (!usePillOverlay) return;
    let cancelled = false;
    let last = 0;
    const step = (now: number) => {
      if (cancelled) return;
      // Keep pill overlays in lockstep with GL line drift.
      if (now - last >= 16) {
        last = now;
        setOverlayMotionRevision((current) => current + 1);
      }
      window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
    return () => {
      cancelled = true;
    };
  }, [usePillOverlay]);

  useEffect(() => {
    const nodeMesh = nodeMeshRef.current;
    const lines = edgeLineRef.current;
    const activeLines = edgeActiveLineRef.current;
    const labels = labelBatchRef.current as unknown as {
      clear?: () => unknown;
      addText?: (text: Text) => void;
      sync?: () => void;
    } | null;
    if (!nodeMesh || !lines || !activeLines || !labels) return;

    const ids = nodeOrderRef.current;
    const positions = positionsRef.current;
    if (ids.length === 0 || positions.length === 0) return;

    const sentimentAttr = nodeMesh.geometry.getAttribute("instanceSentiment") as THREE.InstancedBufferAttribute | null;
    const baseColorAttr = nodeMesh.geometry.getAttribute("instanceBaseColor") as THREE.InstancedBufferAttribute | null;
    const opacityAttr = nodeMesh.geometry.getAttribute("instanceOpacity") as THREE.InstancedBufferAttribute | null;
    const hasSelection = selectedId !== null;
    const hasHover = !hasSelection && hoveredNodeId !== null;
    const effectiveNeighborIds = hasSelection ? neighborIds : hasHover ? hoverNeighborIds : new Set<string>();
    const effectiveActiveEdgeIds = hasSelection ? activeEdgeIds : hasHover ? hoverActiveEdgeIds : new Set<string>();
    const tmp = new THREE.Object3D();
    const nodeIndex = new Map<string, number>();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      if (!id) continue;
      nodeIndex.set(id, i);
      const x = positions[i * 3] ?? 0;
      const y = positions[i * 3 + 1] ?? 0;
      const z = positions[i * 3 + 2] ?? 0;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      tmp.position.set(x, y, z);
      tmp.scale.setScalar(1);
      tmp.updateMatrix();
      nodeMesh.setMatrixAt(i, tmp.matrix);
      const sentiment = sentiments[i] ?? sentimentForNode(id);
      const node = nodeById.get(id);
      const baseColor = parseRgbTuple(getEntityTypeStyle(node?.entityType ?? null).dotColor);
      const nodeSelected = hasSelection ? selectedId === id : hoveredNodeId === id;
      const nodeNeighbor = effectiveNeighborIds.has(id);
      const dimmed = (hasSelection || hasHover) && !nodeSelected && !nodeNeighbor;
      const hasPill = usePillOverlay && overlayNodeIdsRef.current.has(id);
      const alpha = hasPill ? 0 : dimmed ? 0.16 : nodeSelected ? 1 : nodeNeighbor ? 0.9 : 0.72;
      if (sentimentAttr && i < sentimentAttr.count) {
        sentimentAttr.setX(i, sentiment);
      }
      if (baseColorAttr && i < baseColorAttr.count) {
        baseColorAttr.setXYZ(i, baseColor[0], baseColor[1], baseColor[2]);
      }
      if (opacityAttr && i < opacityAttr.count) {
        opacityAttr.setX(i, alpha);
      }
    }
    nodeMesh.count = ids.length;
    nodeMesh.instanceMatrix.needsUpdate = true;
    if (sentimentAttr) sentimentAttr.needsUpdate = true;
    if (baseColorAttr) baseColorAttr.needsUpdate = true;
    if (opacityAttr) opacityAttr.needsUpdate = true;

    const center = new THREE.Vector3((minX + maxX) * 0.5, (minY + maxY) * 0.5, 0);
    const radius = Math.max(800, Math.hypot(maxX - minX, maxY - minY) * 0.6);
    nodeMesh.geometry.boundingSphere = new THREE.Sphere(center, radius);

    const edgePositions = lines.geometry.getAttribute("position") as THREE.BufferAttribute;
    const edgeNodeIdx = lines.geometry.getAttribute("aNodeIdx") as THREE.BufferAttribute;
    const activeEdgePositions = activeLines.geometry.getAttribute("position") as THREE.BufferAttribute;
    const activeEdgeNodeIdx = activeLines.geometry.getAttribute("aNodeIdx") as THREE.BufferAttribute;
    let edgeCursor = 0;
    let activeCursor = 0;
    for (const edge of edges) {
      const sourceIdx = nodeIndex.get(edge.source);
      const targetIdx = nodeIndex.get(edge.target);
      if (sourceIdx === undefined || targetIdx === undefined) continue;
      const sourceX = positions[sourceIdx * 3] ?? 0;
      const sourceY = positions[sourceIdx * 3 + 1] ?? 0;
      const sourceZ = positions[sourceIdx * 3 + 2] ?? 0;
      const targetX = positions[targetIdx * 3] ?? 0;
      const targetY = positions[targetIdx * 3 + 1] ?? 0;
      const targetZ = positions[targetIdx * 3 + 2] ?? 0;
      const isActive = effectiveActiveEdgeIds.has(edge.id);
      if (!isActive) {
        edgePositions.setXYZ(edgeCursor, sourceX, sourceY, sourceZ);
        edgeNodeIdx.setX(edgeCursor, sourceIdx);
        edgeCursor += 1;
        edgePositions.setXYZ(edgeCursor, targetX, targetY, targetZ);
        edgeNodeIdx.setX(edgeCursor, targetIdx);
        edgeCursor += 1;
        continue;
      }
      activeEdgePositions.setXYZ(activeCursor, sourceX, sourceY, sourceZ);
      activeEdgeNodeIdx.setX(activeCursor, sourceIdx);
      activeCursor += 1;
      activeEdgePositions.setXYZ(activeCursor, targetX, targetY, targetZ);
      activeEdgeNodeIdx.setX(activeCursor, targetIdx);
      activeCursor += 1;
    }
    lines.geometry.setDrawRange(0, edgeCursor);
    edgePositions.needsUpdate = true;
    edgeNodeIdx.needsUpdate = true;
    lines.geometry.boundingSphere = new THREE.Sphere(center, radius + 120);
    activeLines.geometry.setDrawRange(0, activeCursor);
    activeEdgePositions.needsUpdate = true;
    activeEdgeNodeIdx.needsUpdate = true;
    activeLines.geometry.boundingSphere = new THREE.Sphere(center, radius + 120);

    const highlightMaterial = activeLines.material as THREE.ShaderMaterial;
    // Write to lerp targets — the frame loop smoothly interpolates the actual uniforms.
    edgeMutedOpacityTargetRef.current = hasSelection ? 0.06 : 0.38;
    edgeActiveOpacityTargetRef.current = hasHover ? 0.92 : hasSelection ? 0.74 : 0.46;
    highlightMaterial.uniforms.uColor.value = colorFromStyle(
      hasHover && !hasSelection ? EDGE_HOVER_RGB : EDGE_ACTIVE_OKLCH,
    );

    labels.clear?.();
    if (!usePillOverlay) {
      for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i];
        const node = id ? nodeById.get(id) ?? null : null;
        if (!id || !node) continue;
        const nodeSelected = hasSelection ? selectedId === id : hoveredNodeId === id;
        const nodeNeighbor = effectiveNeighborIds.has(id);
        const shouldRender =
          !hasSelection && !hasHover ? i < 2200 : nodeSelected || nodeNeighbor || i < 320;
        if (!shouldRender) continue;
        const label = new Text();
        label.text = node.title;
        label.fontSize = nodeSelected ? 9.2 : 8.1;
        label.color = nodeSelected ? 0xfcfdff : nodeNeighbor ? 0xe8edf7 : 0xb8c3d6;
        label.anchorX = "center";
        label.anchorY = "middle";
        label.maxWidth = nodeSelected ? 130 : 95;
        label.position.set(
          positions[i * 3] ?? 0,
          (positions[i * 3 + 1] ?? 0) + (nodeSelected ? 2.5 : 1.5),
          (positions[i * 3 + 2] ?? 0) + 7,
        );
        labels.addText?.(label);
      }
    }
    labels.sync?.();

    const selectedIndex = selectedId ? nodeIndex.get(selectedId) ?? -1 : -1;
    const material = nodeMesh.material as THREE.ShaderMaterial;
    material.uniforms.uSelectedIndex.value = selectedIndex;
  }, [
    activeEdgeIds,
    edges,
    hoverActiveEdgeIds,
    hoverNeighborIds,
    hoveredNodeId,
    layoutRevision,
    neighborIds,
    nodeById,
    selectedId,
    sentiments,
    usePillOverlay,
  ]);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    onCameraZoomChange?.(camera.zoom);
  }, [cameraRevision, onCameraZoomChange]);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    if (cameraActionType === "zoom-in") {
      autoClusterFocusRef.current = false;
      camera.zoom = Math.min(MAX_CAMERA_ZOOM, Math.max(MIN_CAMERA_ZOOM, camera.zoom * CAMERA_ZOOM_STEP));
      camera.updateProjectionMatrix();
      setCameraRevision((current) => current + 1);
      return;
    }
    if (cameraActionType === "zoom-out") {
      autoClusterFocusRef.current = false;
      camera.zoom = Math.min(MAX_CAMERA_ZOOM, Math.max(MIN_CAMERA_ZOOM, camera.zoom / CAMERA_ZOOM_STEP));
      camera.updateProjectionMatrix();
      setCameraRevision((current) => current + 1);
      return;
    }
    if (cameraActionType === "reset" || cameraActionType === "frame-all") {
      camera.position.set(worldWidth * 0.5, worldHeight * 0.5, 1200);
      camera.zoom = DEFAULT_CAMERA_ZOOM;
      camera.updateProjectionMatrix();
      setCameraRevision((current) => current + 1);
      return;
    }
    if (cameraActionType === "frame-selection" && selectedIdRef.current) {
      // Explicit recenter should restore cluster-follow mode.
      autoClusterFocusRef.current = true;
      forceClusterFocusActionKeyRef.current = cameraActionKey;
      if (cameraTweenFrameRef.current !== null) {
        window.cancelAnimationFrame(cameraTweenFrameRef.current);
        cameraTweenFrameRef.current = null;
      }
      const ids = nodeOrderRef.current;
      const idx = ids.findIndex((id) => id === selectedIdRef.current);
      if (idx >= 0) {
        const rightOcclusionPx = rightPanelOcclusionPx;
        const bottomOcclusionPx = bottomPanelOcclusionPx;
        const x = positionsRef.current[idx * 3] ?? camera.position.x;
        const y = positionsRef.current[idx * 3 + 1] ?? camera.position.y;
        const nextZoom = Math.min(MAX_CAMERA_ZOOM, Math.max(1.2, camera.zoom));
        const focusShiftWorldX = rightOcclusionPx > 0 ? (rightOcclusionPx * 0.5 + 14) / Math.max(0.0001, nextZoom) : 0;
        const focusShiftWorldY =
          bottomOcclusionPx > 0 ? (bottomOcclusionPx * 0.5 + 10) / Math.max(0.0001, nextZoom) : 0;
        camera.position.set(x + focusShiftWorldX, y - focusShiftWorldY, 1200);
        camera.zoom = nextZoom;
        camera.updateProjectionMatrix();
        setCameraRevision((current) => current + 1);
      }
    }
  }, [bottomPanelOcclusionPx, cameraActionKey, cameraActionType, rightPanelOcclusionPx, worldHeight, worldWidth]);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera || !selectedId) return;
    const forceFocus = forceClusterFocusActionKeyRef.current === cameraActionKey;
    if (!forceFocus && !autoClusterFocusRef.current) return;
    if (forceFocus) {
      // Recenter is a one-shot intent, not a sticky mode.
      forceClusterFocusActionKeyRef.current = null;
    }

    // If a smooth tween is already running and this is just a layout-revision
    // re-fire (not a user-requested focus), let the tween finish undisturbed.
    // Cancelling mid-tween and snapping via a blend step is what causes the
    // end-of-animation jitter.
    if (!forceFocus && cameraTweenFrameRef.current !== null) return;

    const ids = nodeOrderRef.current;
    const positions = positionsRef.current;
    if (ids.length === 0 || positions.length === 0) return;

    const frameIds = new Set<string>([selectedId, ...Array.from(neighborIds)]);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let found = 0;
    for (const id of frameIds) {
      const idx = ids.indexOf(id);
      if (idx < 0) continue;
      const x = positions[idx * 3] ?? 0;
      const y = positions[idx * 3 + 1] ?? 0;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      found += 1;
    }
    if (found === 0) return;

    const boxW = Math.max(80, maxX - minX);
    const boxH = Math.max(80, maxY - minY);
    const rightOcclusionPx = rightPanelOcclusionPx;
    const bottomOcclusionPx = bottomPanelOcclusionPx;
    const fitWidthPx = Math.max(220, viewport.width - rightOcclusionPx - 24);
    const fitHeightPx = Math.max(220, viewport.height - bottomOcclusionPx - 24);
    const nextZoom = Math.min(
      MAX_CAMERA_ZOOM,
      Math.max(0.4, Math.min(fitWidthPx / (boxW + 180), fitHeightPx / (boxH + 180))),
    );
    const centerShiftWorldX = rightOcclusionPx > 0 ? (rightOcclusionPx * 0.5 + 14) / Math.max(0.0001, nextZoom) : 0;
    const centerShiftWorldY =
      bottomOcclusionPx > 0 ? (bottomOcclusionPx * 0.5 + 10) / Math.max(0.0001, nextZoom) : 0;
    const centerX = (minX + maxX) * 0.5 + centerShiftWorldX;
    const centerY = (minY + maxY) * 0.5 - centerShiftWorldY;
    if (!forceFocus) {
      // Keep the selected cluster centered as simulation/layout evolves. Use a
      // gentle blend so the camera drifts rather than snaps when physics ticks.
      const blend = 0.10;
      camera.position.x = camera.position.x + (centerX - camera.position.x) * blend;
      camera.position.y = camera.position.y + (centerY - camera.position.y) * blend;
      camera.zoom = camera.zoom + (nextZoom - camera.zoom) * blend;
      camera.updateProjectionMatrix();
      setCameraRevision((current) => current + 1);
      return;
    }
    // forceFocus: cancel any prior tween then start a fresh one.
    if (cameraTweenFrameRef.current !== null) {
      window.cancelAnimationFrame(cameraTweenFrameRef.current);
      cameraTweenFrameRef.current = null;
    }
    const startX = camera.position.x;
    const startY = camera.position.y;
    const startZoom = camera.zoom;
    const durationMs = 680;
    const startedAt = performance.now();
    // easeInOutCubic gives a smoother deceleration tail than easeOutCubic,
    // which avoids the micro-jitter that appears as t→1 under rAF scheduling.
    const ease = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const animate = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - startedAt) / durationMs));
      const e = ease(t);
      camera.position.x = startX + (centerX - startX) * e;
      camera.position.y = startY + (centerY - startY) * e;
      camera.zoom = startZoom + (nextZoom - startZoom) * e;
      camera.updateProjectionMatrix();
      setCameraRevision((current) => current + 1);
      if (t >= 1) {
        cameraTweenFrameRef.current = null;
        return;
      }
      cameraTweenFrameRef.current = window.requestAnimationFrame(animate);
    };
    cameraTweenFrameRef.current = window.requestAnimationFrame(animate);
  }, [
    bottomPanelOcclusionPx,
    cameraActionType,
    layoutRevision,
    neighborIds,
    rightPanelOcclusionPx,
    selectedId,
    viewport.height,
    viewport.width,
  ]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    if (!selectedId || nodes.length > 4000) {
      session.reheat({ alpha: 0.04, options: { width: worldWidth, height: worldHeight } });
      return;
    }
    const ids = nodeOrderRef.current;
    const idx = ids.findIndex((id) => id === selectedId);
    if (idx < 0) {
      session.reheat({ alpha: 0.06, options: { width: worldWidth, height: worldHeight } });
      return;
    }
    const x = positionsRef.current[idx * 3] ?? worldWidth * 0.5;
    const y = positionsRef.current[idx * 3 + 1] ?? worldHeight * 0.5;
    const z = positionsRef.current[idx * 3 + 2] ?? 0;
    session.reheat({
      alpha: 0.08,
      options: { width: worldWidth, height: worldHeight },
      fixedNodes: [{ id: selectedId, x, y, z, ttlTicks: 40 }],
    });
  }, [nodes.length, selectedId, worldHeight, worldWidth]);

  // When a node is focused, expand the collision radius for the entire focused
  // cluster (selected + all neighbors) so the force simulation pushes them
  // apart until their pill labels no longer overlap.
  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    const focusNodeIds = selectedId
      ? [selectedId, ...Array.from(neighborIds)]
      : [];
    session.reheat({
      focusNodeIds,
      alpha: focusNodeIds.length > 0 ? 0.18 : 0.04,
    });
  }, [selectedId, neighborIds]);

  useEffect(() => {
    const root = rootRef.current;
    const camera = cameraRef.current;
    const nodeMesh = nodeMeshRef.current;
    if (!root || !camera || !nodeMesh) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      // Let HTML controls (pill buttons, overlay controls) own their clicks.
      if (target?.closest("button")) return;
      dragRef.current = { active: true, x: event.clientX, y: event.clientY, moved: false };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (dragRef.current.active) {
        const dx = event.clientX - dragRef.current.x;
        const dy = event.clientY - dragRef.current.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) dragRef.current.moved = true;
        if (dragRef.current.moved) autoClusterFocusRef.current = false;
        camera.position.x -= dx / camera.zoom;
        camera.position.y += dy / camera.zoom;
        dragRef.current.x = event.clientX;
        dragRef.current.y = event.clientY;
        setCameraRevision((current) => current + 1);
        setHoverPreview(null);
        return;
      }
      if (nodes.length > 4000) {
        const now = performance.now();
        if (now - hoverPickAtRef.current < 48) return;
        hoverPickAtRef.current = now;
      }
      const rect = root.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const vp = { width: rect.width, height: rect.height };
      const ids = nodeOrderRef.current;
      const positions = positionsRef.current;
      const pickRadius = 18;
      let bestId: string | null = null;
      let bestIdx = -1;
      let bestDist = pickRadius;
      for (let i = 0; i < ids.length; i++) {
        const wx = positions[i * 3] ?? 0;
        const wy = positions[i * 3 + 1] ?? 0;
        const wz = positions[i * 3 + 2] ?? 0;
        const s = projectToScreen(wx, wy, wz, camera, vp);
        const d = Math.hypot(s.x - mx, s.y - my);
        if (d < bestDist) {
          bestDist = d;
          bestId = ids[i] ?? null;
          bestIdx = i;
        }
      }
      if (!bestId) {
        if (!usePillOverlayRef.current) setHoveredNodeId(null);
        setHoverPreview(null);
        return;
      }
      setHoveredNodeId((current) => (current === bestId ? current : bestId));
      const hitNode = nodeById.get(bestId);
      if (hitNode) {
        const sx = positions[bestIdx * 3] ?? 0;
        const sy = positions[bestIdx * 3 + 1] ?? 0;
        const sz = positions[bestIdx * 3 + 2] ?? 0;
        const screen = projectToScreen(sx, sy, sz, camera, vp);
        setHoverPreview((current) => {
          if (
            current &&
            current.nodeId === bestId &&
            Math.abs(current.x - screen.x) < 2 &&
            Math.abs(current.y - screen.y) < 2
          ) {
            return current;
          }
          return {
            nodeId: bestId!,
            title: hitNode.title,
            entityType: hitNode.entityType,
            x: screen.x,
            y: screen.y,
          };
        });
      } else {
        setHoverPreview(null);
      }
      const now = performance.now();
      if (hoverPerturbRef.current.id === bestId) return;
      if (now - hoverPerturbRef.current.at < 140) return;
      hoverPerturbRef.current = { id: bestId, at: now };
      const px = positions[bestIdx * 3] ?? worldWidth * 0.5;
      const py = positions[bestIdx * 3 + 1] ?? worldHeight * 0.5;
      const pz = positions[bestIdx * 3 + 2] ?? 0;
      sessionRef.current?.reheat({
        alpha: 0.03,
        options: { width: worldWidth, height: worldHeight },
        fixedNodes: [{ id: bestId, x: px, y: py, z: pz, ttlTicks: 12 }],
      });
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!dragRef.current.active) return;
      const moved = dragRef.current.moved;
      dragRef.current.active = false;
      if (moved) return;
      const rect = root.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const intersections = raycasterRef.current.intersectObject(nodeMesh, false);
      const hit = intersections[0];
      const instanceId = hit?.instanceId;
      if (instanceId === undefined) {
        onSelect(null);
        setOverlay(null);
        return;
      }
      const id = nodeOrderRef.current[instanceId];
      const node = nodeById.get(id);
      if (!id || !node) return;
      onSelect(id);
      if (enableNodeOverlayCard) {
        setOverlay({
          nodeId: id,
          title: node.title,
          body: bodyForNode(node.title),
        });
      } else {
        setOverlay(null);
      }
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      autoClusterFocusRef.current = false;
      const zoom = Math.exp(-event.deltaY * 0.0016);
      camera.zoom = Math.min(MAX_CAMERA_ZOOM, Math.max(MIN_CAMERA_ZOOM, camera.zoom * zoom));
      camera.updateProjectionMatrix();
      setCameraRevision((current) => current + 1);
    };
    const onPointerLeave = () => {
      setHoveredNodeId(null);
      setHoverPreview(null);
    };

    root.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("pointerleave", onPointerLeave);
    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [
    enableNodeOverlayCard,
    nodeById,
    nodes.length,
    onSelect,
    selectedId,
    worldHeight,
    worldWidth,
  ]);

  const overlayNodes = useMemo(() => {
    if (!usePillOverlay) return [];
    const camera = cameraRef.current;
    if (!camera) return [];
    const ids = nodeOrderRef.current;
    const positions = usePillOverlay ? buildInterpolatedPositions(ids) ?? positionsRef.current : positionsRef.current;
    if (ids.length === 0 || positions.length === 0) return [];
    const worldViewWidth = Math.max(1, (camera.right - camera.left) / Math.max(0.0001, camera.zoom));
    const worldViewHeight = Math.max(1, (camera.top - camera.bottom) / Math.max(0.0001, camera.zoom));
    const viewMinX = camera.position.x - worldViewWidth * 0.5;
    const viewMinY = camera.position.y - worldViewHeight * 0.5;
    const bucketWorld = Math.max(90, Math.round(220 / Math.max(0.4, camera.zoom)));
    const viewBucketX = Math.floor(viewMinX / bucketWorld);
    const viewBucketY = Math.floor(viewMinY / bucketWorld);
    const zoomBucket = Math.round(camera.zoom * 10);
    const selectionKey =
      selectedId === null
        ? "none"
        : `${selectedId}:${Array.from(neighborIds).sort().slice(0, 96).join(",")}`;
    const packKey = `lr:${layoutRevision}|n:${ids.length}|sel:${selectionKey}|vx:${viewBucketX}|vy:${viewBucketY}|z:${zoomBucket}|u:${usePillOverlay ? 1 : 0}`;
    let packed = overlayPackCacheRef.current.entries;

    if (overlayPackCacheRef.current.key !== packKey) {
      const targetIds = new Set<string>();
      let sampleStride = 1;
      let sampleOffset = 0;
      if (selectedId) {
        targetIds.add(selectedId);
        // No cap — all neighbors must become pills when a node is focused.
        for (const id of neighborIds) {
          targetIds.add(id);
        }
      } else {
        const cap = Math.min(ids.length, 1200);
        sampleStride = Math.max(1, Math.floor(ids.length / Math.max(1, cap)));
        const hash = Math.abs((viewBucketX * 73856093) ^ (viewBucketY * 19349663));
        sampleOffset = sampleStride > 1 ? hash % sampleStride : 0;
      }

      const candidates: Array<{
        id: string;
        title: string;
        entityType: string | null;
        nodeIndex: number;
        worldX: number;
        worldY: number;
        worldZ: number;
        selected: boolean;
        neighbor: boolean;
        priority: number;
        estWidth: number;
        estHeight: number;
        screenX: number;
        screenY: number;
      }> = [];

      for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i];
        if (!id) continue;
        if (selectedId) {
          if (!targetIds.has(id)) continue;
        } else if (sampleStride > 1 && (i + sampleOffset) % sampleStride !== 0) {
          continue;
        }
        const node = nodeById.get(id);
        if (!node) continue;
        const worldX = positions[i * 3] ?? 0;
        const worldY = positions[i * 3 + 1] ?? 0;
        const worldZ = positions[i * 3 + 2] ?? 0;
        const screen = projectToScreen(worldX, worldY, worldZ, camera, viewport);
        if (
          screen.x < -140 ||
          screen.y < -80 ||
          screen.x > viewport.width + 140 ||
          screen.y > viewport.height + 80
        ) {
          continue;
        }
        const selected = selectedId === id;
        const neighbor = neighborIds.has(id);
        const estWidth = Math.max(72, Math.min(228, node.title.length * 6.4 + (selected ? 56 : 42)));
        const estHeight = selected ? 30 : 26;
        const priority = (selected ? 1_000_000 : 0) + (neighbor ? 100_000 : 0) + (ids.length - i);
        candidates.push({
          id,
          title: node.title,
          entityType: node.entityType,
          nodeIndex: i,
          worldX,
          worldY,
          worldZ,
          selected,
          neighbor,
          priority,
          estWidth,
          estHeight,
          screenX: screen.x,
          screenY: screen.y,
        });
      }

      candidates.sort((a, b) => b.priority - a.priority);
      const accepted: typeof candidates = [];
      const cellSize = 56;
      const maxLabels = selectedId ? 280 : 560;
      const buckets = new Map<string, number[]>();
      const aabbOverlaps = (
        ax: number,
        ay: number,
        aw: number,
        ah: number,
        bx: number,
        by: number,
        bw: number,
        bh: number,
      ): boolean => {
        const pad = 4;
        return (
          Math.abs(ax - bx) * 2 < aw + bw + pad * 2 &&
          Math.abs(ay - by) * 2 < ah + bh + pad * 2
        );
      };

      for (const item of candidates) {
        if (accepted.length >= maxLabels) break;
        const minCellX = Math.floor((item.screenX - item.estWidth * 0.5) / cellSize);
        const maxCellX = Math.floor((item.screenX + item.estWidth * 0.5) / cellSize);
        const minCellY = Math.floor((item.screenY - item.estHeight * 0.5) / cellSize);
        const maxCellY = Math.floor((item.screenY + item.estHeight * 0.5) / cellSize);
        let blocked = false;
        if (!item.selected && !item.neighbor) {
          for (let cx = minCellX; cx <= maxCellX && !blocked; cx += 1) {
            for (let cy = minCellY; cy <= maxCellY && !blocked; cy += 1) {
              const bucket = buckets.get(`${cx}:${cy}`);
              if (!bucket) continue;
              for (const acceptedIndex of bucket) {
                const other = accepted[acceptedIndex];
                if (!other) continue;
                if (
                  aabbOverlaps(
                    item.screenX,
                    item.screenY,
                    item.estWidth,
                    item.estHeight,
                    other.screenX,
                    other.screenY,
                    other.estWidth,
                    other.estHeight,
                  )
                ) {
                  blocked = true;
                  break;
                }
              }
            }
          }
        }
        if (blocked) continue;
        const nextIndex = accepted.length;
        accepted.push(item);
        for (let cx = minCellX; cx <= maxCellX; cx += 1) {
          for (let cy = minCellY; cy <= maxCellY; cy += 1) {
            const key = `${cx}:${cy}`;
            const bucket = buckets.get(key) ?? [];
            bucket.push(nextIndex);
            buckets.set(key, bucket);
          }
        }
      }

      packed = accepted.map((entry) => ({
        id: entry.id,
        title: entry.title,
        entityType: entry.entityType,
        nodeIndex: entry.nodeIndex,
        selected: entry.selected,
        neighbor: entry.neighbor,
        estWidth: entry.estWidth,
        estHeight: entry.estHeight,
        worldX: entry.worldX,
        worldY: entry.worldY,
        worldZ: entry.worldZ,
      }));
      overlayPackCacheRef.current = { key: packKey, entries: packed };
    }

    const out: Array<{
      id: string;
      title: string;
      entityType: string | null;
      screenX: number;
      screenY: number;
      selected: boolean;
      neighbor: boolean;
      estWidth: number;
      estHeight: number;
    }> = [];
    const breathAmp = computeSharedBreathAmp(usePillOverlay, simStatusRef.current);
    for (const entry of packed) {
      const idx = entry.nodeIndex;
      if (idx < 0) continue;
      const worldX = positions[idx * 3] ?? entry.worldX;
      const worldY = positions[idx * 3 + 1] ?? entry.worldY;
      const worldZ = positions[idx * 3 + 2] ?? entry.worldZ;
      const baseScreen = projectToScreen(worldX, worldY, worldZ, camera, viewport);
      const breathed = applyBreathOffset(worldX, worldY, worldZ, idx, breathTimeRef.current, breathAmp);
      const breathScreen = projectToScreen(breathed.x, breathed.y, breathed.z, camera, viewport);
      if (
        baseScreen.x < -140 ||
        baseScreen.y < -80 ||
        baseScreen.x > viewport.width + 140 ||
        baseScreen.y > viewport.height + 80
      ) {
        continue;
      }
      out.push({
        id: entry.id,
        title: entry.title,
        entityType: entry.entityType,
        screenX: breathScreen.x,
        screenY: breathScreen.y,
        selected: entry.selected,
        neighbor: entry.neighbor,
        estWidth: entry.estWidth,
        estHeight: entry.estHeight,
      });
    }
    out.sort((a, b) => Number(a.selected) - Number(b.selected));
    const idSet = new Set(out.map((entry) => entry.id));
    overlayNodeIdsRef.current = idSet;
    return out;
  }, [
    cameraRevision,
    layoutRevision,
    neighborIds,
    nodeById,
    selectedId,
    usePillOverlay,
    viewport,
    overlayMotionRevision,
  ]);

  return (
    <div
      ref={rootRef}
      className={`${styles.graphRoot} ${!blurEffectsEnabled ? styles.blurDisabled : ""} ${simStatus === "active" ? styles.physicsActive : ""}`}
      role="presentation"
      aria-label="threejs entity graph"
    >
      <canvas
        ref={starfieldCanvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {usePillOverlay ? (
        <div className={styles.webglHtmlOverlay}>
          {overlayNodes.map((node) => {
            const typeStyle = getEntityTypeStyle(node.entityType);
            const phase = ((seedFromId(node.id) % 1000) / 1000).toFixed(3);
            return (
              <button
                key={node.id}
                type="button"
                className={[
                  styles.pillNode,
                  node.selected ? styles.pillNodeSelected : "",
                  !node.selected && node.neighbor ? styles.pillNodeNeighbor : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  left: 0,
                  top: 0,
                  transform: `translate3d(${node.screenX}px, ${node.screenY}px, 0) translate(-50%, -50%)`,
                  paddingInline: "12px",
                  "--pill-phase": phase,
                  willChange: "transform",
                } as React.CSSProperties}
                title={node.title}
                onPointerEnter={() => {
                  setHoveredNodeId(node.id);
                }}
                onPointerLeave={() => {
                  setHoveredNodeId((current) => (current === node.id ? null : current));
                  setHoverPreview((current) => (current?.nodeId === node.id ? null : current));
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(node.id);
                }}
              >
                <span className={styles.pillTypeDot} style={{ background: typeStyle.dotColor }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{node.title}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {hoverPreview && !overlayNodeIdsRef.current.has(hoverPreview.nodeId) ? (() => {
        const hoverTypeStyle = getEntityTypeStyle(hoverPreview.entityType);
        const previewId = hoverPreview.nodeId;
        const previewTransform = `translate3d(${hoverPreview.x}px, ${hoverPreview.y}px, 0) translate(-50%, -50%)`;
        return (
          <>
            {/* Expanding glow ring — re-mounts per node to retrigger the animation */}
            <div
              key={`ring-${previewId}`}
              className={styles.hoverGlowRing}
              style={{ left: 0, top: 0, transform: previewTransform }}
            />
            <button
              type="button"
              className={`${styles.pillNode} ${styles.hoverPill}`}
              style={{
                left: 0,
                top: 0,
                transform: previewTransform,
                paddingInline: "12px",
                willChange: "transform",
              }}
              title={hoverPreview.title}
              onPointerEnter={() => setHoveredNodeId(previewId)}
              onPointerLeave={() => {
                setHoveredNodeId((current) => (current === previewId ? null : current));
                setHoverPreview((current) => (current?.nodeId === previewId ? null : current));
              }}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(previewId);
                setHoverPreview(null);
              }}
            >
              <span className={styles.pillTypeDot} style={{ background: hoverTypeStyle.dotColor }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{hoverPreview.title}</span>
            </button>
          </>
        );
      })() : null}
      {showStatsFooter ? (
        <div className={styles.edgeTooltip}>
          {statsFooterLabel} · {stats.nodes.toLocaleString()} nodes · {stats.edges.toLocaleString()} edges
        </div>
      ) : null}
      {enableNodeOverlayCard && overlay ? (
        <div className={styles.threeOverlayCard}>
          <span className={styles.threeOverlayMeta}>{overlay.nodeId}</span>
          <h3 className={styles.threeOverlayTitle}>{overlay.title}</h3>
          <p className={styles.threeOverlayBody}>{overlay.body}</p>
          <button type="button" className={styles.threeOverlayClose} onClick={() => setOverlay(null)}>
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
