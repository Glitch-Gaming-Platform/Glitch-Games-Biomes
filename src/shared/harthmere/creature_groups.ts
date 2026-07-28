// HARTHMERE_CREATURE_GROUPS — the authored membership registry.
//
// `@/shared/npc/creature_group` owns the RULES (who assists whom, responder caps,
// stand-down conditions). This file owns the DATA: which specific creatures form
// one encounter.
//
// Membership is derived from the seed set rather than hand-listed, so a future
// authored pack automatically becomes a real group instead of silently falling
// back to proximity behaviour. A seed may declare `groupId` explicitly (the road
// packs do); otherwise its `areaId` names the group, which is exactly how the
// existing guarded-herd, open-Wilds, and scattered families were already
// authored.
//
// The output is written into each creature's `npc_state.creatureGroup` at seed
// time by `live_entity_ecs_seed.ts`. Anima then reads membership straight off the
// entity — no registry import in the hot path, no boot-order coupling, and no
// runtime name matching.

import {
  HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_LOCATIONS,
  HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS,
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS,
  HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_GROUP_LOCATIONS,
  HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_GROUP_LOCATIONS,
  type HarthmereLiveEntityProductionSeed,
} from "@/shared/harthmere/live_entity_production_seed";
import {
  HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS,
  ROAD_GROUP_LEASH_RADIUS,
  isHarthmereRoadGroupAreaId,
} from "@/shared/harthmere/road_to_harthmere_groups";
import { HARTHMERE_NATIVE_BANDIT_SEEDS } from "@/shared/harthmere/bandit_production_seed";
import type { BiomesId } from "@/shared/ids";
import type {
  CreatureAssistFaction,
  CreatureGroupMembership,
  CreatureGroupRole,
} from "@/shared/npc/creature_group";

export const HARTHMERE_CREATURE_GROUPS_VERSION =
  "harthmere-creature-groups-v1" as const;

/**
 * Leash radii per family, in metres. Each is the authored encounter footprint
 * plus engagement slack — the distance inside which members will answer an alert
 * and beyond which the group stands down.
 */
export const GUARDED_HERD_LEASH_RADIUS = 18;
export const OPEN_WILDS_GROUP_LEASH_RADIUS = 20;
export const SCATTERED_GROUP_LEASH_RADIUS = 20;
export const BANDIT_CAMP_LEASH_RADIUS = 22;

/**
 * Bandit areas holding two or more authored bandits are camps, and a camp
 * coordinates. A lone roadside scout stays ungrouped and keeps only its own
 * individual retaliation — one bandit is not a pack.
 */
function banditCampAreaIds(): string[] {
  const counts = new Map<string, number>();
  for (const seed of HARTHMERE_NATIVE_BANDIT_SEEDS) {
    if (seed.lockedInPlace) continue; // prisoners never fight
    counts.set(seed.areaId, (counts.get(seed.areaId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([areaId]) => areaId);
}

const GROUPED_AREA_LEASH: ReadonlyMap<string, number> = new Map([
  ...HARTHMERE_LIVE_ENTITY_GUARDED_WILDLIFE_LOCATIONS.map(
    (location) => [location.areaId, GUARDED_HERD_LEASH_RADIUS] as const
  ),
  ...HARTHMERE_LIVE_ENTITY_OPEN_WILDS_MIXED_GROUP_LOCATIONS.map(
    (location) => [location.areaId, OPEN_WILDS_GROUP_LEASH_RADIUS] as const
  ),
  ...HARTHMERE_LIVE_ENTITY_SCATTERED_MIXED_GROUP_LOCATIONS.map(
    (location) => [location.areaId, SCATTERED_GROUP_LEASH_RADIUS] as const
  ),
  ...HARTHMERE_ROAD_TO_HARTHMERE_GROUP_ANCHORS.map(
    (anchor) => [anchor.areaId, ROAD_GROUP_LEASH_RADIUS] as const
  ),
  ...banditCampAreaIds().map(
    (areaId) => [areaId, BANDIT_CAMP_LEASH_RADIUS] as const
  ),
]);

/**
 * Hexes fight at range and flank; Muckers and Mucklings close to melee; every
 * animal is prey and never joins Muck aggression.
 */
export function creatureGroupRoleForSeed(
  seed: Pick<
    HarthmereLiveEntityProductionSeed,
    "kind" | "combatKind" | "displayName" | "lockedInPlace" | "banditRole"
  >
): CreatureGroupRole {
  // Prisoners are restrained actors, not combatants; treat them as prey so they
  // are never counted toward a responder cap or asked to flank.
  if (seed.lockedInPlace || seed.banditRole === "prisoner") return "prey";
  if (seed.kind === "ambient_livestock") return "prey";
  if (seed.kind === "ambient_bandit") {
    return seed.banditRole === "archer" ? "ranged" : "skirmisher";
  }
  return seed.combatKind === "hex" || /hex/i.test(seed.displayName)
    ? "ranged"
    : "melee";
}

export function creatureAssistFactionForSeed(
  seed: Pick<
    HarthmereLiveEntityProductionSeed,
    "kind" | "lockedInPlace" | "banditRole"
  >
): CreatureAssistFaction {
  if (seed.lockedInPlace || seed.banditRole === "prisoner") return "none";
  switch (seed.kind) {
    case "ambient_muck_monster":
      return "muck";
    case "ambient_livestock":
      return "livestock";
    case "ambient_bandit":
      return "bandit";
    default:
      return "none";
  }
}

/** Group id for a seed: explicit authored id first, then its area. */
export function creatureGroupIdForSeed(
  seed: Pick<HarthmereLiveEntityProductionSeed, "areaId" | "groupId">
): string | undefined {
  if (seed.groupId) return `harthmere:${seed.groupId}`;
  return GROUPED_AREA_LEASH.has(seed.areaId)
    ? `harthmere:${seed.areaId}`
    : undefined;
}

function leashRadiusForSeed(
  seed: Pick<HarthmereLiveEntityProductionSeed, "areaId" | "groupId">
): number {
  if (seed.groupId && isHarthmereRoadGroupAreaId(seed.groupId)) {
    return ROAD_GROUP_LEASH_RADIUS;
  }
  return GROUPED_AREA_LEASH.get(seed.areaId) ?? OPEN_WILDS_GROUP_LEASH_RADIUS;
}

function buildRegistry(): Map<BiomesId, CreatureGroupMembership> {
  const registry = new Map<BiomesId, CreatureGroupMembership>();
  const nextIndex = new Map<string, number>();

  // Monsters first, then animals, so `memberIndex` puts combatants at the front
  // of the responder ordering and prey at the back. Bandit camps are grouped by
  // their own area so a road ambush coordinates without recruiting Muck.
  const ordered: HarthmereLiveEntityProductionSeed[] = [
    ...HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS,
    ...(HARTHMERE_NATIVE_BANDIT_SEEDS as unknown as HarthmereLiveEntityProductionSeed[]),
    ...HARTHMERE_LIVE_ENTITY_LIVESTOCK_SEEDS,
  ];

  for (const seed of ordered) {
    const groupId = creatureGroupIdForSeed(seed);
    if (!groupId) continue;
    const memberIndex = nextIndex.get(groupId) ?? 0;
    nextIndex.set(groupId, memberIndex + 1);
    registry.set(seed.entityId, {
      groupId,
      assistFaction: creatureAssistFactionForSeed(seed),
      role: creatureGroupRoleForSeed(seed),
      leashRadius: leashRadiusForSeed(seed),
      memberIndex,
    });
  }
  return registry;
}

let cachedRegistry: Map<BiomesId, CreatureGroupMembership> | undefined;

function registry(): Map<BiomesId, CreatureGroupMembership> {
  return (cachedRegistry ??= buildRegistry());
}

/** Authored membership for one entity, or `undefined` if it is not in a group. */
export function harthmereCreatureGroupForEntity(
  entityId: BiomesId
): CreatureGroupMembership | undefined {
  return registry().get(entityId);
}

/** Membership derived directly from a seed, for the ECS seeder. */
export function harthmereCreatureGroupForSeed(
  seed: HarthmereLiveEntityProductionSeed
): CreatureGroupMembership | undefined {
  return harthmereCreatureGroupForEntity(seed.entityId);
}

/** Every authored group id currently in the world. */
export function harthmereCreatureGroupIds(): string[] {
  return [...new Set([...registry().values()].map((entry) => entry.groupId))].sort();
}

/** Every member of one group, in authored order. */
export function harthmereCreatureGroupMembers(
  groupId: string
): Array<{ entityId: BiomesId; membership: CreatureGroupMembership }> {
  return [...registry().entries()]
    .filter(([, membership]) => membership.groupId === groupId)
    .map(([entityId, membership]) => ({ entityId, membership }))
    .sort((a, b) => a.membership.memberIndex - b.membership.memberIndex);
}

export interface CreatureGroupValidationError {
  groupId: string;
  error: string;
}

/**
 * Structural checks that every authored group is coherent. Run from tests and
 * from the seed validation gate.
 */
export function validateHarthmereCreatureGroups(): CreatureGroupValidationError[] {
  const errors: CreatureGroupValidationError[] = [];
  for (const groupId of harthmereCreatureGroupIds()) {
    const members = harthmereCreatureGroupMembers(groupId);
    if (members.length < 2) {
      errors.push({ groupId, error: "group_has_fewer_than_two_members" });
    }
    const indices = members.map((member) => member.membership.memberIndex);
    if (new Set(indices).size !== indices.length) {
      errors.push({ groupId, error: "duplicate_member_index" });
    }
    const leashes = new Set(
      members.map((member) => member.membership.leashRadius)
    );
    if (leashes.size > 1) {
      // A group with two different leash radii would stand down inconsistently.
      errors.push({ groupId, error: "inconsistent_leash_radius" });
    }
    if (
      !members.some((member) =>
        ["muck", "bandit"].includes(member.membership.assistFaction)
      )
    ) {
      errors.push({ groupId, error: "group_has_no_combatant" });
    }
  }
  return errors;
}
