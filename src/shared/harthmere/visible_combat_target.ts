import {
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereGroundedMuckMonsterSeedsInTerritory,
  type HarthmereLiveEntityProductionSeed,
} from "@/shared/harthmere/live_entity_production_seed";

export const HARTHMERE_VISIBLE_COMBAT_TARGET_VERSION =
  "harthmere-visible-combat-target" as const;

export type HarthmereVisibleCombatTargetFamily = "mucker" | "hex" | "animal";

export type HarthmereVisibleCombatActor = {
  offset?: number;
  label?: string;
  asset?: string;
  species?: string;
  family?: string;
  world?: readonly [number, number, number];
};

export type HarthmereVisibleCombatTargetMatch = {
  targetId: string;
  entityId: number;
  idOffset: number;
  family: HarthmereVisibleCombatTargetFamily;
  species?: string;
  distance?: number;
};

export function harthmereServerMuckCombatTargetIdForSeed(input: {
  seedId: string;
  idOffset: number;
}): string | undefined {
  if (!input.seedId.trim() || !Number.isFinite(input.idOffset)) {
    return undefined;
  }
  return `server-muck-combat:${input.seedId}:${input.idOffset}`;
}

function normalizedSpecies(value: string | undefined) {
  const text = value?.toLowerCase().trim();
  if (!text) return undefined;
  if (text === "rabbit" || text === "hare") return "bunny";
  if (text === "goat" || text === "ram" || text === "lamb") return "sheep";
  if (text === "bull" || text === "ox" || text === "calf") return "cow";
  if (text === "hound" || text === "puppy") return "dog";
  if (text === "stag" || text === "doe" || text === "fawn") return "deer";
  return text;
}

function animalSpeciesFromText(text: string) {
  return normalizedSpecies(
    text.match(
      /\b(wolf|bear|boar|deer|stag|doe|fox|dog|hound|cat|rat|pig|hog|cow|bull|sheep|goat|ram|horse|pony|chicken|pigeon|crow|rabbit|hare|bunny|snake|frog)\b/
    )?.[1]
  );
}

function actorFamily(
  actor: HarthmereVisibleCombatActor
): HarthmereVisibleCombatTargetFamily | undefined {
  const text = `${actor.family ?? ""} ${actor.asset ?? ""} ${
    actor.label ?? ""
  } ${actor.species ?? ""}`.toLowerCase();
  if (/\b(hex(?:er)?|helix)\b/.test(text)) return "hex";
  if (
    /^animal_/.test(actor.asset ?? "") ||
    actor.species ||
    animalSpeciesFromText(text)
  ) {
    return "animal";
  }
  if (/\bmuck|mucker|muckling|muckwad|mux\b/.test(text)) return "mucker";
  return undefined;
}

function normalizedLabel(value: string | undefined) {
  return value
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function productionSeedFamily(
  seed: HarthmereLiveEntityProductionSeed
): HarthmereVisibleCombatTargetFamily {
  if (seed.kind === "ambient_livestock") return "animal";
  if (seed.combatKind === "hex") return "hex";
  return "mucker";
}

function productionSeedSpecies(seed: HarthmereLiveEntityProductionSeed) {
  return normalizedSpecies(seed.species);
}

function visibleTargetSeeds() {
  return [
    ...harthmereGroundedMuckMonsterSeedsInTerritory(),
    ...harthmereGroundedLivestockSeedsInTerritory(),
  ];
}

const directSeedTargetsByNumber = (() => {
  const map = new Map<number, HarthmereVisibleCombatTargetMatch>();
  for (const seed of visibleTargetSeeds()) {
    const targetId = harthmereServerMuckCombatTargetIdForSeed(seed);
    const entityId = Number(seed.entityId);
    if (!targetId || !Number.isFinite(entityId)) continue;
    const match = {
      targetId,
      entityId,
      idOffset: seed.idOffset,
      family: productionSeedFamily(seed),
      species: productionSeedSpecies(seed),
      distance: 0,
    } satisfies HarthmereVisibleCombatTargetMatch;
    map.set(entityId, match);
    map.set(seed.idOffset, match);
  }
  return map;
})();

export function harthmereVisibleCombatTargetForActor(
  actor: HarthmereVisibleCombatActor
): HarthmereVisibleCombatTargetMatch | undefined {
  const offset = Number(actor.offset);
  if (Number.isFinite(offset)) {
    const direct = directSeedTargetsByNumber.get(offset);
    if (direct) return direct;
  }

  const family = actorFamily(actor);
  if (!family || !actor.world) return undefined;
  const actorX = Number(actor.world[0]);
  const actorZ = Number(actor.world[2]);
  if (!Number.isFinite(actorX) || !Number.isFinite(actorZ)) {
    return undefined;
  }
  const actorSpecies =
    normalizedSpecies(actor.species) ??
    animalSpeciesFromText(
      `${actor.asset ?? ""} ${actor.label ?? ""}`.toLowerCase()
    );
  const actorLabel = normalizedLabel(actor.label);

  let best: HarthmereVisibleCombatTargetMatch | undefined;
  for (const seed of visibleTargetSeeds()) {
    const seedFamily = productionSeedFamily(seed);
    if (seedFamily !== family) continue;
    const seedSpecies = productionSeedSpecies(seed);
    if (
      family === "animal" &&
      actorSpecies &&
      seedSpecies &&
      actorSpecies !== seedSpecies
    ) {
      continue;
    }
    const targetId = harthmereServerMuckCombatTargetIdForSeed(seed);
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
    } satisfies HarthmereVisibleCombatTargetMatch;
    if (actorLabel && actorLabel === normalizedLabel(seed.displayName)) {
      return match;
    }
    if (!best || distance < (best.distance ?? Infinity)) {
      best = match;
    }
  }
  return best;
}

export function harthmereLiveModeCombatTargetIdForVisibleActor(
  actor: HarthmereVisibleCombatActor
): string | undefined {
  return harthmereVisibleCombatTargetForActor(actor)?.targetId;
}

export function harthmereLiveModeCombatTargetIdForEcsEntity(
  entityId: number | string | undefined
): string | undefined {
  const numeric = Number(entityId);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  return directSeedTargetsByNumber.get(numeric)?.targetId;
}

export function isHarthmereLiveModeManagedCombatEntity(
  entityId: number | string | undefined
): boolean {
  return harthmereLiveModeCombatTargetIdForEcsEntity(entityId) !== undefined;
}
