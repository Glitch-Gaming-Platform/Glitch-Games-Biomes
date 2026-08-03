import { AnimationSystem } from "@/client/game/util/animation_system";
import {
  animationLocomotionIsIdle,
  getVelocityBasedWeights,
} from "@/client/game/util/animations";
import assert from "assert";

describe("animation locomotion threshold", () => {
  const characterSystem = new AnimationSystem(
    {
      idle: { fileAnimationName: "Idle" },
      crouchIdle: { fileAnimationName: "Idle" },
      crouchWalking: { fileAnimationName: "Walk" },
      swimIdle: { fileAnimationName: "Idle" },
      swimForwards: { fileAnimationName: "Swim" },
      swimBackwards: { fileAnimationName: "Swim" },
      flyIdle: { fileAnimationName: "Idle" },
      flyForwards: { fileAnimationName: "Fly" },
      walk: { fileAnimationName: "Walk" },
      run: { fileAnimationName: "Run" },
      runBackwards: { fileAnimationName: "Run" },
      strafeRightSlow: { fileAnimationName: "Walk" },
      strafeRightFast: { fileAnimationName: "Run" },
      strafeLeftSlow: { fileAnimationName: "Walk" },
      strafeLeftFast: { fileAnimationName: "Run" },
    },
    { all: { re: /.*/ } }
  );

  it("keeps the player default while allowing slow uphill NPC walking", () => {
    assert.equal(animationLocomotionIsIdle(0.2), true);
    assert.equal(animationLocomotionIsIdle(0.05, 0.06), true);
    assert.equal(animationLocomotionIsIdle(0.2, 0.06), false);
    assert.equal(animationLocomotionIsIdle(NaN, 0.06), true);
  });

  it("selects Walk for a giant's finite slow uphill velocity", () => {
    const action = getVelocityBasedWeights({
      velocity: [0, 0.2, -0.2],
      orientation: [0, 0],
      movementType: "walking",
      runSpeed: 4.6,
      characterSystem,
      idleSpeed: 0.06,
    });
    assert.equal(action.weights.idle, 0);
    assert.ok(action.weights.walk > 0);
    assert.equal(action.weights.run, 0);
  });
});
