import {
  harthmereGroundedLivestockSeedsInTerritoryV1,
  harthmereGroundedMuckMonsterSeedsInTerritoryV1,
  type HarthmereLiveEntityProductionSeedV1,
} from "@/shared/harthmere/live_entity_production_seed_v1";

export const HARTHMERE_VISIBLE_COMBAT_TARGET_VERSION_V1 =
  "harthmere-visible-combat-target-v1" as const;

export type HarthmereVisibleCombatTargetFamilyV1 =
  | "mucker"
  | "hex"
  | "animal";

export type HarthmereVisibleCombatActorV1 = {
  offset?: number;
  label?: string;
  asset?: string;
  species?: string;
  family?: string;
  world?: readonly [number, number, number];
};

export type HarthmereVisibleCombatTargetMatchV1 = {
  targetId: string;
  entityId: number;
  idOffset: number;
  family: HarthmereVisibleCombatTargetFamilyV1;
  species?: string;
  distance?: number;
};

export function harthmereServerMuckCombatTargetIdForSeedV1(input: {
  seedId: string;
  idOffset: number;
}): string | undefined {
  if (!input.seedId.trim() || !Number.isFinite(input.idOffset)) {
    return undefined;
  }
  return `server-muck-combat:${input.seedId}:${input.idOffset}`;
}

function normalizedSpeciesV1(value: string | undefined) {
  const text = value?.toLowerCase().trim();
  if (!text) return undefined;
  if (text === "rabbit" || text === "hare") return "bunny";
  if (text === "goat" || text === "ram" || text === "lamb") return "sheep";
  if (text === "bull" || text === "ox" || text === "calf") return "cow";
  if (text === "hound" || text === "puppy") return "dog";
  if (text === "stag" || text === "doe" || text === "fawn") return "deer";
  return text;
}

function animalSpeciesFromTextV1(text: string) {
  return normalizedSpeciesV1(
    text.match(
      /\b(wolf|bear|boar|deer|stag|doe|fox|dog|hound|cat|rat|pig|hog|cow|bull|sheep|goat|ram|horse|pony|chicken|pigeon|crow|rabbit|hare|bunny|snake|frog)\b/
    )?.[1]
  );
}

function actorFamilyV1(
  actor: HarthmereVisibleCombatActorV1
): HarthmereVisibleCombatTargetFamilyV1 | undefined {
  const text = `${actor.family ?? ""} ${actor.asset ?? ""} ${
    actor.label ?? ""
  } ${actor.species ?? ""}`.toLowerCase();
  if (/\b(hex(?:er)?|helix)\b/.test(text)) return "hex";
  if (
    /^animal_/.test(actor.asset ?? "") ||
    actor.species ||
    animalSpeciesFromTextV1(text)
  ) {
    return "animal";
  }
  if (/\bmuck|mucker|muckling|muckwad|mux\b/.test(text)) return "mucker";
  return undefined;
}

function normalizedLabelV1(value: string | undefined) {
  return value
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function seedFamilyV1(
  seed: HarthmereLiveEntityProductionSeedV1
): HarthmereVisibleCombatTargetFamilyV1 {
  if (seed.kind === "ambient_livestock") return "animal";
  if (seed.combatKind === "hex") return "hex";
  return "mucker";
}

function seedSpeciesV1(seed: HarthmereLiveEntityProductionSeedV1) {
  return normalizedSpeciesV1(seed.species);
}

function visibleTargetSeedsV1() {
  return [
    ...harthmereGroundedMuckMonsterSeedsInTerritoryV1(),
    ...harthmereGroundedLivestockSeedsInTerritoryV1(),
  ];
}

const directSeedTargetsByNumberV1 = (() => {
  const map = new Map<number, HarthmereVisibleCombatTargetMatchV1>();
  for (const seed of visibleTargetSeedsV1()) {
    const targetId = harthmereServerMuckCombatTargetIdForSeedV1(seed);
    const entityId = Number(seed.entityId);
    if (!targetId || !Number.isFinite(entityId)) continue;
    const match = {
      targetId,
      entityId,
      idOffset: seed.idOffset,
      family: seedFamilyV1(seed),
      species: seedSpeciesV1(seed),
      distance: 0,
    } satisfies HarthmereVisibleCombatTargetMatchV1;
    map.set(entityId, match);
    map.set(seed.idOffset, match);
  }
  return map;
})();

export function harthmereVisibleCombatTargetForActorV1(
  actor: HarthmereVisibleCombatActorV1
): HarthmereVisibleCombatTargetMatchV1 | undefined {
  const offset = Number(actor.offset);
  if (Number.isFinite(offset)) {
    const direct = directSeedTargetsByNumberV1.get(offset);
    if (direct) return direct;
  }

  const family = actorFamilyV1(actor);
  if (!family || !actor.world) return undefined;
  const actorX = Number(actor.world[0]);
  const actorZ = Number(actor.world[2]);
  if (!Number.isFinite(actorX) || !Number.isFinite(actorZ)) {
    return undefined;
  }
  const actorSpecies = normalizedSpeciesV1(actor.species) ?? animalSpeciesFromTextV1(
    `${actor.asset ?? ""} ${actor.label ?? ""}`.toLowerCase()
  );
  const actorLabel = normalizedLabelV1(actor.label);

  let best: HarthmereVisibleCombatTargetMatchV1 | undefined;
  for (const seed of visibleTargetSeedsV1()) {
    const seedFamily = seedFamilyV1(seed);
    if (seedFamily !== family) continue;
    const seedSpecies = seedSpeciesV1(seed);
    if (
      family === "animal" &&
      actorSpecies &&
      seedSpecies &&
      actorSpecies !== seedSpecies
    ) {
      continue;
    }
    const targetId = harthmereServerMuckCombatTargetIdForSeedV1(seed);
    const entityId = Number(seed.entityId);
    if (!targetId || !Number.isFinite(entityId)) continue;
    const dx = Number(seed.position[0]) - actorX;
    const dz = Number(seed.position[2]) - actorZ;
    const distance = Math.hypot(dx, dz);
    if (!Number.isFinite(distance)) continue;
    const match = {
      targetId,
      entityId,
      idOffset: seed.idOffset,
      family: seedFamily,
      species: seedSpecies,
      distance,
    } satisfies HarthmereVisibleCombatTargetMatchV1;
    if (actorLabel && actorLabel === normalizedLabelV1(seed.displayName)) {
      return match;
    }
    if (!best || distance < (best.distance ?? Infinity)) {
      best = match;
    }
  }
  return best;
}

export function harthmereLiveModeCombatTargetIdForVisibleActorV1(
  actor: HarthmereVisibleCombatActorV1
): string | undefined {
  return harthmereVisibleCombatTargetForActorV1(actor)?.targetId;
}
