// HARTHMERE_CUTSCENE_MATH
//
// Pure camera-pose math for the cutscene sampler. Orientation convention is
// the engine's [pitch, yaw] pair (see CameraScript / getCamOrientation):
//   yaw   = normalizeAngle(-atan2(dz, dx) - PI/2)   to face along (dx, dz)
//   pitch = -acos(dirY) + PI/2                       to face along dirY
// No three.js dependency so everything here is unit-testable in node.

import type {
  CutsceneCameraPose,
  CutsceneVec2,
  CutsceneVec3,
} from "@/shared/cutscene/schema";
import { normalizeAngle } from "@/shared/math/angles";
import { easeInOut } from "@/shared/math/easing";

export function clampDt(dt: number, max = 0.25): number {
  if (!Number.isFinite(dt) || dt < 0) {
    return 0;
  }
  return Math.min(dt, max);
}

export function v3add(a: CutsceneVec3, b: CutsceneVec3): CutsceneVec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function v3sub(a: CutsceneVec3, b: CutsceneVec3): CutsceneVec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function v3scale(s: number, a: CutsceneVec3): CutsceneVec3 {
  return [s * a[0], s * a[1], s * a[2]];
}

export function v3dist(a: CutsceneVec3, b: CutsceneVec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function v3lerp(
  a: CutsceneVec3,
  b: CutsceneVec3,
  t: number
): CutsceneVec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** Shortest-path angular interpolation. */
export function angleLerp(a: number, b: number, t: number): number {
  const delta = normalizeAngle(b - a);
  return normalizeAngle(a + delta * t);
}

export function orientationLerp(
  a: CutsceneVec2,
  b: CutsceneVec2,
  t: number
): CutsceneVec2 {
  return [angleLerp(a[0], b[0], t), angleLerp(a[1], b[1], t)];
}

/** Orientation ([pitch, yaw]) to look from `from` toward `to`. */
export function lookAtOrientation(
  from: CutsceneVec3,
  to: CutsceneVec3
): CutsceneVec2 {
  const delta = v3sub(to, from);
  const len = Math.hypot(delta[0], delta[1], delta[2]);
  if (len < 1e-6) {
    return [0, 0];
  }
  const dir: CutsceneVec3 = [delta[0] / len, delta[1] / len, delta[2] / len];
  const yaw = normalizeAngle(-Math.atan2(delta[2], delta[0]) - Math.PI / 2);
  const pitch = -Math.acos(Math.max(-1, Math.min(1, dir[1]))) + Math.PI / 2;
  return [pitch, yaw];
}

/** Yaw for an entity at `from` to face `to` (same convention as lookAt yaw). */
export function faceYaw(from: CutsceneVec3, to: CutsceneVec3): number {
  const delta = v3sub(to, from);
  return normalizeAngle(-Math.atan2(delta[2], delta[0]) - Math.PI / 2);
}

/** Unit forward vector on the XZ plane for a yaw angle (inverse of faceYaw). */
export function yawForward(yaw: number): CutsceneVec3 {
  const angle = -yaw - Math.PI / 2;
  return [Math.cos(angle), 0, Math.sin(angle)];
}

export interface PolylineSample {
  position: CutsceneVec3;
  segment: number;
  segmentT: number;
}

/**
 * Sample a polyline at normalized (0..1) arc-length parameter `t`, with
 * optional easing over the whole path. Degenerate (zero-length) paths return
 * the first point.
 */
export function samplePolyline(
  points: readonly CutsceneVec3[],
  t: number,
  easing: "linear" | "easeInOut" = "easeInOut"
): PolylineSample {
  if (points.length === 0) {
    return { position: [0, 0, 0], segment: 0, segmentT: 0 };
  }
  if (points.length === 1) {
    return { position: [...points[0]], segment: 0, segmentT: 0 };
  }
  const clamped = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const eased = easing === "easeInOut" ? easeInOut(clamped) : clamped;

  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i + 1 < points.length; i += 1) {
    const len = v3dist(points[i], points[i + 1]);
    lengths.push(len);
    total += len;
  }
  if (total < 1e-9) {
    return { position: [...points[0]], segment: 0, segmentT: 0 };
  }
  let remaining = eased * total;
  for (let i = 0; i < lengths.length; i += 1) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const segmentT =
        lengths[i] < 1e-9 ? 0 : Math.min(1, remaining / lengths[i]);
      return {
        position: v3lerp(points[i], points[i + 1], segmentT),
        segment: i,
        segmentT,
      };
    }
    remaining -= lengths[i];
  }
  return {
    position: [...points[points.length - 1]],
    segment: lengths.length - 1,
    segmentT: 1,
  };
}

/**
 * Orbit pose around a target point. angle follows the XZ circle; the camera
 * always looks at the target.
 */
export function orbitPose(
  target: CutsceneVec3,
  radius: number,
  height: number,
  angle: number
): CutsceneCameraPose {
  const position: CutsceneVec3 = [
    target[0] + radius * Math.cos(angle),
    target[1] + height,
    target[2] + radius * Math.sin(angle),
  ];
  return { position, orientation: lookAtOrientation(position, target) };
}

/**
 * Over-the-shoulder two-shot: camera behind and beside `from` (at eye height),
 * framing `to` at 5/6 of its height. Mirrors the NPC-talk framing constants in
 * CameraScript (pullout ratio, azimuthal offset PI/8).
 */
export function overShoulderPose(args: {
  fromPos: CutsceneVec3;
  fromHeight: number;
  toPos: CutsceneVec3;
  toHeight: number;
  side: "left" | "right";
  pullout: number;
}): CutsceneCameraPose {
  const { fromPos, fromHeight, toPos, toHeight, side, pullout } = args;
  const targetRatio = 5 / 6;
  const eye: CutsceneVec3 = [
    fromPos[0],
    fromPos[1] + fromHeight * targetRatio,
    fromPos[2],
  ];
  const frameTarget: CutsceneVec3 = [
    toPos[0],
    toPos[1] + toHeight * targetRatio,
    toPos[2],
  ];
  const toDelta = v3sub(frameTarget, eye);
  const flatLen = Math.hypot(toDelta[0], toDelta[2]);
  const back =
    flatLen < 1e-6
      ? ([0, 0, 1] as CutsceneVec3)
      : ([-toDelta[0] / flatLen, 0, -toDelta[2] / flatLen] as CutsceneVec3);
  // Perpendicular on XZ; "right" of the from->to axis.
  const lateralSign = side === "right" ? 1 : -1;
  const lateral: CutsceneVec3 = [
    -back[2] * lateralSign,
    0,
    back[0] * lateralSign,
  ];
  const backDistance = Math.max(1, pullout * 0.45 * Math.max(flatLen, 1));
  const lateralDistance = Math.tan(Math.PI / 8) * backDistance;
  const position = v3add(
    v3add(eye, v3scale(backDistance, back)),
    v3scale(lateralDistance, lateral)
  );
  return { position, orientation: lookAtOrientation(position, frameTarget) };
}
