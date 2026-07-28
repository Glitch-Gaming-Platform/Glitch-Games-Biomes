import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import { HARTHMERE_REMAINING_NPCS } from "@/shared/harthmere/npc_compendium";
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE } from "@/shared/harthmere/snapshot_grove_content";
import { HARTHMERE_EXTENSION_FEET_Y } from "@/shared/harthmere/world_extension";
import type { BiomesId } from "@/shared/ids";
import type { Vec2, Vec3 } from "@/shared/math/types";

export const HARTHMERE_NATIVE_BANDIT_SEED_VERSION =
  "harthmere-native-bandit-ecs-anima-v2-ch1-id-remap" as const;

// 10500..10599 belongs to Chapter 1. A late bandit pass accidentally reused
// 10501..10505 and let Anima turn Lou, Cressa, Rook, Sorrel, and Iris back into
// ambient bandits after the Chapter 1 seeder wrote them. Road groups end at
// 10868, so 10901..10905 is the next clear authored band.
export const HARTHMERE_NATIVE_BANDIT_REMAP_FIRST_OFFSET = 10901;

export type HarthmereBanditRole =
  | "scout"
  | "archer"
  | "skirmisher"
  | "brute"
  | "captain"
  | "prisoner";

export type HarthmereBanditProductionSeed = {
  seedId: string;
  kind: "ambient_bandit";
  entityId: BiomesId;
  idOffset: number;
  displayName: string;
  areaId: string;
  areaLabel: string;
  position: Vec3;
  orientation: Vec2;
  dialog: string;
  description: string;
  combatLevel: number;
  combatHp: number;
  attackDamage: number;
  killXp: number;
  banditRole: HarthmereBanditRole;
  lockedInPlace?: boolean;
};

function entityIdFromOffset(idOffset: number) {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + idOffset) as BiomesId;
}

function banditRoleForName(name: string): HarthmereBanditRole {
  const text = name.toLowerCase();
  if (/prisoner|captured/.test(text)) return "prisoner";
  if (/captain|quartermaster|liaison/.test(text)) return "captain";
  if (/brute|bruiser|wagon raider/.test(text)) return "brute";
  if (/archer/.test(text)) return "archer";
  if (/knife|ambusher|trapper|snare/.test(text)) return "skirmisher";
  return "scout";
}

function banditStats(role: HarthmereBanditRole) {
  return {
    scout: {
      combatLevel: 6,
      combatHp: 220,
      attackDamage: 26,
      killXp: 97,
    },
    archer: {
      combatLevel: 7,
      combatHp: 210,
      attackDamage: 30,
      killXp: 109,
    },
    skirmisher: {
      combatLevel: 8,
      combatHp: 260,
      attackDamage: 34,
      killXp: 121,
    },
    brute: {
      combatLevel: 9,
      combatHp: 380,
      attackDamage: 46,
      killXp: 133,
    },
    captain: {
      combatLevel: 10,
      combatHp: 460,
      attackDamage: 54,
      killXp: 145,
    },
    prisoner: {
      combatLevel: 3,
      combatHp: 120,
      attackDamage: 8,
      killXp: 0,
    },
  }[role];
}

function banditSeed(input: {
  idOffset: number;
  seedId: string;
  displayName: string;
  areaId: string;
  areaLabel: string;
  position: Vec3;
  orientation: Vec2;
  lockedInPlace?: boolean;
}): HarthmereBanditProductionSeed {
  const role = banditRoleForName(input.displayName);
  const stats = banditStats(role);
  return {
    seedId: input.seedId,
    kind: "ambient_bandit",
    entityId: entityIdFromOffset(input.idOffset),
    idOffset: input.idOffset,
    displayName: input.displayName,
    areaId: input.areaId,
    areaLabel: input.areaLabel,
    position: input.position,
    orientation: input.orientation,
    dialog: "Keep walking. This road belongs to us tonight.",
    description: `${input.displayName}, a native bandit threat patrolling ${input.areaLabel}.`,
    ...stats,
    banditRole: role,
    lockedInPlace: input.lockedInPlace,
  };
}

const AUTHORED_BANDIT_SEEDS: HarthmereBanditProductionSeed[] = [
  banditSeed({
    idOffset: 9003,
    seedId: "bandit-road-scout",
    displayName: "Road Bandit Scout",
    areaId: "mill_road",
    areaLabel: "Mill Road",
    position: [421, 53, -392],
    orientation: [0, -Math.PI / 2],
  }),
  banditSeed({
    idOffset: 9005,
    seedId: "bandit-wilds-ambusher",
    displayName: "Wilds Bandit Ambusher",
    areaId: "northwest_bandit_ridge",
    areaLabel: "Northwest Bandit Ridge",
    position: [112, 53, -715],
    orientation: [0, -Math.PI / 2],
  }),
  banditSeed({
    idOffset: 9013,
    seedId: "bandit-old-wood-trapper",
    displayName: "Bandit Trapper",
    areaId: "west_old_wood",
    areaLabel: "West Old Wood",
    position: [245, 53, -640],
    orientation: [0, Math.PI],
  }),
  banditSeed({
    idOffset: HARTHMERE_NATIVE_BANDIT_REMAP_FIRST_OFFSET,
    seedId: "bandit-connector-road-scout",
    displayName: "Connector Road Bandit Scout",
    areaId: "snapshot_edge_road",
    areaLabel: "Snapshot Edge Road",
    position: [254, 53, -232],
    orientation: [0, -Math.PI / 2],
  }),
  banditSeed({
    idOffset: HARTHMERE_NATIVE_BANDIT_REMAP_FIRST_OFFSET + 1,
    seedId: "bandit-watchtower-ridge-scout",
    displayName: "Watchtower Ridge Scout",
    areaId: "northwest_watchtower_ridge",
    areaLabel: "Northwest Watchtower Ridge",
    position: [155, 53, -610],
    orientation: [0, -Math.PI / 2],
  }),
  banditSeed({
    idOffset: HARTHMERE_NATIVE_BANDIT_REMAP_FIRST_OFFSET + 2,
    seedId: "bandit-watchtower-ridge-bruiser",
    displayName: "Watchtower Ridge Bruiser",
    areaId: "northwest_watchtower_ridge",
    areaLabel: "Northwest Watchtower Ridge",
    position: [188, 53, -640],
    orientation: [0, Math.PI / 2],
  }),
  banditSeed({
    idOffset: HARTHMERE_NATIVE_BANDIT_REMAP_FIRST_OFFSET + 3,
    seedId: "bandit-briarfen-road-thief",
    displayName: "Briarfen Road Thief",
    areaId: "east_briarfen_wood",
    areaLabel: "East Briarfen Wood",
    position: [870, 53, -385],
    orientation: [0, Math.PI / 2],
  }),
  banditSeed({
    idOffset: HARTHMERE_NATIVE_BANDIT_REMAP_FIRST_OFFSET + 4,
    seedId: "bandit-guard-yard-prisoner",
    displayName: "Captured Bandit Prisoner",
    areaId: "guard_yard_prisoner_cage",
    areaLabel: "Guard Yard",
    position: shiftHarthmereAuthoredPositionToWorld([
      503.8,
      HARTHMERE_EXTENSION_FEET_Y,
      -275.6,
    ]),
    orientation: [0, Math.PI],
    lockedInPlace: true,
  }),
];

const COMPENDIUM_BANDIT_SEEDS: HarthmereBanditProductionSeed[] =
  HARTHMERE_REMAINING_NPCS.filter(
    (npc) => npc.category === "bandit_type"
  ).map((npc) =>
    banditSeed({
      idOffset: npc.combatOffset,
      seedId: `bandit-compendium-${npc.id}`,
      displayName: npc.name,
      areaId: "watchtower_ridge_bandit_camp",
      areaLabel: npc.district,
      position: [npc.spawn.x, 53, npc.spawn.z],
      orientation: [0, npc.spawn.rot],
    })
  );

export const HARTHMERE_NATIVE_BANDIT_SEEDS = [
  ...AUTHORED_BANDIT_SEEDS,
  ...COMPENDIUM_BANDIT_SEEDS,
] as const;

export function harthmereNativeBanditSeedIds() {
  return HARTHMERE_NATIVE_BANDIT_SEEDS.map((seed) => seed.entityId);
}
