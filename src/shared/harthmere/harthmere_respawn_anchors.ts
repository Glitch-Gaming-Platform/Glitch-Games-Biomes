// HARTHMERE_RESPAWN_ANCHORS (2026-07-30)
//
// WHAT WENT WRONG
// ---------------
// `warpHomeEvent` had exactly two respawn destinations: a Chapter 1 dungeon
// arrival slot, and `HARTHMERE_GROVE_RESPAWN_POSITION` — a single hard-coded
// point in the Grove at [496, 70, -126]. So a player who died anywhere in
// Harthmere woke up in the Grove, roughly 1,600 blocks west, and had to walk
// the whole connector road back. Harthmere is where the game is; the Grove is
// the tutorial meadow you leave.
//
// WHAT THIS IS
// ------------
// The region half of the decision, kept out of the event handler so it is
// unit-testable without booting a logic server. Given the position a player
// died at, it answers: which settlement was that, and where in that settlement
// should they wake up?
//
// WHY THE CHAPEL
// --------------
// Bible §7.5, Temple Green: the Chapel of Saint Verena is the district that
// carries the `chapel_healing` service, and it is the only building in town
// whose stated civic function is putting people back together. Waking on its
// green is the answer the setting already gives. (The Market Fountain would be
// the other candidate and is wrong twice over: it is the busiest tile in town,
// and it is now a basin you would respawn standing in.)
//
// THE COORDINATE FRAME TRAP
// -------------------------
// Harthmere exists at two X offsets depending on deployment: authored
// (192..768) and the additive east extension (+1600).
//
// Only the extension is a distinguishable region. The AUTHORED town bounds
// contain the Grove outright — Grove is 300..650 x -360..-40, the Harthmere town
// core is 392..590 x -282..-112 — because in an unshifted deployment the two are
// deliberately the same connected surface (see the comment on
// `SNAPSHOT_HARTHMERE_LIVE_BOUNDS`: "Connected Harthmere shares the live Grove
// surface"). There is no position that is in authored Harthmere and not in the
// Grove, so there is nothing to disambiguate and nothing to fix: the Grove
// spawn already IS the town spawn in that mode, a short walk away.
//
// Production runs the extension. That is the case the player hit, and it is the
// only one this changes. Keying on the extension bounds alone also means the
// anchor can never come back in the wrong frame — the failure mode where a
// death in the live town teleports you into empty authored space 1,600 blocks
// west, which is the bug in a new costume.

import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_GROVE_LIVE_BOUNDS,
  SNAPSHOT_HARTHMERE_LIVE_BOUNDS,
  SNAPSHOT_HARTHMERE_SHIFTED_LIVE_BOUNDS,
  snapshotPointInBounds,
} from "@/shared/harthmere/snapshot_live_debug";
import { HARTHMERE_ADDITIVE_TOWN_OFFSET_X } from "@/shared/harthmere/world_extension";
import { HARTHMERE_GROVE_RESPAWN_POSITION } from "@/shared/harthmere/harthmere_native_vitals";
import { SNAPSHOT_GROVE_NPC_FEET_Y } from "@/shared/harthmere/snapshot_grove_content";

export const HARTHMERE_RESPAWN_ANCHORS_VERSION =
  "harthmere-region-respawn-anchors-v1" as const;

/**
 * Temple Green, on the chapel's own green rather than inside the building.
 *
 * The chapel building occupies authored 466..494 x -150..-128 and Brother
 * Vance's cottage 438..458 x -148..-130; the apothecary is further north at
 * -184..-168. This sits at -160, on the open green between the chapel's north
 * face and the apothecary, inside the Temple Green district (440..500,
 * -180..-120) and clear of all three. Feet plane, not ground plane — a respawn
 * at ground Y drops the player inside the cap. Every one of those clearances is
 * asserted, so moving a building fails the test rather than burying a player.
 */
export const HARTHMERE_CHAPEL_RESPAWN_AUTHORED_POSITION: Vec3 = [
  470,
  SNAPSHOT_GROVE_NPC_FEET_Y,
  -160,
];

export type HarthmereRespawnRegion = "harthmere_extension" | "grove";

export interface HarthmereRespawnResolution {
  region: HarthmereRespawnRegion;
  position: Vec3;
  /** Why this anchor was chosen. Surfaced in logs, not in client copy. */
  reason: string;
}

/** The chapel anchor in the additive east extension frame. */
export function harthmereShiftedChapelRespawnPosition(
  offsetX = HARTHMERE_ADDITIVE_TOWN_OFFSET_X
): Vec3 {
  const [x, y, z] = HARTHMERE_CHAPEL_RESPAWN_AUTHORED_POSITION;
  return [x + offsetX, y, z];
}

/**
 * Which Harthmere frame, if either, contains this position.
 *
 * Deliberately reuses the same bounds `snapshotAreaForPosition` uses, so "am I
 * in Harthmere" has one definition across diagnostics, the HUD and respawn.
 */
export function harthmereRespawnRegionForPosition(
  position: ReadonlyVec3 | undefined
): HarthmereRespawnRegion {
  if (!position) {
    return "grove";
  }
  // The Grove is tested first even though the two sets are disjoint in the
  // extension deployment, so that an unshifted world — where the Grove sits
  // inside the authored Harthmere envelope — can never be reclassified.
  if (snapshotPointInBounds(position, SNAPSHOT_GROVE_LIVE_BOUNDS)) {
    return "grove";
  }
  if (snapshotPointInBounds(position, SNAPSHOT_HARTHMERE_SHIFTED_LIVE_BOUNDS)) {
    return "harthmere_extension";
  }
  return "grove";
}

/**
 * THE resolver. Where a player who died at `deathPosition` should wake up.
 *
 * Chapter 1 dungeon deaths never reach this — `warpHomeEvent` resolves an
 * Elsewhen arrival slot first, and must keep doing so, because a dungeon is
 * not in either Harthmere frame and would otherwise fall through to the Grove.
 */
export function harthmereRespawnPositionForDeath(
  deathPosition: ReadonlyVec3 | undefined
): HarthmereRespawnResolution {
  const region = harthmereRespawnRegionForPosition(deathPosition);
  if (region === "harthmere_extension") {
    return {
      region,
      position: harthmereShiftedChapelRespawnPosition(),
      reason: "died inside Harthmere; waking on Temple Green",
    };
  }
  return {
    region,
    position: [...HARTHMERE_GROVE_RESPAWN_POSITION] as Vec3,
    reason: "died outside Harthmere; the Grove spawn is unchanged",
  };
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export function validateHarthmereRespawnAnchors(): {
  ok: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  const authored = HARTHMERE_CHAPEL_RESPAWN_AUTHORED_POSITION;
  if (!snapshotPointInBounds(authored, SNAPSHOT_HARTHMERE_LIVE_BOUNDS)) {
    failures.push("the chapel anchor is outside the authored town bounds");
  }
  const shifted = harthmereShiftedChapelRespawnPosition();
  if (!snapshotPointInBounds(shifted, SNAPSHOT_HARTHMERE_SHIFTED_LIVE_BOUNDS)) {
    failures.push("the shifted chapel anchor is outside the extension bounds");
  }
  // A respawn anchor that resolves to a different region than it sits in would
  // bounce the player between settlements forever.
  if (
    harthmereRespawnPositionForDeath(shifted).region !== "harthmere_extension"
  ) {
    failures.push("the extension anchor does not resolve back to Harthmere");
  }
  if (
    harthmereRespawnPositionForDeath(HARTHMERE_GROVE_RESPAWN_POSITION)
      .region !== "grove"
  ) {
    failures.push("the Grove spawn no longer resolves to the Grove");
  }
  return { ok: failures.length === 0, failures };
}
