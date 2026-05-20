// SNAPSHOT_RUNTIME_RULES_V74
// Shared, reusable snapshot-porting rules for content that came from the
// imported Biomes snapshot. Keep this file free of React/client/server-only
// dependencies so server seeders, HUDs, map metadata, tests, and future titles
// can all read the same source of truth.

import type { BiomesId } from "@/shared/ids";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import { shiftHarthmereAuthoredPositionToWorldV71 } from "@/shared/harthmere/coordinate_transform_v71";

export const SNAPSHOT_RUNTIME_RULES_VERSION_V74 =
  "snapshot-runtime-combat-muck-port-v74";

export const SNAPSHOT_PORT_SOURCE_VISIBLE_V74 =
  "snapshot-source-visible-nux-combat-muck-systems-v74";

export type SnapshotRuntimeContentKindV74 =
  | "challenge"
  | "combat"
  | "muck"
  | "map"
  | "dialogue"
  | "reward"
  | "tooling";

export interface SnapshotPortCoverageV74 {
  key: string;
  kind: SnapshotRuntimeContentKindV74;
  source: "snapshot_source" | "snapshot_static" | "glitch_authored_bridge";
  status: "ported" | "bridged" | "needs_bikkie_export";
  implementation: string[];
  notes: string;
}

export const SNAPSHOT_PORT_COVERAGE_V74: SnapshotPortCoverageV74[] = [
  {
    key: "road_ahead_nux_chain",
    kind: "challenge",
    source: "snapshot_source",
    status: "bridged",
    implementation: [
      "src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx",
      "src/shared/harthmere/snapshot_runtime_rules_v74.ts",
    ],
    notes:
      "The source-visible Road Ahead NUX IDs are implemented as a production bridge. Replace/augment with biscuit data once a readable Bikkie challenge export is available.",
  },
  {
    key: "snapshot_combat_runtime",
    kind: "combat",
    source: "snapshot_source",
    status: "ported",
    implementation: [
      "src/server/shim/main.ts",
      "src/client/components/challenges/LocalDevSnapshotCombatRuntime.tsx",
    ],
    notes:
      "Real snapshot-style hostile NPCs are seeded outside safe zones and the client runtime listens to health/combat events for progression.",
  },
  {
    key: "muck_ecosystem",
    kind: "muck",
    source: "snapshot_static",
    status: "ported",
    implementation: [
      "src/server/shim/main.ts",
      "src/client/components/challenges/LocalDevSnapshotCombatRuntime.tsx",
    ],
    notes:
      "Reusable authored muck zones drive terrain painting, map hints, and tutorial/challenge progress.",
  },
  {
    key: "production_dialogue_rules",
    kind: "dialogue",
    source: "glitch_authored_bridge",
    status: "ported",
    implementation: [
      "src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx",
    ],
    notes:
      "NPC dialogue is in-character only. Mission state belongs in HUD/journal, not dialogue text.",
  },
  {
    key: "snapshot_debug_tooling",
    kind: "tooling",
    source: "glitch_authored_bridge",
    status: "ported",
    implementation: [
      "src/client/components/challenges/LocalDevSnapshotCombatRuntime.tsx",
    ],
    notes:
      "Developer-only window helpers can reset or inspect snapshot port state without exposing debug text to players.",
  },
];

export interface SnapshotAreaV74 {
  id: string;
  label: string;
  authoredCenter: Vec3;
  radius: number;
  type: "safe" | "danger" | "muck" | "resource";
  mapLabel: string;
  description: string;
}

export const SNAPSHOT_SAFE_AREAS_V74: SnapshotAreaV74[] = [
  {
    id: "the_grove_safe",
    label: "The Grove",
    authoredCenter: [486, 54, -209],
    radius: 132,
    type: "safe",
    mapLabel: "The Grove",
    description: "Starter Grove safety area. No Harthmere combat spawns here.",
  },
  {
    id: "harthmere_town_core_safe",
    label: "Harthmere Town Core",
    authoredCenter: [492, 54, -205],
    radius: 142,
    type: "safe",
    mapLabel: "Harthmere",
    description: "Town services, quest givers, and civilians. Hostiles stay outside.",
  },
  {
    id: "harthmere_west_road_safe",
    label: "Road to Harthmere",
    authoredCenter: [256, 54, -209],
    radius: 38,
    type: "safe",
    mapLabel: "Road to Harthmere",
    description: "Readable road connector from snapshot edge to Harthmere west gate.",
  },
];

export const SNAPSHOT_DANGER_AREAS_V74: SnapshotAreaV74[] = [
  {
    id: "watchtower_muck_clearing",
    label: "Watchtower Muck Clearing",
    authoredCenter: [332, 54, -390],
    radius: 34,
    type: "danger",
    mapLabel: "Muck Clearing",
    description: "Low-risk first combat pocket for Road Ahead follow-up lessons.",
  },
  {
    id: "old_wood_mucker_copse",
    label: "Old Wood Mucker Copse",
    authoredCenter: [640, 54, -455],
    radius: 48,
    type: "danger",
    mapLabel: "Old Wood Muckers",
    description: "Hostile muckers, larger aggro range, stronger loot table.",
  },
  {
    id: "gravewood_pale_muck",
    label: "Gravewood Pale Muck",
    authoredCenter: [640, 54, 120],
    radius: 42,
    type: "danger",
    mapLabel: "Gravewood Muck",
    description: "Southern danger zone for later combat and gathering loops.",
  },
];

export const SNAPSHOT_HARTHMERE_MUCK_ZONES_V74: SnapshotAreaV74[] = [
  {
    id: "road_muckwad_patch",
    label: "Road Muckwad Patch",
    authoredCenter: [512, 54, -152],
    radius: 10,
    type: "muck",
    mapLabel: "Muckwad Patch",
    description: "Starter muck patch used by Road Ahead and Muck Buster training.",
  },
  {
    id: "watchtower_muck_patch",
    label: "Watchtower Muck Patch",
    authoredCenter: [332, 54, -390],
    radius: 16,
    type: "muck",
    mapLabel: "Muck Clearing",
    description: "First Wilds muck zone attached to real hostile NPCs.",
  },
  {
    id: "old_wood_muck_patch",
    label: "Old Wood Muck Patch",
    authoredCenter: [640, 54, -455],
    radius: 22,
    type: "muck",
    mapLabel: "Old Wood Muck",
    description: "Reusable mid-tier muck field for combat and gathering loops.",
  },
];

export interface SnapshotHostileSpawnV74 {
  idOffset: number;
  key: string;
  displayName: string;
  authoredPosition: Vec3;
  areaId: string;
  profile: "muckling" | "mucker" | "wild_mucker";
  leashRadius: number;
  reward: string;
  defaultDialog: string;
}

export const SNAPSHOT_HARTHMERE_HOSTILE_NPC_ID_OFFSET_BASE_V74 = 9200;

export const SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS_V74: SnapshotHostileSpawnV74[] = [
  {
    idOffset: 9201,
    key: "road_muckling_one",
    displayName: "Road Muckling",
    authoredPosition: [524, 53, -154],
    areaId: "road_muckwad_patch",
    profile: "muckling",
    leashRadius: 24,
    reward: "Muckling cleared. +25 XP.",
    defaultDialog: "<text>The muckling gurgles and claws at the road.</text>",
  },
  {
    idOffset: 9202,
    key: "watchtower_mucker_one",
    displayName: "Watchtower Mucker",
    authoredPosition: [334, 53, -392],
    areaId: "watchtower_muck_clearing",
    profile: "mucker",
    leashRadius: 34,
    reward: "Watchtower threat defeated. +35 XP.",
    defaultDialog: "<text>The mucker drags itself out of the corrupted grass.</text>",
  },
  {
    idOffset: 9203,
    key: "old_wood_mucker_one",
    displayName: "Old Wood Mucker",
    authoredPosition: [644, 53, -456],
    areaId: "old_wood_mucker_copse",
    profile: "wild_mucker",
    leashRadius: 42,
    reward: "Old Wood danger thinned. +45 XP.",
    defaultDialog: "<text>The old wood is already watching you through the muck.</text>",
  },
];

export interface SnapshotCombatChallengeStepV74 {
  id: string;
  title: string;
  objective: string;
  targetLabel: string;
  targetPosition: Vec3;
  trigger: "location" | "damage_hostile" | "defeat_hostile" | "destroy_muck" | "craft_muck_buster";
  radius?: number;
  reward: string;
  mapHint: string;
}

export const SNAPSHOT_COMBAT_PRIMER_ID_V74 = "snapshot_wilds_combat_primer_v74";

export const SNAPSHOT_COMBAT_PRIMER_STEPS_V74: SnapshotCombatChallengeStepV74[] = [
  {
    id: "reach_muck_clearing",
    title: "Reach a Muck Clearing",
    objective: "Follow the marker to the first muck clearing outside the safe road.",
    targetLabel: "Muck Clearing",
    targetPosition: [524, 54, -154],
    trigger: "location",
    radius: 12,
    reward: "Danger-zone awareness. +25 XP.",
    mapHint: "Leave the safe road only when you are ready to fight or retreat.",
  },
  {
    id: "strike_hostile",
    title: "Strike a Hostile",
    objective: "Hit a muckling or mucker with your equipped weapon.",
    targetLabel: "Road Muckling",
    targetPosition: [524, 54, -154],
    trigger: "damage_hostile",
    reward: "First hostile hit. +25 XP.",
    mapHint: "Draw your weapon, face the target, and attack from the front arc.",
  },
  {
    id: "defeat_hostile",
    title: "Defeat a Hostile",
    objective: "Defeat one muckling or mucker and survive the counterattack.",
    targetLabel: "Road Muckling",
    targetPosition: [524, 54, -154],
    trigger: "defeat_hostile",
    reward: "First threat defeated. +50 XP.",
    mapHint: "The hostile has real health. Back up if you take too much damage.",
  },
  {
    id: "clear_muck",
    title: "Clear the Muck",
    objective: "Break or clear muck terrain near the road.",
    targetLabel: "Muckwad Patch",
    targetPosition: [512, 54, -152],
    trigger: "destroy_muck",
    reward: "Muck cleared. +35 XP.",
    mapHint: "Use block breaking or a Muck Buster-compatible tool on the marked patch.",
  },
  {
    id: "carry_muck_buster",
    title: "Carry a Muck Buster",
    objective: "Craft, obtain, or carry an item that can clear muck.",
    targetLabel: "Crafting Stop",
    targetPosition: [494, 54, -213],
    trigger: "craft_muck_buster",
    reward: "Muck Buster ready. +50 XP.",
    mapHint: "The inventory check completes when you have an item with unmuck capability.",
  },
];

export function distance2DToSnapshotAreaV74(
  pos: ReadonlyVec3,
  area: SnapshotAreaV74,
) {
  return Math.hypot(pos[0] - area.authoredCenter[0], pos[2] - area.authoredCenter[2]);
}

export function isAuthoredPointInSnapshotAreaV74(
  pos: ReadonlyVec3,
  area: SnapshotAreaV74,
  pad = 0,
) {
  return distance2DToSnapshotAreaV74(pos, area) <= area.radius + pad;
}

export function authoredSnapshotAreaForPointV74(
  pos: ReadonlyVec3,
  areas: readonly SnapshotAreaV74[],
  pad = 0,
) {
  return areas.find((area) => isAuthoredPointInSnapshotAreaV74(pos, area, pad));
}

export function isAuthoredPointInSnapshotSafeZoneV74(pos: ReadonlyVec3, pad = 0) {
  return Boolean(authoredSnapshotAreaForPointV74(pos, SNAPSHOT_SAFE_AREAS_V74, pad));
}

export function isAuthoredPointInSnapshotMuckZoneV74(pos: ReadonlyVec3, pad = 0) {
  return Boolean(authoredSnapshotAreaForPointV74(pos, SNAPSHOT_HARTHMERE_MUCK_ZONES_V74, pad));
}

export function shiftSnapshotAuthoredPointToWorldV74(pos: ReadonlyVec3): Vec3 {
  return shiftHarthmereAuthoredPositionToWorldV71(pos);
}

export function hostileWorldPositionV74(spawn: SnapshotHostileSpawnV74): Vec3 {
  return shiftSnapshotAuthoredPointToWorldV74(spawn.authoredPosition);
}

export function combatStepWorldPositionV74(step: SnapshotCombatChallengeStepV74): Vec3 {
  return shiftSnapshotAuthoredPointToWorldV74(step.targetPosition);
}

export function snapshotHostileEntityIdV74(localDevNpcBase: BiomesId, spawn: SnapshotHostileSpawnV74): BiomesId {
  return (Number(localDevNpcBase) + spawn.idOffset) as BiomesId;
}
