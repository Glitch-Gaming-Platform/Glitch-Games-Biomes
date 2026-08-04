import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { isTouchDevice } from "@/client/components/contexts/PointerLockContext";
import { describeHotbarPrimaryAction } from "@/client/components/biomes_ui/hotbar/hotbarAction";
import {
  cycleHarthmereCombatTarget,
  performHarthmereKeyedAttack,
  toggleHarthmereWeaponDrawn,
  useHarthmereMultiplayerCombatState,
} from "@/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem";
import { readHarthmereCombatState } from "@/client/components/challenges/LocalDevHarthmereCombat";
import { getHarthmereMultiplayerAttackDisabledReason } from "@/client/components/challenges/harthmereCombatDeathInterfaceRules";
import {
  MOBILE_PRIMARY_ACTION_SOURCE,
  MOBILE_SECONDARY_ACTION_SOURCE,
  mobileActionButtons,
  mobileActionDisabledReason,
  mobileCombatActionForKind,
  type MobileActionButtonSpec,
  type MobileActionKind,
  type MobilePrimaryLabelKind,
} from "@/client/game/util/mobile_action_controls";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import {
  containMobileControlEvent,
  preventMobileBrowserNavigationGesture,
} from "@/client/components/mobileControlEvents";
import { useBiomesUINonGameplayScreenVisible } from "@/client/components/biomes_ui/BiomesUIOpenPrompt";
import {
  invokeSelectedWorldInteractionForKey,
  useHasSelectedWorldInteractionCandidate,
} from "@/client/components/challenges/worldInteractionDispatcher";
import { useAnimation } from "@/client/util/animation";
import {
  MOBILE_JOYSTICK_ACTION_PULSE_MS,
  MOBILE_JOYSTICK_ACTION_SOURCE,
  MOBILE_JOYSTICK_CROUCH_SOURCE,
  MOBILE_JOYSTICK_JUMP_SOURCE,
  MOBILE_JOYSTICK_RUN_SOURCE,
  mobileJoystickDoubleTapDirectionForTest,
  mobileJoystickHardTapForTest,
  mobileJoystickMagnitude,
  mobileJoystickMovementActionForDirectionForTest,
  mobileJoystickRunMotionValueForTest,
  type MobileJoystickHardTap,
} from "@/client/game/util/mobile_joystick";
import type { Vec2 } from "@/shared/math/types";
import dynamic from "next/dynamic";
import React, { useEffect, useRef, useState } from "react";
import { JoystickShape } from "react-joystick-component";

const Joystick = dynamic(
  () => import("react-joystick-component").then((mod) => mod.Joystick),
  {
    ssr: false,
  }
);

const MOBILE_MOVEMENT_HISTORY_GUARD_KEY = "__biomesMobileMovementHistoryGuard";

export const MaybeJoystickInput: React.FunctionComponent<{}> = React.memo(
  ({}) => {
    const { clientConfig } = useClientContext();
    const nonGameplayScreenVisible = useBiomesUINonGameplayScreenVisible();

    if (!clientConfig.showVirtualJoystick) {
      return <></>;
    }

    if (clientConfig.mobileDevice && nonGameplayScreenVisible) {
      return <></>;
    }

    return <JoystickInput />;
  }
);

export const JoystickInput: React.FunctionComponent<{}> = ({}) => {
  const { clientConfig, input, userId } = useClientContext();
  const touchDevice = isTouchDevice();
  const [mobileCrouchHeld, setMobileCrouchHeld] = useState(false);
  const [mobileJumpHeld, setMobileJumpHeld] = useState(false);
  const mobileInteractAvailable =
    useHasSelectedWorldInteractionCandidate("KeyF");
  const [joystickSize, setJoystickSize] = useState(() =>
    responsiveJoystickSize()
  );

  const leftPosRef = useRef([0, 0] as Vec2);
  const rightPosRef = useRef([0, 0] as Vec2);
  const leftRunningRef = useRef(false);
  const leftRunMotionRef = useRef(0);
  const leftGestureRef = useRef<
    | {
        startedAtMs: number;
        peak: Vec2;
      }
    | undefined
  >(undefined);
  const lastHardTapRef = useRef<MobileJoystickHardTap>(undefined);
  const movementActionPulseNonceRef = useRef(0);
  const crouchPointerIdRef = useRef<number>(undefined);
  const jumpPointerIdRef = useRef<number>(undefined);
  const movementControlsRef = useRef<HTMLDivElement>(null);

  const nowMs = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const resetLeftJoystick = () => {
    leftPosRef.current = [0, 0];
    leftRunningRef.current = false;
    leftRunMotionRef.current = 0;
    input.setSyntheticMotion("run", MOBILE_JOYSTICK_RUN_SOURCE, 0);
  };

  const resetJoystickTapGesture = () => {
    leftGestureRef.current = undefined;
    lastHardTapRef.current = undefined;
  };

  const releaseMobileCrouch = (updateUi = true) => {
    crouchPointerIdRef.current = undefined;
    input.setSyntheticMotion("crouch", MOBILE_JOYSTICK_CROUCH_SOURCE, 0);
    if (updateUi) {
      setMobileCrouchHeld(false);
    }
  };

  const releaseMobileJump = (updateUi = true) => {
    jumpPointerIdRef.current = undefined;
    input.setSyntheticAction("jump", MOBILE_JOYSTICK_JUMP_SOURCE, false);
    if (updateUi) {
      setMobileJumpHeld(false);
    }
  };

  const beginLeftJoystickGesture = (x: number, y: number) => {
    leftGestureRef.current = {
      startedAtMs: nowMs(),
      peak: [x, y],
    };
  };

  const updateLeftJoystickGesture = (x: number, y: number) => {
    if (!leftGestureRef.current) {
      beginLeftJoystickGesture(x, y);
      return;
    }
    if (
      mobileJoystickMagnitude(x, y) >
      mobileJoystickMagnitude(...leftGestureRef.current.peak)
    ) {
      leftGestureRef.current.peak = [x, y];
    }
  };

  const triggerDirectionalMovementAction = (
    direction: readonly [number, number]
  ) => {
    const source = `${MOBILE_JOYSTICK_ACTION_SOURCE}:${++movementActionPulseNonceRef.current}`;
    const command = mobileJoystickMovementActionForDirectionForTest(direction);
    input.setSyntheticMotion("lateral", source, command.lateral);
    input.setSyntheticMotion("forward", source, command.forward);
    void input
      .pulseAction(command.action, MOBILE_JOYSTICK_ACTION_PULSE_MS, source)
      .finally(() => {
        input.setSyntheticMotion("lateral", source, 0);
        input.setSyntheticMotion("forward", source, 0);
      });
  };

  const finishLeftJoystickGesture = () => {
    const gesture = leftGestureRef.current;
    leftGestureRef.current = undefined;
    if (!gesture) {
      lastHardTapRef.current = undefined;
      return;
    }
    const hardTap = mobileJoystickHardTapForTest({
      startedAtMs: gesture.startedAtMs,
      releasedAtMs: nowMs(),
      peakX: gesture.peak[0],
      peakY: gesture.peak[1],
    });
    if (!hardTap) {
      lastHardTapRef.current = undefined;
      return;
    }
    const movementDirection = mobileJoystickDoubleTapDirectionForTest(
      lastHardTapRef.current,
      hardTap
    );
    if (movementDirection) {
      lastHardTapRef.current = undefined;
      triggerDirectionalMovementAction(movementDirection);
    } else {
      lastHardTapRef.current = hardTap;
    }
  };

  useEffect(() => {
    const updateSize = () => setJoystickSize(responsiveJoystickSize());
    window.addEventListener("resize", updateSize);
    window.addEventListener("orientationchange", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("orientationchange", updateSize);
    };
  }, []);

  useEffect(() => {
    const resetForInterruption = () => {
      resetLeftJoystick();
      resetJoystickTapGesture();
      releaseMobileCrouch();
      releaseMobileJump();
    };
    const resetWhenHidden = () => {
      if (document.visibilityState !== "visible") {
        resetForInterruption();
      }
    };
    window.addEventListener("blur", resetForInterruption);
    document.addEventListener("visibilitychange", resetWhenHidden);
    return () => {
      window.removeEventListener("blur", resetForInterruption);
      document.removeEventListener("visibilitychange", resetWhenHidden);
      resetLeftJoystick();
      resetJoystickTapGesture();
      releaseMobileCrouch(false);
      releaseMobileJump(false);
    };
  }, [input]);

  useEffect(() => {
    if (!clientConfig.mobileDevice) {
      return;
    }
    const controls = movementControlsRef.current;
    if (!controls) {
      return;
    }
    const preventBrowserNavigation = (event: TouchEvent) => {
      preventMobileBrowserNavigationGesture(event);
    };
    const options: AddEventListenerOptions = {
      capture: true,
      passive: false,
    };
    const gameplayUrl = window.location.href;
    const guardedHistoryState = () => {
      const state = window.history.state;
      return typeof state === "object" && state !== null ? state : {};
    };
    const ensureMovementHistoryGuard = () => {
      const state = guardedHistoryState();
      if (state[MOBILE_MOVEMENT_HISTORY_GUARD_KEY] === true) {
        return;
      }
      window.history.pushState(
        {
          ...state,
          [MOBILE_MOVEMENT_HISTORY_GUARD_KEY]: true,
        },
        "",
        gameplayUrl
      );
    };
    const restoreMovementHistoryGuard = () => {
      window.history.pushState(
        {
          ...guardedHistoryState(),
          [MOBILE_MOVEMENT_HISTORY_GUARD_KEY]: true,
        },
        "",
        gameplayUrl
      );
    };
    const preventNavigationFromMovementControls = (event: TouchEvent) => {
      const path = event.composedPath();
      if (
        path.includes(controls) ||
        (event.target instanceof Node && controls.contains(event.target))
      ) {
        preventBrowserNavigation(event);
      }
    };
    document.addEventListener(
      "touchstart",
      preventNavigationFromMovementControls,
      options
    );
    document.addEventListener(
      "touchmove",
      preventNavigationFromMovementControls,
      options
    );
    ensureMovementHistoryGuard();
    window.addEventListener("pageshow", ensureMovementHistoryGuard);
    window.addEventListener("popstate", restoreMovementHistoryGuard);
    return () => {
      document.removeEventListener(
        "touchstart",
        preventNavigationFromMovementControls,
        options
      );
      document.removeEventListener(
        "touchmove",
        preventNavigationFromMovementControls,
        options
      );
      window.removeEventListener("pageshow", ensureMovementHistoryGuard);
      window.removeEventListener("popstate", restoreMovementHistoryGuard);
    };
  }, [clientConfig.mobileDevice]);

  useAnimation(() => {
    input.moveVirtualJoycon("left", ...leftPosRef.current);
    input.setSyntheticMotion(
      "run",
      MOBILE_JOYSTICK_RUN_SOURCE,
      leftRunMotionRef.current
    );
    if (!touchDevice) {
      input.moveVirtualJoycon("right", ...rightPosRef.current);
    }
  });

  return (
    <div
      className={`joysticks${
        clientConfig.mobileDevice ? " joysticks--mobile" : ""
      }`}
      data-biomes-mobile-controls={
        clientConfig.mobileDevice ? "true" : undefined
      }
    >
      {userId && (
        <div
          ref={movementControlsRef}
          className="mobile-movement-controls"
          data-biomes-mobile-browser-back-guard={
            clientConfig.mobileDevice ? "true" : undefined
          }
        >
          <div
            className="joystick left"
            role="group"
            aria-label="Movement joystick"
            title="Double-tap a direction to dodge"
            data-biomes-mobile-double-tap-dodge="true"
          >
            <Joystick
              size={joystickSize}
              baseColor="rgb(0, 0, 51)"
              stickColor="rgba(61, 89, 171)"
              stickShape={JoystickShape.Square}
              baseShape={JoystickShape.Square}
              start={(evt) => {
                beginLeftJoystickGesture(evt.x ?? 0, evt.y ?? 0);
              }}
              stop={() => {
                finishLeftJoystickGesture();
                resetLeftJoystick();
              }}
              move={(evt) => {
                const x = evt.x ?? 0;
                const y = evt.y ?? 0;
                leftPosRef.current = [x, y];
                updateLeftJoystickGesture(x, y);
                leftRunMotionRef.current = mobileJoystickRunMotionValueForTest(
                  x,
                  y,
                  leftRunningRef.current
                );
                leftRunningRef.current = leftRunMotionRef.current > 0;
              }}
            />
          </div>
          {clientConfig.mobileDevice ? (
            <div className="mobile-movement-buttons">
              <button
                type="button"
                className={`mobile-movement-button mobile-crouch-button${
                  mobileCrouchHeld ? " mobile-crouch-button--held" : ""
                }`}
                aria-label="Hold C to crouch"
                aria-pressed={mobileCrouchHeld}
                data-biomes-mobile-crouch="true"
                onPointerDown={(event) => {
                  containMobileControlEvent(event);
                  if (crouchPointerIdRef.current !== undefined) {
                    return;
                  }
                  crouchPointerIdRef.current = event.pointerId;
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  input.setSyntheticMotion(
                    "crouch",
                    MOBILE_JOYSTICK_CROUCH_SOURCE,
                    1
                  );
                  setMobileCrouchHeld(true);
                }}
                onPointerUp={(event) => {
                  containMobileControlEvent(event);
                  if (crouchPointerIdRef.current === event.pointerId) {
                    releaseMobileCrouch();
                  }
                }}
                onPointerCancel={(event) => {
                  containMobileControlEvent(event);
                  if (crouchPointerIdRef.current === event.pointerId) {
                    releaseMobileCrouch();
                  }
                }}
                onLostPointerCapture={(event) => {
                  containMobileControlEvent(event);
                  if (crouchPointerIdRef.current === event.pointerId) {
                    releaseMobileCrouch();
                  }
                }}
                onClick={containMobileControlEvent}
                onContextMenu={containMobileControlEvent}
              >
                <span className="mobile-movement-button__key">C</span>
                <span className="mobile-movement-button__label">Crouch</span>
              </button>
              <button
                type="button"
                className={`mobile-movement-button mobile-jump-button${
                  mobileJumpHeld ? " mobile-jump-button--held" : ""
                }`}
                aria-label="Jump or hold to rise"
                aria-pressed={mobileJumpHeld}
                data-biomes-mobile-jump="true"
                onPointerDown={(event) => {
                  containMobileControlEvent(event);
                  if (jumpPointerIdRef.current !== undefined) {
                    return;
                  }
                  jumpPointerIdRef.current = event.pointerId;
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  input.setSyntheticAction(
                    "jump",
                    MOBILE_JOYSTICK_JUMP_SOURCE,
                    true
                  );
                  setMobileJumpHeld(true);
                }}
                onPointerUp={(event) => {
                  containMobileControlEvent(event);
                  if (jumpPointerIdRef.current === event.pointerId) {
                    releaseMobileJump();
                  }
                }}
                onPointerCancel={(event) => {
                  containMobileControlEvent(event);
                  if (jumpPointerIdRef.current === event.pointerId) {
                    releaseMobileJump();
                  }
                }}
                onLostPointerCapture={(event) => {
                  containMobileControlEvent(event);
                  if (jumpPointerIdRef.current === event.pointerId) {
                    releaseMobileJump();
                  }
                }}
                onClick={containMobileControlEvent}
                onContextMenu={containMobileControlEvent}
              >
                <span className="mobile-movement-button__key">↑</span>
                <span className="mobile-movement-button__label">Jump</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`mobile-crouch-button${
                mobileCrouchHeld ? " mobile-crouch-button--held" : ""
              }`}
              aria-label="Hold C to crouch"
              aria-pressed={mobileCrouchHeld}
              onPointerDown={(event) => {
                containMobileControlEvent(event);
                if (crouchPointerIdRef.current !== undefined) {
                  return;
                }
                crouchPointerIdRef.current = event.pointerId;
                event.currentTarget.setPointerCapture?.(event.pointerId);
                input.setSyntheticMotion(
                  "crouch",
                  MOBILE_JOYSTICK_CROUCH_SOURCE,
                  1
                );
                setMobileCrouchHeld(true);
              }}
              onPointerUp={(event) => {
                containMobileControlEvent(event);
                if (crouchPointerIdRef.current === event.pointerId) {
                  releaseMobileCrouch();
                }
              }}
              onPointerCancel={(event) => {
                containMobileControlEvent(event);
                if (crouchPointerIdRef.current === event.pointerId) {
                  releaseMobileCrouch();
                }
              }}
              onLostPointerCapture={(event) => {
                containMobileControlEvent(event);
                if (crouchPointerIdRef.current === event.pointerId) {
                  releaseMobileCrouch();
                }
              }}
              onClick={containMobileControlEvent}
              onContextMenu={containMobileControlEvent}
            >
              <span className="mobile-crouch-button__key">C</span>
              <span className="mobile-crouch-button__label">Crouch</span>
            </button>
          )}
        </div>
      )}
      {/*
        HARTHMERE_MOBILE_ACTION_CONTROLS (2026-08-04 mobile audit, items 1
        and 14). The right-thumb cluster: mine/attack/use, place, and the
        Harthmere combat verbs that were previously keyboard-only. Mounted only
        for `mobileDevice`, so desktop and pointerless-desktop are untouched.
      */}
      {userId && clientConfig.mobileDevice && <MobileActionButtons />}
      {userId && clientConfig.mobileDevice && mobileInteractAvailable && (
        <button
          type="button"
          className="mobile-movement-button mobile-interact-button"
          aria-label="Interact or talk (F)"
          data-biomes-mobile-interact="true"
          onPointerDown={(event) => {
            containMobileControlEvent(event);
            invokeSelectedWorldInteractionForKey("KeyF");
          }}
          onClick={(event) => {
            containMobileControlEvent(event);
            if (event.detail === 0) {
              invokeSelectedWorldInteractionForKey("KeyF");
            }
          }}
          onContextMenu={containMobileControlEvent}
        >
          <span className="mobile-movement-button__key">F</span>
          <span className="mobile-movement-button__label">Interact</span>
        </button>
      )}
      <div className="spacer" />
      {!touchDevice && (
        <div
          className="joystick right"
          role="group"
          aria-label="Camera joystick"
        >
          <Joystick
            size={joystickSize}
            baseColor="rgb(0, 0, 51)"
            stickColor="rgba(61, 89, 171)"
            stickShape={JoystickShape.Square}
            baseShape={JoystickShape.Square}
            stop={() => {
              rightPosRef.current = [0, 0];
            }}
            move={(evt) => {
              rightPosRef.current = [evt.x ?? 0, evt.y ?? 0];
            }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * HARTHMERE_MOBILE_ACTION_CONTROLS (2026-08-04 mobile audit, items 1 and 14).
 *
 * The right-thumb action cluster. Before this existed a phone could walk,
 * jump, crouch, look, press F, and open menus -- but could not mine, place, or
 * fight, because `primary`/`secondary` are bound to mouse buttons only and the
 * Harthmere combat verbs (draw, target, basic, heavy, spark) are dispatched
 * from a `keydown` handler.
 *
 * This is a separate component, not a branch inside `JoystickInput`, for one
 * specific reason: it subscribes to combat state and the hotbar selection, and
 * React hooks cannot be mounted conditionally. Keeping it separate means those
 * subscriptions and their re-renders exist ONLY on a phone. `JoystickInput`
 * itself still mounts on a touch-capable desktop, and that path is unchanged.
 */
const MobileActionButtons: React.FunctionComponent<{}> = () => {
  const { input, reactResources } = useClientContext();
  const [heldActions, setHeldActions] = useState<ReadonlySet<MobileActionKind>>(
    () => new Set()
  );
  const actionPointerIdsRef = useRef(new Map<MobileActionKind, number>());

  // Hold-capable controls drive the same synthetic motions the mouse drives,
  // so `InteractScript` stays the single authority for what the selected item
  // actually does. A press sets the motion to 1 and *holds* it -- that is what
  // makes mining a slow block work, and it is why these are not implemented
  // with the fixed-duration `pulseMotion` the hotbar uses.
  const motionForHoldableAction = (kind: MobileActionKind) =>
    kind === "primary" ? "primary_hold" : "secondary_hold";

  const sourceForHoldableAction = (kind: MobileActionKind) =>
    kind === "primary"
      ? MOBILE_PRIMARY_ACTION_SOURCE
      : MOBILE_SECONDARY_ACTION_SOURCE;

  const pressHoldAction = (kind: MobileActionKind, pointerId: number) => {
    if (actionPointerIdsRef.current.has(kind)) {
      return;
    }
    actionPointerIdsRef.current.set(kind, pointerId);
    input.setSyntheticMotion(
      motionForHoldableAction(kind),
      sourceForHoldableAction(kind),
      1
    );
    setHeldActions((held) => new Set(held).add(kind));
  };

  const releaseHoldAction = (kind: MobileActionKind, updateUi = true) => {
    actionPointerIdsRef.current.delete(kind);
    input.setSyntheticMotion(
      motionForHoldableAction(kind),
      sourceForHoldableAction(kind),
      0
    );
    if (updateUi) {
      setHeldActions((held) => {
        if (!held.has(kind)) {
          return held;
        }
        const next = new Set(held);
        next.delete(kind);
        return next;
      });
    }
  };

  const releaseAllHoldActions = (updateUi = true) => {
    for (const kind of [...actionPointerIdsRef.current.keys()]) {
      releaseHoldAction(kind, false);
    }
    if (updateUi) {
      setHeldActions(new Set());
    }
  };

  // A stuck `primary_hold` would mine or swing forever, so release on every
  // interruption -- the same set the crouch/jump controls already guard.
  useEffect(() => {
    const releaseForInterruption = () => releaseAllHoldActions();
    const releaseWhenHidden = () => {
      if (document.visibilityState !== "visible") {
        releaseAllHoldActions();
      }
    };
    window.addEventListener("blur", releaseForInterruption);
    document.addEventListener("visibilitychange", releaseWhenHidden);
    return () => {
      window.removeEventListener("blur", releaseForInterruption);
      document.removeEventListener("visibilitychange", releaseWhenHidden);
      releaseAllHoldActions(false);
    };
  }, [input]);

  /**
   * Discrete combat controls route through the *existing* combat entry points
   * rather than reimplementing them, so a phone press and a keyboard press
   * produce the same animation, the same UpdateNpcHealthEvent, the same server
   * range/item validation, and the same Anima retaliation.
   */
  const invokeCombatAction = (kind: MobileActionKind) => {
    if (kind === "draw") {
      toggleHarthmereWeaponDrawn();
      return;
    }
    if (kind === "target") {
      cycleHarthmereCombatTarget();
      return;
    }
    const combatAction = mobileCombatActionForKind(kind);
    if (combatAction) {
      performHarthmereKeyedAttack(combatAction);
    }
  };

  // The same subscription the desktop combat HUD uses, so the phone can never
  // disagree with it about weapon stance or block reasons.
  const combatState = useHarthmereMultiplayerCombatState();
  const selectedItem = reactResources.use("/hotbar/selection")?.item;
  const availability = React.useMemo(() => {
    const player = readHarthmereCombatState().player;
    return {
      nativeCombatEnabled: nativeBiomesEcsAuthorityEnabled(),
      weaponDrawn: Boolean(combatState.weaponDrawn),
      attackBlockedReason: getHarthmereMultiplayerAttackDisabledReason(
        "heavy",
        combatState,
        player
      ),
      sparkBlockedReason: getHarthmereMultiplayerAttackDisabledReason(
        "spark",
        combatState,
        player
      ),
    };
  }, [combatState]);
  const specs: MobileActionButtonSpec[] = React.useMemo(
    () =>
      mobileActionButtons(
        availability,
        // The primary caption follows the selected item, so the button reads
        // "Mine", "Attack", "Place" or "Use" instead of a generic verb. An
        // empty hand still mines, which is why `undefined` is allowed through.
        selectedItem
          ? (describeHotbarPrimaryAction(selectedItem)
              .kind as MobilePrimaryLabelKind)
          : undefined
      ),
    [availability, selectedItem]
  );

  return (
    <div className="mobile-action-buttons" data-biomes-mobile-actions="true">
      {specs.map((spec) => {
        const disabledReason = mobileActionDisabledReason(
          spec.kind,
          availability
        );
        const held = heldActions.has(spec.kind);
        return (
          <button
            key={spec.kind}
            type="button"
            className={`mobile-movement-button mobile-action-button mobile-action-button--${
              spec.kind
            }${held ? " mobile-action-button--held" : ""}`}
            aria-label={spec.ariaLabel}
            aria-pressed={spec.holdable ? held : undefined}
            title={disabledReason ?? spec.label}
            disabled={Boolean(disabledReason)}
            data-biomes-mobile-action-button={spec.testAttribute}
            onPointerDown={(event) => {
              containMobileControlEvent(event);
              if (disabledReason) {
                return;
              }
              if (spec.holdable) {
                event.currentTarget.setPointerCapture?.(event.pointerId);
                pressHoldAction(spec.kind, event.pointerId);
              } else {
                // Discrete controls fire on press rather than click so a combat
                // action feels immediate and cannot be swallowed by iOS's
                // synthetic-click delay.
                invokeCombatAction(spec.kind);
              }
            }}
            onPointerUp={(event) => {
              containMobileControlEvent(event);
              if (
                spec.holdable &&
                actionPointerIdsRef.current.get(spec.kind) === event.pointerId
              ) {
                releaseHoldAction(spec.kind);
              }
            }}
            onPointerCancel={(event) => {
              containMobileControlEvent(event);
              if (
                spec.holdable &&
                actionPointerIdsRef.current.get(spec.kind) === event.pointerId
              ) {
                releaseHoldAction(spec.kind);
              }
            }}
            onLostPointerCapture={(event) => {
              containMobileControlEvent(event);
              if (
                spec.holdable &&
                actionPointerIdsRef.current.get(spec.kind) === event.pointerId
              ) {
                releaseHoldAction(spec.kind);
              }
            }}
            onClick={containMobileControlEvent}
            onContextMenu={containMobileControlEvent}
          >
            <span className="mobile-movement-button__key">{spec.glyph}</span>
            <span className="mobile-movement-button__label">{spec.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export function responsiveJoystickSize() {
  if (typeof window === "undefined") {
    return 88;
  }
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;
  return Math.round(
    Math.max(72, Math.min(112, Math.min(viewportWidth, viewportHeight) * 0.22))
  );
}
