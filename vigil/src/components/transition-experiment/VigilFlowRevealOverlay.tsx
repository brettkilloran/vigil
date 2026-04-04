"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";

import { Button } from "@/src/components/ui/Button";
import styles from "./VigilFlowRevealOverlay.module.css";

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 vUv;
void main() {
  vUv = (a_position + 1.0) / 2.0;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;
uniform float u_time;
uniform float u_progress;
uniform vec2 u_resolution;
uniform float u_softBoot;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * snoise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Pixel glyph pass — matches prototype “digital artifacts on liquid” behavior.
vec3 pixelGlyphPass(vec2 uv, float liquidMask, float pixelSize, float t) {
  vec2 pixelCoord = floor(uv * pixelSize) / pixelSize;
  vec2 subPixel = fract(uv * pixelSize);
  float edgeIntensity = liquidMask * (1.0 - liquidMask) * 4.0;
  edgeIntensity = pow(max(edgeIntensity, 0.0001), 0.7);
  float cellNoise = hash21(pixelCoord + floor(t * 2.0));
  float cellPattern = step(0.4, cellNoise) * step(cellNoise, 0.6);
  float scan = sin(subPixel.y * 3.14159 * 3.0 + t * 2.0);
  scan = smoothstep(0.3, 0.7, scan) * 0.3;
  float glyph = cellPattern * scan * edgeIntensity;
  vec3 glyphColor = vec3(0.08, 0.12, 0.15);
  return glyphColor * glyph * 0.5;
}

void main() {
  vec2 uv = vUv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 warpedUV = uv;
  warpedUV.x *= aspect;

  vec2 q = vec2(0.);
  q.x = fbm(warpedUV + 0.1 * u_time);
  q.y = fbm(warpedUV + vec2(1.0));

  vec2 r = vec2(0.0);
  r.x = fbm(warpedUV + 1.0*q + vec2(1.7, 9.2) + 0.15*u_time);
  r.y = fbm(warpedUV + 1.0*q + vec2(8.3, 2.8) + 0.126*u_time);

  float liquidRaw = fbm(warpedUV + r);

  float dist = length(uv - vec2(0.5, 0.5));
  float threshold = u_progress * 1.5;
  float liquidMask = smoothstep(threshold - 0.35, threshold + 0.35, liquidRaw * 0.5 + 0.5 + dist);

  vec3 glyphLayer = pixelGlyphPass(uv, liquidMask, 150.0, u_time);

  float coarsePixel = 50.0;
  vec2 coarseCoord = floor(uv * coarsePixel) / coarsePixel;
  float coarseNoise = hash21(coarseCoord * 2.0 + floor(u_time));
  float coarseBlock = step(liquidMask, 0.5 + coarseNoise * 0.3) * liquidMask;

  vec2 chromaOffset = vec2(
    snoise(warpedUV * 1.5 + u_time * 0.2),
    snoise(warpedUV * 1.5 + 100.0 + u_time * 0.2)
  ) * 0.04;
  float turbulence = 1.0 + abs(liquidRaw) * 3.0;

  float maskR;
  {
    vec2 uvR = uv + chromaOffset * turbulence * vec2(1.0, 0.5);
    float distR = length(uvR - vec2(0.5));
    vec2 wR = uvR;
    wR.x *= aspect;
    float fR = fbm(wR + vec2(u_time * 0.05));
    maskR = smoothstep(threshold - 0.3, threshold + 0.3, fR * 0.5 + 0.5 + distR);
  }

  float maskG = liquidMask;

  float maskB;
  {
    vec2 uvB = uv - chromaOffset * turbulence * vec2(1.0, 0.5);
    float distB = length(uvB - vec2(0.5));
    vec2 wB = uvB;
    wB.x *= aspect;
    float fB = fbm(wB + vec2(u_time * 0.05));
    maskB = smoothstep(threshold - 0.3, threshold + 0.3, fB * 0.5 + 0.5 + distB);
  }

  float fringeAmount = abs(maskR - maskG) + abs(maskB - maskG);
  fringeAmount = smoothstep(0.02, 0.25, fringeAmount) * liquidMask;

  vec3 bloomR = vec3(0.9, 0.2, 0.3) * maskR * (1.0 - maskG) * 0.8;
  vec3 bloomB = vec3(0.1, 0.6, 1.0) * maskB * (1.0 - maskG) * 0.8;
  vec3 bloomG = vec3(0.02, 0.03, 0.02) * maskG;
  vec3 chromaticLiquid = bloomR + bloomB + bloomG;

  float redLeads = smoothstep(0.0, 0.15, maskR - maskB);
  float blueLeads = smoothstep(0.0, 0.15, maskB - maskR);
  vec3 fringeCyan = vec3(0.05, 0.8, 0.9) * blueLeads * liquidMask;
  vec3 fringeMagenta = vec3(0.9, 0.15, 0.6) * redLeads * liquidMask;
  chromaticLiquid += fringeCyan + fringeMagenta;

  float coreFactor = liquidMask * (1.0 - fringeAmount);
  vec3 coreDark = vec3(0.03, 0.03, 0.04);
  chromaticLiquid = mix(chromaticLiquid, coreDark, coreFactor * 0.6);

  float transitionEdge = liquidMask * (1.0 - liquidMask) * 4.0;
  transitionEdge = smoothstep(0.0, 1.0, transitionEdge);
  vec3 glowRGB = vec3(0.8, 0.3, 0.5) * transitionEdge * (1.0 - u_progress) * 0.4;

  vec3 finalColor = chromaticLiquid + glowRGB;
  finalColor += vec3(liquidRaw * 0.01);
  finalColor += glyphLayer * 0.6;
  finalColor += hash21(uv * u_time) * 0.02;

  float finalAlpha = (maskR + maskG + maskB) / 3.0;
  finalAlpha = max(finalAlpha, coarseBlock * 0.15);

  // Central "work" safe zone: suppress fluid/tendril layer so chroma noise does not creep
  // into the main canvas (aspect-normalized so the clear core stays circular on wide screens).
  float dNorm =
    length((uv - vec2(0.5)) * vec2(aspect, 1.0)) / (0.5 * sqrt(aspect * aspect + 1.0));
  float workSafe = smoothstep(0.30, 0.56, dNorm);
  finalColor *= workSafe;
  finalAlpha *= workSafe;

  // While /api/bootstrap is still in flight, u_softBoot=1: crush neon fringes so a slow
  // network does not leave the canvas under a full-intensity chroma sheet for minutes.
  vec3 coolVeil = vec3(0.038, 0.042, 0.05);
  float rgbMix = mix(1.0, 0.2, u_softBoot);
  float aMul = mix(1.0, 0.34, u_softBoot);
  gl_FragColor = vec4(mix(coolVeil, finalColor, rgbMix), finalAlpha * aMul);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("[VigilFlowReveal] shader compile", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const IS_DEV = process.env.NODE_ENV === "development";

export type VigilFlowRevealOverlayProps = {
  scenario: "default" | "nested" | "corrupt";
  bootContentReady: boolean;
  navActive: boolean;
  /** True while default-scenario bootstrap fetch has not finished — dims the overlay. */
  bootstrapPending?: boolean;
};

export function VigilFlowRevealOverlay({
  scenario,
  bootContentReady,
  navActive,
  bootstrapPending = false,
}: VigilFlowRevealOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const skipBoot = scenario !== "default";

  const [reduceMotion, setReduceMotion] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const u = () => setReduceMotion(mq.matches);
    u();
    mq.addEventListener("change", u);
    return () => mq.removeEventListener("change", u);
  }, []);

  const bootContentReadyRef = useRef(bootContentReady);
  bootContentReadyRef.current = bootContentReady;

  const navActiveRef = useRef(navActive);
  navActiveRef.current = navActive;

  const bootstrapPendingRef = useRef(bootstrapPending);
  bootstrapPendingRef.current = bootstrapPending;

  const targetProgressRef = useRef(0);
  const progressRef = useRef(0);
  const startTimeRef = useRef(0);
  const rafRef = useRef(0);

  const glRef = useRef<{
    gl: WebGLRenderingContext;
    program: WebGLProgram;
    timeLoc: WebGLUniformLocation | null;
    progressLoc: WebGLUniformLocation | null;
    resLoc: WebGLUniformLocation | null;
    softBootLoc: WebGLUniformLocation | null;
    posBuffer: WebGLBuffer;
  } | null>(null);

  useEffect(() => {
    if (skipBoot) return;
    if (reduceMotion) return;
    if (navActive) targetProgressRef.current = 0.18;
    else if (bootContentReady) targetProgressRef.current = 1;
    else targetProgressRef.current = 0;
  }, [navActive, bootContentReady, skipBoot, reduceMotion]);

  const disposeGl = useCallback(() => {
    const g = glRef.current;
    glRef.current = null;
    if (!g) return;
    g.gl.deleteProgram(g.program);
    g.gl.deleteBuffer(g.posBuffer);
  }, []);

  useEffect(() => {
    if (skipBoot || reduceMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    });
    if (!gl) return;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("[VigilFlowReveal] program link", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return;
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    const positionBuffer = gl.createBuffer();
    if (!positionBuffer) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    gl.useProgram(program);
    const posAttrib = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posAttrib);
    gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

    const timeLoc = gl.getUniformLocation(program, "u_time");
    const progressLoc = gl.getUniformLocation(program, "u_progress");
    const resLoc = gl.getUniformLocation(program, "u_resolution");
    const softBootLoc = gl.getUniformLocation(program, "u_softBoot");

    glRef.current = { gl, program, timeLoc, progressLoc, resLoc, softBootLoc, posBuffer: positionBuffer };

    startTimeRef.current = Date.now();
    const initiallyReady = bootContentReadyRef.current;
    targetProgressRef.current = initiallyReady ? 1 : 0;
    progressRef.current = initiallyReady ? 1 : 0;

    let width = 0;
    let height = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      const ctx = glRef.current;
      if (!ctx) return;

      const time = (Date.now() - startTimeRef.current) * 0.001;
      const target = targetProgressRef.current;
      progressRef.current += (target - progressRef.current) * 0.025;

      gl.useProgram(ctx.program);
      if (ctx.timeLoc !== null) gl.uniform1f(ctx.timeLoc, time);
      if (ctx.progressLoc !== null) gl.uniform1f(ctx.progressLoc, progressRef.current);
      if (ctx.resLoc !== null) gl.uniform2f(ctx.resLoc, width, height);
      if (ctx.softBootLoc !== null) {
        gl.uniform1f(ctx.softBootLoc, bootstrapPendingRef.current ? 1.0 : 0.0);
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
      disposeGl();
    };
  }, [skipBoot, reduceMotion, disposeGl]);

  const replay = useCallback(() => {
    if (skipBoot || reduceMotion) return;
    progressRef.current = 0;
    targetProgressRef.current = 0;
    window.setTimeout(() => {
      targetProgressRef.current = 1;
    }, 300);
  }, [skipBoot, reduceMotion]);

  if (skipBoot) return null;
  if (reduceMotion) return null;

  return (
    <>
      <div className={styles.wrap} aria-hidden>
        <div className={styles.bgGrid} />
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
      {IS_DEV ? (
        <div className={styles.devReplay}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            tone="menu"
            iconOnly
            aria-label="Replay flow reveal"
            title="Replay flow reveal"
            onClick={replay}
          >
            <ArrowsClockwise size={18} weight="bold" aria-hidden />
          </Button>
        </div>
      ) : null}
    </>
  );
}
