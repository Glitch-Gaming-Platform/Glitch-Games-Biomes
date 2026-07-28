import { ch1DungeonAuthoredToWorld } from "@/shared/harthmere/ch1_dungeon_terrain";
import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";
import { CH1_NPC_ENTITY_IDS } from "@/shared/harthmere/ch1_ids";

export interface Ch1DungeonEncounterNpc {
  entityId: BiomesId;
  dungeonId: "ch1_dungeon_desert" | "ch1_dungeon_winter";
  encounterId: string;
  objectiveId: string;
  displayName: string;
  position: Vec3;
  maxHp: number;
}

const BASE = 8_810_000_003_000_000;
const encounter = (
  offset: number,
  dungeonId: Ch1DungeonEncounterNpc["dungeonId"],
  encounterId: string,
  objectiveId: string,
  displayName: string,
  local: { x: number; y: number; z: number },
  maxHp: number
): Ch1DungeonEncounterNpc => ({
  entityId: (BASE + offset) as BiomesId,
  dungeonId,
  encounterId,
  objectiveId,
  displayName,
  position: ch1DungeonAuthoredToWorld(dungeonId, local),
  maxHp,
});

export const CH1_DUNGEON_ENCOUNTER_NPCS: readonly Ch1DungeonEncounterNpc[] =
  Object.freeze([
    encounter(
      1,
      "ch1_dungeon_desert",
      "enc_d1_salt_cured_muckers",
      "d1_salt_market",
      "Salt-Cured Mucker",
      { x: 168, y: 3, z: -68 },
      90
    ),
    encounter(
      2,
      "ch1_dungeon_desert",
      "enc_d1_salt_cured_muckers",
      "d1_salt_market",
      "Salt-Cured Mucker",
      { x: 184, y: 3, z: -52 },
      90
    ),
    encounter(
      3,
      "ch1_dungeon_desert",
      "enc_d1_salt_cured_muckers",
      "d1_salt_market",
      "Salt-Cured Mucker",
      { x: 198, y: 3, z: -70 },
      90
    ),
    encounter(
      4,
      "ch1_dungeon_desert",
      "enc_d1_cistern_hexers",
      "d1_cistern_stair",
      "Cistern Hexer",
      { x: 244, y: -20, z: -64 },
      70
    ),
    encounter(
      5,
      "ch1_dungeon_desert",
      "enc_d1_cistern_hexers",
      "d1_cistern_stair",
      "Cistern Hexer",
      { x: 260, y: -20, z: -46 },
      70
    ),
    encounter(
      6,
      "ch1_dungeon_desert",
      "enc_d1_gilded_bull",
      "d1_sun_court",
      "The Gilded Bull",
      { x: 344, y: -20, z: -56 },
      420
    ),
    encounter(
      7,
      "ch1_dungeon_winter",
      "enc_d2_underice_hexers",
      "d2_longhouse",
      "Under-Ice Hexer",
      { x: 100, y: -10, z: -92 },
      80
    ),
    encounter(
      8,
      "ch1_dungeon_winter",
      "enc_d2_underice_hexers",
      "d2_longhouse",
      "Under-Ice Hexer",
      { x: 120, y: -10, z: -80 },
      80
    ),
    encounter(
      9,
      "ch1_dungeon_winter",
      "enc_d2_hanged_wood_stalkers",
      "d2_hanged_wood",
      "Unfinished Stalker",
      { x: 154, y: 1, z: -104 },
      110
    ),
    encounter(
      10,
      "ch1_dungeon_winter",
      "enc_d2_hanged_wood_stalkers",
      "d2_hanged_wood",
      "Unfinished Stalker",
      { x: 176, y: 1, z: -76 },
      110
    ),
    encounter(
      11,
      "ch1_dungeon_winter",
      "enc_d2_hanged_wood_stalkers",
      "d2_hanged_wood",
      "Unfinished Stalker",
      { x: 194, y: 1, z: -108 },
      110
    ),
    encounter(
      12,
      "ch1_dungeon_winter",
      "enc_d2_ninth_winter",
      "d2_ash_hall",
      "The Ninth Winter",
      { x: 388, y: 1, z: -88 },
      560
    ),
  ]);

export function ch1DungeonEncounterNpcsForDungeon(dungeonId: string) {
  return CH1_DUNGEON_ENCOUNTER_NPCS.filter(
    (npc) => npc.dungeonId === dungeonId
  );
}

export function ch1RequiredEncounterNpcsForObjective(
  objectiveId: string,
  choice?: string
) {
  const combatRequired =
    (objectiveId === "d1_salt_market" && choice === "fight_open") ||
    (objectiveId === "d1_sun_court" && choice === "break_horns") ||
    (objectiveId === "d2_hanged_wood" && choice === "fight_through") ||
    objectiveId === "d2_ash_hall";
  return combatRequired
    ? CH1_DUNGEON_ENCOUNTER_NPCS.filter(
        (npc) => npc.objectiveId === objectiveId
      )
    : [];
}

export const CH1_NINTH_WINTER_LOOP_MS = 90_000;

export function ch1GildedBullBrokenPartIds(input: {
  hp: number;
  maxHp: number;
  existing?: readonly string[];
}) {
  const broken = new Set(input.existing ?? []);
  if (input.maxHp > 0 && input.hp / input.maxHp <= 0.7) {
    broken.add("left_horn");
  }
  if (input.maxHp > 0 && input.hp / input.maxHp <= 0.45) {
    broken.add("right_horn");
  }
  return [...broken];
}

export function ch1GildedBullPhase(input: {
  hp: number;
  maxHp: number;
  attackTarget?: BiomesId;
  brokenPartIds?: readonly string[];
}) {
  if (input.hp <= 0) return "defeated" as const;
  if ((input.brokenPartIds?.length ?? 0) >= 2) return "unbalanced" as const;
  if (input.attackTarget !== undefined || input.hp < input.maxHp) {
    return "charge" as const;
  }
  return "patrol" as const;
}

export function ch1NinthWinterPhase(input: {
  hp: number;
  maxHp: number;
  cycleStartedAtMs?: number;
  nowMs: number;
}) {
  if (input.hp <= 0) return "defeated" as const;
  if (input.maxHp > 0 && input.hp / input.maxHp <= 0.3) {
    return "year_breaks" as const;
  }
  if (input.cycleStartedAtMs === undefined) return "hearth_fails" as const;
  if (input.nowMs - input.cycleStartedAtMs < 30_000) {
    return "hearth_fails" as const;
  }
  return "same_day_again" as const;
}

export function ch1NinthWinterLoopRemainingMs(input: {
  cycleStartedAtMs?: number;
  nowMs: number;
}) {
  if (input.cycleStartedAtMs === undefined) return CH1_NINTH_WINTER_LOOP_MS;
  const elapsed = Math.max(0, input.nowMs - input.cycleStartedAtMs);
  return CH1_NINTH_WINTER_LOOP_MS - (elapsed % CH1_NINTH_WINTER_LOOP_MS);
}

export interface Ch1DungeonEscortNpc {
  entityId: BiomesId;
  dungeonId: "ch1_dungeon_desert" | "ch1_dungeon_winter";
  displayName: string;
  startPosition: Vec3;
}

export const CH1_DUNGEON_ESCORT_NPCS: readonly Ch1DungeonEscortNpc[] =
  Object.freeze([
    {
      entityId: CH1_NPC_ENTITY_IDS.iris_fen,
      dungeonId: "ch1_dungeon_desert",
      displayName: "Iris Fen",
      startPosition: ch1DungeonAuthoredToWorld("ch1_dungeon_desert", {
        x: 386,
        y: -20,
        z: -56,
      }),
    },
    {
      entityId: CH1_NPC_ENTITY_IDS.marrow,
      dungeonId: "ch1_dungeon_desert",
      displayName: "Marrow",
      startPosition: ch1DungeonAuthoredToWorld("ch1_dungeon_desert", {
        x: 391,
        y: -20,
        z: -52,
      }),
    },
    {
      entityId: CH1_NPC_ENTITY_IDS.nadia_sorrel,
      dungeonId: "ch1_dungeon_winter",
      displayName: "Dr. Nadia Sorrel",
      startPosition: ch1DungeonAuthoredToWorld("ch1_dungeon_winter", {
        x: 308,
        y: 1,
        z: -88,
      }),
    },
  ]);

export function ch1DungeonEscortNpcsForDungeon(dungeonId: string) {
  return CH1_DUNGEON_ESCORT_NPCS.filter((npc) => npc.dungeonId === dungeonId);
}

export function ch1RequiredEscortNpcsForObjective(objectiveId: string) {
  if (objectiveId === "d1_the_long_walk") {
    return CH1_DUNGEON_ESCORT_NPCS.filter(
      (npc) => npc.dungeonId === "ch1_dungeon_desert"
    );
  }
  if (objectiveId === "d2_the_breaking_year") {
    return CH1_DUNGEON_ESCORT_NPCS.filter(
      (npc) => npc.entityId === CH1_NPC_ENTITY_IDS.nadia_sorrel
    );
  }
  return [];
}
