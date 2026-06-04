// HARTHMERE_CRAFTING_TABLE_PROXIMITY_V1
//
// Gating + selection for the Harthmere crafting-table interaction prompt. The
// prompt must appear ONLY at actual crafting tables — wherever they are: inside a
// business, in a home on the map, or one the player bought for their own home /
// business. A crafting table is any placed placeable whose item is a crafting
// station (item.isCraftingStation), so detection keys on that identity, never on
// location.
//
// This module is node-safe and pure (the client adapts the real ECS table /
// bikkie item flags into the candidate list) so the gating can be unit-tested.

export type HarthmereCraftingVec3V1 = readonly [number, number, number];

// One nearby placeable the player could be standing at. `isCraftingStation` is
// resolved by the caller from the placeable item's bikkie flags; `usable` lets
// the caller exclude tables whose building requirements (roof / no-roof) aren't
// met, so the prompt only offers a table the player can actually use.
export interface HarthmereCraftingTableCandidateV1 {
  entityId: string;
  position: HarthmereCraftingVec3V1;
  isCraftingStation: boolean;
  usable?: boolean;
  stationName?: string;
}

export interface HarthmereCraftingTableSelectionV1 {
  entityId: string;
  position: HarthmereCraftingVec3V1;
  stationName?: string;
  score: number;
}

// Tuned to match the other Harthmere proximity prompts (jobs board / world
// objects) so the crafting prompt feels consistent.
export const HARTHMERE_CRAFTING_TABLE_PROMPT_RADIUS_V1 = 5.5;
export const HARTHMERE_CRAFTING_TABLE_PROMPT_CLOSE_RADIUS_V1 = 2.5;
export const HARTHMERE_CRAFTING_TABLE_PROMPT_MIN_VIEW_DOT_V1 = 0.1;

// The single gate that decides whether an entity is a crafting table the prompt
// should ever appear for. Pure boolean logic so it can be reused by the cursor
// overlay AND the proximity prompt and stay in lockstep.
export function isHarthmereCraftingTableV1(input: {
  hasPlaceableComponent: boolean;
  itemIsCraftingStation: boolean;
}): boolean {
  return input.hasPlaceableComponent && input.itemIsCraftingStation;
}

// Proximity + facing score (lower is better); undefined when out of range or not
// faced. Mirrors harthmereWorldObjectCandidateScoreV1 so all prompts agree.
export function harthmereCraftingTableScoreV1(input: {
  playerPosition: HarthmereCraftingVec3V1;
  facingView: HarthmereCraftingVec3V1;
  tablePosition: HarthmereCraftingVec3V1;
  radius?: number;
  closeRadius?: number;
  minViewDot?: number;
}): number | undefined {
  const radius = input.radius ?? HARTHMERE_CRAFTING_TABLE_PROMPT_RADIUS_V1;
  const closeRadius =
    input.closeRadius ?? HARTHMERE_CRAFTING_TABLE_PROMPT_CLOSE_RADIUS_V1;
  const minViewDot =
    input.minViewDot ?? HARTHMERE_CRAFTING_TABLE_PROMPT_MIN_VIEW_DOT_V1;
  const dx = input.tablePosition[0] - input.playerPosition[0];
  const dz = input.tablePosition[2] - input.playerPosition[2];
  const dist = Math.hypot(dx, dz);
  if (!Number.isFinite(dist) || dist > radius) {
    return undefined;
  }
  const vx = input.facingView[0];
  const vz = input.facingView[2];
  const vlen = Math.hypot(vx, vz);
  if (!Number.isFinite(vlen) || vlen <= 1e-5) {
    return undefined;
  }
  const tlen = Math.max(dist, 1e-5);
  const viewDot = (vx * dx + vz * dz) / (vlen * tlen);
  const requiredDot = dist <= closeRadius ? 0 : Math.max(0, minViewDot);
  if (viewDot < requiredDot) {
    return undefined;
  }
  return dist - viewDot * 0.9;
}

// Pick the nearest faced crafting table among nearby candidates. Non-crafting
// placeables and unusable tables (building requirements unmet) are excluded, so
// the prompt is offered ONLY for a crafting table the player can actually use.
export function selectNearestHarthmereCraftingTableV1(input: {
  playerPosition: HarthmereCraftingVec3V1;
  facingView: HarthmereCraftingVec3V1;
  candidates: readonly HarthmereCraftingTableCandidateV1[];
  radius?: number;
  closeRadius?: number;
  minViewDot?: number;
}): HarthmereCraftingTableSelectionV1 | undefined {
  let best: HarthmereCraftingTableSelectionV1 | undefined;
  for (const candidate of input.candidates) {
    if (
      !isHarthmereCraftingTableV1({
        hasPlaceableComponent: true,
        itemIsCraftingStation: candidate.isCraftingStation,
      })
    ) {
      continue;
    }
    if (candidate.usable === false) {
      continue;
    }
    const score = harthmereCraftingTableScoreV1({
      playerPosition: input.playerPosition,
      facingView: input.facingView,
      tablePosition: candidate.position,
      radius: input.radius,
      closeRadius: input.closeRadius,
      minViewDot: input.minViewDot,
    });
    if (score === undefined) {
      continue;
    }
    if (!best || score < best.score) {
      best = {
        entityId: candidate.entityId,
        position: candidate.position,
        stationName: candidate.stationName,
        score,
      };
    }
  }
  return best;
}
