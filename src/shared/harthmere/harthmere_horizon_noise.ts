// HARTHMERE_HORIZON_NOISE
//
// Shared deterministic noise primitives for every "land you can see but never
// reach" backdrop — the Chapter 1 dungeons and the Harthmere back country.
//
// Extracted so the two horizons cannot drift apart. Both were going to need
// the same three functions, and two copies of a noise implementation is two
// chances for the same landform to look subtly different in each place.
//
// CONTRACT (matched to the world-gen pipeline's idioms):
//   * Seeded by a STRING, adler32-hashed. Named seeds mean each layer is
//     independently reproducible and independently tunable — change the dune
//     seed without disturbing the snow line.
//   * Pure and cheap enough to call per voxel from a terrain seeder.
//   * Weight vectors ARE the art direction. `explicitNoise(period, weights)`
//     lets a designer say "lots of 256-voxel structure, none at 128, a bit at
//     64" — which fractal falloff cannot express.

export const HARTHMERE_HORIZON_NOISE_VERSION =
  "harthmere-horizon-noise-v1" as const;

function adler32(text: string): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < text.length; i++) {
    a = (a + text.charCodeAt(i)) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function hash2(seed: number, x: number, y: number): number {
  let h = seed ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967295;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Coherent value noise in [-1, 1]. */
function valueNoise2(seed: number, x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smoothstep(x - xi);
  const yf = smoothstep(y - yi);
  const v00 = hash2(seed, xi, yi);
  const v10 = hash2(seed, xi + 1, yi);
  const v01 = hash2(seed, xi, yi + 1);
  const v11 = hash2(seed, xi + 1, yi + 1);
  const top = v00 + (v10 - v00) * xf;
  const bottom = v01 + (v11 - v01) * xf;
  return (top + (bottom - top) * yf) * 2 - 1;
}

/**
 * Weighted-octave noise. Lacunarity 2, matching the pipeline. Octaves whose
 * scale would fall below one voxel are skipped rather than aliasing.
 */
export function harthmereExplicitNoise(
  seedName: string,
  x: number,
  z: number,
  period: number,
  weights: readonly number[]
): number {
  const seed = adler32(seedName);
  let total = 0;
  for (let i = 0; i < weights.length; i++) {
    const weight = weights[i];
    if (weight === 0) {
      continue;
    }
    const scale = period / Math.pow(2, i);
    if (scale < 1) {
      break;
    }
    total += weight * valueNoise2(seed + i * 7919, x / scale, z / scale);
  }
  return total;
}

/**
 * 0 at the boundary, 1 once `radius` voxels beyond it. The pipeline's
 * `linear_boundary`. This is what stops a backdrop starting as a cliff.
 */
export function harthmereLinearBoundary(
  distance: number,
  radius: number
): number {
  if (radius <= 0) {
    return 1;
  }
  return Math.max(0, Math.min(1, distance / radius));
}

/**
 * Normalise weighted noise to roughly [0, 1] using its own weight budget, then
 * bias upward. A horizon that dips below the viewer reads as a pit, not a
 * vista, so backdrops want a positive-biased field rather than a symmetric one.
 */
export function harthmereUpwardBiasedNoise(
  seedName: string,
  x: number,
  z: number,
  period: number,
  weights: readonly number[]
): number {
  const raw = harthmereExplicitNoise(seedName, x, z, period, weights);
  const budget = Math.max(
    1e-6,
    weights.reduce((sum, w) => sum + Math.abs(w), 0)
  );
  return (raw / budget) * 0.5 + 0.5;
}
