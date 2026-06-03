import {
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1,
  type HarthmereLiveEntityProductionSeedV1,
} from "@/shared/harthmere/live_entity_production_seed_v1";
import { muckMonsterAreaForPositionV1 } from "@/shared/harthmere/muck_monster_aggression_ai_v1";
import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";

export const HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS_VERSION_V1 =
  "harthmere-jobs-board-muck-bounty-targets-v1" as const;

export const HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID_V1 =
  "muck_bounty_elite_mucker" as const;
export const HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID_V1 =
  "muck_bounty_elite_mucker_marker" as const;
export const HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_TARGET_ID_V1 =
  "muck_bounty_hex_wraith" as const;
export const HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_MARKER_ID_V1 =
  "muck_bounty_hex_wraith_marker" as const;
export const HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_TARGET_ID_V1 =
  "muck_bounty_alpha_mucker" as const;
export const HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_MARKER_ID_V1 =
  "muck_bounty_alpha_mucker_marker" as const;

export type HarthmereJobsBoardMuckBountyMonsterIdV1 = "mucker" | "hex";
export type HarthmereJobsBoardMuckBountyTierV1 =
  | "elite"
  | "boss";

export interface HarthmereJobsBoardMuckBountyTargetV1 {
  targetId: string;
  markerId: string;
  targetName: string;
  label: string;
  position: Vec3;
  areaId: string;
  areaLabel: string;
  seedId: string;
  entityId: BiomesId;
  monsterId: HarthmereJobsBoardMuckBountyMonsterIdV1;
  monsterTier: HarthmereJobsBoardMuckBountyTierV1;
  source: "muck_bounty_target";
}

function pickMuckBountySeedV1(input: {
  areaId: string;
  monsterId: HarthmereJobsBoardMuckBountyMonsterIdV1;
  preferredName: RegExp;
}): HarthmereLiveEntityProductionSeedV1 {
  const seed = HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.find(
    (candidate) =>
      candidate.areaId === input.areaId &&
      candidate.combatKind === (input.monsterId === "hex" ? "hex" : "mux") &&
      input.preferredName.test(candidate.displayName)
  );
  if (seed) {
    return seed;
  }
  const fallback = HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.find(
    (candidate) =>
      candidate.areaId === input.areaId &&
      candidate.combatKind === (input.monsterId === "hex" ? "hex" : "mux")
  );
  if (!fallback) {
    throw new Error(
      `Missing Muck bounty seed for ${input.monsterId} in ${input.areaId}`
    );
  }
  return fallback;
}

function targetFromSeedV1(input: {
  targetId: string;
  markerId: string;
  targetName: string;
  label: string;
  monsterId: HarthmereJobsBoardMuckBountyMonsterIdV1;
  monsterTier: HarthmereJobsBoardMuckBountyTierV1;
  seed: HarthmereLiveEntityProductionSeedV1;
}): HarthmereJobsBoardMuckBountyTargetV1 {
  return {
    targetId: input.targetId,
    markerId: input.markerId,
    targetName: input.targetName,
    label: input.label,
    position: [...input.seed.position] as Vec3,
    areaId: input.seed.areaId,
    areaLabel: input.seed.areaLabel,
    seedId: input.seed.seedId,
    entityId: input.seed.entityId,
    monsterId: input.monsterId,
    monsterTier: input.monsterTier,
    source: "muck_bounty_target",
  };
}

const eliteMuckerSeed = pickMuckBountySeedV1({
  areaId: "west_muck_breach",
  monsterId: "mucker",
  preferredName: /west breach/i,
});
const hexWraithSeed = pickMuckBountySeedV1({
  areaId: "gravewood_pale_muck",
  monsterId: "hex",
  preferredName: /pale hexer/i,
});
const alphaMuckerSeed = pickMuckBountySeedV1({
  areaId: "old_wood_mucker_copse",
  monsterId: "mucker",
  preferredName: /old wood copse/i,
});

export const HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS_V1: readonly HarthmereJobsBoardMuckBountyTargetV1[] =
  [
    targetFromSeedV1({
      targetId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID_V1,
      markerId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID_V1,
      targetName: "Elite Mucker",
      label: "Elite Mucker Bounty",
      monsterId: "mucker",
      monsterTier: "elite",
      seed: eliteMuckerSeed,
    }),
    targetFromSeedV1({
      targetId: HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_TARGET_ID_V1,
      markerId: HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_MARKER_ID_V1,
      targetName: "Hex Wraith",
      label: "Hex Wraith Bounty",
      monsterId: "hex",
      monsterTier: "boss",
      seed: hexWraithSeed,
    }),
    targetFromSeedV1({
      targetId: HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_TARGET_ID_V1,
      markerId: HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_MARKER_ID_V1,
      targetName: "Alpha Mucker",
      label: "Alpha Mucker Bounty",
      monsterId: "mucker",
      monsterTier: "boss",
      seed: alphaMuckerSeed,
    }),
  ] as const;

export function harthmereJobsBoardMuckBountyTargetForIdV1(
  id: string | undefined
) {
  if (!id) {
    return undefined;
  }
  return HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS_V1.find(
    (target) => target.targetId === id || target.markerId === id
  );
}

export function validateHarthmereJobsBoardMuckBountyTargetsV1() {
  const errors: string[] = [];
  const seenTargetIds = new Set<string>();
  const seenMarkerIds = new Set<string>();
  for (const target of HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS_V1) {
    if (seenTargetIds.has(target.targetId)) {
      errors.push(`${target.targetId}:duplicate_target_id`);
    }
    seenTargetIds.add(target.targetId);
    if (seenMarkerIds.has(target.markerId)) {
      errors.push(`${target.markerId}:duplicate_marker_id`);
    }
    seenMarkerIds.add(target.markerId);
    if (
      target.position.length < 3 ||
      !target.position.every((value) => Number.isFinite(Number(value)))
    ) {
      errors.push(`${target.markerId}:invalid_position`);
    }
    if (!muckMonsterAreaForPositionV1(target.position, 1.5)) {
      errors.push(`${target.markerId}:outside_muck_territory`);
    }
    const seed = HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.find(
      (candidate) => candidate.seedId === target.seedId
    );
    if (!seed) {
      errors.push(`${target.markerId}:missing_seed`);
    } else if (
      seed.entityId !== target.entityId ||
      seed.areaId !== target.areaId ||
      seed.position.some((value, index) => value !== target.position[index])
    ) {
      errors.push(`${target.markerId}:seed_mismatch`);
    }
    if (/grove|town|board|placeholder/i.test(target.markerId)) {
      errors.push(`${target.markerId}:unsafe_marker_name`);
    }
  }
  return errors;
}
