import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  clearHarthmereCombatLock,
  harthmereCombatLockActorIsBoss,
  harthmereCombatLockActorIsHostile,
  readHarthmereCombatLockState,
  refreshHarthmereCombatLock,
  subscribeHarthmereCombatLockState,
  switchHarthmereCombatLock,
  type HarthmereCombatLockCandidate,
} from "@/client/components/challenges/harthmere_combat_lock_on";
import { readHarthmereCrosshairCombatActors } from "@/client/components/challenges/harthmereCrosshairCombatTarget";
import React, { useEffect, useState } from "react";
import * as THREE from "three";

export const HARTHMERE_COMBAT_LOCK_REFRESH_MS = 80;

export function projectHarthmereCombatLockCandidate(input: {
  world: readonly [number, number, number];
  radius: number;
  camera: THREE.Camera;
  viewportWidth: number;
  viewportHeight: number;
}) {
  const projected = new THREE.Vector3(
    input.world[0],
    input.world[1] + Math.max(0.6, input.radius * 0.72),
    input.world[2]
  ).project(input.camera);
  return {
    x: ((projected.x + 1) / 2) * input.viewportWidth,
    y: ((1 - projected.y) / 2) * input.viewportHeight,
    visible:
      projected.z > -1 &&
      projected.z < 1 &&
      projected.x > -1.08 &&
      projected.x < 1.08 &&
      projected.y > -1.08 &&
      projected.y < 1.08,
    depth: projected.z,
  };
}

export function buildHarthmereCombatLockCandidates(input: {
  playerPosition: readonly [number, number, number];
  camera: THREE.Camera;
  viewportWidth: number;
  viewportHeight: number;
}) {
  const candidates: HarthmereCombatLockCandidate[] = [];
  for (const actor of readHarthmereCrosshairCombatActors()) {
    if (
      !Number.isFinite(actor.worldX) ||
      !Number.isFinite(actor.worldY) ||
      !Number.isFinite(actor.worldZ)
    ) {
      continue;
    }
    const world: [number, number, number] = [
      actor.worldX as number,
      actor.worldY as number,
      actor.worldZ as number,
    ];
    const radius = Number.isFinite(actor.radius) ? actor.radius : 1.15;
    const screen = projectHarthmereCombatLockCandidate({
      world,
      radius,
      camera: input.camera,
      viewportWidth: input.viewportWidth,
      viewportHeight: input.viewportHeight,
    });
    candidates.push({
      ...actor,
      world,
      radius,
      screenX: screen.x,
      screenY: screen.y,
      screenVisible: actor.screenVisible !== false && screen.visible,
      screenDepth: screen.depth,
      distance: Math.hypot(
        world[0] - input.playerPosition[0],
        world[2] - input.playerPosition[2]
      ),
      boss: harthmereCombatLockActorIsBoss(actor),
      hostile: harthmereCombatLockActorIsHostile(actor),
    });
  }
  return candidates;
}

function isGameplayWheelTarget(target: EventTarget | null) {
  if (typeof document !== "undefined" && document.pointerLockElement) {
    return true;
  }
  const element = target instanceof HTMLElement ? target : undefined;
  return Boolean(element?.closest("canvas, #game-canvas, [data-game-canvas]"));
}

export const HarthmereCombatLockOnController: React.FunctionComponent = () => {
  const { reactResources } = useClientContext();
  const [lockState, setLockState] = useState(readHarthmereCombatLockState);

  useEffect(
    () =>
      subscribeHarthmereCombatLockState(() => {
        setLockState({ ...readHarthmereCombatLockState() });
      }),
    []
  );

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      const localPlayer = reactResources.get("/scene/local_player");
      const gameModal = reactResources.get("/game_modal");
      const cutscene = reactResources.get("/scene/cutscene");
      if (
        localPlayer.playerStatus !== "alive" ||
        localPlayer.warpingInfo ||
        gameModal.kind !== "empty" ||
        cutscene.active
      ) {
        clearHarthmereCombatLock("player_or_ui_state_invalidated");
        return;
      }
      const camera = reactResources.get("/scene/camera").three;
      refreshHarthmereCombatLock(
        buildHarthmereCombatLockCandidates({
          playerPosition: localPlayer.player.position,
          camera,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        }),
        Date.now()
      );
    };
    refresh();
    const timer = window.setInterval(refresh, HARTHMERE_COMBAT_LOCK_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      clearHarthmereCombatLock("controller_unmounted");
    };
  }, [reactResources]);

  useEffect(() => {
    let lastSwitchAt = 0;
    const onWheel = (event: WheelEvent) => {
      if (
        !readHarthmereCombatLockState().active ||
        !isGameplayWheelTarget(event.target) ||
        Math.abs(event.deltaY) < 1
      ) {
        return;
      }
      const now = performance.now();
      if (now - lastSwitchAt < 180) return;
      if (switchHarthmereCombatLock(event.deltaY > 0 ? 1 : -1)) {
        lastSwitchAt = now;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("wheel", onWheel, {
      capture: true,
      passive: false,
    });
    return () => window.removeEventListener("wheel", onWheel, true);
  }, []);

  const target = lockState.target;
  if (!lockState.active || !target) return null;
  const size = Math.max(38, Math.min(78, 38 + target.radius * 11));
  return (
    <div
      className="pointer-events-none fixed z-[74]"
      style={{
        left: target.screenX,
        top: target.screenY,
        width: size,
        height: size,
        opacity: target.screenVisible ? 1 : 0.42,
        transform: "translate(-50%, -50%)",
        transition:
          "left 120ms cubic-bezier(0.22, 1, 0.36, 1), top 120ms cubic-bezier(0.22, 1, 0.36, 1), opacity 120ms ease",
      }}
      data-harthmere-combat-lock-on={target.offset}
      data-harthmere-combat-lock-on-target-id={target.targetId ?? ""}
      data-harthmere-combat-lock-on-boss={target.boss ? "true" : "false"}
      role="status"
      aria-label={`Locked on ${target.label}`}
    >
      <div className="absolute inset-0 rotate-45 rounded-[28%] border-2 border-amber-100/90 shadow-[0_0_10px_rgba(251,191,36,0.55)]" />
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-amber-50 bg-amber-300/75" />
      <div className="absolute left-1/2 top-[calc(100%+6px)] -translate-x-1/2 whitespace-nowrap rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-50 shadow">
        {target.label}
      </div>
    </div>
  );
};
