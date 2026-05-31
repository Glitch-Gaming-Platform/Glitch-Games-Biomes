import { BikkieIds } from "@/shared/bikkie/ids";
import type { BiomesId } from "@/shared/ids";
import type { Vec2, Vec3 } from "@/shared/math/types";
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE_V75 } from "./snapshot_grove_content_v75";

export const HARTHMERE_GROVE_RACE_MINIGAME_SEED_VERSION_V1 =
  "harthmere-grove-race-minigame-seed-v1" as const;

export const HARTHMERE_GROVE_RACE_MINIGAME_LABEL_V1 = "Let's a Grove!";

export const HARTHMERE_GROVE_RACE_START_POSITION_V1 = [
  547.2631199515679, 70, -145.3003845851506,
] as Vec3;

export type HarthmereGroveRaceMinigameElementKindV1 =
  | "start"
  | "checkpoint"
  | "finish"
  | "leaderboard";

export interface HarthmereGroveRaceMinigameElementSeedV1 {
  seedId: string;
  kind: HarthmereGroveRaceMinigameElementKindV1;
  entityId: BiomesId;
  idOffset: number;
  itemId: BiomesId;
  position: Vec3;
  orientation: Vec2;
}

function groveRaceEntityIdFromOffsetV1(idOffset: number) {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE_V75) + idOffset) as BiomesId;
}

export const HARTHMERE_GROVE_RACE_MINIGAME_ID_V1 =
  groveRaceEntityIdFromOffsetV1(9471);

export const HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS_V1 = [
  {
    seedId: "grove-race-start",
    kind: "start",
    entityId: groveRaceEntityIdFromOffsetV1(9472),
    idOffset: 9472,
    itemId: BikkieIds.simpleRaceStart,
    position: HARTHMERE_GROVE_RACE_START_POSITION_V1,
    orientation: [0, Math.PI],
  },
  {
    seedId: "grove-race-checkpoint-east",
    kind: "checkpoint",
    entityId: groveRaceEntityIdFromOffsetV1(9473),
    idOffset: 9473,
    itemId: BikkieIds.simpleRaceCheckpoint,
    position: [552.8, 70, -145.3],
    orientation: [0, Math.PI / 2],
  },
  {
    seedId: "grove-race-checkpoint-north",
    kind: "checkpoint",
    entityId: groveRaceEntityIdFromOffsetV1(9474),
    idOffset: 9474,
    itemId: BikkieIds.simpleRaceCheckpoint,
    position: [552.8, 70, -137.8],
    orientation: [0, 0],
  },
  {
    seedId: "grove-race-finish",
    kind: "finish",
    entityId: groveRaceEntityIdFromOffsetV1(9475),
    idOffset: 9475,
    itemId: BikkieIds.simpleRaceFinish,
    position: [547.25, 70, -137.8],
    orientation: [0, 0],
  },
  {
    seedId: "grove-race-leaderboard",
    kind: "leaderboard",
    entityId: groveRaceEntityIdFromOffsetV1(9476),
    idOffset: 9476,
    itemId: BikkieIds.minigameLeaderboard,
    position: [544.5, 70, -148.2],
    orientation: [0, Math.PI / 4],
  },
] satisfies readonly HarthmereGroveRaceMinigameElementSeedV1[];

export const HARTHMERE_GROVE_RACE_MINIGAME_SEED_IDS_V1 = [
  HARTHMERE_GROVE_RACE_MINIGAME_ID_V1,
  ...HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS_V1.map((seed) => seed.entityId),
] as const;

export function validateHarthmereGroveRaceMinigameSeedsV1() {
  const errors: string[] = [];
  const ids = new Set<BiomesId>();
  const offsets = new Set<number>();
  const starts = HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS_V1.filter(
    (seed) => seed.kind === "start"
  );
  const checkpoints = HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS_V1.filter(
    (seed) => seed.kind === "checkpoint"
  );
  const finishes = HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS_V1.filter(
    (seed) => seed.kind === "finish"
  );

  for (const id of HARTHMERE_GROVE_RACE_MINIGAME_SEED_IDS_V1) {
    if (ids.has(id)) {
      errors.push(`duplicate_entity_id:${id}`);
    }
    ids.add(id);
  }

  for (const seed of HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS_V1) {
    if (offsets.has(seed.idOffset)) {
      errors.push(`${seed.seedId}:duplicate_id_offset`);
    }
    offsets.add(seed.idOffset);
    if (seed.position[1] !== HARTHMERE_GROVE_RACE_START_POSITION_V1[1]) {
      errors.push(`${seed.seedId}:wrong_y:${seed.position[1]}`);
    }
    const distanceFromStart = Math.hypot(
      seed.position[0] - HARTHMERE_GROVE_RACE_START_POSITION_V1[0],
      seed.position[2] - HARTHMERE_GROVE_RACE_START_POSITION_V1[2]
    );
    if (distanceFromStart > 20) {
      errors.push(`${seed.seedId}:too_far_from_start`);
    }
  }

  if (starts.length !== 1) {
    errors.push(`expected_one_start:${starts.length}`);
  }
  if (checkpoints.length < 1) {
    errors.push("expected_at_least_one_checkpoint");
  }
  if (finishes.length !== 1) {
    errors.push(`expected_one_finish:${finishes.length}`);
  }
  if (
    starts[0]?.position[0] !== HARTHMERE_GROVE_RACE_START_POSITION_V1[0] ||
    starts[0]?.position[1] !== HARTHMERE_GROVE_RACE_START_POSITION_V1[1] ||
    starts[0]?.position[2] !== HARTHMERE_GROVE_RACE_START_POSITION_V1[2]
  ) {
    errors.push("start_position_does_not_match_requested_coordinate");
  }
  if (HARTHMERE_GROVE_RACE_MINIGAME_LABEL_V1.includes("_")) {
    errors.push("label_contains_internal_case");
  }

  return errors;
}
