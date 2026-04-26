"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

import styles from "./starfield-snippet.module.css";

export function StarfieldSnippetClient() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020202, 0.0015);

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 1, 2000);
    camera.position.z = 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x020202, 1);
    container.appendChild(renderer.domElement);

    const vertexShader = `
      attribute float size;
      attribute float phase;
      attribute float twinklingSpeed;
      varying float vAlpha;
      varying float vGlow;
      uniform float time;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
        float blink = (sin(time * twinklingSpeed + phase) + 1.0) / 2.0;
        vAlpha = 0.1 + (blink * 0.9);
        vGlow = size;
      }
    `;

    const fragmentShader = `
      varying float vAlpha;
      varying float vGlow;

      void main() {
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        if (dist > 0.5) discard;
        float core = smoothstep(0.5, 0.1, dist);
        float halo = smoothstep(0.5, 0.3, dist) * 0.5;
        float strength = core + halo;
        gl_FragColor = vec4(1.0, 1.0, 1.0, strength * vAlpha * 0.35);
      }
    `;

    const particleCount = 6000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const phases = new Float32Array(particleCount);
    const twinklingSpeeds = new Float32Array(particleCount);
    const radius = 1000;

    for (let i = 0; i < particleCount; i++) {
      const r = radius * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      sizes[i] = Math.random() * 2.0 + 0.5;

      phases[i] = Math.random() * Math.PI * 2;
      twinklingSpeeds[i] = Math.random() * 2.2 + 0.9;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("twinklingSpeed", new THREE.BufferAttribute(twinklingSpeeds, 1));

    const uniforms = {
      time: { value: 0.0 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    const onResize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(container);

    const clock = new THREE.Clock();
    let rafId: number | null = null;
    const animate = () => {
      rafId = window.requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      uniforms.time.value = elapsedTime;
      camera.lookAt(scene.position);
      renderer.render(scene, camera);
    };

    onResize();
    animate();

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.canvasContainer} ref={containerRef} />
      <div className={styles.caption}>`/dev/starfield-snippet` — isolated snippet renderer</div>
    </main>
  );
}
