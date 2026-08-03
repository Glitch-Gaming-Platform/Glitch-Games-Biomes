import { MovementState } from "@/shared/ecs/gen/components";
import {
  BASE_PLAYER_JUMP_COUNT,
  DOUBLE_JUMP_STAMINA_COST,
  EVADE_MOVEMENT_ACTION_STAMINA_COST,
  MOVEMENT_ACTION_STAMINA_COST,
  PLAYER_EVADE_ATTACK_TRANSITION,
  PLAYER_MOVEMENT_ACTION_TIMING,
  PLAYER_ROLL_DODGE_EVENTS,
  PLAYER_ROLL_DODGE_PHASES,
  RESERVED_MOVEMENT_KEY_CODES,
  createMovementActionState,
  isDoubleJumpAttempt,
  lateralEvadeDirection,
  movementActionCameraEffects,
  movementActionDrivesMotion,
  movementActionEnvironmentForTick,
  movementActionIsActive,
  movementActionIsInvulnerable,
  movementActionIsOnCooldown,
  movementActionLocksControl,
  movementActionPressedOnEdge,
  movementActionAttackTransition,
  movementActionStaminaCost,
  movementActionVelocityForTick,
  movementActionYaw,
  normalizeMovementActionDirection,
  npcEvadeProfileForDescriptor,
  playerMovementActionAnimationName,
  playerMovementActionVisualPose,
  playerEvadeLateralDirection,
  playerJumpCount,
  rollDodgePhaseAt,
} from "@/shared/game/movement_actions";
import assert from "assert";

describe("movement actions", () => {
  it("reserves Z/X/C and gives committed movement actions distinct costs", () => {
    assert.deepEqual(RESERVED_MOVEMENT_KEY_CODES, ["KeyZ", "KeyX", "KeyC"]);
    assert.equal(MOVEMENT_ACTION_STAMINA_COST, 3);
    assert.equal(EVADE_MOVEMENT_ACTION_STAMINA_COST, 2);
    assert.equal(DOUBLE_JUMP_STAMINA_COST, 4);
    assert.equal(movementActionStaminaCost("dodge"), 3);
    assert.equal(movementActionStaminaCost("evade"), 2);
    assert.equal(movementActionStaminaCost("doubleJump"), 4);
    assert.equal(BASE_PLAYER_JUMP_COUNT, 2);
    assert.equal(playerJumpCount(0), 2);
    assert.equal(playerJumpCount(1), 3);
    assert.equal(playerJumpCount(-99), 0);
    assert.equal(isDoubleJumpAttempt(0), false, "coyote jump stays free");
    assert.equal(isDoubleJumpAttempt(1), true);
  });

  it("fires dodge and evade only on a fresh key-down edge", () => {
    assert.equal(movementActionPressedOnEdge(true, false), true);
    assert.equal(movementActionPressedOnEdge(true, true), false);
    assert.equal(movementActionPressedOnEdge(false, true), false);
    assert.equal(movementActionPressedOnEdge(false, false), false);
  });

  it("normalizes horizontal input and provides a safe forward fallback", () => {
    const direction = normalizeMovementActionDirection([3, 99, 4]);
    assert.ok(Math.abs(direction[0] - 0.6) < 1e-9);
    assert.equal(direction[1], 0);
    assert.ok(Math.abs(direction[2] - 0.8) < 1e-9);
    assert.deepEqual(normalizeMovementActionDirection([0, 1, 0]), [0, 0, -1]);
    assert.deepEqual(
      normalizeMovementActionDirection([Number.NaN, 0, 0], [2, 0, 0]),
      [1, 0, 0]
    );
  });

  it("selects a strictly lateral 5.25-meter evade from input or lean", () => {
    assert.equal(PLAYER_MOVEMENT_ACTION_TIMING.evade.distanceMeters, 5.25);

    assert.deepEqual(
      playerEvadeLateralDirection({
        rightDirection: [1, 0, 0],
        lateralInput: -1,
        lateralVelocity: 8,
        fallbackSide: 1,
      }),
      { direction: [-1, 0, 0], side: -1 },
      "left/right key input wins over residual velocity"
    );
    assert.deepEqual(
      playerEvadeLateralDirection({
        rightDirection: [1, 0, 0],
        lateralInput: 0,
        lateralVelocity: 0.8,
        fallbackSide: -1,
      }),
      { direction: [1, 0, 0], side: 1 },
      "a released key may still use the player's visible lateral lean"
    );
    assert.deepEqual(
      playerEvadeLateralDirection({
        rightDirection: [0, 0, 1],
        lateralInput: 0,
        lateralVelocity: 0,
        fallbackSide: -1,
      }),
      { direction: [0, 0, -1], side: -1 },
      "neutral input retains the prior side instead of becoming a forward dash"
    );
  });

  it("selects directional clips and gives every avatar a neutral-ended root pose", () => {
    assert.equal(
      playerMovementActionAnimationName({
        action: "dodge",
        direction: [1, 0, 0],
        facingYaw: 0,
      }),
      "dodgeRight"
    );
    assert.equal(
      playerMovementActionAnimationName({
        action: "dodge",
        direction: [-1, 0, 0],
        facingYaw: 0,
      }),
      "dodgeLeft"
    );
    assert.equal(
      playerMovementActionAnimationName({
        action: "dodge",
        direction: [0, 0, -1],
        facingYaw: 0,
      }),
      "dodgeForward"
    );
    assert.equal(
      playerMovementActionAnimationName({
        action: "dodge",
        direction: [0, 0, 1],
        facingYaw: 0,
      }),
      "dodgeBack"
    );
    assert.equal(
      playerMovementActionAnimationName({
        action: "evade",
        direction: [1, 0, 0],
        facingYaw: 0,
      }),
      "evade"
    );
    assert.equal(
      playerMovementActionAnimationName({
        action: "doubleJump",
        direction: [0, 0, -1],
        facingYaw: 0,
      }),
      "doubleJump"
    );

    for (const animation of [
      "dodgeLeft",
      "dodgeRight",
      "dodgeForward",
      "dodgeBack",
      "evade",
      "doubleJump",
    ] as const) {
      assert.deepEqual(playerMovementActionVisualPose(animation, 0), {
        pitchRadians: 0,
        rollRadians: 0,
        liftMeters: 0,
        scaleY: 1,
      });
      const end = playerMovementActionVisualPose(animation, 1)!;
      assert.ok(Math.abs(Math.sin(end.pitchRadians)) < 1e-9, animation);
      assert.ok(Math.abs(end.rollRadians) < 1e-9, animation);
      assert.ok(Math.abs(end.liftMeters) < 1e-9, animation);
      assert.ok(Math.abs(end.scaleY - 1) < 1e-9, animation);
    }
    assert.ok(
      playerMovementActionVisualPose("dodgeLeft", 0.5)!.rollRadians > 0.4
    );
    assert.ok(
      playerMovementActionVisualPose("dodgeRight", 0.5)!.rollRadians < -0.4
    );
    assert.ok(
      Math.abs(playerMovementActionVisualPose("evade", 0.5)!.pitchRadians) > 3
    );
    assert.ok(playerMovementActionVisualPose("evade", 0.5)!.liftMeters > 0.8);
    assert.ok(playerMovementActionVisualPose("doubleJump", 0.1)!.scaleY < 0.9);
    assert.ok(playerMovementActionVisualPose("doubleJump", 0.4)!.scaleY > 1.1);
    assert.ok(
      playerMovementActionVisualPose("doubleJump", 0.4)!.liftMeters > 0.2
    );
    assert.equal(playerMovementActionVisualPose("idle", 0.5), undefined);
  });

  it("buffers attacks only near evade recovery and then opens the cancel", () => {
    const input = {
      action: "evade" as const,
      startTimeSeconds: 10,
      expiryTimeSeconds:
        10 + PLAYER_MOVEMENT_ACTION_TIMING.evade.durationSeconds,
    };
    assert.equal(
      movementActionAttackTransition({ ...input, nowSeconds: 10.2 }),
      "blocked"
    );
    assert.equal(
      movementActionAttackTransition({
        ...input,
        nowSeconds: 10 + PLAYER_EVADE_ATTACK_TRANSITION.queueStartSeconds,
      }),
      "queue"
    );
    assert.equal(
      movementActionAttackTransition({
        ...input,
        nowSeconds: 10 + PLAYER_EVADE_ATTACK_TRANSITION.cancelStartSeconds,
      }),
      "open"
    );
    assert.equal(
      movementActionAttackTransition({
        ...input,
        nowSeconds: input.expiryTimeSeconds,
      }),
      "none"
    );
    assert.equal(
      movementActionAttackTransition({
        ...input,
        action: "dodge",
        nowSeconds: 10.7,
      }),
      "none",
      "the new cancel window must not rewrite the established dodge flow"
    );
  });

  it("keeps double jump vertical-only and without invulnerability", () => {
    const timing = PLAYER_MOVEMENT_ACTION_TIMING.doubleJump;
    assert.equal(timing.distanceMeters, 0);
    assert.equal(timing.invulnerabilityStartSeconds, 0);
    assert.equal(timing.invulnerabilityEndSeconds, 0);
    assert.deepEqual(
      movementActionVelocityForTick({
        action: "doubleJump",
        direction: [1, 0, 0],
        startTimeSeconds: 0,
        expiryTimeSeconds: timing.durationSeconds,
        nowSeconds: 0.2,
        dtSeconds: 1 / 60,
      }),
      [0, 0, 0]
    );
  });

  it("keeps dodge and evade travel frame-rate stable, including a partial final tick", () => {
    const distanceAtFrameRate = (
      action: "dodge" | "evade",
      framesPerSecond: number
    ) => {
      const timing = PLAYER_MOVEMENT_ACTION_TIMING[action];
      const dtSeconds = 1 / framesPerSecond;
      let distance = 0;
      for (
        let nowSeconds = 0;
        nowSeconds < timing.durationSeconds;
        nowSeconds += dtSeconds
      ) {
        const velocity = movementActionVelocityForTick({
          action,
          direction: [3, 8, 4],
          startTimeSeconds: 0,
          expiryTimeSeconds: timing.durationSeconds,
          nowSeconds,
          dtSeconds,
        });
        distance += Math.hypot(velocity[0], velocity[2]) * dtSeconds;
      }
      return distance;
    };

    for (const action of ["dodge", "evade"] as const) {
      const timing = PLAYER_MOVEMENT_ACTION_TIMING[action];
      const expectedDistance = timing.distanceMeters;
      assert.ok(
        Math.abs(distanceAtFrameRate(action, 60) - expectedDistance) < 1e-9
      );
      assert.ok(
        Math.abs(distanceAtFrameRate(action, 8) - expectedDistance) < 1e-9
      );
    }
  });

  it("holds anticipation, accelerates through the middle, and settles before recovery", () => {
    const timing = PLAYER_MOVEMENT_ACTION_TIMING.evade;
    const velocityAt = (nowSeconds: number) =>
      Math.hypot(
        ...movementActionVelocityForTick({
          action: "evade",
          direction: [0, 0, -1],
          startTimeSeconds: 0,
          expiryTimeSeconds: timing.durationSeconds,
          nowSeconds,
          dtSeconds: 1 / 120,
        }).filter((_, index) => index !== 1)
      );

    assert.equal(velocityAt(0.04), 0, "anticipation must not slide");
    assert.ok(velocityAt(0.34) > velocityAt(0.12));
    assert.ok(velocityAt(0.34) > velocityAt(0.5));
    assert.equal(velocityAt(0.6), 0, "landing/recovery must not drift");
  });

  it("defines the full roll phase and animation-event contract", () => {
    assert.deepEqual(
      PLAYER_ROLL_DODGE_PHASES.map(({ phase }) => phase),
      ["anticipation", "launch", "tuck", "rotation", "landing", "recovery"]
    );
    assert.equal(PLAYER_ROLL_DODGE_EVENTS.end, 0.75);
    assert.equal(rollDodgePhaseAt(-0.01), "inactive");
    assert.equal(rollDodgePhaseAt(0.05), "anticipation");
    assert.equal(rollDodgePhaseAt(0.15), "launch");
    assert.equal(rollDodgePhaseAt(0.25), "tuck");
    assert.equal(rollDodgePhaseAt(0.4), "rotation");
    assert.equal(rollDodgePhaseAt(0.57), "landing");
    assert.equal(rollDodgePhaseAt(0.7), "recovery");
    assert.equal(rollDodgePhaseAt(0.75), "inactive");
  });

  it("separates movement, control, camera, and visual recovery windows", () => {
    const timing = PLAYER_MOVEMENT_ACTION_TIMING.evade;
    const input = {
      action: "evade" as const,
      startTimeSeconds: 10,
      expiryTimeSeconds: 10 + timing.durationSeconds,
    };

    assert.equal(
      movementActionDrivesMotion({ ...input, nowSeconds: 10.05 }),
      false
    );
    assert.equal(
      movementActionDrivesMotion({ ...input, nowSeconds: 10.2 }),
      true
    );
    assert.equal(
      movementActionDrivesMotion({ ...input, nowSeconds: 10.58 }),
      false
    );
    assert.equal(
      movementActionLocksControl({ ...input, nowSeconds: 10.61 }),
      true
    );
    assert.equal(
      movementActionLocksControl({ ...input, nowSeconds: 10.63 }),
      false,
      "gameplay control should return before the visual recovery ends"
    );

    const peakCamera = movementActionCameraEffects({
      ...input,
      nowSeconds: 10.3,
    });
    assert.deepEqual(peakCamera, {
      fovBoostDegrees: timing.cameraFovBoostDegrees,
      pullbackMeters: timing.cameraPullbackMeters,
    });
    const recoveredCamera = movementActionCameraEffects({
      ...input,
      nowSeconds: input.expiryTimeSeconds,
    });
    assert.deepEqual(recoveredCamera, {
      fovBoostDegrees: 0,
      pullbackMeters: 0,
    });
  });

  it("orients the reusable forward roll into the requested travel direction", () => {
    const epsilon = 1e-9;
    assert.ok(Math.abs(movementActionYaw([0, 0, -1]) - 0) < epsilon);
    assert.ok(Math.abs(movementActionYaw([-1, 0, 0]) - Math.PI / 2) < epsilon);
    assert.ok(Math.abs(movementActionYaw([0, 0, 1]) - Math.PI) < epsilon);
    assert.ok(
      Math.abs(movementActionYaw([1, 0, 0]) - (3 * Math.PI) / 2) < epsilon
    );
  });

  it("does not add movement outside the action window or for an invalid tick", () => {
    const input = {
      action: "dodge" as const,
      direction: [1, 0, 0] as const,
      startTimeSeconds: 10,
      expiryTimeSeconds: 10.5,
    };
    assert.deepEqual(
      movementActionVelocityForTick({
        ...input,
        nowSeconds: 9,
        dtSeconds: 0.1,
      }),
      [0, 0, 0]
    );
    assert.deepEqual(
      movementActionVelocityForTick({
        ...input,
        nowSeconds: 10.5,
        dtSeconds: 0.1,
      }),
      [0, 0, 0]
    );
    assert.deepEqual(
      movementActionVelocityForTick({
        ...input,
        nowSeconds: 10,
        dtSeconds: Number.NaN,
      }),
      [0, 0, 0]
    );
  });

  it("removes only movement-action damping without mutating the base environment", () => {
    const base = {
      gravity: 31.8,
      friction: 12,
      airResistance: 0.12,
      escapeDampening: 100,
    };
    assert.equal(movementActionEnvironmentForTick(base, false), base);
    assert.deepEqual(movementActionEnvironmentForTick(base, true), {
      gravity: 31.8,
      friction: 0,
      airResistance: 0,
      escapeDampening: 100,
    });
    assert.equal(base.friction, 12);
    assert.equal(base.airResistance, 0.12);
  });

  it("preserves crouch state and uses half-open action timing boundaries", () => {
    const state = createMovementActionState({
      previous: MovementState.create({ crouching: true }),
      action: "dodge",
      direction: [10, 4, 0],
      nonce: 42,
      nowSeconds: 100,
      durationSeconds: 0.5,
      invulnerabilitySeconds: 0.28,
      cooldownSeconds: 0.85,
    });

    assert.equal(state.crouching, true);
    assert.deepEqual(state.direction, [1, 0, 0]);
    assert.equal(state.action_nonce, 42);
    assert.equal(movementActionIsActive(state, 99.999), false);
    assert.equal(movementActionIsActive(state, 100), true);
    assert.equal(movementActionIsActive(state, 100.499), true);
    assert.equal(movementActionIsActive(state, 100.5), false);
    assert.equal(movementActionIsInvulnerable(state, 100), false);
    assert.equal(movementActionIsInvulnerable(state, 100.099), false);
    assert.equal(movementActionIsInvulnerable(state, 100.1), true);
    assert.equal(movementActionIsInvulnerable(state, 100.279), true);
    assert.equal(movementActionIsInvulnerable(state, 100.28), false);
    assert.equal(movementActionIsOnCooldown(state, 100.849), true);
    assert.equal(movementActionIsOnCooldown(state, 100.85), false);

    const npcStyleCustomDuration = MovementState.create({
      ...MovementState.clone(state),
      action: "evade",
      action_start_time: 200,
      action_expiry_time: 200.56,
      invulnerability_expiry_time: 200.3,
    });
    assert.equal(
      movementActionIsInvulnerable(npcStyleCustomDuration, 200),
      true,
      "custom-duration NPC evades retain immediate protection"
    );
  });

  it("maps every requested creature family to its intended evade", () => {
    const cases = [
      ["mucker", "mucker", "evadeMucker"],
      ["helping robot", "robot", "evadeRobot"],
      ["wolf", "sideLeap", "evadeSideLeap"],
      ["dog", "sideLeap", "evadeSideLeap"],
      ["cat", "sideLeap", "evadeSideLeap"],
      ["deer", "sideLeap", "evadeSideLeap"],
      ["cow", "heavy", "evadeHeavy"],
      ["sheep", "heavy", "evadeHeavy"],
      ["bear", "heavy", "evadeHeavy"],
      ["rabbit", "rabbit", "evadeRabbit"],
      ["bird", "bird", "evadeBird"],
      ["fish", "swim", "evadeSwim"],
      ["turtle", "swim", "evadeSwim"],
      ["hexer", "hexer", "evadeHexer"],
    ] as const;

    for (const [descriptor, family, animation] of cases) {
      const profile = npcEvadeProfileForDescriptor(descriptor);
      assert.equal(profile.family, family, descriptor);
      assert.equal(profile.animation, animation, descriptor);
      assert.ok(profile.speedMetersPerSecond > 0, descriptor);
      assert.ok(profile.invulnerabilitySeconds < profile.durationSeconds);
      assert.ok(profile.durationSeconds < profile.cooldownSeconds);
    }
  });

  it("alternates lateral direction deterministically", () => {
    assert.deepEqual(
      lateralEvadeDirection({ awayFromAttacker: [0, 0, 1], seed: 2 }),
      [-1, 0, 0]
    );
    assert.deepEqual(
      lateralEvadeDirection({ awayFromAttacker: [0, 0, 1], seed: 3 }),
      [1, 0, 0]
    );
  });
});
