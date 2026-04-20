"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

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

/* AESTHETICS // FLOW style: blocky digital glitch on the liquid edge (prototype digitalGlitchPass). */
vec3 digitalGlitchPass(vec2 uv, float liquidMask, float pixelSize, float t) {
  vec2 pixelCoord = floor(uv * pixelSize) / pixelSize;
  vec2 subPixel = fract(uv * pixelSize);
  float edgeIntensity = liquidMask * (1.0 - liquidMask) * 5.0;
  edgeIntensity = pow(max(edgeIntensity, 0.0001), 0.7);
  float glitchTime = floor(t * 12.0);
  float blockNoise = hash21(pixelCoord + glitchTime);
  float glitchBlock = step(0.85, blockNoise) * step(0.5, hash21(vec2(pixelCoord.y, glitchTime)));
  float scan = sin(subPixel.y * 3.14159 * 4.0 + t * 15.0);
  scan = smoothstep(0.4, 0.6, scan);
  float scanIntensity = step(0.6, hash21(vec2(pixelCoord.y, glitchTime))) * 0.5;
  vec3 rgbShift = vec3(0.0);
  float rOffset = hash21(vec2(pixelCoord.x + 1.0, glitchTime)) * 2.0 - 1.0;
  float bOffset = hash21(vec2(pixelCoord.x + 2.0, glitchTime)) * 2.0 - 1.0;
  rgbShift.r = step(0.72, blockNoise) * rOffset * 0.72;
  rgbShift.g = step(0.78, blockNoise) * (rOffset - bOffset) * 0.22;
  rgbShift.b = step(0.76, blockNoise) * bOffset * 0.72;
  float streakNoise = hash21(vec2(pixelCoord.y * 20.0, glitchTime));
  float streak = step(0.9, streakNoise) * step(subPixel.x, 0.5);
  float glitch = (glitchBlock * 0.5 + scan * scanIntensity + streak * 0.6) * edgeIntensity;
  vec3 glitchColor = vec3(0.09, 0.11, 0.14) + rgbShift;
  return glitchColor * glitch;
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
  /*
   * Low threshold: smoothstep(-0.35, 0.35, reveal) puts reveal≈0 at the band midpoint →
   * liquidMask≈0.5 everywhere = full-opacity chroma + diagonal flow reads as rainbow stripes.
   * Bias lo/hi so reveal=0 maps near 0 until progress advances.
   */
  float reveal = liquidRaw * 0.5 + 0.5 + dist;
  float loM = threshold - 0.35;
  float hiM = threshold + 0.35;
  float earlyBand = 1.0 - step(0.28, threshold);
  float loMF = mix(loM, max(loM, 0.0), earlyBand);
  float hiMF = mix(hiM, max(hiM, 0.58), earlyBand);
  float liquidMask = smoothstep(loMF, hiMF, reveal);

  float loRB = threshold - 0.3;
  float hiRB = threshold + 0.3;
  float loRBF = mix(loRB, max(loRB, 0.0), earlyBand);
  float hiRBF = mix(hiRB, max(hiRB, 0.52), earlyBand);

  /* Ramp saturated / diagonal chroma after preload; extra cut during bootstrap (u_softBoot). */
  float chromaRamp = smoothstep(0.05, 0.42, u_progress);
  float chromaSoft = chromaRamp * mix(1.0, 0.22, u_softBoot);

  vec3 glitchLayer = digitalGlitchPass(uv, liquidMask, 88.0, u_time);

  float coarsePixel = 50.0;
  vec2 coarseCoord = floor(uv * coarsePixel) / coarsePixel;
  float coarseNoise = hash21(coarseCoord * 2.0 + floor(u_time));
  float coarseBlock = step(liquidMask, 0.5 + coarseNoise * 0.3) * liquidMask;

  /* CA: horizontal RGB split + wobble — ease in with progress; less split during early band. */
  float turbulence = 1.0 + abs(liquidRaw) * 2.45;
  float wob = snoise(warpedUV * 1.2 + u_time * 0.09) * 0.014;
  vec2 ca = vec2(0.026 + wob, wob * 0.52) * turbulence;
  ca *= mix(1.0, 0.48, earlyBand) * mix(1.0, 0.55, 1.0 - chromaRamp);

  float maskR;
  {
    vec2 uvR = uv + ca;
    float distR = length(uvR - vec2(0.5));
    vec2 wR = uvR;
    wR.x *= aspect;
    float fR = fbm(wR + vec2(u_time * 0.04));
    maskR = smoothstep(loRBF, hiRBF, fR * 0.5 + 0.5 + distR);
  }

  float maskG = liquidMask;

  float maskB;
  {
    vec2 uvB = uv - ca;
    float distB = length(uvB - vec2(0.5));
    vec2 wB = uvB;
    wB.x *= aspect;
    float fB = fbm(wB + vec2(u_time * 0.04));
    maskB = smoothstep(loRBF, hiRBF, fB * 0.5 + 0.5 + distB);
  }

  float fringeAmount = abs(maskR - maskG) + abs(maskB - maskG);
  fringeAmount = smoothstep(0.015, 0.2, fringeAmount) * liquidMask;

  /*
   * Liquid color (closer to reference feel): roaming hue from fbm + phase-based RGB
   * (waveGlitchPass-style), not constant pink/blue ribbons from saturated lead tints.
   */
  vec3 ink = vec3(0.034, 0.040, 0.054);

  float terrA = fbm(warpedUV * 1.1 + vec2(u_time * 0.035)) * 0.5 + 0.5;
  float terrB =
    snoise(warpedUV * 2.2 + vec2(9.1 + u_time * 0.06, 2.4 - u_time * 0.04)) * 0.5 +
    0.5;
  vec3 toneSteel = vec3(0.10, 0.20, 0.34);
  vec3 toneWine = vec3(0.28, 0.18, 0.32);
  vec3 toneSage = vec3(0.16, 0.26, 0.22);
  vec3 bodyHue = mix(mix(toneSteel, toneWine, terrA), toneSage, terrB * 0.55);

  /* Mostly horizontal phase early (less diagonal rainbow); add X drift as chroma ramps. */
  float wPh =
    warpedUV.y * 14.0 +
    warpedUV.x * mix(2.5, 9.0, chromaRamp) +
    u_time * 2.1;
  float rWv = sin(wPh + 0.55);
  float gWv = sin(wPh);
  float bWv = sin(wPh - 0.55);
  vec3 flowChroma = vec3(
    (rWv - gWv) * 0.11,
    (gWv - bWv) * 0.07,
    (bWv - rWv) * 0.11
  );
  flowChroma.r += sin(u_time * 0.9 + uv.y * 11.0) * 0.06;
  flowChroma.b += cos(u_time * 0.85 + uv.x * 9.0) * 0.07;

  float edgeR = maskR * (1.0 - maskG);
  float edgeB = maskB * (1.0 - maskG);
  float caSep = abs(maskR - maskB);

  vec3 sheenCool = vec3(0.11, 0.22, 0.37);
  vec3 sheenWarm = vec3(0.30, 0.24, 0.38);
  vec3 rimBase = mix(sheenCool, sheenWarm, smoothstep(0.04, 0.24, caSep));
  float rimJitter =
    0.82 + 0.18 * (snoise(warpedUV * 3.5 + vec2(u_time * 0.08, u_time * 0.05)) * 0.5 + 0.5);
  vec3 rim = rimBase * rimJitter;

  vec3 chromaticLiquid = ink * maskG;
  chromaticLiquid += bodyHue * liquidMask * 0.22 * mix(0.4, 1.0, chromaRamp);
  chromaticLiquid += flowChroma * liquidMask * 0.42 * chromaSoft;
  chromaticLiquid += rim * max(edgeR, edgeB) * 0.88 * chromaSoft;
  chromaticLiquid += rim * fringeAmount * 0.34 * chromaSoft;

  float redLeads = smoothstep(0.0, 0.14, maskR - maskB);
  float blueLeads = smoothstep(0.0, 0.14, maskB - maskR);
  chromaticLiquid += vec3(0.10, 0.30, 0.36) * blueLeads * liquidMask * 0.26 * chromaSoft;
  chromaticLiquid += vec3(0.34, 0.15, 0.28) * redLeads * liquidMask * 0.26 * chromaSoft;

  float coreFactor = liquidMask * (1.0 - fringeAmount);
  vec3 coreCool = vec3(0.028, 0.034, 0.046);
  chromaticLiquid = mix(chromaticLiquid, coreCool, coreFactor * 0.26);

  float transitionEdge = liquidMask * (1.0 - liquidMask) * 4.0;
  transitionEdge = smoothstep(0.0, 1.0, transitionEdge);
  vec3 glowRGB =
    vec3(0.38, 0.22, 0.42) * transitionEdge * (1.0 - u_progress) * 0.30;

  vec3 finalColor = chromaticLiquid + glowRGB;
  finalColor += vec3(liquidRaw * 0.0035);
  finalColor += glitchLayer * mix(0.52, 0.11, u_softBoot) * chromaSoft;

  /* CRT scanlines: liquid-only; pitch + phase drift for visible motion (no second CSS layer). */
  float linePitch = 4.0 + sin(u_time * 1.22) * 0.65;
  float scanPhase =
    6.2831853 * uv.y * u_resolution.y / linePitch + u_time * 3.85;
  scanPhase += sin(uv.y * 14.0 + u_time * 2.35) * 0.55 * chromaRamp;
  float scanBand = sin(scanPhase) * 0.5 + 0.5;
  scanBand = smoothstep(0.18, 0.82, scanBand);
  float scanMul = mix(0.82, 1.0, scanBand);
  float scanWeight =
    liquidMask * mix(0.68, 0.3, u_softBoot) * mix(0.2, 1.0, chromaRamp);
  finalColor *= mix(1.0, scanMul, scanWeight);

  float finalAlpha = (maskR + maskG + maskB) / 3.0;
  finalAlpha = max(finalAlpha, coarseBlock * 0.07);

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

export type VigilFlowRevealOverlayProps = {
  scenario: "default" | "corrupt";
  /** After the user activates (or non-default mount): full reveal target 1; before that, ambient ~nav idle. */
  sessionActivated: boolean;
  navActive: boolean;
  /** True while default-scenario bootstrap fetch has not finished — dims the overlay. */
  bootstrapPending?: boolean;
};

export function VigilFlowRevealOverlay({
  scenario,
  sessionActivated,
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

  const sessionActivatedRef = useRef(sessionActivated);
  sessionActivatedRef.current = sessionActivated;

  const navActiveRef = useRef(navActive);
  navActiveRef.current = navActive;

  const bootstrapPendingRef = useRef(bootstrapPending);
  bootstrapPendingRef.current = bootstrapPending;

  const targetProgressRef = useRef(0);
  const progressRef = useRef(0);
  const prevSessionActivatedRef = useRef(false);
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

  /*
   * Pre-activate (boot copy): after load, progress 1 (thin edge wisps). While bootstrap is in flight,
   * drive progress ~0 so the same liquid flow covers the viewport (hides graph hydration) — same
   * language as nav/activate, not a dimmed peek-through.
   * Nav transitions alone use 0.18. Activate edge: snap progress 0 then ease to 1 for the wipe.
   */
  useEffect(() => {
    if (skipBoot || reduceMotion) return;
    if (navActive) {
      targetProgressRef.current = 0.18;
      prevSessionActivatedRef.current = sessionActivated;
      return;
    }
    if (bootstrapPending) {
      targetProgressRef.current = 0;
      if (!sessionActivated) prevSessionActivatedRef.current = false;
      return;
    }
    if (!sessionActivated) {
      targetProgressRef.current = 1;
      prevSessionActivatedRef.current = false;
      return;
    }
    if (!prevSessionActivatedRef.current) {
      progressRef.current = 0;
    }
    targetProgressRef.current = 1;
    prevSessionActivatedRef.current = true;
  }, [navActive, sessionActivated, skipBoot, reduceMotion, bootstrapPending]);

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
    const initiallyActivated = sessionActivatedRef.current;
    prevSessionActivatedRef.current = initiallyActivated;
    /* Loading: full flow veil; idle behind boot (post-bootstrap): thin wisps at progress 1. */
    if (bootstrapPendingRef.current) {
      targetProgressRef.current = 0;
      progressRef.current = 0;
    } else if (!initiallyActivated) {
      targetProgressRef.current = 1;
      progressRef.current = 1;
    } else {
      targetProgressRef.current = 1;
      progressRef.current = 0;
    }

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
        /*
         * During bootstrap we drive progress ~0 (full flow cover) instead of wisps + soft crush.
         * Keep soft boot off so the veil stays visually solid; soft boot was for the old “wisps over dim canvas” case.
         */
        gl.uniform1f(ctx.softBootLoc, 0.0);
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

  if (skipBoot) return null;
  if (reduceMotion) return null;

  return (
    <div className={styles.wrap} aria-hidden>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
