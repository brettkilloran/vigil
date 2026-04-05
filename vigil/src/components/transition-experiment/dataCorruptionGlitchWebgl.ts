import {
  DATA_CORRUPTION_GLITCH_FRAGMENT_SHADER,
  DATA_CORRUPTION_GLITCH_VERTEX_SHADER,
} from "@/src/components/transition-experiment/dataCorruptionGlitchShaders";

export type DataCorruptionGlitchGl = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  tex: WebGLTexture;
  timeLoc: WebGLUniformLocation | null;
  resLoc: WebGLUniformLocation | null;
  bgLoc: WebGLUniformLocation | null;
  texLoc: WebGLUniformLocation | null;
  posBuffer: WebGLBuffer;
  posAttrib: number;
};

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("[DataCorruptionGlitch] shader compile", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createDataCorruptionGlitchGl(canvas: HTMLCanvasElement): DataCorruptionGlitchGl | null {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  const vs = compileShader(gl, gl.VERTEX_SHADER, DATA_CORRUPTION_GLITCH_VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, DATA_CORRUPTION_GLITCH_FRAGMENT_SHADER);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("[DataCorruptionGlitch] program link", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const tex = gl.createTexture();
  if (!tex) return null;

  const positionBuffer = gl.createBuffer();
  if (!positionBuffer) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  gl.useProgram(program);
  const posAttrib = gl.getAttribLocation(program, "a_position");
  if (posAttrib < 0) {
    console.warn("[DataCorruptionGlitch] missing a_position attrib");
    gl.deleteProgram(program);
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(posAttrib);
  gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

  const timeLoc = gl.getUniformLocation(program, "u_time");
  const resLoc = gl.getUniformLocation(program, "u_resolution");
  const bgLoc = gl.getUniformLocation(program, "u_bgColor");
  const texLoc = gl.getUniformLocation(program, "u_textTexture");

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  return { gl, program, tex, timeLoc, resLoc, bgLoc, texLoc, posBuffer: positionBuffer, posAttrib };
}

export function disposeDataCorruptionGlitchGl(ctx: DataCorruptionGlitchGl | null) {
  if (!ctx) return;
  ctx.gl.deleteProgram(ctx.program);
  ctx.gl.deleteBuffer(ctx.posBuffer);
  ctx.gl.deleteTexture(ctx.tex);
}

export function uploadSolidBgTexture(ctx: DataCorruptionGlitchGl, bgRgb: [number, number, number]) {
  const [r, g, b] = bgRgb;
  const R = Math.max(0, Math.min(255, Math.round(r * 255)));
  const G = Math.max(0, Math.min(255, Math.round(g * 255)));
  const B = Math.max(0, Math.min(255, Math.round(b * 255)));
  const px = new Uint8Array([R, G, B, 255, R, G, B, 255, R, G, B, 255, R, G, B, 255]);
  ctx.gl.bindTexture(ctx.gl.TEXTURE_2D, ctx.tex);
  ctx.gl.pixelStorei(ctx.gl.UNPACK_FLIP_Y_WEBGL, 0);
  ctx.gl.texImage2D(ctx.gl.TEXTURE_2D, 0, ctx.gl.RGBA, 2, 2, 0, ctx.gl.RGBA, ctx.gl.UNSIGNED_BYTE, px);
}

/** @returns whether the GPU texture was updated successfully */
export function tryUploadTextureFromCanvas(ctx: DataCorruptionGlitchGl, c: HTMLCanvasElement): boolean {
  if (c.width < 2 || c.height < 2) return false;
  try {
    ctx.gl.bindTexture(ctx.gl.TEXTURE_2D, ctx.tex);
    ctx.gl.pixelStorei(ctx.gl.UNPACK_FLIP_Y_WEBGL, 1);
    ctx.gl.texImage2D(ctx.gl.TEXTURE_2D, 0, ctx.gl.RGBA, ctx.gl.RGBA, ctx.gl.UNSIGNED_BYTE, c);
    ctx.gl.pixelStorei(ctx.gl.UNPACK_FLIP_Y_WEBGL, 0);
    return true;
  } catch (e) {
    console.warn("[DataCorruptionGlitch] texture upload failed (tainted canvas?)", e);
    return false;
  }
}

export function drawDataCorruptionGlitchFrame(
  ctx: DataCorruptionGlitchGl,
  width: number,
  height: number,
  timeSeconds: number,
  bgRgb: [number, number, number],
) {
  const { gl } = ctx;
  gl.viewport(0, 0, width, height);
  gl.useProgram(ctx.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, ctx.posBuffer);
  gl.enableVertexAttribArray(ctx.posAttrib);
  gl.vertexAttribPointer(ctx.posAttrib, 2, gl.FLOAT, false, 0, 0);
  if (ctx.timeLoc) gl.uniform1f(ctx.timeLoc, timeSeconds);
  if (ctx.resLoc) gl.uniform2f(ctx.resLoc, width, height);
  if (ctx.bgLoc) gl.uniform3f(ctx.bgLoc, bgRgb[0], bgRgb[1], bgRgb[2]);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, ctx.tex);
  if (ctx.texLoc) gl.uniform1i(ctx.texLoc, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}
