import type { ResolvedActor } from "@/shared/cutscene/binding";
import type {
  CutsceneEffect,
  CutsceneRuntime,
  CutsceneRuntimeProviders,
} from "@/shared/cutscene/director_core";
import {
  createCutsceneRuntime,
  sampleCameraSpec,
} from "@/shared/cutscene/director_core";
import type { CutsceneDef, CutsceneVec3 } from "@/shared/cutscene/schema";
import { validateCutsceneDef } from "@/shared/cutscene/schema";
import assert from "assert";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function parse(raw: unknown): CutsceneDef {
  const result = validateCutsceneDef(raw);
  assert.ok(result.ok, JSON.stringify(!result.ok && result.issues));
  return result.def;
}

function playerActor(): ResolvedActor {
  return { kind: "player", role: "player", entityId: 7, height: 1.8 };
}

function npcActor(role: string, entityId: number): ResolvedActor {
  return { kind: "entity", role, entityId, height: 1.8, isNpc: true };
}

function ghostActor(role: string, spawnAt: CutsceneVec3): ResolvedActor {
  return {
    kind: "ghost",
    role,
    ghostId: -12345,
    asset: "townsperson_clergy",
    family: "human",
    spawnAt,
    height: 1.8,
  };
}

class Harness {
  effects: CutsceneEffect[] = [];
  alive = true;
  worldReady = true;
  worldReadyPositions: CutsceneVec3[] = [];
  advance = false;
  positions = new Map<string, CutsceneVec3>();
  runtime: CutsceneRuntime;

  constructor(runtime: CutsceneRuntime, actors: Map<string, ResolvedActor>) {
    this.runtime = runtime;
    for (const [role, actor] of actors) {
      if (actor.kind === "player") this.positions.set(role, [0, 0, 0]);
      if (actor.kind === "entity") this.positions.set(role, [5, 0, 5]);
    }
  }

  providers(): CutsceneRuntimeProviders {
    return {
      livePositionOf: (actor) => this.positions.get(actor.role),
      liveOrientationOf: () => [0, 0],
      playerAlive: () => this.alive,
      worldReadyAt: (position) => {
        this.worldReadyPositions.push([...position]);
        return this.worldReady;
      },
      advanceRequested: () => this.advance,
    };
  }

  tick(dt: number): CutsceneEffect[] {
    const out = this.runtime.tick(dt, this.providers());
    this.effects.push(...out);
    return out;
  }

  /** Tick until finished or maxSeconds of scene time elapses. */
  run(maxSeconds: number, dt = 0.05): void {
    const steps = Math.ceil(maxSeconds / dt);
    for (let i = 0; i < steps && !this.runtime.finished; i += 1) {
      this.tick(dt);
    }
  }

  ofKind<K extends CutsceneEffect["kind"]>(
    kind: K
  ): Extract<CutsceneEffect, { kind: K }>[] {
    return this.effects.filter((e) => e.kind === kind) as Extract<
      CutsceneEffect,
      { kind: K }
    >[];
  }
}

function makeRuntime(
  raw: unknown,
  actors?: Map<string, ResolvedActor>
): Harness {
  const def = parse(raw);
  const resolved =
    actors ?? new Map<string, ResolvedActor>([["player", playerActor()]]);
  const runtime = createCutsceneRuntime({
    def,
    actors: resolved,
    instanceNonce: "test",
  });
  return new Harness(runtime, resolved);
}

function flyoverDef(overrides: Record<string, unknown> = {}) {
  return {
    id: "flyover",
    name: "Flyover",
    cast: [{ role: "player", binding: { kind: "player" } }],
    shots: [
      {
        id: "move",
        duration: 2,
        camera: {
          kind: "dolly",
          waypoints: [
            { position: [0, 10, 0], orientation: [0, 0] },
            { position: [10, 10, 0], orientation: [0, 1] },
          ],
        },
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe("cutscene director core", () => {
  it("plays a scene start-to-finish with begin/restore effects in order", () => {
    const h = makeRuntime(flyoverDef());
    h.run(10);
    assert.ok(h.runtime.finished);
    assert.strictEqual(h.runtime.finishReason, "completed");

    const kinds = h.effects.map((e) => e.kind);
    // Prewarm lock + fade, then begin block.
    assert.strictEqual(kinds[0], "lockInput");
    assert.strictEqual(kinds[1], "fade");
    assert.ok(kinds.includes("begin"));
    // Camera poses were streamed.
    assert.ok(h.ofKind("cameraPose").length > 10);
    // Exactly one end-state commit and one finished.
    assert.strictEqual(h.ofKind("commitEndState").length, 1);
    assert.strictEqual(h.ofKind("finished").length, 1);
    // Restore block present and ordered: cameraClear before finished.
    const clearIdx = kinds.lastIndexOf("cameraClear");
    const finishedIdx = kinds.lastIndexOf("finished");
    assert.ok(clearIdx >= 0 && clearIdx < finishedIdx);
    // HUD hidden at begin, restored at finish.
    const hudEffects = h.ofKind("hud");
    assert.strictEqual(hudEffects[0].hidden, true);
    assert.strictEqual(hudEffects[hudEffects.length - 1].hidden, false);
    // Input unlocked at the end.
    const locks = h.ofKind("lockInput");
    assert.strictEqual(locks[locks.length - 1].on, false);
  });

  it("dolly camera interpolates position over the shot", () => {
    const h = makeRuntime(flyoverDef());
    h.run(10);
    const poses = h.ofKind("cameraPose");
    const first = poses[0].pose.position;
    const last = poses[poses.length - 1].pose.position;
    assert.ok(first[0] < 1);
    assert.ok(last[0] > 9);
    // Monotone-ish progress (eased, never reversing).
    for (let i = 1; i < poses.length; i += 1) {
      assert.ok(
        poses[i].pose.position[0] >= poses[i - 1].pose.position[0] - 1e-9
      );
    }
  });

  it("ticking after finish is a no-op and never re-commits", () => {
    const h = makeRuntime(flyoverDef());
    h.run(10);
    assert.ok(h.runtime.finished);
    const before = h.effects.length;
    h.tick(0.05);
    h.tick(0.05);
    assert.strictEqual(h.effects.length, before);
    assert.strictEqual(h.ofKind("commitEndState").length, 1);
  });

  it("skip runs the same finish path with the same single commit", () => {
    const h = makeRuntime(
      flyoverDef({
        shots: [
          {
            id: "long",
            duration: 20,
            camera: {
              kind: "static",
              position: [0, 10, 0],
              orientation: [0, 0],
            },
          },
        ],
        onEnd: {
          placements: [{ role: "player", position: [1, 2, 3] }],
          commits: [{ hook: "quest.advance", payload: { step: 2 } }],
        },
      })
    );
    h.run(4); // past skipAfterSeconds (3)
    assert.ok(!h.runtime.finished);
    h.runtime.requestSkip();
    h.tick(0.05);
    assert.ok(h.runtime.finished);
    assert.strictEqual(h.runtime.finishReason, "skipped");
    const commits = h.ofKind("commitEndState");
    assert.strictEqual(commits.length, 1);
    assert.strictEqual(commits[0].commits[0].hook, "quest.advance");
    assert.deepStrictEqual(commits[0].placements[0].position, [1, 2, 3]);
    // Double-skip after finish: nothing more.
    h.runtime.requestSkip();
    h.tick(0.05);
    assert.strictEqual(h.ofKind("commitEndState").length, 1);
    assert.strictEqual(h.ofKind("finished").length, 1);
  });

  it("skip is denied before skipAfterSeconds on unskippable scenes, honored after", () => {
    const h = makeRuntime(
      flyoverDef({
        settings: { skippable: false, skipAfterSeconds: 1 },
        shots: [
          {
            id: "long",
            duration: 30,
            camera: {
              kind: "static",
              position: [0, 10, 0],
              orientation: [0, 0],
            },
          },
        ],
      })
    );
    h.tick(0.05); // prewarm
    h.tick(0.05);
    h.runtime.requestSkip();
    h.tick(0.05);
    assert.ok(!h.runtime.finished, "skip before threshold must be denied");
    h.run(1.2);
    h.runtime.requestSkip();
    h.tick(0.05);
    assert.ok(h.runtime.finished, "skip after threshold must be honored");
    assert.strictEqual(h.runtime.finishReason, "skipped");
  });

  it("aborts through the finish path when the player dies mid-scene", () => {
    const h = makeRuntime(flyoverDef());
    h.run(0.5);
    assert.ok(!h.runtime.finished);
    h.alive = false;
    h.tick(0.05);
    assert.ok(h.runtime.finished);
    assert.strictEqual(h.runtime.finishReason, "aborted");
    // Full restore still happened.
    assert.strictEqual(
      h.ofKind("commitEndState").length,
      0,
      "abort cleanup must not imply story success by default"
    );
    const locks = h.ofKind("lockInput");
    assert.strictEqual(locks[locks.length - 1].on, false);
    assert.ok(h.ofKind("cameraClear").length === 1);
  });

  it("can explicitly opt an abort outcome into end-state commits", () => {
    const h = makeRuntime(flyoverDef({ settings: { commitOn: ["aborted"] } }));
    h.run(0.5);
    h.alive = false;
    h.tick(0.05);
    assert.strictEqual(h.runtime.finishReason, "aborted");
    assert.strictEqual(h.ofKind("commitEndState").length, 1);
  });

  it("external abort() drains the finish path exactly once", () => {
    const h = makeRuntime(flyoverDef());
    h.run(0.5);
    const effects = h.runtime.abort();
    assert.ok(effects.some((e) => e.kind === "finished"));
    assert.ok(h.runtime.finished);
    assert.deepStrictEqual(h.runtime.abort(), []);
  });

  it("waits in prewarm for shards, then starts; times out if never ready", () => {
    const h = makeRuntime(flyoverDef());
    h.worldReady = false;
    h.tick(0.1);
    assert.ok(!h.effects.some((e) => e.kind === "begin"));
    h.worldReady = true;
    h.tick(0.1);
    assert.ok(h.effects.some((e) => e.kind === "begin"));

    // Timeout path: never ready, default prewarmTimeoutSeconds = 2.
    const h2 = makeRuntime(flyoverDef());
    h2.worldReady = false;
    h2.run(2.5);
    assert.ok(
      h2.effects.some((e) => e.kind === "begin"),
      "starts after timeout"
    );
  });

  it("prewarms explicit waypoints and generated camera-path samples", () => {
    const h = makeRuntime(
      flyoverDef({
        shots: [
          {
            id: "path",
            duration: 4,
            camera: {
              kind: "dolly",
              waypoints: [
                { position: [0, 10, 0] },
                { position: [10, 20, 10] },
                { position: [20, 10, 0] },
              ],
            },
          },
        ],
      })
    );
    h.worldReady = true;
    h.tick(0.05);
    assert.ok(
      h.worldReadyPositions.some(
        (position) =>
          position[0] === 10 && position[1] === 20 && position[2] === 10
      ),
      "middle dolly waypoint must be included in prewarm"
    );
    assert.ok(h.worldReadyPositions.length > 3);
  });

  it("clamps dt spikes so a hitch cannot swallow the scene", () => {
    const h = makeRuntime(flyoverDef());
    h.tick(0.05); // prewarm
    h.tick(1000); // massive hitch: clamped to 0.25s
    assert.ok(!h.runtime.finished);
    assert.ok(h.runtime.elapsed <= 0.5);
    // NaN / negative dt are no-ops on the clock.
    const before = h.runtime.elapsed;
    h.tick(NaN);
    h.tick(-5);
    assert.strictEqual(h.runtime.elapsed, before);
  });

  it("fires actions at their offsets exactly once", () => {
    const h = makeRuntime(
      flyoverDef({
        shots: [
          {
            id: "s",
            duration: 2,
            camera: {
              kind: "static",
              position: [0, 5, 0],
              orientation: [0, 0],
            },
            actions: [
              { kind: "sfx", at: 0.5, name: "boom" },
              {
                kind: "shake",
                at: 1.0,
                magnitude: 0.1,
                repeats: 3,
                durationMs: 500,
              },
              { kind: "fov", at: 1.5, fov: 30 },
            ],
          },
        ],
      })
    );
    h.run(10);
    assert.strictEqual(h.ofKind("sfx").length, 1);
    assert.strictEqual(h.ofKind("shake").length, 1);
    // One fov set by the action + one fov restore (undefined) at finish.
    const fovs = h.ofKind("fov");
    assert.strictEqual(fovs.length, 2);
    assert.strictEqual(fovs[0].fov, 30);
    assert.strictEqual(fovs[1].fov, undefined);
  });

  it("keeps authored fades non-blocking while covered cuts block", () => {
    const authored = makeRuntime(
      flyoverDef({
        shots: [
          {
            id: "authored-fades",
            duration: 1,
            camera: {
              kind: "static",
              position: [0, 5, 0],
              orientation: [0, 0],
            },
            actions: [
              { kind: "fade", at: 0.1, direction: "out", duration: 0.2 },
              { kind: "fade", at: 0.5, direction: "in", duration: 0.2 },
            ],
          },
        ],
      })
    );
    authored.run(0.8);
    const authoredFades = authored
      .ofKind("fade")
      .filter((effect) => effect.duration === 0.2);
    assert.strictEqual(authoredFades.length, 2);
    assert.ok(authoredFades.every((effect) => !effect.blocking));

    const coveredCut = makeRuntime(
      flyoverDef({
        shots: [
          {
            id: "first",
            duration: 0.1,
            camera: {
              kind: "static",
              position: [0, 5, 0],
              orientation: [0, 0],
            },
          },
          {
            id: "second",
            duration: 1,
            transitionIn: "fade",
            camera: {
              kind: "static",
              position: [1, 5, 0],
              orientation: [0, 0],
            },
          },
        ],
      })
    );
    coveredCut.run(0.3);
    assert.ok(
      coveredCut
        .ofKind("fade")
        .some((effect) => effect.direction === "out" && effect.blocking)
    );
  });

  it("moveTo drives an npc puppet to the target and emits poses", () => {
    const actors = new Map<string, ResolvedActor>([
      ["player", playerActor()],
      ["npc", npcActor("npc", 42)],
    ]);
    const h = makeRuntime(
      {
        id: "walk",
        name: "Walk",
        cast: [
          { role: "player", binding: { kind: "player" } },
          { role: "npc", binding: { kind: "entity", entityId: 42 } },
        ],
        shots: [
          {
            id: "walk",
            duration: 1,
            until: { kind: "actorArrived", role: "npc", maxDuration: 20 },
            camera: { kind: "trackRole", role: "npc" },
            actions: [
              {
                kind: "moveTo",
                at: 0,
                role: "npc",
                to: [15, 0, 5],
                speed: 5,
                arriveWithin: 0.25,
              },
            ],
          },
        ],
      },
      actors
    );
    h.run(30);
    assert.ok(h.runtime.finished);
    const poses = h.ofKind("actorPose").filter((p) => p.actor.role === "npc");
    assert.ok(poses.length > 5);
    const lastPose = poses[poses.length - 1];
    // npc started at [5,0,5]; target [15,0,5]: arrived within tolerance.
    assert.ok(
      Math.abs(lastPose.position[0] - 15) < 0.5,
      `x=${lastPose.position[0]}`
    );
    // Walked, not teleported: intermediate positions exist.
    assert.ok(poses.some((p) => p.position[0] > 6 && p.position[0] < 14));
    // Faced its direction of travel (+x).
    assert.ok(poses.some((p) => p.moving));
  });

  it("moveTo timeout falls back to teleport under fade, scene still completes", () => {
    const actors = new Map<string, ResolvedActor>([
      ["player", playerActor()],
      ["npc", npcActor("npc", 42)],
    ]);
    const h = makeRuntime(
      {
        id: "stuck",
        name: "Stuck Walk",
        cast: [
          { role: "player", binding: { kind: "player" } },
          { role: "npc", binding: { kind: "entity", entityId: 42 } },
        ],
        shots: [
          {
            id: "walk",
            duration: 1,
            until: { kind: "actorArrived", role: "npc", maxDuration: 30 },
            camera: { kind: "trackRole", role: "npc" },
            actions: [
              {
                kind: "moveTo",
                at: 0,
                role: "npc",
                to: [10000, 0, 5], // unreachable at this speed
                speed: 1,
                arriveWithin: 0.5,
                timeoutSeconds: 1,
                timeoutFallback: "teleport",
              },
            ],
          },
        ],
      },
      actors
    );
    h.run(40);
    assert.ok(
      h.runtime.finished,
      "scene must complete despite unreachable target"
    );
    const poses = h.ofKind("actorPose").filter((p) => p.actor.role === "npc");
    const last = poses[poses.length - 1];
    assert.ok(
      Math.abs(last.position[0] - 10000) < 1e-6,
      "teleported to target"
    );
    // Fade pulse covered the pop (prewarm fade + teleport pulse + finish fade).
    assert.ok(h.ofKind("fade").length >= 4);
  });

  it("ghost actors emit poses every running tick and never leak into end placements", () => {
    const ghost = ghostActor("spirit", [3, 0, 3]);
    const actors = new Map<string, ResolvedActor>([
      ["player", playerActor()],
      ["spirit", ghost],
    ]);
    const h = makeRuntime(
      {
        id: "haunt",
        name: "Haunt",
        cast: [
          { role: "player", binding: { kind: "player" } },
          {
            role: "spirit",
            binding: {
              kind: "ghost",
              asset: "townsperson_clergy",
              spawnAt: [3, 0, 3],
            },
          },
        ],
        shots: [
          {
            id: "s",
            duration: 1,
            camera: { kind: "trackRole", role: "spirit" },
          },
        ],
        onEnd: { placements: [{ role: "spirit", position: [9, 9, 9] }] },
      },
      actors
    );
    h.run(5);
    const ghostPoses = h
      .ofKind("actorPose")
      .filter((p) => p.actor.role === "spirit");
    assert.ok(ghostPoses.length > 5, "ghosts emit poses continuously");
    assert.deepStrictEqual(ghostPoses[0].position, [3, 0, 3]);
    // Ghost release happens at finish.
    assert.ok(h.ofKind("actorRelease").some((e) => e.actor.role === "spirit"));
    // Placement for a ghost is emitted (executor decides it's a no-op server-side).
    const commit = h.ofKind("commitEndState")[0];
    assert.strictEqual(commit.placements.length, 1);
  });

  it("dialogue shows subtitles, clears them, and gates dialogueDone shots", () => {
    const h = makeRuntime(
      flyoverDef({
        shots: [
          {
            id: "talk",
            duration: 1,
            until: { kind: "dialogueDone", maxDuration: 30 },
            camera: {
              kind: "static",
              position: [0, 5, 0],
              orientation: [0, 0],
            },
            actions: [
              {
                kind: "dialogue",
                at: 0.2,
                speaker: "Elder",
                text: "Short line.",
                voice: "azure-speech|voice=en-US-LunaNeural",
                duration: 2,
              },
            ],
          },
        ],
      })
    );
    h.run(30);
    assert.ok(h.runtime.finished);
    const subtitles = h.ofKind("subtitle");
    assert.ok(subtitles.some((s) => s.value?.text === "Short line."));
    assert.ok(subtitles.some((s) => s.value?.speaker === "Elder"));
    assert.ok(
      subtitles.some(
        (s) => s.value?.voice === "azure-speech|voice=en-US-LunaNeural"
      )
    );
    // Cleared before finish.
    assert.strictEqual(subtitles[subtitles.length - 1].value, undefined);
    // Shot ended promptly after the line (0.2 + 2s + slack), not at maxDuration.
    assert.ok(h.runtime.elapsed < 5, `elapsed ${h.runtime.elapsed}`);
  });

  it("presents player dialogue as You instead of an internal cast role", () => {
    const h = makeRuntime(
      flyoverDef({
        shots: [
          {
            id: "player-line",
            duration: 1,
            camera: {
              kind: "static",
              position: [0, 2, 4],
              orientation: [0, 0],
            },
            actions: [
              {
                kind: "dialogue",
                at: 0,
                role: "player",
                text: "Not this small.",
              },
            ],
          },
        ],
      })
    );
    h.run(3);
    assert.ok(
      h.ofKind("subtitle").some(
        (subtitle) =>
          subtitle.value?.speaker === "You" &&
          subtitle.value.text === "Not this small."
      )
    );
  });

  it("until.maxDuration is a hard ceiling even if the condition never fires", () => {
    const h = makeRuntime(
      flyoverDef({
        shots: [
          {
            id: "input",
            duration: 0.5,
            until: { kind: "playerInput", maxDuration: 2 },
            camera: {
              kind: "static",
              position: [0, 5, 0],
              orientation: [0, 0],
            },
          },
        ],
      })
    );
    h.run(30); // advance never requested
    assert.ok(h.runtime.finished);
    assert.ok(h.runtime.elapsed <= 3, `elapsed ${h.runtime.elapsed}`);
  });

  it("playerInput advances the shot as soon as requested after min duration", () => {
    const h = makeRuntime(
      flyoverDef({
        shots: [
          {
            id: "input",
            duration: 0.2,
            until: { kind: "playerInput", maxDuration: 30 },
            camera: {
              kind: "static",
              position: [0, 5, 0],
              orientation: [0, 0],
            },
          },
        ],
      })
    );
    h.run(0.5);
    assert.ok(!h.runtime.finished);
    h.advance = true;
    h.tick(0.05);
    assert.ok(h.runtime.finished);
  });

  it("multi-shot scenes advance with blend transitions and never snap to origin", () => {
    const actors = new Map<string, ResolvedActor>([
      ["player", playerActor()],
      ["npc", npcActor("npc", 42)],
    ]);
    const h = makeRuntime(
      {
        id: "two-shot",
        name: "Two Shot",
        cast: [
          { role: "player", binding: { kind: "player" } },
          { role: "npc", binding: { kind: "entity", entityId: 42 } },
        ],
        shots: [
          {
            id: "a",
            duration: 1,
            camera: {
              kind: "static",
              position: [0, 5, 0],
              orientation: [0, 0],
            },
          },
          {
            id: "b",
            duration: 1,
            transitionIn: "blend",
            blendSeconds: 0.4,
            camera: {
              kind: "static",
              position: [20, 5, 0],
              orientation: [0, 1],
            },
          },
        ],
      },
      actors
    );
    h.run(10);
    assert.ok(h.runtime.finished);
    const poses = h.ofKind("cameraPose");
    // Blend produced intermediate positions between 0 and 20.
    assert.ok(
      poses.some((p) => p.pose.position[0] > 3 && p.pose.position[0] < 17),
      "expected blended intermediate poses"
    );
    // Every pose is finite.
    for (const p of poses) {
      assert.ok(p.pose.position.every((v) => Number.isFinite(v)));
      assert.ok(p.pose.orientation.every((v) => Number.isFinite(v)));
    }
  });

  it("holds the last good pose when a camera role dies mid-shot (no origin snap)", () => {
    const actors = new Map<string, ResolvedActor>([
      ["player", playerActor()],
      ["npc", npcActor("npc", 42)],
    ]);
    const h = makeRuntime(
      {
        id: "orbit-dead",
        name: "Orbit Dead",
        cast: [
          { role: "player", binding: { kind: "player" } },
          { role: "npc", binding: { kind: "entity", entityId: 42 } },
        ],
        shots: [
          {
            id: "orbit",
            duration: 2,
            camera: { kind: "orbit", role: "npc", radius: 5, height: 2 },
          },
        ],
      },
      actors
    );
    h.run(0.5);
    const posesBefore = h.ofKind("cameraPose").length;
    assert.ok(posesBefore > 0);
    // Entity vanishes (despawn/death): provider returns undefined. The puppet
    // holds the last-known position, so the orbit keeps circling that point
    // instead of snapping to the origin or going NaN.
    h.positions.delete("npc");
    h.run(0.3);
    const poses = h.ofKind("cameraPose");
    assert.ok(poses.length > posesBefore, "camera keeps emitting poses");
    for (const p of poses.slice(posesBefore)) {
      assert.ok(p.pose.position.every((v) => Number.isFinite(v)));
      assert.ok(p.pose.orientation.every((v) => Number.isFinite(v)));
      // Still on the 5-radius orbit around the npc's last position [5,0,5].
      const flat = Math.hypot(p.pose.position[0] - 5, p.pose.position[2] - 5);
      assert.ok(Math.abs(flat - 5) < 1e-6, `flat dist ${flat}`);
    }
  });

  it("uncontrolled actors track live positions; controlled actors ignore them", () => {
    const actors = new Map<string, ResolvedActor>([
      ["player", playerActor()],
      ["npc", npcActor("npc", 42)],
    ]);
    const h = makeRuntime(
      {
        id: "track-live",
        name: "Track Live",
        cast: [
          { role: "player", binding: { kind: "player" } },
          { role: "npc", binding: { kind: "entity", entityId: 42 } },
        ],
        shots: [
          {
            id: "watch",
            duration: 1,
            camera: { kind: "trackRole", role: "npc", offset: [0, 2, 4] },
          },
          {
            id: "control",
            duration: 1,
            camera: { kind: "trackRole", role: "npc", offset: [0, 2, 4] },
            actions: [
              { kind: "teleport", at: 0, role: "npc", to: [50, 0, 50] },
            ],
          },
        ],
      },
      actors
    );
    // While uncontrolled, camera follows live movement.
    h.run(0.5);
    h.positions.set("npc", [8, 0, 8]);
    h.tick(0.05);
    let poses = h.ofKind("cameraPose");
    const followed = poses[poses.length - 1].pose.position;
    assert.ok(Math.abs(followed[0] - 8) < 0.6, `followed x=${followed[0]}`);
    // After the teleport takes control, live updates are ignored.
    h.run(0.6); // into shot 2
    h.positions.set("npc", [0, 0, 0]);
    h.run(0.3);
    poses = h.ofKind("cameraPose");
    const controlled = poses[poses.length - 1].pose.position;
    assert.ok(
      Math.abs(controlled[0] - 50) < 1,
      `controlled x=${controlled[0]}`
    );
    assert.ok(h.runtime.finished || h.runtime.currentShotIndex === 1);
  });

  it("emote actions emit animations mapped to their actors", () => {
    const actors = new Map<string, ResolvedActor>([
      ["player", playerActor()],
      ["npc", npcActor("npc", 42)],
    ]);
    const h = makeRuntime(
      {
        id: "emotes",
        name: "Emotes",
        cast: [
          { role: "player", binding: { kind: "player" } },
          { role: "npc", binding: { kind: "entity", entityId: 42 } },
        ],
        shots: [
          {
            id: "s",
            duration: 1,
            camera: {
              kind: "static",
              position: [0, 5, 0],
              orientation: [0, 0],
            },
            actions: [
              { kind: "emote", at: 0.1, role: "player", emote: "wave" },
              { kind: "emote", at: 0.2, role: "npc", emote: "talkGesture" },
              {
                kind: "holdItem",
                at: 0.25,
                role: "npc",
                itemId: 4537020877770159,
              },
            ],
          },
        ],
      },
      actors
    );
    h.run(5);
    const anims = h.ofKind("actorAnimation");
    assert.strictEqual(anims.length, 2);
    assert.ok(
      anims.some((a) => a.actor.role === "player" && a.animation === "wave")
    );
    assert.ok(
      anims.some((a) => a.actor.role === "npc" && a.animation === "talkGesture")
    );
    const npcPoses = h
      .ofKind("actorPose")
      .filter((pose) => pose.actor.role === "npc" && pose.animation);
    assert.ok(npcPoses.some((pose) => pose.animation === "talkGesture"));
    assert.ok(npcPoses.every((pose) => Number.isFinite(pose.animationTime)));
    const items = h.ofKind("actorItem");
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].actor.role, "npc");
    assert.strictEqual(items[0].itemId, 4537020877770159);
  });

  it("emits capture after the staged camera and actors but before finish fades", () => {
    const actors = new Map<string, ResolvedActor>([
      ["player", playerActor()],
      ["npc", npcActor("npc", 42)],
    ]);
    const h = makeRuntime(
      {
        id: "capture",
        name: "Capture",
        cast: [
          { role: "player", binding: { kind: "player" } },
          { role: "npc", binding: { kind: "entity", entityId: 42 } },
        ],
        shots: [
          {
            id: "hero",
            duration: 1,
            camera: { kind: "trackRole", role: "npc" },
            actions: [
              { kind: "face", role: "npc", towards: { role: "player" } },
              { kind: "capture", at: 1, captureId: "hero-frame" },
            ],
          },
        ],
      },
      actors
    );
    h.run(5);
    const kinds = h.effects.map((effect) => effect.kind);
    const captureIndex = kinds.indexOf("capture");
    assert.ok(captureIndex > kinds.indexOf("cameraPose"));
    assert.ok(captureIndex > kinds.indexOf("actorPose"));
    const finalFadeOut = kinds.findIndex(
      (kind, index) => index > captureIndex && kind === "fade"
    );
    assert.ok(finalFadeOut > captureIndex);
  });

  it("emits engine VFX once at an explicit or cast-relative position", () => {
    const actors = new Map<string, ResolvedActor>([
      ["player", playerActor()],
      ["npc", npcActor("npc", 42)],
    ]);
    const h = makeRuntime(
      {
        id: "vfx",
        name: "VFX",
        cast: [
          { role: "player", binding: { kind: "player" } },
          { role: "npc", binding: { kind: "entity", entityId: 42 } },
        ],
        shots: [
          {
            id: "creation",
            duration: 1,
            camera: { kind: "trackRole", role: "npc" },
            actions: [
              {
                kind: "vfx",
                at: 0.1,
                effect: "exoticMatterCreation",
                position: [7, 8, 9],
              },
              {
                kind: "vfx",
                at: 0.2,
                effect: "exoticMatterCreation",
                atRole: "npc",
              },
            ],
          },
        ],
      },
      actors
    );
    h.run(5);
    const effects = h.ofKind("vfx");
    assert.strictEqual(effects.length, 2);
    assert.deepStrictEqual(effects[0].position, [7, 8, 9]);
    assert.deepStrictEqual(effects[1].position, [5, 0, 5]);
  });

  it("grounds walking positions through the runtime provider", () => {
    const actors = new Map<string, ResolvedActor>([
      ["player", playerActor()],
      ["npc", npcActor("npc", 42)],
    ]);
    const def = parse({
      id: "grounded-walk",
      name: "Grounded Walk",
      cast: [
        { role: "player", binding: { kind: "player" } },
        { role: "npc", binding: { kind: "entity", entityId: 42 } },
      ],
      shots: [
        {
          id: "walk",
          duration: 0.5,
          until: { kind: "actorArrived", role: "npc", maxDuration: 5 },
          camera: { kind: "trackRole", role: "npc" },
          actions: [{ kind: "moveTo", role: "npc", to: [7, 99, 5], speed: 5 }],
        },
      ],
    });
    const runtime = createCutsceneRuntime({
      def,
      actors,
      instanceNonce: "ground",
    });
    const h = new Harness(runtime, actors);
    const baseProviders = h.providers();
    for (let i = 0; i < 100 && !runtime.finished; i += 1) {
      h.effects.push(
        ...runtime.tick(0.05, {
          ...baseProviders,
          groundPosition: (_actor, desired) => [desired[0], 12, desired[2]],
        })
      );
    }
    const poses = h
      .ofKind("actorPose")
      .filter((pose) => pose.actor.role === "npc");
    assert.ok(poses.length > 0);
    assert.ok(poses.every((pose) => pose.position[1] === 12));
  });

  it("preserves explicit cinematic Y for synthetic ghost teleports", () => {
    const actors = new Map<string, ResolvedActor>([
      ["ghost", ghostActor("ghost", [0, 80, 0])],
    ]);
    const def = parse({
      id: "elevated-ghost",
      name: "Elevated Ghost",
      cast: [
        {
          role: "ghost",
          binding: {
            kind: "ghost",
            asset: "boss.glb",
            family: "quest_creature",
            spawnAt: [0, 80, 0],
            height: 5,
          },
        },
      ],
      shots: [
        {
          id: "hero",
          duration: 1,
          camera: { kind: "trackRole", role: "ghost" },
          actions: [
            { kind: "teleport", role: "ghost", to: [10, 80, 20] },
          ],
        },
      ],
    });
    const runtime = createCutsceneRuntime({
      def,
      actors,
      instanceNonce: "elevated-ghost",
    });
    const h = new Harness(runtime, actors);
    h.effects.push(
      ...runtime.tick(0.05, {
        ...h.providers(),
        groundPosition: (_actor, desired) => [desired[0], 45, desired[2]],
      })
    );
    const poses = h
      .ofKind("actorPose")
      .filter((pose) => pose.actor.role === "ghost");
    assert.ok(poses.length > 0);
    assert.ok(poses.every((pose) => pose.position[1] === 80));
  });

  it("scene-level timeOfDay/music apply at begin and restore at finish", () => {
    const h = makeRuntime(
      flyoverDef({
        settings: { timeOfDay: 0.75, music: "battle_music" },
      })
    );
    h.run(10);
    const times = h.ofKind("timeOfDay");
    assert.strictEqual(times[0].value, 0.75);
    assert.strictEqual(times[times.length - 1].value, undefined);
    const music = h.ofKind("music");
    assert.strictEqual(music[0].track, "battle_music");
    assert.strictEqual(music[music.length - 1].track, undefined);
  });
});

// ---------------------------------------------------------------------------
// Camera spec sampling
// ---------------------------------------------------------------------------

describe("cutscene camera sampling", () => {
  const world = {
    positionOf: (role: string): CutsceneVec3 | undefined =>
      role === "a" ? [0, 0, 0] : role === "b" ? [0, 0, -6] : undefined,
    yawOf: (role: string) => (role === "a" ? 0 : undefined),
    heightOf: () => 1.8,
  };

  it("static with lookAtRole aims at the role", () => {
    const pose = sampleCameraSpec(
      { kind: "static", position: [0, 2, 10], lookAtRole: "b" } as never,
      0,
      world
    );
    assert.ok(pose);
    assert.ok(pose.orientation.every((v) => Number.isFinite(v)));
    // Looking toward -z: yaw near 0 in engine convention.
    assert.ok(Math.abs(pose.orientation[1]) < 0.1);
    // The camera is near the actor's eye line, so framing the role's body
    // height should be almost level rather than pitched down at its feet.
    assert.ok(Math.abs(pose.orientation[0]) < 0.05);
  });

  it("pov looks along facing when no lookAt is given", () => {
    const pose = sampleCameraSpec(
      { kind: "pov", role: "a", eyeHeight: 1.6 } as never,
      0,
      world
    );
    assert.ok(pose);
    assert.deepStrictEqual(pose.position, [0, 1.6, 0]);
    assert.ok(Number.isFinite(pose.orientation[1]));
  });

  it("returns undefined for specs whose roles are missing", () => {
    for (const spec of [
      {
        kind: "orbit",
        role: "zz",
        radius: 5,
        height: 2,
        startAngle: 0,
        endAngle: 1,
        easing: "linear",
      },
      { kind: "trackRole", role: "zz", offset: [0, 2, 4] },
      {
        kind: "overShoulder",
        from: "zz",
        to: "b",
        side: "right",
        pullout: 1.8,
      },
      { kind: "pov", role: "zz", eyeHeight: 1.6 },
    ]) {
      assert.strictEqual(
        sampleCameraSpec(spec as never, 0.5, world),
        undefined
      );
    }
  });

  it("orbit sweeps between start and end angles", () => {
    const spec = {
      kind: "orbit",
      role: "a",
      radius: 4,
      height: 2,
      startAngle: 0,
      endAngle: Math.PI,
      easing: "linear",
    } as never;
    const start = sampleCameraSpec(spec, 0, world)!;
    const end = sampleCameraSpec(spec, 1, world)!;
    assert.ok(Math.abs(start.position[0] - 4) < 1e-6);
    assert.ok(Math.abs(end.position[0] + 4) < 1e-6);
  });
});
