// SNAPSHOT_RUNTIME_RULES
// Shared, reusable snapshot-porting rules for content that came from the
// imported Biomes snapshot. Keep this file free of React/client/server-only
// dependencies so server seeders, HUDs, map metadata, tests, and future titles
// can all read the same source of truth.

import type { BiomesId } from "@/shared/ids";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_GROVE_NPC_FEET_Y,
  snapshotGroveGroundedPosition,
} from "@/shared/harthmere/snapshot_grove_content";

export const SNAPSHOT_RUNTIME_RULES_VERSION =
  "snapshot-runtime-combat-muck-port";

export const SNAPSHOT_PORT_SOURCE_VISIBLE =
  "snapshot-source-visible-nux-combat-muck-systems";

export type SnapshotRuntimeContentKind =
  | "challenge"
  | "combat"
  | "muck"
  | "map"
  | "dialogue"
  | "reward"
  | "tooling";

export interface SnapshotPortCoverage {
  key: string;
  kind: SnapshotRuntimeContentKind;
  source: "snapshot_source" | "snapshot_static" | "glitch_authored_bridge";
  status: "ported" | "bridged" | "needs_bikkie_export";
  implementation: string[];
  notes: string;
}

export const SNAPSHOT_PORT_COVERAGE: SnapshotPortCoverage[] = [
  {
    key: "road_ahead_nux_chain",
    kind: "challenge",
    source: "snapshot_source",
    status: "bridged",
    implementation: [
      "src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx",
      "src/shared/harthmere/snapshot_runtime_rules.ts",
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
  {
    key: "grove_bible_content",
    kind: "challenge",
    source: "glitch_authored_bridge",
    status: "ported",
    implementation: [
      "src/shared/harthmere/snapshot_grove_content.ts",
      "src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx",
      "src/pages/api/world_map/landmarks.ts",
      "src/server/shim/main.ts",
    ],
    notes:
      "The Grove bible NPCs, 15 subquests, grounded positions, dialogue lines, map landmarks, and player-builder style presets are canonical shared data. Grove positions intentionally do not receive the Harthmere +512 town offset.",
  },
];

export interface SnapshotArea {
  id: string;
  label: string;
  authoredCenter: Vec3;
  radius: number;
  type: "safe" | "danger" | "muck" | "resource";
  mapLabel: string;
  description: string;
}

export const SNAPSHOT_SAFE_AREAS: SnapshotArea[] = [
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
    description:
      "Town services, quest givers, and civilians. Hostiles stay outside.",
  },
  {
    id: "harthmere_west_road_safe",
    label: "Road to Harthmere",
    authoredCenter: [256, 54, -209],
    radius: 38,
    type: "safe",
    mapLabel: "Road to Harthmere",
    description:
      "Readable road connector from snapshot edge to Harthmere west gate.",
  },
];

export const SNAPSHOT_DANGER_AREAS: SnapshotArea[] = [
  {
    id: "watchtower_muck_clearing",
    label: "Watchtower Muck Clearing",
    authoredCenter: [332, 54, -390],
    radius: 34,
    type: "danger",
    mapLabel: "Muck Clearing",
    description:
      "Low-risk first combat pocket for Road Ahead follow-up lessons.",
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

export const SNAPSHOT_HARTHMERE_MUCK_ZONES: SnapshotArea[] = [
  {
    id: "road_muckwad_patch",
    label: "Road Muckwad Patch",
    authoredCenter: [512, 54, -152],
    radius: 10,
    type: "muck",
    mapLabel: "Muckwad Patch",
    description:
      "Starter muck patch used by Road Ahead and Muck Buster training.",
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

export interface SnapshotHostileSpawn {
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

export const SNAPSHOT_HARTHMERE_HOSTILE_NPC_ID_OFFSET_BASE = 9200;

export const SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS: SnapshotHostileSpawn[] = [
  {
    idOffset: 9201,
    key: "road_muckling_one",
    displayName: "Watchtower Muckling",
    authoredPosition: [320, 53, -384],
    areaId: "watchtower_muck_clearing",
    profile: "muckling",
    leashRadius: 24,
    reward: "Muckling cleared. +25 XP.",
    defaultDialog: "<text>I gurgle beneath the abandoned watchtower.</text>",
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
    defaultDialog: "<text>I drag myself out of the corrupted grass.</text>",
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
    defaultDialog: "<text>I am old wood watching you through the muck.</text>",
  },
];

export interface SnapshotCombatChallengeStep {
  id: string;
  title: string;
  objective: string;
  targetLabel: string;
  targetPosition: Vec3;
  trigger:
    | "location"
    | "damage_hostile"
    | "defeat_hostile"
    | "destroy_muck"
    | "craft_muck_buster";
  radius?: number;
  reward: string;
  mapHint: string;
}

export const SNAPSHOT_COMBAT_PRIMER_ID = "snapshot_wilds_combat_primer";

export const SNAPSHOT_COMBAT_PRIMER_STEPS: SnapshotCombatChallengeStep[] = [
  {
    id: "reach_muck_clearing",
    title: "Reach a Muck Clearing",
    objective:
      "Follow the marker to the watchtower muck clearing outside the Grove.",
    targetLabel: "Muck Clearing",
    targetPosition: [320, 54, -384],
    trigger: "location",
    radius: 12,
    reward: "Danger-zone awareness. +25 XP.",
    mapHint: "Leave the safe road only when you are ready to fight or retreat.",
  },
  {
    id: "strike_hostile",
    title: "Strike a Hostile",
    objective: "Hit a muckling or mucker with your equipped weapon.",
    targetLabel: "Watchtower Muckling",
    targetPosition: [320, 54, -384],
    trigger: "damage_hostile",
    reward: "First hostile hit. +25 XP.",
    mapHint:
      "Draw your weapon, face the target, and attack from the front arc.",
  },
  {
    id: "defeat_hostile",
    title: "Defeat a Hostile",
    objective: "Defeat one muckling or mucker and survive the counterattack.",
    targetLabel: "Watchtower Muckling",
    targetPosition: [320, 54, -384],
    trigger: "defeat_hostile",
    reward: "First threat defeated. +50 XP.",
    mapHint:
      "The hostile has real health. Back up if you take too much damage.",
  },
  {
    id: "clear_muck",
    title: "Clear the Muck",
    objective: "Break or clear muck terrain near the road.",
    targetLabel: "Muckwad Patch",
    targetPosition: [512, 54, -152],
    trigger: "destroy_muck",
    reward: "Muck cleared. +35 XP.",
    mapHint:
      "Use block breaking or a Muck Buster-compatible tool on the marked patch.",
  },
  {
    id: "carry_muck_buster",
    title: "Carry a Muck Buster",
    objective: "Craft, obtain, or carry an item that can clear muck.",
    targetLabel: "Crafting Stop",
    targetPosition: [494, 54, -213],
    trigger: "craft_muck_buster",
    reward: "Muck Buster ready. +50 XP.",
    mapHint:
      "The inventory check completes when you have an item with unmuck capability.",
  },
];

export function distance2DToSnapshotArea(
  pos: ReadonlyVec3,
  area: SnapshotArea
) {
  return Math.hypot(
    pos[0] - area.authoredCenter[0],
    pos[2] - area.authoredCenter[2]
  );
}

export function isAuthoredPointInSnapshotArea(
  pos: ReadonlyVec3,
  area: SnapshotArea,
  pad = 0
) {
  return distance2DToSnapshotArea(pos, area) <= area.radius + pad;
}

export function authoredSnapshotAreaForPoint(
  pos: ReadonlyVec3,
  areas: readonly SnapshotArea[],
  pad = 0
) {
  return areas.find((area) => isAuthoredPointInSnapshotArea(pos, area, pad));
}

export function isAuthoredPointInSnapshotSafeZone(pos: ReadonlyVec3, pad = 0) {
  return Boolean(authoredSnapshotAreaForPoint(pos, SNAPSHOT_SAFE_AREAS, pad));
}

export function isAuthoredPointInSnapshotMuckZone(pos: ReadonlyVec3, pad = 0) {
  return Boolean(
    authoredSnapshotAreaForPoint(pos, SNAPSHOT_HARTHMERE_MUCK_ZONES, pad)
  );
}

export function shiftSnapshotAuthoredPointToWorld(pos: ReadonlyVec3): Vec3 {
  // SNAPSHOT_GROVE_NO_HARTHMERE_OFFSET:
  // Snapshot/Grove civic content is already in the snapshot world. Only
  // Harthmere authored town content receives the additive connected-town shift.
  // Applying the Harthmere transform here is what made Grove NPCs/markers
  // appear displaced. Civic Grove NPCs still use the live courtyard grounding
  // helper because the visible fountain/courtyard sits around y=69/70.
  return snapshotGroveGroundedPosition([pos[0], pos[1], pos[2]]);
}

export const SNAPSHOT_COMBAT_MUCKER_GROUNDING_VERSION =
  "snapshot-combat-mucker-grounding" as const;

export function snapshotCombatGroundedPosition(pos: ReadonlyVec3): Vec3 {
  // Muckers/Hexers use the dMucker/damageable creature biscuit and are seeded
  // in the authored wilds/muck layer, not the raised Grove fountain courtyard.
  // Reusing snapshotGroveGroundedPosition here forced every hostile to y=70,
  // which detached their dMucker health/interaction body from the terrain and
  // made the visual model float in the sky. Preserve the authored Y when present
  // and only fall back to the original snapshot NPC feet Y for malformed data.
  const authoredY = Number(pos[1]);
  return [
    pos[0],
    Number.isFinite(authoredY) ? authoredY : SNAPSHOT_GROVE_NPC_FEET_Y,
    pos[2],
  ];
}

export function hostileWorldPosition(spawn: SnapshotHostileSpawn): Vec3 {
  return snapshotCombatGroundedPosition(spawn.authoredPosition);
}

export function combatStepWorldPosition(
  step: SnapshotCombatChallengeStep
): Vec3 {
  return snapshotCombatGroundedPosition(step.targetPosition);
}

export function snapshotHostileEntityId(
  localDevNpcBase: BiomesId,
  spawn: SnapshotHostileSpawn
): BiomesId {
  return (Number(localDevNpcBase) + spawn.idOffset) as BiomesId;
}
