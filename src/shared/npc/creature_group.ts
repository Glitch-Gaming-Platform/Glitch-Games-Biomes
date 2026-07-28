// HARTHMERE_CREATURE_GROUPS
//
// Explicit group identity and coordinated assistance, replacing the
// proximity-plus-name inference in `chase_attack.ts`.
//
// What the old system did
// -----------------------
// `evaluateMixedCreatureGroupRetaliationTarget` decided "are we in the same pack?"
// by asking three questions at runtime: are you within 18 m horizontally, within
// 10 m vertically, and does your LABEL match a Mucker/Hex/cow/sheep/rabbit regex.
// That has four failure modes, all of them visible in play:
//
//   1. No group identity. Two unrelated encounters that happen to overlap assist
//      each other, so one aggressive pull can cascade into a swarm.
//   2. The same brittle terrain line-of-sight test that broke target retention on
//      hills also gates the alert, so authored pack members fail to help each
//      other over a one-block crest — precisely the terrain in the July 27 HAR.
//   3. Livestock joins Muck combat by default because "cow" is in the regex.
//   4. Every hostile NPC scans every nearby NPC every tick. In the Watchtower
//      region (32 monsters + 11 livestock) that is quadratic.
//
// What this does instead
// ----------------------
// Membership is DATA, resolved by entity id against an authored registry
// (`@/shared/harthmere/creature_groups`) with an optional per-entity override in
// `npc_state`. Assistance is an explicit faction decision, not a name match. A
// brief hill occlusion cannot suppress an alert, because members of a group know
// they are members. A hard responder cap stops six monsters from landing
// simultaneous attacks on a 140 HP player.
//
// Everything here is pure; `chase_attack.ts` supplies the world observations.

import type { BiomesId } from "@/shared/ids";
import type { ReadonlyVec3 } from "@/shared/math/types";
import { unpack } from "msgpackr";
import { z } from "zod";

export const HARTHMERE_CREATURE_GROUP_VERSION =
  "harthmere-creature-group-v1" as const;

/**
 * Who a creature will fight alongside.
 *
 * - `muck`      — Muckers, Mucklings, Hexes. Assists other `muck` members.
 * - `bandit`    — human outlaws. Assists other `bandit` members.
 * - `livestock` — cows, sheep, rabbits. Deliberately does NOT join Muck
 *   aggression. Its members flee a group alert and retain only their own
 *   individual retaliation, which is what an animal actually does.
 * - `none`      — in a group for encounter bookkeeping only; never assists.
 */
export type CreatureAssistFaction = "muck" | "bandit" | "livestock" | "none";

/** Combat role inside a group. Drives approach, not raw stats. */
export type CreatureGroupRole = "melee" | "ranged" | "skirmisher" | "prey";

export interface CreatureGroupMembership {
  groupId: string;
  assistFaction: CreatureAssistFaction;
  role: CreatureGroupRole;
  /**
   * Radius around the group anchor inside which members are considered part of
   * the same encounter. Alerts do not travel outside it and are cleared when the
   * attacker leaves it.
   */
  leashRadius: number;
  /** Stable authored ordering, used to make responder ranking deterministic. */
  memberIndex: number;
}

export const zCreatureGroupComponent = z.object({
  creatureGroup: z
    .object({
      groupId: z.string().min(1).max(96),
      assistFaction: z.enum(["muck", "bandit", "livestock", "none"]),
      role: z.enum(["melee", "ranged", "skirmisher", "prey"]),
      leashRadius: z.number().positive().max(256),
      memberIndex: z.number().int().nonnegative(),
    })
    .optional(),
  groupAlert: z
    .object({
      groupId: z.string().min(1).max(96),
      attackerId: z.number(),
      sourcePosition: z.tuple([z.number(), z.number(), z.number()]),
      raisedAtSeconds: z.number(),
      expiresAtSeconds: z.number(),
      /** Deterministic responder rank at the moment the alert was adopted. */
      responderRank: z.number().int().nonnegative().optional(),
    })
    .optional(),
});
export type CreatureGroupComponent = z.infer<typeof zCreatureGroupComponent>;

const zMembershipOnly = zCreatureGroupComponent.shape.creatureGroup;

/**
 * Reads ONLY the group membership out of a serialized `npc_state` blob.
 *
 * Deliberately does not go through `@/shared/npc/serde`: that module imports the
 * behaviour schemas (including `chase_attack`), and `chase_attack` is the hot
 * caller here, so routing through it would create an import cycle whose zod
 * `.merge()` chain fails at module-init time. Membership is a tiny, stable field,
 * so a narrow decode is both cheaper and structurally safer.
 *
 * Returns `undefined` for absent, malformed, or ungrouped state; a creature with
 * no membership simply never participates in group assistance.
 */
export function decodeCreatureGroupMembership(
  encoded: Uint8Array | undefined
): CreatureGroupMembership | undefined {
  if (!encoded) return undefined;
  try {
    const raw = unpack(encoded) as { creatureGroup?: unknown } | undefined;
    if (!raw || typeof raw !== "object" || raw.creatureGroup === undefined) {
      return undefined;
    }
    const parsed = zMembershipOnly.safeParse(raw.creatureGroup);
    return parsed.success ? (parsed.data as CreatureGroupMembership) : undefined;
  } catch {
    return undefined;
  }
}

/** Seconds a raised alert stays live before it must be re-evidenced. */
export const GROUP_ALERT_LIFETIME_SECONDS = 20;

/**
 * Members that may be in melee contact with the player at once. Sized directly
 * against native damage: a level 3 Hex deals ~90 and a level 3 Mucker ~80 into a
 * 140 HP player, so three simultaneous connections is already lethal. Everyone
 * else holds until an active slot opens.
 */
export const GROUP_MAX_SIMULTANEOUS_RESPONDERS = 3;
/** Backwards-compatible name retained for callers/tests written during v1. */
export const GROUP_MAX_SIMULTANEOUS_MELEE =
  GROUP_MAX_SIMULTANEOUS_RESPONDERS;

/**
 * Distance quantum used when ranking responders. Bucketing means two members
 * with slightly different views of the same fight still compute the same order,
 * which is what lets each NPC derive the plan locally with no shared bus.
 */
export const GROUP_RESPONDER_DISTANCE_BUCKET_METERS = 4;

export interface GroupAlert {
  groupId: string;
  attackerId: BiomesId;
  sourcePosition: ReadonlyVec3;
  raisedAtSeconds: number;
  expiresAtSeconds: number;
  responderRank?: number;
}

export interface GroupAlertCandidate {
  id: BiomesId;
  position: ReadonlyVec3;
  membership: CreatureGroupMembership | undefined;
  lastDamageSource?: { kind: string; attacker: BiomesId };
  lastDamageTimeSeconds?: number;
  lastDamageAmount?: number;
  alive: boolean;
}

export interface GroupAlertAttacker {
  position: ReadonlyVec3;
  hp: number;
  isPlayer: boolean;
  canBeTargeted: boolean;
}

/** Factions whose members answer a group alert with aggression. */
export function assistFactionJoinsCombat(
  faction: CreatureAssistFaction
): boolean {
  return faction === "muck" || faction === "bandit";
}

/**
 * True when a group alert should make this creature run rather than fight.
 * A directly attacked animal still retaliates — that is its own damage event, not
 * an alert — so this only governs the bystander case.
 */
export function shouldFleeGroupAlert(input: {
  faction: CreatureAssistFaction;
  directlyAttacked: boolean;
}): boolean {
  return !input.directlyAttacked && input.faction === "livestock";
}

export interface EvaluateGroupAlertInput {
  recipientId: BiomesId;
  recipientPosition: ReadonlyVec3;
  recipientMembership: CreatureGroupMembership | undefined;
  candidates: ReadonlyArray<GroupAlertCandidate>;
  lookupAttacker: (id: BiomesId) => GroupAlertAttacker | undefined;
  nowSeconds: number;
  /** How long a damage event stays valid evidence for an alert. */
  memorySeconds: number;
  /** Squared disengage distance; an attacker beyond it cannot be adopted. */
  deAggroDistanceSq: number;
  alertLifetimeSeconds?: number;
}

/**
 * Raises an alert for `recipientId` when a member of its OWN group was recently
 * damaged by a targetable player.
 *
 * Deliberately non-recursive: only real `Health` damage evidence
 * (`lastDamageAmount < 0`) raises an alert, never another creature's alert state.
 * An alerted creature therefore cannot alert a second ring, so one pull cannot
 * cascade across the map.
 *
 * Deliberately not line-of-sight gated: members of an authored pack know they are
 * members. The leash radius, not terrain visibility, is what bounds the alert —
 * this is the direct fix for pack-mates failing to help over a hill crest.
 */
export function evaluateGroupAlert(
  input: EvaluateGroupAlertInput
): GroupAlert | undefined {
  const membership = input.recipientMembership;
  if (!membership || !assistFactionJoinsCombat(membership.assistFaction)) {
    return undefined;
  }
  const leashSq = membership.leashRadius * membership.leashRadius;

  const lifetime = input.alertLifetimeSeconds ?? GROUP_ALERT_LIFETIME_SECONDS;
  let best:
    | {
        attackerId: BiomesId;
        damageTime: number;
        sourceId: BiomesId;
        sourcePosition: ReadonlyVec3;
        distanceSq: number;
      }
    | undefined;

  for (const candidate of input.candidates) {
    if (candidate.id === input.recipientId) continue;
    const candidateMembership = candidate.membership;
    if (
      !candidateMembership ||
      candidateMembership.groupId !== membership.groupId ||
      candidateMembership.assistFaction !== membership.assistFaction ||
      !assistFactionJoinsCombat(candidateMembership.assistFaction)
    ) {
      // Explicit identity: two unrelated packs standing in the same clearing no
      // longer merge into one swarm.
      continue;
    }
    if (
      candidate.lastDamageSource?.kind !== "attack" ||
      candidate.lastDamageTimeSeconds === undefined ||
      !(candidate.lastDamageAmount !== undefined && candidate.lastDamageAmount < 0)
    ) {
      continue;
    }
    const age = input.nowSeconds - candidate.lastDamageTimeSeconds;
    if (age < 0 || age >= Math.min(input.memorySeconds, lifetime)) continue;

    const dx = candidate.position[0] - input.recipientPosition[0];
    const dz = candidate.position[2] - input.recipientPosition[2];
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq > leashSq) continue;

    const attackerId = candidate.lastDamageSource.attacker;
    const attacker = input.lookupAttacker(attackerId);
    if (
      !attacker?.isPlayer ||
      !attacker.canBeTargeted ||
      attacker.hp <= 0 ||
      squaredDistance(attacker.position, input.recipientPosition) >=
        input.deAggroDistanceSq
    ) {
      continue;
    }

    if (
      !best ||
      candidate.lastDamageTimeSeconds > best.damageTime ||
      (candidate.lastDamageTimeSeconds === best.damageTime &&
        (distanceSq < best.distanceSq ||
          (distanceSq === best.distanceSq && candidate.id < best.sourceId)))
    ) {
      best = {
        attackerId,
        damageTime: candidate.lastDamageTimeSeconds,
        sourceId: candidate.id,
        sourcePosition: candidate.position,
        distanceSq,
      };
    }
  }

  if (!best) return undefined;
  return {
    groupId: membership.groupId,
    attackerId: best.attackerId,
    // Use the damaged member as the encounter-local leash origin. The previous
    // implementation stored the attacker's position and then called it a group
    // anchor, which measured only how far the player moved after the hit.
    sourcePosition: [...best.sourcePosition] as [number, number, number],
    // Alert age is evidence age. Recreating raisedAt=now on every NPC tick kept
    // stagger delays permanently at zero while the same Health damage record was
    // inside the retaliation-memory window.
    raisedAtSeconds: best.damageTime,
    expiresAtSeconds: best.damageTime + lifetime,
  };
}

function squaredDistance(a: ReadonlyVec3, b: ReadonlyVec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

export type GroupResponderMode = "engage" | "flank" | "hold";

export interface GroupResponderPlanMember {
  id: BiomesId;
  role: CreatureGroupRole;
  memberIndex: number;
  distanceToAttacker: number;
  alive: boolean;
}

export interface GroupResponderAssignment {
  id: BiomesId;
  rank: number;
  mode: GroupResponderMode;
  /** Zero for an active slot; infinity while the member must hold. */
  engageDelaySeconds: number;
}

/**
 * Deterministic responder plan for one group alert.
 *
 * Every member computes this locally and finds its own entry, so no shared alert
 * bus is required. Determinism comes from ranking on a QUANTIZED distance plus
 * the authored `memberIndex`: two members with slightly different views of the
 * same fight still agree on the order.
 *
 * - Melee/skirmisher members inside the cap `engage`.
 * - Ranged members (Hexes) inside the cap are tagged `flank`; the current chase
 *   locomotion still owns their physical approach.
 * - `prey` members never participate.
 * - Everyone beyond the cap holds until a live active responder leaves the plan,
 *   then deterministic ranking fills the vacancy.
 */
export function groupResponderPlan(input: {
  members: ReadonlyArray<GroupResponderPlanMember>;
  maxSimultaneousMelee?: number;
  distanceBucketMeters?: number;
}): GroupResponderAssignment[] {
  const bucket = Math.max(
    0.5,
    input.distanceBucketMeters ?? GROUP_RESPONDER_DISTANCE_BUCKET_METERS
  );
  const maxResponders = Math.max(
    1,
    input.maxSimultaneousMelee ?? GROUP_MAX_SIMULTANEOUS_RESPONDERS
  );
  const ordered = input.members
    .filter((member) => member.alive && member.role !== "prey")
    .map((member) => ({
      member,
      distanceBucket: Math.floor(
        Math.max(0, member.distanceToAttacker) / bucket
      ),
    }))
    .sort(
      (a, b) =>
        a.distanceBucket - b.distanceBucket ||
        a.member.memberIndex - b.member.memberIndex ||
        Number(a.member.id) - Number(b.member.id)
    );

  const assignments: GroupResponderAssignment[] = [];
  let activeResponders = 0;
  ordered.forEach(({ member }, rank) => {
    if (activeResponders < maxResponders) {
      activeResponders += 1;
      assignments.push({
        id: member.id,
        rank,
        mode: member.role === "ranged" ? "flank" : "engage",
        engageDelaySeconds: 0,
      });
      return;
    }
    assignments.push({
      id: member.id,
      rank,
      mode: "hold",
      // A finite delay here silently dissolves the cap: once the alert ages past
      // every delay, all overflow members acquire the player simultaneously.
      // Hold until ranking opens a slot.
      engageDelaySeconds: Number.POSITIVE_INFINITY,
    });
  });

  // Members excluded above (dead, or prey) still get an explicit answer so the
  // caller never has to distinguish "not planned" from "told to hold".
  for (const member of input.members) {
    if (!assignments.some((assignment) => assignment.id === member.id)) {
      assignments.push({
        id: member.id,
        rank: Number.MAX_SAFE_INTEGER,
        mode: "hold",
        engageDelaySeconds: Number.POSITIVE_INFINITY,
      });
    }
  }
  return assignments;
}

export interface GroupAlertClearInput {
  alert: GroupAlert | undefined;
  nowSeconds: number;
  attackerAlive: boolean;
  attackerInSafeZone: boolean;
  /** Horizontal distance from the group's leash anchor to the attacker. */
  attackerDistanceFromAnchor: number;
  groupLeashRadius: number;
  /** `false` when navigation reports the attacker cannot be reached at all. */
  attackerReachable?: boolean;
}

export type GroupAlertClearReason =
  | "expired"
  | "attacker_dead"
  | "attacker_safe_zone"
  | "attacker_escaped_leash"
  | "attacker_unreachable";

/**
 * The complete set of reasons a group stands down. Anything not listed keeps the
 * alert live, which is deliberate: the whole point of the redesign is that
 * transient terrain occlusion is NOT a stand-down condition.
 */
export function groupAlertClearReason(
  input: GroupAlertClearInput
): GroupAlertClearReason | undefined {
  if (!input.alert) return undefined;
  if (input.nowSeconds >= input.alert.expiresAtSeconds) return "expired";
  if (!input.attackerAlive) return "attacker_dead";
  if (input.attackerInSafeZone) return "attacker_safe_zone";
  if (input.attackerDistanceFromAnchor > input.groupLeashRadius) {
    return "attacker_escaped_leash";
  }
  if (input.attackerReachable === false) return "attacker_unreachable";
  return undefined;
}
