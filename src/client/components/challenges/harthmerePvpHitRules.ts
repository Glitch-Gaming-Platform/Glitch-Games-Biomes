// HARTHMERE_PVP_DAMAGE_V1
// Pure, DOM-free decision logic for player-vs-player melee in the Harthmere mod.
//
// Design: vanilla Biomes already has a complete, server-authoritative networked
// damage path for players (UpdatePlayerHealthEvent -> updatePlayerHealthEventHandler
// -> ECS health). Rather than invent a fragile client-local RPC, the Harthmere
// left-mouse swing reuses that path: it picks the other players inside the swing
// arc here, and the caller fires UpdatePlayerHealthEvent for each. The victim's
// client then mirrors the authoritative ECS-health drop back onto the Harthmere
// HUD (which renders a separate localStorage HP) via harthmereIncomingExternalAttackV1.
//
// All geometry/threshold logic lives here so every branch is unit-tested without
// a renderer, ECS table, or network.
import type { BiomesId } from "@/shared/ids";

export interface HarthmerePvpCandidatePlayerV1 {
  id: BiomesId;
  // World X/Z (the swing is resolved on the ground plane, like the NPC arc).
  pos: [number, number];
}

function normalize2(v: [number, number]): [number, number] | undefined {
  const length = Math.hypot(v[0], v[1]);
  if (!Number.isFinite(length) || length <= 1e-6) {
    return undefined;
  }
  return [v[0] / length, v[1] / length];
}

// Players inside the forward swing: within `range` of the attacker AND either
// inside the arc (facing cone) or in close body contact. Mirrors the NPC arc's
// acceptance shape so a swing that hits a creature also hits a player standing in
// the same spot. Generous-but-bounded so it never silently drops a fair hit.
export function harthmerePvpPlayersInArcV1(input: {
  origin: [number, number];
  forward: [number, number];
  players: ReadonlyArray<HarthmerePvpCandidatePlayerV1>;
  range: number;
  cosHalfAngle: number;
  closeContactRadius?: number;
}): BiomesId[] {
  const forward = normalize2(input.forward) ?? [0, -1];
  const closeContactRadius = input.closeContactRadius ?? 1.85;
  const hits: BiomesId[] = [];
  for (const player of input.players) {
    const dx = player.pos[0] - input.origin[0];
    const dz = player.pos[1] - input.origin[1];
    const distance = Math.hypot(dx, dz);
    if (!Number.isFinite(distance) || distance <= 1e-3) {
      // Exactly on top of the attacker — count as a contact hit.
      hits.push(player.id);
      continue;
    }
    if (distance > input.range) {
      continue;
    }
    const dot = (dx / distance) * forward[0] + (dz / distance) * forward[1];
    const withinArc = dot >= input.cosHalfAngle;
    const closeBodyContact = distance <= closeContactRadius && dot >= -0.2;
    if (withinArc || closeBodyContact) {
      hits.push(player.id);
    }
  }
  return hits;
}

// Damage a player's basic Harthmere swing deals to another player. Derived from
// the attacker's combat attack stat, clamped so an un-statted player still lands
// a meaningful hit and a high-attack player can't one-shot.
export function harthmerePvpBasicDamageV1(attackPoints: number): number {
  const base = Number.isFinite(attackPoints) ? Math.max(0, attackPoints) : 0;
  return Math.round(Math.min(120, Math.max(10, 10 + base * 0.45)));
}

// Victim side: given the local player's ECS health snapshot, decide whether it
// reflects a NEW external attack (by another player) that we should mirror onto
// the Harthmere HUD. Returns the damage to apply, or undefined to ignore (our own
// hits, non-attack damage, stale/already-processed events, non-decreasing hp).
export function harthmereIncomingExternalAttackV1(input: {
  localPlayerId: BiomesId;
  damageSourceKind: string | undefined;
  attacker: BiomesId | undefined;
  lastDamageAmount: number | undefined;
  lastDamageTime: number | undefined;
  alreadyProcessedTime: number | undefined;
}): { damage: number; attacker: BiomesId } | undefined {
  if (input.damageSourceKind !== "attack") {
    return undefined;
  }
  if (input.attacker === undefined || input.attacker === input.localPlayerId) {
    return undefined;
  }
  const time = input.lastDamageTime;
  if (time === undefined || !Number.isFinite(time)) {
    return undefined;
  }
  if (
    input.alreadyProcessedTime !== undefined &&
    time <= input.alreadyProcessedTime
  ) {
    return undefined;
  }
  const amount = Number(input.lastDamageAmount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }
  return { damage: Math.round(amount), attacker: input.attacker };
}
