"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BatchedText, Text } from "troika-three-text";

import styles from "@/src/components/dev/entity-graph-lab.module.css";
import type { GraphCanvasSharedProps } from "@/src/components/dev/entity-graph-renderer-types";
import { getEntityTypeStyle } from "@/src/lib/entity-graph-type-style";
import type { GraphNode } from "@/src/lib/graph-types";
import { initForce3dSim, type Force3dSession } from "@/src/lib/entity-graph-force3d-client";

type OverlayState = {
  nodeId: string;
  title: string;
  body: string;
};

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
  const match = input.match(/rgba?\(([^)]+)\)/i);
  if (!match) return [0.82, 0.86, 0.92];
  const parts = (match[1] ?? "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value));
  if (parts.length < 3) return [0.82, 0.86, 0.92];
  return [parts[0]! / 255, parts[1]! / 255, parts[2]! / 255];
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

export function EntityGraphThreeCanvas({
  nodes,
  edges,
  blurEffectsEnabled = true,
  selectedId,
  neighborIds,
  activeEdgeIds,
  worldWidth,
  worldHeight,
  cameraActionKey,
  cameraActionType,
  onSelect,
  onLayoutChange,
}: GraphCanvasSharedProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
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
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const dragRef = useRef<{ active: boolean; x: number; y: number; moved: boolean }>({
    active: false,
    x: 0,
    y: 0,
    moved: false,
  });
  const nodeOrderRef = useRef<string[]>([]);
  const positionsRef = useRef<Float32Array>(new Float32Array());
  const selectedIdRef = useRef<string | null>(selectedId);
  const sessionRef = useRef<Force3dSession | null>(null);
  const simStatusRef = useRef<"active" | "idle" | "frozen">("idle");
  const hoverPerturbRef = useRef<{ id: string | null; at: number }>({ id: null, at: 0 });

  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [cameraRevision, setCameraRevision] = useState(0);
  const [viewport, setViewport] = useState({ width: 1000, height: 760 });
  const [simStatus, setSimStatus] = useState<"active" | "idle" | "frozen">("idle");
  const sentiments = useMemo(() => nodes.map((node) => sentimentForNode(node.id)), [nodes]);
  const nodeById = useMemo(() => buildNodeIndex(nodes), [nodes]);
  const usePillOverlay = nodes.length <= 2500 || selectedId !== null;
  const overlayNodeIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    onLayoutChangeRef.current = onLayoutChange;
  }, [onLayoutChange]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(root.clientWidth, root.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    root.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1018);
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(-500, 500, 380, -380, -5000, 5000);
    camera.position.set(worldWidth * 0.5, worldHeight * 0.5, 1200);
    camera.lookAt(worldWidth * 0.5, worldHeight * 0.5, 0);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    cameraRef.current = camera;

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.5);
    dir.position.set(0, 0, 900);
    scene.add(dir);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
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
          float t = clamp(instanceSentiment * 0.5 + 0.5, 0.0, 1.0);
          float scale = mix(4.2, 8.2, t);
          vec3 scaled = position * scale;
          vec4 worldPos = instanceMatrix * vec4(scaled, 1.0);
          // Subtle "alive" breath. Amplitude is sub-pixel at typical zoom, so
          // picking offsets stay imperceptible while edges (anchored to layout
          // positions) provide the steady visual frame.
          float fid = float(gl_InstanceID);
          float pa = hash11(fid + 0.13) * 6.2831853;
          float pb = hash11(fid + 0.71) * 6.2831853;
          float omega = uTime * 1.382;
          vec3 breath = vec3(
            sin(omega + pa),
            cos(omega * 1.13 + pb),
            sin(omega * 0.87 + pa) * 0.4
          ) * uBreathAmp;
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
          vec3 base = mix(vBaseColor, sentimentTint, 0.2);
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
        float omega = uTime * 1.382;
        vec3 breath = vec3(
          sin(omega + pa),
          cos(omega * 1.13 + pb),
          sin(omega * 0.87 + pa) * 0.4
        ) * uBreathAmp;
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
        uOpacity: { value: 0.34 },
        uColor: { value: new THREE.Color(0x6f7b8c) },
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
        uColor: { value: new THREE.Color(0xf7be72) },
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
      composer.setSize(w, h);
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
      const breathAmp = simStatusRef.current === "active" ? 0.18 : 1.1;
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
      }
      const al = edgeActiveLineRef.current;
      if (al) {
        const mat = al.material as THREE.ShaderMaterial;
        if (mat?.uniforms?.uTime) mat.uniforms.uTime.value = t;
        if (mat?.uniforms?.uBreathAmp) mat.uniforms.uBreathAmp.value = breathAmp;
      }
      composer.render();
      frameRef.current = window.requestAnimationFrame(renderLoop);
    };
    frameRef.current = window.requestAnimationFrame(renderLoop);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
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
    const bloom = bloomPassRef.current;
    if (!bloom) return;
    bloom.enabled = blurEffectsEnabled;
  }, [blurEffectsEnabled]);

  useEffect(() => {
    const applyTick = (ids: string[], positions: Float32Array, emitLayout: boolean) => {
      if (ids.length === 0 || positions.length === 0) return;
      nodeOrderRef.current = ids;
      positionsRef.current = positions;
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
    const radius = 220 + Math.sqrt(Math.max(1, ids.length)) * 40;
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i] ?? `${i}`;
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
        progressEvery: nodes.length >= 10000 ? 8 : nodes.length >= 4000 ? 6 : 4,
        alphaThreshold: 0.003,
        warmNodeThreshold: 4000,
        initialTicks: nodes.length >= 10000 ? 20 : nodes.length >= 4000 ? 26 : 32,
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
      const nodeSelected = selectedId === id;
      const nodeNeighbor = neighborIds.has(id);
      const dimmed = selectedId !== null && !nodeSelected && !nodeNeighbor;
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
      const isActive = activeEdgeIds.has(edge.id);
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

    const mutedMaterial = lines.material as THREE.ShaderMaterial;
    const highlightMaterial = activeLines.material as THREE.ShaderMaterial;
    mutedMaterial.uniforms.uOpacity.value = selectedId ? 0.14 : 0.32;
    highlightMaterial.uniforms.uOpacity.value = selectedId ? 0.74 : 0.46;

    labels.clear?.();
    if (!usePillOverlay) {
      for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i];
        const node = id ? nodeById.get(id) ?? null : null;
        if (!id || !node) continue;
        const nodeSelected = selectedId === id;
        const nodeNeighbor = neighborIds.has(id);
        const shouldRender =
          selectedId === null ? i < 2200 : nodeSelected || nodeNeighbor || i < 320;
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
  }, [activeEdgeIds, edges, layoutRevision, neighborIds, nodeById, selectedId, sentiments, usePillOverlay]);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    if (cameraActionType === "reset" || cameraActionType === "frame-all") {
      camera.position.set(worldWidth * 0.5, worldHeight * 0.5, 1200);
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      setCameraRevision((current) => current + 1);
      return;
    }
    if (cameraActionType === "frame-selection" && selectedIdRef.current) {
      const ids = nodeOrderRef.current;
      const idx = ids.findIndex((id) => id === selectedIdRef.current);
      if (idx >= 0) {
        const x = positionsRef.current[idx * 3] ?? camera.position.x;
        const y = positionsRef.current[idx * 3 + 1] ?? camera.position.y;
        camera.position.set(x, y, 1200);
        camera.zoom = Math.min(2.2, Math.max(1.2, camera.zoom));
        camera.updateProjectionMatrix();
        setCameraRevision((current) => current + 1);
      }
    }
  }, [cameraActionKey, cameraActionType, worldHeight, worldWidth]);

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

  useEffect(() => {
    const root = rootRef.current;
    const camera = cameraRef.current;
    const nodeMesh = nodeMeshRef.current;
    if (!root || !camera || !nodeMesh) return;

    const onPointerDown = (event: PointerEvent) => {
      dragRef.current = { active: true, x: event.clientX, y: event.clientY, moved: false };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (dragRef.current.active) {
        const dx = event.clientX - dragRef.current.x;
        const dy = event.clientY - dragRef.current.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) dragRef.current.moved = true;
        camera.position.x -= dx / camera.zoom;
        camera.position.y += dy / camera.zoom;
        dragRef.current.x = event.clientX;
        dragRef.current.y = event.clientY;
        setCameraRevision((current) => current + 1);
        return;
      }
      if (nodes.length > 4000) return;
      const now = performance.now();
      if (now - hoverPerturbRef.current.at < 140) return;
      const rect = root.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const hit = raycasterRef.current.intersectObject(nodeMesh, false)[0];
      const hitInstance = hit?.instanceId;
      if (hitInstance === undefined) return;
      const hitId = nodeOrderRef.current[hitInstance] ?? null;
      if (!hitId || hoverPerturbRef.current.id === hitId) return;
      hoverPerturbRef.current = { id: hitId, at: now };
      const x = positionsRef.current[hitInstance * 3] ?? worldWidth * 0.5;
      const y = positionsRef.current[hitInstance * 3 + 1] ?? worldHeight * 0.5;
      const z = positionsRef.current[hitInstance * 3 + 2] ?? 0;
      sessionRef.current?.reheat({
        alpha: 0.03,
        options: { width: worldWidth, height: worldHeight },
        fixedNodes: [{ id: hitId, x, y, z, ttlTicks: 12 }],
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
      setOverlay({
        nodeId: id,
        title: node.title,
        body: bodyForNode(node.title),
      });
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const zoom = Math.exp(-event.deltaY * 0.0016);
      camera.zoom = Math.min(6, Math.max(0.22, camera.zoom * zoom));
      camera.updateProjectionMatrix();
      setCameraRevision((current) => current + 1);
    };

    root.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("wheel", onWheel);
    };
  }, [nodeById, nodes.length, onSelect, worldHeight, worldWidth]);

  const overlayNodes = useMemo(() => {
    if (!usePillOverlay) return [];
    const camera = cameraRef.current;
    if (!camera) return [];
    const ids = nodeOrderRef.current;
    const positions = positionsRef.current;
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
      if (selectedId) {
        targetIds.add(selectedId);
        let added = 0;
        for (const id of neighborIds) {
          targetIds.add(id);
          added += 1;
          if (added >= 80) break;
        }
      } else {
        const cap = Math.min(ids.length, 1200);
        for (let i = 0; i < cap; i += 1) {
          const id = ids[i];
          if (id) targetIds.add(id);
        }
      }

      const candidates: Array<{
        id: string;
        title: string;
        entityType: string | null;
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
        if (!id || !targetIds.has(id)) continue;
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
      const maxLabels = selectedId ? 280 : 900;
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
        if (!item.selected) {
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
    for (const entry of packed) {
      const screen = projectToScreen(entry.worldX, entry.worldY, entry.worldZ, camera, viewport);
      if (
        screen.x < -140 ||
        screen.y < -80 ||
        screen.x > viewport.width + 140 ||
        screen.y > viewport.height + 80
      ) {
        continue;
      }
      out.push({
        id: entry.id,
        title: entry.title,
        entityType: entry.entityType,
        screenX: screen.x,
        screenY: screen.y,
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
  ]);

  return (
    <div
      ref={rootRef}
      className={`${styles.graphRoot} ${!blurEffectsEnabled ? styles.blurDisabled : ""} ${simStatus === "active" ? styles.physicsActive : ""}`}
      role="presentation"
      aria-label="threejs entity graph"
    >
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
                  left: node.screenX,
                  top: node.screenY,
                  paddingInline: "12px",
                  "--pill-phase": phase,
                } as React.CSSProperties}
                title={node.title}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(node.id);
                }}
              >
                <span className={styles.pillTypeDot} style={{ background: typeStyle.dotColor }} />
                {node.title}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className={styles.edgeTooltip}>
        three.js · worker force3d · {stats.nodes.toLocaleString()} nodes · {stats.edges.toLocaleString()} edges
      </div>
      {overlay ? (
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
