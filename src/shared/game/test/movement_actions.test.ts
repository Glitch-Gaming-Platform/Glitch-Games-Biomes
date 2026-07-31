import { MovementState } from "@/shared/ecs/gen/components";
import {
  MOVEMENT_ACTION_STAMINA_COST,
  PLAYER_MOVEMENT_ACTION_TIMING,
  RESERVED_MOVEMENT_KEY_CODES,
  createMovementActionState,
  lateralEvadeDirection,
  movementActionEnvironmentForTick,
  movementActionIsActive,
  movementActionIsInvulnerable,
  movementActionIsOnCooldown,
  movementActionPressedOnEdge,
  movementActionVelocityForTick,
  normalizeMovementActionDirection,
  npcEvadeProfileForDescriptor,
} from "@/shared/game/movement_actions";
import assert from "assert";

describe("movement actions", () => {
  it("reserves Z/X/C and charges exactly three stamina", () => {
    assert.deepEqual(RESERVED_MOVEMENT_KEY_CODES, ["KeyZ", "KeyX", "KeyC"]);
    assert.equal(MOVEMENT_ACTION_STAMINA_COST, 3);
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
      const expectedDistance =
        timing.speedMetersPerSecond * timing.durationSeconds;
      assert.ok(
        Math.abs(distanceAtFrameRate(action, 60) - expectedDistance) < 1e-9
      );
      assert.ok(
        Math.abs(distanceAtFrameRate(action, 8) - expectedDistance) < 1e-9
      );
    }
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
    assert.equal(movementActionIsInvulnerable(state, 100.279), true);
    assert.equal(movementActionIsInvulnerable(state, 100.28), false);
    assert.equal(movementActionIsOnCooldown(state, 100.849), true);
    assert.equal(movementActionIsOnCooldown(state, 100.85), false);
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
