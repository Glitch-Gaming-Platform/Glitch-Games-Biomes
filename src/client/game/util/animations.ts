import type {
  ActionPriority,
  AnimationAction,
  AnimationName,
  AnimationDefinition,
  AnimationSystem,
  AnimationSystemState,
  AnyAnimationSystem,
  LayerDefinition,
  LayerName,
} from "@/client/game/util/animation_system";
import type { TimelineMatcher } from "@/client/game/util/timeline_matcher";
import { length } from "@/shared/math/linear";
import type { ReadonlyVec2, ReadonlyVec3 } from "@/shared/math/types";
import type { MovementType } from "@/shared/npc/npc_types";
import * as THREE from "three";

export interface MixedMesh<T extends AnyAnimationSystem> {
  three: THREE.Object3D;
  animationMixer: THREE.AnimationMixer;
  animationSystem: T;
  animationSystemState: AnimationSystemState<T>;
  timelineMatcher: TimelineMatcher;
}

export type CharacterAnimations = {
  idle: AnimationDefinition;
  crouchIdle: AnimationDefinition;
  crouchWalking: AnimationDefinition;
  swimIdle: AnimationDefinition;
  swimForwards: AnimationDefinition;
  swimBackwards: AnimationDefinition;
  flyIdle: AnimationDefinition;
  flyForwards: AnimationDefinition;
  walk: AnimationDefinition;
  run: AnimationDefinition;
  runBackwards: AnimationDefinition;
  strafeRightSlow: AnimationDefinition;
  strafeRightFast: AnimationDefinition;
  strafeLeftSlow: AnimationDefinition;
  strafeLeftFast: AnimationDefinition;
};

const IDLE_SPEED = 0.5;
const MIN_LOCOMOTION_PLAYBACK_RATE = 0.65;
const MAX_LOCOMOTION_PLAYBACK_RATE = 1.55;

function locomotionPlaybackRate(speed: number, authoredSpeed: number) {
  if (!(speed > 0) || !(authoredSpeed > 0)) {
    return 1;
  }
  return Math.min(
    MAX_LOCOMOTION_PLAYBACK_RATE,
    Math.max(MIN_LOCOMOTION_PLAYBACK_RATE, speed / authoredSpeed)
  );
}

export function animationLocomotionIsIdle(
  speed: number,
  idleSpeed = IDLE_SPEED
) {
  const threshold =
    Number.isFinite(idleSpeed) && idleSpeed >= 0 ? idleSpeed : IDLE_SPEED;
  return !Number.isFinite(speed) || speed < threshold;
}

// Given the provided speed, determines how to split the animation weights
// between walk and run animations.
function splitWalkRunTransition(speed: number, runSpeed: number) {
  const SPEED_TRANSITION_RADIUS = runSpeed / 12;
  const alpha = Math.min(
    1,
    Math.max(
      0,
      (speed - (runSpeed - SPEED_TRANSITION_RADIUS)) /
        (SPEED_TRANSITION_RADIUS * 2)
    )
  );

  return [(1 - alpha) * speed, alpha * speed];
}

export function getVelocityBasedWeights<
  L extends { [K in string]: LayerDefinition },
  A extends CharacterAnimations,
>({
  velocity,
  orientation,
  movementType,
  runSpeed,
  characterSystem,
  idleSpeed,
}: {
  velocity: ReadonlyVec3;
  orientation: ReadonlyVec2;
  movementType: MovementType;
  runSpeed: number; // The speed at which we switch walk -> run.
  characterSystem: AnimationSystem<A, L>;
  /** NPCs use a lower threshold so slow uphill motion visibly plays Walk. */
  idleSpeed?: number;
}): AnimationAction<AnimationSystem<A, L>> {
  const speed3d = length(velocity);
  const velocity2d = new THREE.Vector2(velocity[0], -velocity[2]);
  const speed2d = velocity2d.length();
  const forward2d = new THREE.Vector2(0, 1);
  const side2d = new THREE.Vector2(1, 0);
  forward2d.rotateAround(new THREE.Vector2(0, 0), orientation[1]);
  side2d.rotateAround(new THREE.Vector2(0, 0), orientation[1]);

  const forwardVelocity = velocity2d.dot(forward2d);
  const sideVelocity = velocity2d.dot(side2d);

  const ALL_LAYERS = Object.fromEntries(
    characterSystem.layerNames.map((x) => [x, "apply"])
  ) as {
    [K in LayerName<AnimationSystem<A, L>>]: ActionPriority;
  };

  if (movementType === "flying") {
    const weights = characterSystem.createEmptyAnimationWeights();

    if (animationLocomotionIsIdle(speed3d, idleSpeed)) {
      weights.flyIdle = 1;
    } else {
      weights.flyForwards = 1;
    }

    return {
      weights: weights,
      state: { repeat: { kind: "repeat" }, startTime: 0 },
      playbackRates: {
        flyForwards: locomotionPlaybackRate(speed2d, runSpeed),
      } as Partial<Record<AnimationName<AnimationSystem<A, L>>, number>>,
      layers: ALL_LAYERS,
    };
  }

  if (movementType === "swimming") {
    const weights = characterSystem.createEmptyAnimationWeights();

    if (animationLocomotionIsIdle(speed3d, idleSpeed)) {
      weights.swimIdle = 1;
    } else if (forwardVelocity > 0) {
      weights.swimForwards = 1;
    } else if (forwardVelocity < 0) {
      weights.swimBackwards = 1;
    }

    return {
      weights: weights,
      state: { repeat: { kind: "repeat" }, startTime: 0 },
      playbackRates: {
        swimForwards: locomotionPlaybackRate(speed2d, runSpeed * 0.65),
        swimBackwards: locomotionPlaybackRate(speed2d, runSpeed * 0.55),
      } as Partial<Record<AnimationName<AnimationSystem<A, L>>, number>>,
      layers: ALL_LAYERS,
    };
  }

  if (movementType === "crouching") {
    const weights = characterSystem.createEmptyAnimationWeights();

    if (animationLocomotionIsIdle(speed2d, idleSpeed)) {
      weights.crouchIdle = 1;
    } else {
      weights.crouchWalking = 1;
    }
    // Not really done here, we don't currently have a good "crouchIdle"
    // animation so we're always walking when we're crouched.
    return {
      weights: weights,
      state: { repeat: { kind: "repeat" }, startTime: 0 },
      playbackRates: {
        crouchWalking: locomotionPlaybackRate(speed2d, runSpeed * 0.28),
      } as Partial<Record<AnimationName<AnimationSystem<A, L>>, number>>,
      layers: ALL_LAYERS,
    };
  }

  // Handle the walking/running/strafing case.
  const weights = characterSystem.createEmptyAnimationWeights();
  if (animationLocomotionIsIdle(speed2d, idleSpeed)) {
    weights.idle = 1;
  } else {
    if (forwardVelocity > 0) {
      [weights.walk, weights.run] = splitWalkRunTransition(
        forwardVelocity,
        runSpeed
      );
    } else {
      weights.runBackwards = forwardVelocity < 0 ? -forwardVelocity : 0;
    }
    if (sideVelocity > 0) {
      [weights.strafeRightSlow, weights.strafeRightFast] =
        splitWalkRunTransition(sideVelocity, runSpeed);
    }
    if (sideVelocity < 0) {
      [weights.strafeLeftSlow, weights.strafeLeftFast] = splitWalkRunTransition(
        -sideVelocity,
        runSpeed
      );
    }

    if (forwardVelocity < -0.1) {
      [
        weights.strafeLeftSlow,
        weights.strafeLeftFast,
        weights.strafeRightSlow,
        weights.strafeRightFast,
      ] = [
        weights.strafeRightSlow,
        weights.strafeRightFast,
        weights.strafeLeftSlow,
        weights.strafeLeftFast,
      ];
    }
  }

  return {
    weights,
    state: {
      repeat: { kind: "repeat" },
      startTime: 0,
    },
    playbackRates: {
      walk: locomotionPlaybackRate(
        Math.max(0, forwardVelocity),
        runSpeed * 0.45
      ),
      run: locomotionPlaybackRate(Math.max(0, forwardVelocity), runSpeed),
      runBackwards: locomotionPlaybackRate(
        Math.max(0, -forwardVelocity),
        runSpeed * 0.62
      ),
      strafeRightSlow: locomotionPlaybackRate(
        Math.max(0, sideVelocity),
        runSpeed * 0.42
      ),
      strafeRightFast: locomotionPlaybackRate(
        Math.max(0, sideVelocity),
        runSpeed * 0.9
      ),
      strafeLeftSlow: locomotionPlaybackRate(
        Math.max(0, -sideVelocity),
        runSpeed * 0.42
      ),
      strafeLeftFast: locomotionPlaybackRate(
        Math.max(0, -sideVelocity),
        runSpeed * 0.9
      ),
    } as Partial<Record<AnimationName<AnimationSystem<A, L>>, number>>,
    layers: ALL_LAYERS,
  };
}
