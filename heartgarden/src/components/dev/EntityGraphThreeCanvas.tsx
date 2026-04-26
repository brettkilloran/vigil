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
import { solveGraphForce3dInWorker } from "@/src/lib/entity-graph-force3d-client";

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

export function EntityGraphThreeCanvas({
  nodes,
  edges,
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
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const nodeMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const edgeLineRef = useRef<THREE.LineSegments | null>(null);
  const edgeActiveLineRef = useRef<THREE.LineSegments | null>(null);
  const labelBatchRef = useRef<BatchedText | null>(null);
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

  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [cameraRevision, setCameraRevision] = useState(0);
  const [viewport, setViewport] = useState({ width: 1000, height: 760 });
  const sentiments = useMemo(() => nodes.map((node) => sentimentForNode(node.id)), [nodes]);
  const nodeById = useMemo(() => buildNodeIndex(nodes), [nodes]);
  const usePillOverlay = nodes.length <= 2500 || selectedId !== null;

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

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
      },
      vertexShader: `
        attribute float instanceSentiment;
        attribute vec3 instanceBaseColor;
        attribute float instanceOpacity;
        varying float vSentiment;
        varying vec3 vBaseColor;
        varying float vOpacity;
        varying float vSelectionMix;
        uniform float uSelectedIndex;
        void main() {
          vSentiment = instanceSentiment;
          vBaseColor = instanceBaseColor;
          vOpacity = instanceOpacity;
          float t = clamp(instanceSentiment * 0.5 + 0.5, 0.0, 1.0);
          float scale = mix(4.2, 8.2, t);
          vec3 scaled = position * scale;
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(scaled, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          vSelectionMix = float(abs(float(gl_InstanceID) - uSelectedIndex) < 0.5);
        }
      `,
      fragmentShader: `
        varying float vSentiment;
        varying vec3 vBaseColor;
        varying float vOpacity;
        varying float vSelectionMix;
        void main() {
          vec2 p = uv * 2.0 - 1.0;
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

    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(Math.max(2, edges.length * 6)), 3));
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x6f7b8c,
      transparent: true,
      opacity: 0.34,
    });
    const lines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    lines.frustumCulled = true;
    scene.add(lines);
    edgeLineRef.current = lines;

    const edgeActiveGeometry = new THREE.BufferGeometry();
    edgeActiveGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(Math.max(2, edges.length * 6)), 3));
    const edgeActiveMaterial = new THREE.LineBasicMaterial({
      color: 0xf7be72,
      transparent: true,
      opacity: 0.68,
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

    const renderLoop = () => {
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
    let cancelled = false;
    void solveGraphForce3dInWorker(nodes, edges, {
      width: worldWidth,
      height: worldHeight,
      iterations: nodes.length >= 4000 ? 130 : nodes.length >= 1000 ? 190 : 260,
    }).then((result) => {
      if (cancelled) return;
      nodeOrderRef.current = result.ids;
      positionsRef.current = result.positions;
      const nextLayout = new Map<string, { x: number; y: number }>();
      for (let i = 0; i < result.ids.length; i += 1) {
        const id = result.ids[i];
        if (!id) continue;
        nextLayout.set(id, {
          x: result.positions[i * 3] ?? 0,
          y: result.positions[i * 3 + 1] ?? 0,
        });
      }
      onLayoutChange?.(nextLayout);
      setStats({ nodes: result.ids.length, edges: edges.length });
      setLayoutRevision((current) => current + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [edges, nodes, onLayoutChange, worldHeight, worldWidth]);

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
      const alpha = dimmed ? 0.16 : nodeSelected ? 1 : nodeNeighbor ? 0.9 : 0.72;
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
    const activeEdgePositions = activeLines.geometry.getAttribute("position") as THREE.BufferAttribute;
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
        edgeCursor += 1;
        edgePositions.setXYZ(edgeCursor, targetX, targetY, targetZ);
        edgeCursor += 1;
        continue;
      }
      activeEdgePositions.setXYZ(activeCursor, sourceX, sourceY, sourceZ);
      activeCursor += 1;
      activeEdgePositions.setXYZ(activeCursor, targetX, targetY, targetZ);
      activeCursor += 1;
    }
    lines.geometry.setDrawRange(0, edgeCursor);
    edgePositions.needsUpdate = true;
    lines.geometry.boundingSphere = new THREE.Sphere(center, radius + 120);
    activeLines.geometry.setDrawRange(0, activeCursor);
    activeEdgePositions.needsUpdate = true;
    activeLines.geometry.boundingSphere = new THREE.Sphere(center, radius + 120);

    const mutedMaterial = lines.material as THREE.LineBasicMaterial;
    const highlightMaterial = activeLines.material as THREE.LineBasicMaterial;
    mutedMaterial.opacity = selectedId ? 0.14 : 0.32;
    highlightMaterial.opacity = selectedId ? 0.74 : 0.46;

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
    const root = rootRef.current;
    const camera = cameraRef.current;
    const nodeMesh = nodeMeshRef.current;
    if (!root || !camera || !nodeMesh) return;

    const onPointerDown = (event: PointerEvent) => {
      dragRef.current = { active: true, x: event.clientX, y: event.clientY, moved: false };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragRef.current.active) return;
      const dx = event.clientX - dragRef.current.x;
      const dy = event.clientY - dragRef.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) dragRef.current.moved = true;
      camera.position.x -= dx / camera.zoom;
      camera.position.y += dy / camera.zoom;
      dragRef.current.x = event.clientX;
      dragRef.current.y = event.clientY;
      setCameraRevision((current) => current + 1);
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
  }, [nodeById, onSelect]);

  const overlayNodes = useMemo(() => {
    if (!usePillOverlay) return [];
    const camera = cameraRef.current;
    if (!camera) return [];
    const ids = nodeOrderRef.current;
    const positions = positionsRef.current;
    if (ids.length === 0 || positions.length === 0) return [];
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
    const out: Array<{
      id: string;
      title: string;
      entityType: string | null;
      screenX: number;
      screenY: number;
      selected: boolean;
      neighbor: boolean;
    }> = [];
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      if (!id || !targetIds.has(id)) continue;
      const node = nodeById.get(id);
      if (!node) continue;
      const screen = projectToScreen(
        positions[i * 3] ?? 0,
        positions[i * 3 + 1] ?? 0,
        positions[i * 3 + 2] ?? 0,
        camera,
        viewport,
      );
      if (
        screen.x < -140 ||
        screen.y < -80 ||
        screen.x > viewport.width + 140 ||
        screen.y > viewport.height + 80
      ) {
        continue;
      }
      out.push({
        id,
        title: node.title,
        entityType: node.entityType,
        screenX: screen.x,
        screenY: screen.y,
        selected: selectedId === id,
        neighbor: neighborIds.has(id),
      });
    }
    out.sort((a, b) => Number(a.selected) - Number(b.selected));
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
    <div ref={rootRef} className={styles.graphRoot} role="presentation" aria-label="threejs entity graph">
      {usePillOverlay ? (
        <div className={styles.webglHtmlOverlay}>
          {overlayNodes.map((node) => {
            const typeStyle = getEntityTypeStyle(node.entityType);
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
                }}
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
