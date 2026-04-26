export const NODE_FRAGMENT_SHADER = `
precision mediump float;

varying vec4 v_color;

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) {
    discard;
  }
  float edge = smoothstep(1.0, 0.75, d);
  gl_FragColor = vec4(v_color.rgb, v_color.a * edge);
}
`;
