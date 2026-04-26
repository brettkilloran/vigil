export const EDGE_FRAGMENT_SHADER = `
precision mediump float;

varying vec4 v_color;

void main() {
  gl_FragColor = v_color;
}
`;
