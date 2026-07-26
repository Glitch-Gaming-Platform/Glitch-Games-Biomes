// CHAPTER_1_FRACTURE_GATE_MATERIAL
//
// The visual for a Fracture Gate: a vertical tear in the present tense that
// looks onto a real place at a real other time.
//
// Authored as a self-contained THREE.ShaderMaterial rather than a
// .fs/.vs/.material.json pair because it needs no engine lighting integration
// (it is fully emissive) and because keeping it out of the codegen pipeline
// lets the aperture silhouette animate from a single uniform.
//
// Design intent — a Mouth should read as WRONG, not as magic:
//   * the silhouette is a vesica (two arcs meeting at points), not a circle.
//     Circles look like portals in games. Vesicas look like something split.
//   * the interior scrolls INWARD. Things fall into the past, not out of it.
//   * the rim is chromatically split — red and blue edges diverge — because
//     the aperture is not focusing time cleanly.
//   * everything jitters on a per-gate seed. Stable gates are a lie; the whole
//     point of the chapter is that this technology is not stable.
//
// Two eras ship in Chapter 1. Adding a third is a palette entry, not a shader.

import * as THREE from "three";

export type Ch1GateEra = "desert" | "winter" | "unknown";

export interface Ch1GatePalette {
  /** Deep interior, furthest from the rim. */
  deep: THREE.Color;
  /** Mid-field colour, where the warped noise lives. */
  mid: THREE.Color;
  /** The hot edge. Should blow out under bloom. */
  rim: THREE.Color;
  /** Ground caustic tint. */
  ground: THREE.Color;
}

export const CH1_GATE_PALETTES: Readonly<Record<Ch1GateEra, Ch1GatePalette>> = {
  // Bronze Age desert: low sun, bronze, salt, and too much light.
  desert: {
    deep: new THREE.Color(0.32, 0.14, 0.04),
    mid: new THREE.Color(0.94, 0.52, 0.14),
    rim: new THREE.Color(1.0, 0.86, 0.55),
    ground: new THREE.Color(0.85, 0.45, 0.12),
  },
  // Norse winter: a stalled year, dead pale, almost no saturation.
  winter: {
    deep: new THREE.Color(0.04, 0.09, 0.16),
    mid: new THREE.Color(0.36, 0.62, 0.82),
    rim: new THREE.Color(0.86, 0.95, 1.0),
    ground: new THREE.Color(0.3, 0.55, 0.8),
  },
  // A gate nobody has been through yet. Colourless and slightly sick.
  unknown: {
    deep: new THREE.Color(0.06, 0.05, 0.09),
    mid: new THREE.Color(0.48, 0.44, 0.62),
    rim: new THREE.Color(0.92, 0.9, 1.0),
    ground: new THREE.Color(0.4, 0.38, 0.55),
  },
};

// ---------------------------------------------------------------------------
// Shared GLSL
// ---------------------------------------------------------------------------

const NOISE_GLSL = /* glsl */ `
// Simplex-style value noise. Cheap, tileable enough, and we are stacking it.
vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
            dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
        mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
            dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
    mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
            dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
        mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
            dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y),
    u.z);
}

float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}

// Domain warping: run the field through itself. This is what stops the
// interior reading as "animated texture" and starts it reading as depth.
float warpedFbm(vec3 p, float strength) {
  vec3 q = vec3(fbm(p), fbm(p + vec3(5.2, 1.3, 2.8)), fbm(p + vec3(1.7, 9.2, 4.4)));
  vec3 r = vec3(fbm(p + strength * q + vec3(1.7, 9.2, 0.0)),
                fbm(p + strength * q + vec3(8.3, 2.8, 0.0)),
                fbm(p + strength * q + vec3(3.1, 6.7, 0.0)));
  return fbm(p + strength * r);
}

// Signed distance to a vesica (two circular arcs meeting at points).
// Negative inside. This is the aperture silhouette.
float sdVesica(vec2 p, float r, float d) {
  p = abs(p);
  float b = sqrt(max(r * r - d * d, 1e-5));
  return ((p.y - b) * d > p.x * b)
    ? length(p - vec2(0.0, b)) * sign(d)
    : length(p - vec2(-d, 0.0)) - r;
}
`;

const APERTURE_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const APERTURE_FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uOpen;        // 0 closed .. 1 fully open
uniform float uSeed;        // per-gate, so no two Mouths breathe together
uniform float uInstability; // 0 calm .. 1 the one that doesn't close
uniform float uAspect;      // width / height of the aperture
uniform vec3  uDeep;
uniform vec3  uMid;
uniform vec3  uRim;
uniform float uIntensity;

varying vec2 vUv;
varying vec3 vWorldPos;

${NOISE_GLSL}

void main() {
  // Centred, aspect-corrected quad space.
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;

  // The aperture opens as a vesica that starts as a slit and widens. The
  // 'd' parameter controls how far the two arc centres are apart: large d is
  // a razor slit, small d is nearly a circle.
  float openEase = uOpen * uOpen * (3.0 - 2.0 * uOpen);
  float d = mix(0.98, 0.30, openEase);
  float r = mix(1.02, 1.15, openEase);

  // Per-gate breathing plus instability jitter. A stable gate is a lie.
  float breathe = 0.012 * sin(uTime * 0.9 + uSeed * 6.283);
  float jitter = uInstability * 0.03 *
                 fbm(vec3(uTime * 2.7 + uSeed * 40.0, 0.0, 0.0));
  float sd = sdVesica(p, r + breathe + jitter, d);

  // Hard-ish silhouette with a soft couple of pixels so it never aliases.
  float edge = fwidth(sd) * 1.5 + 0.004;
  float inside = 1.0 - smoothstep(-edge, edge, sd);
  if (inside <= 0.001) {
    discard;
  }

  // --- Interior --------------------------------------------------------
  // Polar coordinates, scrolling INWARD. Things fall into the past.
  float rad = length(p);
  float ang = atan(p.y, p.x);
  vec3 q = vec3(ang * 0.55, rad * 1.6 - uTime * 0.22, uTime * 0.07 + uSeed);
  float n = warpedFbm(q * 1.8, 1.9 + uInstability);
  n = n * 0.5 + 0.5;

  // A second, slower field counter-rotating underneath gives parallax and
  // stops the middle looking like a drain.
  float n2 = warpedFbm(
    vec3(ang * -0.31, rad * 1.1 + uTime * 0.09, uTime * 0.04 + uSeed * 2.0) * 2.4,
    1.2
  );
  n2 = n2 * 0.5 + 0.5;

  float depth = clamp(mix(n, n2, 0.45), 0.0, 1.0);

  // Depth falloff: dark and slow at the centre, hot toward the rim.
  float toRim = clamp(1.0 - (-sd) / (r * 0.85), 0.0, 1.0);
  vec3 col = mix(uDeep, uMid, pow(depth, 1.35));
  col = mix(col, uMid * 1.4, pow(toRim, 2.2) * 0.6);

  // --- Rim -------------------------------------------------------------
  // Chromatic split: sample the silhouette three times at slightly different
  // radii so red and blue edges diverge. The aperture is not focusing cleanly.
  float ca = 0.010 + 0.020 * uInstability;
  float rimR = 1.0 - smoothstep(0.0, 0.055, abs(sd + ca));
  float rimG = 1.0 - smoothstep(0.0, 0.055, abs(sd));
  float rimB = 1.0 - smoothstep(0.0, 0.055, abs(sd - ca));
  vec3 rim = uRim * vec3(rimR, rimG, rimB);

  // A thin, very hot inner line right at the boundary. This is what bloom
  // grabs and it is most of why the gate reads as dangerous.
  float hot = 1.0 - smoothstep(0.0, 0.012, abs(sd));
  rim += uRim * hot * 2.4;

  col += rim * (0.8 + 0.6 * uOpen);

  // Filaments: bright threads reaching in from the rim, animated per-gate.
  float fil = pow(max(0.0, fbm(vec3(ang * 5.0, uTime * 0.5 + uSeed * 10.0, 0.0))), 3.0);
  col += uRim * fil * toRim * 0.9;

  // Opening flash. When a Mouth first tears it over-drives for a moment.
  col *= uIntensity * (1.0 + (1.0 - openEase) * 2.5);

  // Alpha: solid interior, feathered nowhere. A gate is not a ghost.
  float alpha = inside * clamp(0.35 + 0.65 * openEase, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

const GROUND_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GROUND_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uOpen;
uniform float uSeed;
uniform vec3  uGround;
varying vec2 vUv;

${NOISE_GLSL}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float rad = length(p);
  if (rad > 1.0) discard;

  float ang = atan(p.y, p.x);
  // Rings travelling outward, eaten by noise so they never look like a UI.
  float rings = sin(rad * 22.0 - uTime * 2.1 + uSeed * 6.28) * 0.5 + 0.5;
  float n = fbm(vec3(ang * 2.2, rad * 3.0 - uTime * 0.4, uSeed)) * 0.5 + 0.5;
  float mask = pow(1.0 - rad, 2.0) * uOpen;

  float v = rings * n * mask;
  gl_FragColor = vec4(uGround * v * 1.8, v * 0.75);
}
`;

// ---------------------------------------------------------------------------
// Material construction
// ---------------------------------------------------------------------------

export interface Ch1GateMaterials {
  aperture: THREE.ShaderMaterial;
  ground: THREE.ShaderMaterial;
}

export function makeCh1FractureGateMaterials(args: {
  era: Ch1GateEra;
  seed: number;
  aspect: number;
  instability: number;
}): Ch1GateMaterials {
  const palette = CH1_GATE_PALETTES[args.era] ?? CH1_GATE_PALETTES.unknown;

  const aperture = new THREE.ShaderMaterial({
    vertexShader: APERTURE_VERT,
    fragmentShader: APERTURE_FRAG,
    transparent: true,
    depthWrite: false,
    // Additive would wash out the deep interior and make the Mouth look
    // friendly. Normal blending keeps the centre genuinely dark.
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uOpen: { value: 0 },
      uSeed: { value: args.seed },
      uInstability: { value: args.instability },
      uAspect: { value: args.aspect },
      uDeep: { value: palette.deep.clone() },
      uMid: { value: palette.mid.clone() },
      uRim: { value: palette.rim.clone() },
      uIntensity: { value: 1 },
    },
  });

  const ground = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uOpen: { value: 0 },
      uSeed: { value: args.seed },
      uGround: { value: palette.ground.clone() },
    },
  });

  return { aperture, ground };
}

export function updateCh1FractureGateMaterials(
  materials: Ch1GateMaterials,
  args: { time: number; open: number; intensity?: number }
): void {
  materials.aperture.uniforms.uTime.value = args.time;
  materials.aperture.uniforms.uOpen.value = args.open;
  materials.aperture.uniforms.uIntensity.value = args.intensity ?? 1;
  materials.ground.uniforms.uTime.value = args.time;
  materials.ground.uniforms.uOpen.value = args.open;
}

export function disposeCh1FractureGateMaterials(
  materials: Ch1GateMaterials
): void {
  materials.aperture.dispose();
  materials.ground.dispose();
}

/** Deterministic per-gate seed so a Mouth looks the same on every visit. */
export function ch1GateSeed(gateId: string): number {
  let h = 2166136261;
  for (let i = 0; i < gateId.length; i++) {
    h ^= gateId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * The open curve. A Mouth tears fast and settles slow — 0 to 1 in about 1.2
 * seconds. Transient gates run this in reverse over the last 1.5 seconds of
 * their window.
 *
 * Deliberately monotonic and clamped to [0,1]. The "tear" overshoot people
 * expect from a portal is delivered by the shader's intensity flash
 * (`uIntensity * (1 + (1 - openEase) * 2.5)`), not by pushing this value past
 * one — an aperture whose silhouette bounces reads as rubbery, and a
 * non-monotonic close makes a collapsing gate visibly flicker back open.
 */
export function ch1GateOpenAmount(args: {
  elapsedSeconds: number;
  /** Undefined for persistent gates. */
  closesAfterSeconds?: number;
}): number {
  const openIn = 1.2;
  const closeOut = 1.5;
  const t = args.elapsedSeconds;
  if (t < 0) {
    return 0;
  }
  const rising = Math.min(1, t / openIn);
  // Cubic ease-out: fast tear, slow settle.
  const open = 1 - Math.pow(1 - rising, 3);

  if (args.closesAfterSeconds === undefined) {
    return open;
  }
  const remaining = args.closesAfterSeconds - t;
  if (remaining <= 0) {
    return 0;
  }
  if (remaining < closeOut) {
    return open * (remaining / closeOut);
  }
  return open;
}
