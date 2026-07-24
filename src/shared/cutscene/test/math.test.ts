import {
  angleLerp,
  clampDt,
  faceYaw,
  lookAtOrientation,
  orbitPose,
  overShoulderPose,
  samplePolyline,
  v3dist,
  yawForward,
} from "@/shared/cutscene/math";
import assert from "assert";

const EPS = 1e-6;

function approx(a: number, b: number, eps = 1e-6) {
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ~= ${b}`);
}

describe("cutscene math", () => {
  it("clamps dt spikes, NaN, and negatives", () => {
    approx(clampDt(0.016), 0.016);
    approx(clampDt(5), 0.25);
    approx(clampDt(NaN), 0);
    approx(clampDt(-1), 0);
    approx(clampDt(Infinity), 0);
  });

  it("angleLerp takes the shortest path across the wrap", () => {
    const almostPi = Math.PI - 0.1;
    const result = angleLerp(almostPi, -almostPi, 0.5);
    // Halfway across the PI boundary, NOT through zero.
    assert.ok(Math.abs(Math.abs(result) - Math.PI) < 0.11, `got ${result}`);
    approx(angleLerp(0, 1, 0.5), 0.5);
  });

  it("lookAtOrientation matches the engine yaw/pitch convention", () => {
    // Looking straight down -Z from origin.
    const [pitchZ, yawZ] = lookAtOrientation([0, 0, 0], [0, 0, -10]);
    approx(pitchZ, 0);
    approx(Math.abs(yawZ), 0, 1e-6);
    // Looking straight up: pitch approaches +PI/2.
    const [pitchUp] = lookAtOrientation([0, 0, 0], [0, 10, 0]);
    approx(pitchUp, Math.PI / 2);
    // Looking down: pitch approaches -PI/2.
    const [pitchDown] = lookAtOrientation([0, 0, 0], [0, -10, 0]);
    approx(pitchDown, -Math.PI / 2);
    // Degenerate: same point.
    assert.deepStrictEqual(lookAtOrientation([1, 1, 1], [1, 1, 1]), [0, 0]);
  });

  it("yawForward inverts faceYaw", () => {
    for (const target of [
      [10, 0, 0],
      [0, 0, 10],
      [-3, 0, 7],
      [5, 0, -5],
    ] as const) {
      const yaw = faceYaw([0, 0, 0], [...target] as [number, number, number]);
      const forward = yawForward(yaw);
      const len = Math.hypot(target[0], target[2]);
      approx(forward[0], target[0] / len, 1e-6);
      approx(forward[2], target[2] / len, 1e-6);
    }
  });

  it("samples polylines by arc length with easing", () => {
    const points: [number, number, number][] = [
      [0, 0, 0],
      [10, 0, 0],
      [10, 0, 10],
    ];
    const start = samplePolyline(points, 0, "linear");
    assert.deepStrictEqual(start.position, [0, 0, 0]);
    const end = samplePolyline(points, 1, "linear");
    assert.ok(v3dist(end.position, [10, 0, 10]) < EPS);
    // Halfway by arc length = corner of the L.
    const mid = samplePolyline(points, 0.5, "linear");
    assert.ok(v3dist(mid.position, [10, 0, 0]) < EPS);
    // Eased sampling still hits both endpoints.
    assert.ok(
      v3dist(samplePolyline(points, 0, "easeInOut").position, [0, 0, 0]) < EPS
    );
    assert.ok(
      v3dist(samplePolyline(points, 1, "easeInOut").position, [10, 0, 10]) < EPS
    );
  });

  it("handles degenerate polylines (empty, single, zero-length, NaN t)", () => {
    assert.deepStrictEqual(samplePolyline([], 0.5).position, [0, 0, 0]);
    assert.deepStrictEqual(
      samplePolyline([[1, 2, 3]], 0.7).position,
      [1, 2, 3]
    );
    assert.deepStrictEqual(
      samplePolyline(
        [
          [1, 1, 1],
          [1, 1, 1],
        ],
        0.5
      ).position,
      [1, 1, 1]
    );
    assert.deepStrictEqual(
      samplePolyline(
        [
          [0, 0, 0],
          [2, 0, 0],
        ],
        NaN,
        "linear"
      ).position,
      [0, 0, 0]
    );
    // Out-of-range t clamps.
    assert.deepStrictEqual(
      samplePolyline(
        [
          [0, 0, 0],
          [2, 0, 0],
        ],
        7,
        "linear"
      ).position,
      [2, 0, 0]
    );
  });

  it("orbit poses stay on the circle and look at the target", () => {
    const target: [number, number, number] = [100, 20, -50];
    for (const angle of [0, Math.PI / 3, Math.PI, 1.7 * Math.PI]) {
      const pose = orbitPose(target, 8, 3, angle);
      const flat = Math.hypot(
        pose.position[0] - target[0],
        pose.position[2] - target[2]
      );
      approx(flat, 8, 1e-6);
      approx(pose.position[1], target[1] + 3, 1e-6);
      // Orientation points back at the target.
      const look = lookAtOrientation(pose.position, target);
      approx(pose.orientation[0], look[0]);
      approx(pose.orientation[1], look[1]);
    }
  });

  it("over-shoulder poses sit behind the from-actor and frame the to-actor", () => {
    const pose = overShoulderPose({
      fromPos: [0, 0, 0],
      fromHeight: 1.8,
      toPos: [0, 0, -6],
      toHeight: 1.8,
      side: "right",
      pullout: 1.8,
    });
    // Camera is behind "from" relative to "to": z greater than from's z.
    assert.ok(
      pose.position[2] > 0,
      `camera z ${pose.position[2]} should be > 0`
    );
    // At roughly eye height.
    assert.ok(pose.position[1] > 1 && pose.position[1] < 3);
    // Left/right sides mirror on x.
    const left = overShoulderPose({
      fromPos: [0, 0, 0],
      fromHeight: 1.8,
      toPos: [0, 0, -6],
      toHeight: 1.8,
      side: "left",
      pullout: 1.8,
    });
    approx(left.position[0], -pose.position[0], 1e-6);
    // Degenerate: actors stacked on the same spot must not produce NaN.
    const degenerate = overShoulderPose({
      fromPos: [5, 0, 5],
      fromHeight: 1.8,
      toPos: [5, 0, 5],
      toHeight: 1.8,
      side: "right",
      pullout: 1.8,
    });
    assert.ok(degenerate.position.every((v) => Number.isFinite(v)));
    assert.ok(degenerate.orientation.every((v) => Number.isFinite(v)));
  });
});
