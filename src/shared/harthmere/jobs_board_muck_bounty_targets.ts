import {
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS,
  type HarthmereLiveEntityProductionSeed,
} from "@/shared/harthmere/live_entity_production_seed";
import { muckMonsterAreaForPosition } from "@/shared/harthmere/muck_monster_aggression_ai";
import { resolveHarthmereProductionMarkerPosition } from "@/shared/harthmere/production_terrain_placement_map";
import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";

export const HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS_VERSION =
  "harthmere-jobs-board-muck-bounty-targets" as const;

// Legacy ids remain resolvable for already-open production jobs. New generated
// repeatable hunts use seed-backed ids selected from the full live muck pool.
export const HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID =
  "muck_bounty_elite_mucker" as const;
export const HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID =
  "muck_bounty_elite_mucker_marker" as const;
export const HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_TARGET_ID =
  "muck_bounty_hex_wraith" as const;
export const HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_MARKER_ID =
  "muck_bounty_hex_wraith_marker" as const;
export const HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_TARGET_ID =
  "muck_bounty_alpha_mucker" as const;
export const HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_MARKER_ID =
  "muck_bounty_alpha_mucker_marker" as const;

export type HarthmereJobsBoardMuckBountyMonsterId = "mucker" | "hex";
export type HarthmereJobsBoardMuckBountyTier = "elite" | "boss";

export interface HarthmereJobsBoardMuckBountyTarget {
  targetId: string;
  markerId: string;
  targetName: string;
  label: string;
  position: Vec3;
  areaId: string;
  areaLabel: string;
  seedId: string;
  entityId: BiomesId;
  monsterId: HarthmereJobsBoardMuckBountyMonsterId;
  monsterTier: HarthmereJobsBoardMuckBountyTier;
  legacyTarget?: boolean;
  source: "muck_bounty_target";
}

function seedCombatKind(monsterId: HarthmereJobsBoardMuckBountyMonsterId) {
  return monsterId === "hex" ? "hex" : "mux";
}

function safeIdPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function pickMuckBountySeed(input: {
  areaId: string;
  monsterId: HarthmereJobsBoardMuckBountyMonsterId;
  preferredName: RegExp;
}): HarthmereLiveEntityProductionSeed {
  const seed = HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.find(
    (candidate) =>
      candidate.areaId === input.areaId &&
      candidate.combatKind === seedCombatKind(input.monsterId) &&
      input.preferredName.test(candidate.displayName)
  );
  if (seed) {
    return seed;
  }
  const fallback = HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.find(
    (candidate) =>
      candidate.areaId === input.areaId &&
      candidate.combatKind === seedCombatKind(input.monsterId)
  );
  if (!fallback) {
    throw new Error(
      `Missing Muck bounty seed for ${input.monsterId} in ${input.areaId}`
    );
  }
  return fallback;
}

function targetFromSeed(input: {
  targetId: string;
  markerId: string;
  targetName: string;
  label: string;
  monsterId: HarthmereJobsBoardMuckBountyMonsterId;
  monsterTier: HarthmereJobsBoardMuckBountyTier;
  seed: HarthmereLiveEntityProductionSeed;
  legacyTarget?: boolean;
}): HarthmereJobsBoardMuckBountyTarget {
  const position = resolveHarthmereProductionMarkerPosition({
    source: "live_muck_monster",
    markerId: input.seed.seedId,
    fallback: [...input.seed.position] as Vec3,
  });
  return {
    targetId: input.targetId,
    markerId: input.markerId,
    targetName: input.targetName,
    label: input.label,
    position,
    areaId: input.seed.areaId,
    areaLabel: input.seed.areaLabel,
    seedId: input.seed.seedId,
    entityId: input.seed.entityId,
    monsterId: input.monsterId,
    monsterTier: input.monsterTier,
    legacyTarget: input.legacyTarget,
    source: "muck_bounty_target",
  };
}

function generatedTargetFromSeed(input: {
  monsterId: HarthmereJobsBoardMuckBountyMonsterId;
  monsterTier: HarthmereJobsBoardMuckBountyTier;
  seed: HarthmereLiveEntityProductionSeed;
}): HarthmereJobsBoardMuckBountyTarget {
  const id = `muck_bounty_${input.monsterId}_${input.monsterTier}_${safeIdPart(
    input.seed.seedId
  )}`;
  const tierLabel = input.monsterTier === "boss" ? "Boss" : "Elite";
  const monsterLabel = input.monsterId === "hex" ? "Hex" : "Mucker";
  return targetFromSeed({
    targetId: id,
    markerId: `${id}_marker`,
    targetName: `${tierLabel} ${input.seed.displayName}`,
    label: `${tierLabel} ${monsterLabel}: ${input.seed.areaLabel}`,
    monsterId: input.monsterId,
    monsterTier: input.monsterTier,
    seed: input.seed,
  });
}

const eliteMuckerSeed = pickMuckBountySeed({
  areaId: "west_muck_breach",
  monsterId: "mucker",
  preferredName: /west breach/i,
});
const hexWraithSeed = pickMuckBountySeed({
  areaId: "gravewood_pale_muck",
  monsterId: "hex",
  preferredName: /pale hexer/i,
});
const alphaMuckerSeed = pickMuckBountySeed({
  areaId: "old_wood_mucker_copse",
  monsterId: "mucker",
  preferredName: /old wood copse/i,
});

const LEGACY_MUCK_BOUNTY_TARGETS: readonly HarthmereJobsBoardMuckBountyTarget[] =
  [
    targetFromSeed({
      targetId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID,
      markerId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID,
      targetName: "Elite Mucker",
      label: "Elite Mucker Bounty",
      monsterId: "mucker",
      monsterTier: "elite",
      seed: eliteMuckerSeed,
      legacyTarget: true,
    }),
    targetFromSeed({
      targetId: HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_TARGET_ID,
      markerId: HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_MARKER_ID,
      targetName: "Hex Wraith",
      label: "Hex Wraith Bounty",
      monsterId: "hex",
      monsterTier: "boss",
      seed: hexWraithSeed,
      legacyTarget: true,
    }),
    targetFromSeed({
      targetId: HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_TARGET_ID,
      markerId: HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_MARKER_ID,
      targetName: "Alpha Mucker",
      label: "Alpha Mucker Bounty",
      monsterId: "mucker",
      monsterTier: "boss",
      seed: alphaMuckerSeed,
      legacyTarget: true,
    }),
  ] as const;

const GENERATED_MUCK_BOUNTY_TARGETS: readonly HarthmereJobsBoardMuckBountyTarget[] =
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.flatMap((seed) => {
    const monsterId =
      seed.combatKind === "hex"
        ? ("hex" as const)
        : ("mucker" as const);
    const tiers: readonly HarthmereJobsBoardMuckBountyTier[] =
      monsterId === "hex" ? ["boss"] : ["elite", "boss"];
    return tiers.map((monsterTier) =>
      generatedTargetFromSeed({ monsterId, monsterTier, seed })
    );
  });

export const HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS: readonly HarthmereJobsBoardMuckBountyTarget[] =
  [...LEGACY_MUCK_BOUNTY_TARGETS, ...GENERATED_MUCK_BOUNTY_TARGETS] as const;

export function harthmereJobsBoardMuckBountyTargetForId(
  id: string | undefined
) {
  if (!id) {
    return undefined;
  }
  return HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS.find(
    (target) => target.targetId === id || target.markerId === id
  );
}

export function harthmereJobsBoardMuckBountyTargetsForMonster(input: {
  monsterId: HarthmereJobsBoardMuckBountyMonsterId;
  monsterTier?: string;
  includeLegacy?: boolean;
}) {
  return HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS.filter((target) => {
    if (!input.includeLegacy && target.legacyTarget) return false;
    if (target.monsterId !== input.monsterId) return false;
    if (
      input.monsterTier === "elite" ||
      input.monsterTier === "boss"
    ) {
      return target.monsterTier === input.monsterTier;
    }
    return true;
  });
}

export function randomHarthmereJobsBoardMuckBountyTarget(input: {
  monsterId: HarthmereJobsBoardMuckBountyMonsterId;
  monsterTier?: string;
  rng: () => number;
}) {
  const candidates = harthmereJobsBoardMuckBountyTargetsForMonster({
    monsterId: input.monsterId,
    monsterTier: input.monsterTier,
  });
  if (!candidates.length) {
    return undefined;
  }
  return candidates[
    Math.min(
      candidates.length - 1,
      Math.floor(input.rng() * candidates.length)
    )
  ];
}

export function validateHarthmereJobsBoardMuckBountyTargets() {
  const errors: string[] = [];
  const seenTargetIds = new Set<string>();
  const seenMarkerIds = new Set<string>();
  for (const target of HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS) {
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
    if (!muckMonsterAreaForPosition(target.position, 1.5)) {
      errors.push(`${target.markerId}:outside_muck_territory`);
    }
    const seed = HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.find(
      (candidate) => candidate.seedId === target.seedId
    );
    if (!seed) {
      errors.push(`${target.markerId}:missing_seed`);
    } else {
      const resolvedSeedPosition = resolveHarthmereProductionMarkerPosition({
        source: "live_muck_monster",
        markerId: seed.seedId,
        fallback: [...seed.position] as Vec3,
      });
      if (
        seed.entityId !== target.entityId ||
        seed.areaId !== target.areaId ||
        resolvedSeedPosition.some(
          (value, index) => value !== target.position[index]
        )
      ) {
        errors.push(`${target.markerId}:seed_mismatch`);
      }
      if (seed.combatKind !== seedCombatKind(target.monsterId)) {
        errors.push(`${target.markerId}:monster_kind_mismatch`);
      }
    }
    if (/grove|town|board|placeholder/i.test(target.markerId)) {
      errors.push(`${target.markerId}:unsafe_marker_name`);
    }
  }
  return errors;
}
