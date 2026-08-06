import {
  AnimationSystem,
  getSmoothedWeight,
} from "@/client/game/util/animation_system";
import assert from "assert";
import * as THREE from "three";

describe("Player Animations", () => {
  const ALL_DURATIONS = 1;
  const durationFn = () => ALL_DURATIONS;

  const system = new AnimationSystem(
    {
      attack: {
        fileAnimationName: "attack",
      },
      dance: {
        fileAnimationName: "dance",
      },
      walk: {
        fileAnimationName: "walk",
      },
      run: {
        fileAnimationName: "run",
      },
      idle: {
        fileAnimationName: "idle",
      },
    },
    {
      arms: {
        re: /(.*(arm|hand|tool).*)/i,
      },
      notArms: {
        re: /[^(.*(arm|hand|tool).*)]/i,
      },
    }
  );

  it("simple single apply action modifies accumulated actions", () => {
    const accum = system.newAccumulatedActions(0.2, durationFn);
    assert.equal(accum.clockTime, 0.2);

    system.accumulateAction(
      {
        weights: system.singleAnimationWeight("dance", 1),
        state: { repeat: { kind: "once" }, startTime: 0.1 },
        layers: { arms: "apply", notArms: "apply" },
      },
      accum
    );

    assert.deepEqual(accum.animations.dance?.repeat, { kind: "once" });
    assert.equal(accum.animations.dance?.startTime, 0.1);
    assert.equal(accum.animations.walk, undefined);
    assert.equal(accum.layers.arms.desiredWeights?.dance, 1);
    assert.equal(accum.layers.arms.desiredWeights?.walk, 0);
    assert.equal(accum.layers.arms.idleWeights, undefined);
    assert.equal(accum.layers.notArms.desiredWeights?.dance, 1);
    assert.equal(accum.layers.notArms.desiredWeights?.walk, 0);
    assert.equal(accum.layers.notArms.idleWeights, undefined);
  });

  it("apply action does not overwrite existing", () => {
    const accum = system.newAccumulatedActions(0.2, durationFn);

    system.accumulateAction(
      {
        weights: system.singleAnimationWeight("attack", 1),
        state: { repeat: { kind: "once" }, startTime: 0.2 },
        layers: { arms: "apply", notArms: "noApply" },
      },
      accum
    );
    system.accumulateAction(
      {
        weights: system.singleAnimationWeight("dance", 1),
        state: { repeat: { kind: "once" }, startTime: 0.1 },
        layers: { arms: "apply", notArms: "apply" },
      },
      accum
    );

    assert.deepEqual(accum.animations.attack?.repeat, { kind: "once" });
    assert.deepEqual(accum.animations.dance?.repeat, { kind: "once" });
    assert.equal(accum.layers.arms.desiredWeights?.dance, 0);
    assert.equal(accum.layers.arms.desiredWeights?.attack, 1);
    assert.equal(accum.layers.notArms.desiredWeights?.dance, 1);
    assert.equal(accum.layers.notArms.desiredWeights?.walk, 0);
  });

  it("once animations expire", () => {
    const accum = system.newAccumulatedActions(
      ALL_DURATIONS * 2 + 0.2,
      durationFn
    );

    system.accumulateAction(
      {
        weights: system.singleAnimationWeight("dance", 1),
        state: { repeat: { kind: "once" }, startTime: 0.2 },
        layers: { arms: "apply", notArms: "apply" },
      },
      accum
    );

    assert.equal(accum.animations.dance, undefined);
    assert.equal(accum.layers.arms.desiredWeights, undefined);
    assert.equal(accum.layers.arms.idleWeights, undefined);
    assert.equal(accum.layers.notArms.desiredWeights, undefined);
    assert.equal(accum.layers.notArms.idleWeights, undefined);
  });

  it("once animations with trim active before trim starts", () => {
    const TRANSITION_TRIM = 0.5;
    const accum = system.newAccumulatedActions(
      ALL_DURATIONS - TRANSITION_TRIM * 1.01,
      durationFn,
      TRANSITION_TRIM
    );

    system.accumulateAction(
      {
        weights: system.singleAnimationWeight("dance", 1),
        state: { repeat: { kind: "once" }, startTime: 0 },
        layers: { arms: "apply", notArms: "apply" },
      },
      accum
    );

    assert.deepEqual(accum.animations.dance?.repeat, { kind: "once" });
    assert.equal(accum.layers.arms.desiredWeights?.dance, 1);
    assert.equal(accum.layers.notArms.desiredWeights?.dance, 1);
  });

  it("once animations with trim expire when trim starts", () => {
    const TRANSITION_TRIM = 0.5;
    const accum = system.newAccumulatedActions(
      ALL_DURATIONS - TRANSITION_TRIM / 2,
      durationFn,
      TRANSITION_TRIM
    );

    system.accumulateAction(
      {
        weights: system.singleAnimationWeight("dance", 1),
        state: { repeat: { kind: "once" }, startTime: 0 },
        layers: { arms: "apply", notArms: "apply" },
      },
      accum
    );

    assert.equal(accum.animations.dance, undefined);
    assert.equal(accum.layers.arms.desiredWeights, undefined);
    assert.equal(accum.layers.notArms.desiredWeights, undefined);
  });

  it("repeat animations do not expire", () => {
    const accum = system.newAccumulatedActions(
      ALL_DURATIONS * 2 + 0.2,
      durationFn
    );

    system.accumulateAction(
      {
        weights: system.singleAnimationWeight("dance", 1),
        state: { repeat: { kind: "repeat" }, startTime: 0.2 },
        layers: { arms: "apply", notArms: "apply" },
      },
      accum
    );

    assert.deepEqual(accum.animations.dance?.repeat, { kind: "repeat" });
    assert.equal(accum.layers.arms.desiredWeights?.dance, 1);
    assert.equal(accum.layers.notArms.desiredWeights?.dance, 1);
  });

  it("custom ease in is accumulated", () => {
    const accum = system.newAccumulatedActions(0.2, durationFn);

    system.accumulateAction(
      {
        weights: system.singleAnimationWeight("dance", 1),
        state: { repeat: { kind: "repeat" }, startTime: 0.2, easeInTime: 0.5 },
        layers: { arms: "apply", notArms: "apply" },
      },
      accum
    );

    assert.equal(accum.animations.dance?.easeInTime, 0.5);
  });

  it("accumulates a dynamic playback rate without changing blend weights", () => {
    const accum = system.newAccumulatedActions(0.2, durationFn);
    system.accumulateAction(
      {
        weights: system.singleAnimationWeight("walk", 1),
        state: { repeat: { kind: "repeat" }, startTime: 0 },
        playbackRates: { walk: 1.35 },
        layers: { arms: "apply", notArms: "apply" },
      },
      accum
    );
    assert.equal(accum.animations.walk?.playbackRate, 1.35);
    assert.equal(accum.layers.arms.desiredWeights?.walk, 1);
  });

  it("idle weights are tracked despire previous setting", () => {
    const accum = system.newAccumulatedActions(0.2, durationFn);

    system.accumulateAction(
      {
        weights: system.singleAnimationWeight("attack", 1),
        state: { repeat: { kind: "once" }, startTime: 0.2 },
        layers: { arms: "apply", notArms: "ifIdle" },
      },
      accum
    );

    const moveWeights = system.createEmptyAnimationWeights();
    moveWeights.run = 0.5;
    moveWeights.idle = 0.5;
    system.accumulateAction(
      {
        weights: moveWeights,
        state: { repeat: { kind: "repeat" }, startTime: 0 },
        layers: { arms: "apply", notArms: "apply" },
      },
      accum
    );

    assert.deepEqual(accum.animations.attack?.repeat, { kind: "once" });
    assert.deepEqual(accum.animations.run?.repeat, { kind: "repeat" });
    assert.deepEqual(accum.animations.idle?.repeat, { kind: "repeat" });
    assert.equal(accum.layers.arms.desiredWeights?.attack, 1);
    assert.equal(accum.layers.arms.desiredWeights?.run, 0);
    assert.equal(accum.layers.arms.desiredWeights?.idle, 0);
    assert.equal(accum.layers.arms.idleWeights, undefined);
    assert.equal(accum.layers.notArms.desiredWeights?.attack, 0);
    assert.equal(accum.layers.notArms.desiredWeights?.run, 0.5);
    assert.equal(accum.layers.notArms.desiredWeights?.idle, 0.5);
    assert.equal(accum.layers.notArms.idleWeights?.attack, 1.0);
    assert.equal(accum.layers.notArms.idleWeights?.run, 0);
    assert.equal(accum.layers.notArms.idleWeights?.idle, 0);

    // Now check that the idle weights resolve correctly.
    system.resolveIdleWeights(accum);

    assert.equal(accum.layers.arms.desiredWeights?.attack, 1);
    assert.equal(accum.layers.arms.desiredWeights?.run, 0);
    assert.equal(accum.layers.arms.desiredWeights?.idle, 0);
    assert.equal(accum.layers.arms.idleWeights, undefined);
    assert.equal(accum.layers.notArms.desiredWeights?.attack, 0.5);
    assert.equal(accum.layers.notArms.desiredWeights?.run, 0.5);
    assert.equal(accum.layers.notArms.desiredWeights?.idle, 0);
    assert.equal(accum.layers.notArms.idleWeights, undefined);
  });

  it("smoothing weights with self does nothing", () => {
    const e = 1;
    const d = 1;
    const s = getSmoothedWeight(e, d, 0.1);

    assert.equal(s, 1);
  });
  it("desired weights are smoothed into current weights", () => {
    const e = 1;
    const d = 0;
    const s = getSmoothedWeight(e, d, 0.1);

    assert.ok(Math.abs(s - Math.exp(-0.1 / 0.25)) < 1e-12);
  });
  it("smoothed weights near zero are rounded to zero", () => {
    const e = 0.0000001;
    const d = 0;
    const s = getSmoothedWeight(e, d, 0.1);

    assert.equal(s, 0);
  });
  it("smoothed weights with custom ease in works", () => {
    const e = 0;
    const d = 1;
    const s = getSmoothedWeight(e, d, 0.1, 0.5);

    assert.ok(Math.abs(s - (1 - Math.exp(-0.1 / 0.5))) < 1e-12);
  });
  it("smoothed weights with custom ease in does not affect ease out", () => {
    const e = 1;
    const d = 0;
    const s = getSmoothedWeight(e, d, 0.1, 0.5);

    assert.ok(Math.abs(s - Math.exp(-0.1 / 0.25)) < 1e-12);
  });

  it("produces the same blend after equal wall time at different frame rates", () => {
    const oneFrame = getSmoothedWeight(0, 1, 0.1, 0.5);
    const firstHalf = getSmoothedWeight(0, 1, 0.05, 0.5);
    const twoFrames = getSmoothedWeight(firstHalf, 1, 0.05, 0.5);
    assert.ok(Math.abs(oneFrame - twoFrames) < 1e-12);
  });

  it("keeps animation tracks for Blender dotted bone names", () => {
    const bossSystem = new AnimationSystem(
      {
        idle: { fileAnimationName: "Idle" },
        walk: { fileAnimationName: "RootMarch" },
      },
      { all: { re: /.*/ } }
    );
    const scene = new THREE.Group();
    const branch = new THREE.Bone();
    branch.name = "Branch.L";
    const rootLeg = new THREE.Bone();
    rootLeg.name = "RootLeg.L";
    scene.add(branch, rootLeg);

    const idle = new THREE.AnimationClip("Idle", 1, [
      new THREE.QuaternionKeyframeTrack(
        "Branch.L.quaternion",
        [0, 1],
        [0, 0, 0, 1, 0, 0, 0, 1]
      ),
    ]);
    const rootMarch = new THREE.AnimationClip("RootMarch", 1, [
      new THREE.QuaternionKeyframeTrack(
        "Branch.L.quaternion",
        [0, 1],
        [0, 0, 0, 1, 0.1, 0, 0, 0.995]
      ),
      new THREE.VectorKeyframeTrack(
        "RootLeg.L.position",
        [0, 1],
        [0, 0, 0, 0, 0.25, 0]
      ),
    ]);

    const state = bossSystem.newState(scene, [idle, rootMarch]);
    const walkAction = state.actions.all.walk;
    assert.ok(walkAction, "RootMarch should bind to dotted boss bone names");
    assert.deepEqual(
      walkAction.getClip().tracks.map((track) => track.name),
      ["Branch.L.quaternion", "RootLeg.L.position"]
    );
  });

  it("creates additive actions for upper-body expression definitions", () => {
    const expressionSystem = new AnimationSystem(
      {
        idle: { fileAnimationName: "Idle" },
        expression: {
          fileAnimationName: "Expression",
          additive: true,
        },
      },
      { upperBody: { re: /Chest/ } }
    );
    const scene = new THREE.Group();
    const chest = new THREE.Bone();
    chest.name = "Chest";
    scene.add(chest);
    const idle = new THREE.AnimationClip("Idle", 1, [
      new THREE.QuaternionKeyframeTrack(
        "Chest.quaternion",
        [0, 1],
        [0, 0, 0, 1, 0, 0, 0, 1]
      ),
    ]);
    const expression = new THREE.AnimationClip("Expression", 1, [
      new THREE.QuaternionKeyframeTrack(
        "Chest.quaternion",
        [0, 1],
        [0, 0, 0, 1, 0, 0.2, 0, 0.98]
      ),
    ]);
    const state = expressionSystem.newState(scene, [idle, expression]);
    assert.equal(
      state.actions.upperBody.expression?.getClip().blendMode,
      THREE.AdditiveAnimationBlendMode
    );
  });

  it("defers and reclaims mobile animation actions without losing duration", () => {
    const mobileSystem = new AnimationSystem(
      {
        idle: { fileAnimationName: "Idle" },
        expression: { fileAnimationName: "Expression" },
      },
      { all: { re: /.*/ } }
    );
    const scene = new THREE.Group();
    const root = new THREE.Bone();
    root.name = "Root";
    scene.add(root);
    const idle = new THREE.AnimationClip("Idle", 1, [
      new THREE.VectorKeyframeTrack(
        "Root.position",
        [0, 1],
        [0, 0, 0, 0, 0, 0]
      ),
    ]);
    const expression = new THREE.AnimationClip("Expression", 1.5, [
      new THREE.VectorKeyframeTrack(
        "Root.position",
        [0, 1.5],
        [0, 0, 0, 0, 0.1, 0]
      ),
    ]);
    const state = mobileSystem.newState(scene, [idle, expression], undefined, {
      deferredAnimationNames: new Set(["expression"] as const),
      reclaimDeferredActions: true,
      stabilizeClampedOnceAnimations: true,
    });

    assert.ok(state.actions.all.idle, "desktop-compatible idle stays eager");
    assert.equal(state.actions.all.expression, undefined);
    assert.equal(mobileSystem.durationFromState(state)("expression"), 1.5);

    const active = mobileSystem.newAccumulatedActions(
      0.1,
      mobileSystem.durationFromState(state)
    );
    mobileSystem.accumulateAction(
      {
        weights: mobileSystem.singleAnimationWeight("expression", 1),
        state: {
          repeat: { kind: "once", clampWhenFinished: true },
          startTime: 0,
        },
        layers: { all: "apply" },
      },
      active
    );
    mobileSystem.applyAccumulatedActionsToState(active, state);
    assert.ok(state.actions.all.expression, "first use materializes the clip");

    const idleOnly = mobileSystem.newAccumulatedActions(
      0.2,
      mobileSystem.durationFromState(state)
    );
    mobileSystem.accumulateAction(
      {
        weights: mobileSystem.singleAnimationWeight("idle", 1),
        state: { repeat: { kind: "repeat" }, startTime: 0 },
        layers: { all: "apply" },
      },
      idleOnly
    );
    mobileSystem.applyAccumulatedActionsToState(idleOnly, state);
    assert.equal(
      state.actions.all.expression,
      undefined,
      "zero-weight deferred actions are released"
    );
  });

  it("stops a completed clamped action when WebKit leaves paused false", () => {
    const mobileSystem = new AnimationSystem(
      {
        idle: { fileAnimationName: "Idle" },
        expression: { fileAnimationName: "Expression" },
      },
      { all: { re: /.*/ } }
    );
    const scene = new THREE.Group();
    const root = new THREE.Bone();
    root.name = "Root";
    scene.add(root);
    const clips = [
      new THREE.AnimationClip("Idle", 1, [
        new THREE.VectorKeyframeTrack(
          "Root.position",
          [0, 1],
          [0, 0, 0, 0, 0, 0]
        ),
      ]),
      new THREE.AnimationClip("Expression", 1, [
        new THREE.VectorKeyframeTrack(
          "Root.position",
          [0, 1],
          [0, 0, 0, 0, 0.1, 0]
        ),
      ]),
    ];
    const state = mobileSystem.newState(scene, clips, undefined, {
      deferredAnimationNames: new Set(["expression"] as const),
      stabilizeClampedOnceAnimations: true,
    });
    const first = mobileSystem.newAccumulatedActions(
      0,
      mobileSystem.durationFromState(state)
    );
    mobileSystem.accumulateAction(
      {
        weights: mobileSystem.singleAnimationWeight("expression", 1),
        state: {
          repeat: { kind: "once", clampWhenFinished: true },
          startTime: 0,
        },
        layers: { all: "apply" },
      },
      first
    );
    mobileSystem.applyAccumulatedActionsToState(first, state);
    const action = state.actions.all.expression;
    assert.ok(action);

    state.mixer.time = 2;
    action.paused = false;
    action.enabled = false;
    let resets = 0;
    const originalReset = action.reset.bind(action);
    action.reset = () => {
      resets += 1;
      return originalReset();
    };

    const afterEnd = mobileSystem.newAccumulatedActions(
      2,
      mobileSystem.durationFromState(state)
    );
    mobileSystem.accumulateAction(
      {
        weights: mobileSystem.singleAnimationWeight("expression", 1),
        state: {
          repeat: { kind: "once", clampWhenFinished: true },
          startTime: 0,
        },
        layers: { all: "apply" },
      },
      afterEnd
    );
    mobileSystem.applyAccumulatedActionsToState(afterEnd, state);

    assert.equal(resets, 0, "completed mobile once action must not restart");
    assert.equal(action.paused, true);
    assert.equal(action.enabled, true);
    assert.equal(action.time, action.getClip().duration);
  });
});
