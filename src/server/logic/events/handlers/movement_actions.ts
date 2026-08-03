import { makeEventHandler } from "@/server/logic/events/core";
import { q } from "@/server/logic/events/query";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { MovementState } from "@/shared/ecs/gen/components";
import {
  PLAYER_MOVEMENT_ACTION_TIMING,
  createMovementActionState,
  movementActionIsActive,
  movementActionIsOnCooldown,
  movementActionStaminaCost,
  normalizeMovementActionDirection,
} from "@/shared/game/movement_actions";
import {
  readHarthmereNativeVitals,
  spendHarthmereNativeStamina,
} from "@/shared/harthmere/harthmere_native_vitals";
import { yawVector } from "@/shared/physics/utils";

export const setCrouchingEventHandler = makeEventHandler("setCrouchingEvent", {
  mergeKey: (event) => event.id,
  involves: (event) => ({ player: q.player(event.id) }),
  apply: ({ player }, event) => {
    const delta = player.delta();
    if ((delta.health()?.hp ?? 0) <= 0 && event.crouching) {
      return;
    }
    const previous = delta.movementState();
    if (previous?.crouching === event.crouching) {
      return;
    }
    delta.setMovementState(
      MovementState.create({
        ...MovementState.clone(previous),
        crouching: event.crouching,
      })
    );
  },
});

export const movementActionEventHandler = makeEventHandler(
  "movementActionEvent",
  {
    mergeKey: (event) => event.id,
    involves: (event) => ({ player: q.player(event.id) }),
    apply: ({ player }, event) => {
      const delta = player.delta();
      if ((delta.health()?.hp ?? 0) <= 0) {
        return;
      }

      const nowSeconds = secondsSinceEpoch();
      const previous = delta.movementState();
      if (movementActionIsOnCooldown(previous, nowSeconds)) {
        return;
      }

      // Never let a second action start on top of a live one. Cooldowns happen
      // to cover this for the current table (every cooldown exceeds its own
      // duration), but that is a tuning coincidence rather than a rule, and a
      // stacked action would restart the i-frame window mid-flight.
      //
      // Note the residual gap: the client gates double jump on its own jump
      // count (`isDoubleJumpAttempt`), and the server cannot yet confirm it
      // because airborne state is not replicated. Cooldown and stamina bound
      // the abuse, and the action grants no invulnerability or displacement, so
      // the exposure today is a stamina drain. Closing it properly needs jump
      // count or grounded state on MovementState.
      if (movementActionIsActive(previous, nowSeconds)) {
        return;
      }

      const vitals = readHarthmereNativeVitals(delta.triggerState());
      const staminaCost = movementActionStaminaCost(event.action);
      if (vitals.stamina < staminaCost) {
        return;
      }

      const timing = PLAYER_MOVEMENT_ACTION_TIMING[event.action];
      const fallbackDirection = yawVector(delta.orientation()?.v[1] ?? 0);
      delta.setMovementState(
        createMovementActionState({
          previous,
          action: event.action,
          direction: normalizeMovementActionDirection(
            event.direction,
            fallbackDirection
          ),
          nonce: event.nonce,
          nowSeconds,
          durationSeconds: timing.durationSeconds,
          invulnerabilitySeconds: timing.invulnerabilityEndSeconds,
          cooldownSeconds: timing.cooldownSeconds,
        })
      );
      spendHarthmereNativeStamina(delta.mutableTriggerState(), staminaCost);
    },
  }
);

export const movementActionEventHandlers = [
  setCrouchingEventHandler,
  movementActionEventHandler,
];
