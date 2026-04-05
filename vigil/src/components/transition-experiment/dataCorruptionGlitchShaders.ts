/**
 * Fragment logic matches the “System Failure” HTML demo (tear / stretch / rgb offset / acid / speckle / grain).
 *
 * That demo’s texture is **white glyphs on transparent** (`textAlpha` only on type). The shader uses flat
 * `textColor` ink: `mix(bgColor, textColor, textAlpha)` then heavy acid on torn strips — fine for sparse alpha.
 *
 * **html2canvas** snapshots are usually **opaque across the whole card**, so the same acid mix hits almost
 * every pixel in a torn band → neon soup. Use **`u_bitmapMode = 1`** (sample chroma as ink) and
 * **`u_acidIntensity &lt; 1`** (scale the `0.85` mix) for UI captures. Use **`u_bitmapMode = 0`**, **`u_acidIntensity = 1`**
 * to match the original snippet with a typographic texture.
 */

export const DATA_CORRUPTION_GLITCH_VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 vUv;
void main() {
  vUv = vec2((a_position.x + 1.0) * 0.5, (1.0 - a_position.y) * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const DATA_CORRUPTION_GLITCH_FRAGMENT_SHADER = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_bgColor;
uniform sampler2D u_textTexture;
uniform float u_bitmapMode;
uniform float u_acidIntensity;

varying vec2 vUv;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  vec2 uv = vUv;
  float t = u_time * 0.8;

  vec3 bgColor = u_bgColor;

  float blockLine = floor(uv.y * 30.0);
  float blockNoise = random(vec2(blockLine, floor(t * 2.0)));
  float isTearing = step(0.85, blockNoise);

  float scanNoise = random(vec2(uv.y * 200.0, t));
  float microTear = step(0.95, scanNoise) * (random(vec2(uv.y, t)) * 2.0 - 1.0) * 0.05;

  float stretchLine = floor(uv.y * 60.0);
  float isStretching = step(0.92, random(vec2(stretchLine, floor(t * 4.0))));

  float displaceX = 0.0;
  if (isTearing > 0.5) displaceX += (random(vec2(blockLine, 1.0)) * 2.0 - 1.0) * 0.3;
  displaceX += microTear;

  vec2 shiftUv = uv;
  shiftUv.x += displaceX;

  if (isStretching > 0.5) {
    shiftUv.x = random(vec2(stretchLine, 0.0));
  }

  shiftUv.x = fract(shiftUv.x);

  float rgbOffset = 0.015 * random(vec2(t, uv.y));
  if (isTearing > 0.5 || isStretching > 0.5) rgbOffset *= 5.0;

  vec4 texR = texture2D(u_textTexture, vec2(shiftUv.x + rgbOffset, shiftUv.y));
  vec4 texG = texture2D(u_textTexture, shiftUv);
  vec4 texB = texture2D(u_textTexture, vec2(shiftUv.x - rgbOffset, shiftUv.y));

  float textAlpha = texG.a;

  vec3 chroma = vec3(texR.r, texG.g, texB.b);
  vec3 textColor = vec3(0.05, 0.06, 0.08);
  vec3 ink = mix(textColor, chroma, clamp(u_bitmapMode, 0.0, 1.0));

  vec3 acidCyan = vec3(0.0, 1.0, 1.0);
  vec3 acidMagenta = vec3(1.0, 0.0, 1.0);
  vec3 acidGreen = vec3(0.22, 1.0, 0.08);
  vec3 deepBlue = vec3(0.0, 0.0, 0.8);

  vec3 finalColor = bgColor;

  if (textAlpha > 0.1) {
    finalColor = mix(bgColor, ink, textAlpha);

    if (isTearing > 0.5 || isStretching > 0.5) {
      float colorMapPos = random(vec2(shiftUv.x, t * 0.1));

      vec3 injectedColor = ink;
      if (colorMapPos > 0.8) injectedColor = acidCyan;
      else if (colorMapPos > 0.6) injectedColor = acidMagenta;
      else if (colorMapPos > 0.4) injectedColor = deepBlue;
      else if (colorMapPos > 0.2) injectedColor = acidGreen;

      float acidMix = 0.85 * clamp(u_acidIntensity, 0.0, 2.0);
      finalColor = mix(finalColor, injectedColor, acidMix);
    }
  } else {
    if (isTearing > 0.5 && random(vec2(shiftUv.x, shiftUv.y)) > 0.9) {
      finalColor = mix(finalColor, acidCyan, 0.3);
    }
  }

  float noiseSpeck = random(uv + t);
  if (noiseSpeck > 0.992) {
    finalColor = mix(finalColor, vec3(0.78, 0.23, 0.31), 0.9);
  }

  float grain = (random(uv * t) - 0.5) * 0.05;
  finalColor += grain;

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

/** Snippet parity: white-on-alpha canvas + full-strength acid (original HTML). */
export const DATA_CORRUPTION_GLITCH_SNIPPET_BITMAP = 0;
export const DATA_CORRUPTION_GLITCH_SNIPPET_ACID = 1;

/** html2canvas / opaque UI: chroma ink + tame acid so torn bands do not flood the whole card. */
export const DATA_CORRUPTION_GLITCH_DOM_BITMAP = 1;
export const DATA_CORRUPTION_GLITCH_DOM_ACID = 0.22;
