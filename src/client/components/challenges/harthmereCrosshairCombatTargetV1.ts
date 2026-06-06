// HARTHMERE_CROSSHAIR_COMBAT_TARGET_V1
//
// Root cause this module fixes: in the live/embed build the creatures you see
// (muckers, hexes, animals, town NPCs) are client-side renderer meshes, not ECS
// entities, so the proven native cursor ray (`traceEntities(table, ...)`) never
// hits them and the left click falls through to voxel-break. The renderer does
// publish every actor's camera-projected screen position + world position into
// `window.__harthmereCombatActorPositions` each frame. Targeting off that screen
// projection is exactly "hit the thing under the crosshair", and it does NOT
// depend on the player's body-forward / yaw / origin runtime (the inputs the
// forward-arc resolver relied on, which go missing or land in the wrong
// coordinate frame and produce "no target inside the arc" — i.e. every swing
// misses).
//
// The selection logic is a pure function (no DOM / renderer / window access) so
// every branch is unit-testable, per the repo convention. The thin window
// readers live here too but are guarded for non-browser test runs.

export type HarthmereCrosshairCombatActorV1 = {
  offset: number;
  attackable: boolean;
  radius: number;
  targetId?: string;
  label?: string;
  asset?: string;
  species?: string;
  screenX?: number;
  screenY?: number;
  screenVisible?: boolean;
  screenDepth?: number;
  worldX?: number;
  worldY?: number;
  worldZ?: number;
};

export type HarthmereCrosshairAimV1 = {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
};

export type HarthmereCrosshairPickInputV1 = {
  actors: ReadonlyArray<HarthmereCrosshairCombatActorV1>;
  aim: HarthmereCrosshairAimV1;
  // Player world position, when known, so we never hit something that is
  // visually under the crosshair but physically out of melee reach. When the
  // player origin is unknown (the runtime snapshot is missing) we fall back to
  // screen proximity alone rather than refusing to hit anything.
  playerX?: number;
  playerZ?: number;
  worldReach: number;
  // Optional override for the crosshair pixel tolerance (mainly for tests).
  baseScreenTolerancePx?: number;
};

export type HarthmereCrosshairPickResultV1 = {
  offset: number;
  screenDistancePx: number;
  worldDistance?: number;
  targetId?: string;
  targetPosition?: [number, number, number];
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function crosshairScreenTolerancePx(
  aim: HarthmereCrosshairAimV1,
  override?: number
): number {
  if (typeof override === "number" && Number.isFinite(override)) {
    return override;
  }
  const minDim = Math.min(
    Number.isFinite(aim.viewportWidth) ? aim.viewportWidth : 0,
    Number.isFinite(aim.viewportHeight) ? aim.viewportHeight : 0
  );
  const basis = minDim > 0 ? minDim : 720;
  // ~14% of the smaller viewport dimension: generous enough that a click a
  // little off the body still connects, tight enough that you do not hit a
  // creature on the far side of the screen.
  return clampNumber(basis * 0.14, 70, 240);
}

/**
 * Pure decision: given the actors the renderer is currently drawing (with their
 * screen + world positions) and where the player is aiming, return the actor the
 * swing should damage, or undefined to let the caller fall back to the arc.
 */
export function pickHarthmereCrosshairCombatTargetV1(
  input: HarthmereCrosshairPickInputV1
): HarthmereCrosshairPickResultV1 | undefined {
  const { aim } = input;
  if (!Number.isFinite(aim.x) || !Number.isFinite(aim.y)) {
    return undefined;
  }
  const tolerance = crosshairScreenTolerancePx(aim, input.baseScreenTolerancePx);
  const haveOrigin =
    Number.isFinite(input.playerX) && Number.isFinite(input.playerZ);

  let best: HarthmereCrosshairPickResultV1 | undefined;
  for (const actor of input.actors) {
    if (!Number.isFinite(actor.offset)) {
      continue;
    }
    if (actor.attackable === false) {
      continue;
    }
    if (actor.screenVisible === false) {
      continue;
    }
    if (!Number.isFinite(actor.screenX) || !Number.isFinite(actor.screenY)) {
      continue;
    }
    const radius = Number.isFinite(actor.radius) ? actor.radius : 1.15;

    // World-reach gate (only when we know where the player is).
    let worldDistance: number | undefined;
    if (
      haveOrigin &&
      Number.isFinite(actor.worldX) &&
      Number.isFinite(actor.worldZ)
    ) {
      const dx = (actor.worldX as number) - (input.playerX as number);
      const dz = (actor.worldZ as number) - (input.playerZ as number);
      worldDistance = Math.hypot(dx, dz);
      if (worldDistance > input.worldReach + radius + 0.2) {
        continue;
      }
    }

    const sdx = (actor.screenX as number) - aim.x;
    const sdy = (actor.screenY as number) - aim.y;
    const screenDistancePx = Math.hypot(sdx, sdy);
    // Bigger creatures present a bigger body, so allow a little extra slack.
    const accept = screenDistancePx <= tolerance + Math.min(60, radius * 18);
    if (!accept) {
      continue;
    }

    if (
      best === undefined ||
      screenDistancePx < best.screenDistancePx ||
      (screenDistancePx === best.screenDistancePx &&
        (worldDistance ?? Infinity) < (best.worldDistance ?? Infinity))
    ) {
      const targetPosition =
        Number.isFinite(actor.worldX) &&
        Number.isFinite(actor.worldY) &&
        Number.isFinite(actor.worldZ)
          ? [
              actor.worldX as number,
              actor.worldY as number,
              actor.worldZ as number,
            ] satisfies [number, number, number]
          : undefined;
      best = {
        offset: actor.offset,
        screenDistancePx,
        worldDistance,
        targetId: actor.targetId,
        targetPosition,
      };
    }
  }
  return best;
}

export function harthmereHasCrosshairCombatTargetV1(
  input: HarthmereCrosshairPickInputV1
): boolean {
  return pickHarthmereCrosshairCombatTargetV1(input) !== undefined;
}

// ---------------------------------------------------------------------------
// Browser glue (not exercised by the pure unit tests).
// ---------------------------------------------------------------------------

function isBrowserEnvV1(): boolean {
  return typeof window !== "undefined";
}

function parseScreen(raw: unknown):
  | { x?: number; y?: number; visible?: boolean; depth?: number }
  | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const screen = raw as Record<string, unknown>;
  return {
    x: Number(screen.x),
    y: Number(screen.y),
    visible: screen.visible === false ? false : true,
    depth: Number(screen.depth),
  };
}

/**
 * Read the live actor registry the renderer publishes each frame, keeping the
 * screen + world data the forward-arc reader throws away. Fresh entries only
 * (stale actors older than 3.5s are dropped, matching the existing reader).
 */
export function readHarthmereCrosshairCombatActorsV1(): HarthmereCrosshairCombatActorV1[] {
  if (!isBrowserEnvV1()) {
    return [];
  }
  const win = window as typeof window & {
    __harthmereCombatActorPositions?: Record<string, unknown>;
    __harthmereEcsNpcCombatActorPositions?: Record<string, unknown>;
    __harthmereVoxelNpcMotionActorPositionsV193?: Record<string, unknown>;
  };
  const sources = [
    win.__harthmereCombatActorPositions,
    win.__harthmereEcsNpcCombatActorPositions,
    win.__harthmereVoxelNpcMotionActorPositionsV193,
  ].filter(
    (raw): raw is Record<string, unknown> => Boolean(raw && typeof raw === "object")
  );

  const now = Date.now();
  const byOffset = new Map<number, HarthmereCrosshairCombatActorV1>();
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      const offset = Number(key);
      if (!Number.isFinite(offset) || byOffset.has(offset)) {
        continue;
      }
      if (!value || typeof value !== "object") {
        continue;
      }
      const actor = value as Record<string, unknown>;
      const at = Number(actor.at);
      if (Number.isFinite(at) && now - at > 3_500) {
        continue;
      }
      const screen = parseScreen(actor.screen);
      const world = Array.isArray(actor.world) ? actor.world : undefined;
      const targetId =
        typeof actor.liveModeTargetId === "string" && actor.liveModeTargetId.trim()
          ? actor.liveModeTargetId.trim()
          : typeof actor.targetId === "string" && actor.targetId.trim()
            ? actor.targetId.trim()
            : undefined;
      byOffset.set(offset, {
        offset,
        attackable: actor.attackable === false ? false : true,
        radius: Number.isFinite(Number(actor.radius)) ? Number(actor.radius) : 1.15,
        targetId,
        label: typeof actor.label === "string" ? actor.label : undefined,
        asset: typeof actor.asset === "string" ? actor.asset : undefined,
        species:
          typeof actor.species === "string"
            ? actor.species
            : typeof actor.appearanceSpecies === "string"
              ? actor.appearanceSpecies
              : undefined,
        screenX: screen?.x,
        screenY: screen?.y,
        screenVisible: screen?.visible,
        screenDepth: screen?.depth,
        worldX: world ? Number(world[0]) : undefined,
        worldY: world ? Number(world[1]) : undefined,
        worldZ: world ? Number(world[2]) : undefined,
      });
    }
  }
  return [...byOffset.values()];
}

/**
 * Resolve the on-screen aim point for a left click. With pointer lock the cursor
 * is hidden and the crosshair sits at viewport centre; in the embed (no pointer
 * lock) the click lands exactly where the player pressed, so use the event
 * coordinates.
 */
export function harthmereCrosshairAimFromEventV1(input: {
  pointerLocked: boolean;
  clientX: number;
  clientY: number;
  viewportWidth: number;
  viewportHeight: number;
}): HarthmereCrosshairAimV1 {
  if (input.pointerLocked) {
    return {
      x: input.viewportWidth / 2,
      y: input.viewportHeight / 2,
      viewportWidth: input.viewportWidth,
      viewportHeight: input.viewportHeight,
    };
  }
  return {
    x: input.clientX,
    y: input.clientY,
    viewportWidth: input.viewportWidth,
    viewportHeight: input.viewportHeight,
  };
}
