import { EDGE_FRAGMENT_SHADER } from "@/src/lib/graph-webgl/shaders/edge.frag";
import { EDGE_VERTEX_SHADER } from "@/src/lib/graph-webgl/shaders/edge.vert";
import { NODE_FRAGMENT_SHADER } from "@/src/lib/graph-webgl/shaders/node.frag";
import { NODE_VERTEX_SHADER } from "@/src/lib/graph-webgl/shaders/node.vert";

export type WebGLCamera = {
  x: number;
  y: number;
  scale: number;
};

export type RenderNode = {
  id: string;
  label?: string;
  x: number;
  y: number;
  size: number;
  color: [number, number, number, number];
};

export type RenderEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  color: [number, number, number, number];
};

export type RenderScene = {
  nodes: RenderNode[];
  edges: RenderEdge[];
};

export type RendererStats = {
  drawnNodes: number;
  drawnEdges: number;
};

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? "Unknown shader compile error";
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create WebGL program");
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? "Unknown shader link error";
    gl.deleteProgram(program);
    throw new Error(info);
  }
  return program;
}

function getUniformLocation(gl: WebGLRenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (!location) throw new Error(`Missing uniform location: ${name}`);
  return location;
}

function getAttribLocation(gl: WebGLRenderingContext, program: WebGLProgram, name: string): number {
  const location = gl.getAttribLocation(program, name);
  if (location < 0) throw new Error(`Missing attribute location: ${name}`);
  return location;
}

export class CustomWebGLRenderer {
  private gl: WebGLRenderingContext;
  private edgeProgram: WebGLProgram;
  private nodeProgram: WebGLProgram;
  private edgeBuffer: WebGLBuffer;
  private nodeBuffer: WebGLBuffer;
  private edgeUViewport: WebGLUniformLocation;
  private edgeUCamera: WebGLUniformLocation;
  private edgeAPosition: number;
  private edgeAColor: number;
  private nodeUViewport: WebGLUniformLocation;
  private nodeUCamera: WebGLUniformLocation;
  private nodeAPosition: number;
  private nodeASize: number;
  private nodeAColor: number;
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, depth: false });
    if (!gl) throw new Error("WebGL unavailable");
    this.gl = gl;
    this.edgeProgram = createProgram(gl, EDGE_VERTEX_SHADER, EDGE_FRAGMENT_SHADER);
    this.nodeProgram = createProgram(gl, NODE_VERTEX_SHADER, NODE_FRAGMENT_SHADER);
    const edgeBuffer = gl.createBuffer();
    const nodeBuffer = gl.createBuffer();
    if (!edgeBuffer || !nodeBuffer) throw new Error("Failed to allocate WebGL buffers");
    this.edgeBuffer = edgeBuffer;
    this.nodeBuffer = nodeBuffer;
    this.edgeUViewport = getUniformLocation(gl, this.edgeProgram, "u_viewport");
    this.edgeUCamera = getUniformLocation(gl, this.edgeProgram, "u_camera");
    this.edgeAPosition = getAttribLocation(gl, this.edgeProgram, "a_position");
    this.edgeAColor = getAttribLocation(gl, this.edgeProgram, "a_color");
    this.nodeUViewport = getUniformLocation(gl, this.nodeProgram, "u_viewport");
    this.nodeUCamera = getUniformLocation(gl, this.nodeProgram, "u_camera");
    this.nodeAPosition = getAttribLocation(gl, this.nodeProgram, "a_position");
    this.nodeASize = getAttribLocation(gl, this.nodeProgram, "a_size");
    this.nodeAColor = getAttribLocation(gl, this.nodeProgram, "a_color");
  }

  resize(width: number, height: number, dpr: number): void {
    if (this.disposed) return;
    const pixelWidth = Math.max(1, Math.floor(width * dpr));
    const pixelHeight = Math.max(1, Math.floor(height * dpr));
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  render(scene: RenderScene, camera: WebGLCamera): RendererStats {
    if (this.disposed) return { drawnEdges: 0, drawnNodes: 0 };
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const edgeVertexCount = scene.edges.length * 2;
    if (edgeVertexCount > 0) {
      const edgeData = new Float32Array(edgeVertexCount * 6);
      let offset = 0;
      for (const edge of scene.edges) {
        edgeData[offset++] = edge.sourceX;
        edgeData[offset++] = edge.sourceY;
        edgeData[offset++] = edge.color[0];
        edgeData[offset++] = edge.color[1];
        edgeData[offset++] = edge.color[2];
        edgeData[offset++] = edge.color[3];
        edgeData[offset++] = edge.targetX;
        edgeData[offset++] = edge.targetY;
        edgeData[offset++] = edge.color[0];
        edgeData[offset++] = edge.color[1];
        edgeData[offset++] = edge.color[2];
        edgeData[offset++] = edge.color[3];
      }

      gl.useProgram(this.edgeProgram);
      gl.uniform2f(this.edgeUViewport, this.canvas.width, this.canvas.height);
      gl.uniform3f(this.edgeUCamera, camera.x, camera.y, camera.scale);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, edgeData, gl.DYNAMIC_DRAW);

      gl.enableVertexAttribArray(this.edgeAPosition);
      gl.vertexAttribPointer(this.edgeAPosition, 2, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(this.edgeAColor);
      gl.vertexAttribPointer(this.edgeAColor, 4, gl.FLOAT, false, 24, 8);
      gl.drawArrays(gl.LINES, 0, edgeVertexCount);
    }

    const nodeVertexCount = scene.nodes.length;
    if (nodeVertexCount > 0) {
      const nodeData = new Float32Array(nodeVertexCount * 7);
      let offset = 0;
      for (const node of scene.nodes) {
        nodeData[offset++] = node.x;
        nodeData[offset++] = node.y;
        nodeData[offset++] = node.size;
        nodeData[offset++] = node.color[0];
        nodeData[offset++] = node.color[1];
        nodeData[offset++] = node.color[2];
        nodeData[offset++] = node.color[3];
      }
      gl.useProgram(this.nodeProgram);
      gl.uniform2f(this.nodeUViewport, this.canvas.width, this.canvas.height);
      gl.uniform3f(this.nodeUCamera, camera.x, camera.y, camera.scale);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, nodeData, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.nodeAPosition);
      gl.vertexAttribPointer(this.nodeAPosition, 2, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(this.nodeASize);
      gl.vertexAttribPointer(this.nodeASize, 1, gl.FLOAT, false, 28, 8);
      gl.enableVertexAttribArray(this.nodeAColor);
      gl.vertexAttribPointer(this.nodeAColor, 4, gl.FLOAT, false, 28, 12);
      gl.drawArrays(gl.POINTS, 0, nodeVertexCount);
    }

    return { drawnNodes: nodeVertexCount, drawnEdges: scene.edges.length };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    gl.deleteBuffer(this.edgeBuffer);
    gl.deleteBuffer(this.nodeBuffer);
    gl.deleteProgram(this.edgeProgram);
    gl.deleteProgram(this.nodeProgram);
  }
}
