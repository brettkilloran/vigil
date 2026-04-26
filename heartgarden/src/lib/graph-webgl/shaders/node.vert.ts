export const NODE_VERTEX_SHADER = `
attribute vec2 a_position;
attribute float a_size;
attribute vec4 a_color;

uniform vec2 u_viewport;
uniform vec3 u_camera;

varying vec4 v_color;

void main() {
  vec2 screen = (a_position * u_camera.z) + vec2(u_camera.x, u_camera.y);
  vec2 clip = (screen / u_viewport) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = clamp(a_size, 2.0, 56.0);
  v_color = a_color;
}
`;
