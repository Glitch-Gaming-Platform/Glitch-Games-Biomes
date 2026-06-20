// HARTHMERE_LIVE_CREATURE_RENDER
//
// Foundational, renderer-agnostic helpers for the "render every creature from
// its ECS entity" model. The visible mucker/hex/animal/quest-creature must BE
// its ECS entity (same id, same position) so the proven native attack ray hits
// it. These pure functions translate the structured seed/entity data into the
// render family the asset pipeline already understands, and own the
// kill -> respawn timing. They are pure (no DOM/renderer/window) so every branch
// is unit-testable per the repo convention.

export type HarthmereLiveCreatureRenderFamily =
  | "mucker"
  | "hex"
  | "animal"
  | "robot"
  | "quest_creature"
  | "live_entity";

export type HarthmereLiveCreatureRenderInput = {
  // seed.kind: "robot_sentinel" | "ambient_muck_monster" | "ambient_livestock"
  kind?: string;
  // seed.combatKind: "mux" | "hex"
  combatKind?: string;
  // seed.species (e.g. "cow") for wildlife
  species?: string;
  // Free-text label / displayName / description fallback.
  label?: string;
  // Quest creatures (job board / world quest spawns) flag through here.
  isQuestCreature?: boolean;
};

const ANIMAL_LABEL_RE =
  /\b(wolf|bear|boar|deer|stag|doe|buck|fox|dog|hound|cat|rat|pig|cow|sheep|goat|horse|chicken|pigeon|crow|rabbit|bunny|snake|frog)\b/;

/**
 * Decide the render family for a live creature from its structured ECS/seed
 * data, falling back to label text. This is what lets one ECS entity stream pick
 * the right mesh/appearance (mucker vs hex vs animal vs robot vs quest creature).
 */
export function harthmereLiveCreatureRenderFamily(
  input: HarthmereLiveCreatureRenderInput
): HarthmereLiveCreatureRenderFamily {
  if (input.isQuestCreature) {
    return "quest_creature";
  }
  if (input.kind === "robot_sentinel") {
    return "robot";
  }
  if (input.combatKind === "hex") {
    return "hex";
  }
  if (input.combatKind === "mux") {
    return "mucker";
  }
  if (input.kind === "ambient_livestock" || (input.species && input.species.trim())) {
    return "animal";
  }
  if (input.kind === "ambient_muck_monster") {
    return "mucker";
  }
  const label = (input.label ?? "").toLowerCase();
  // Robot/bot wins first: names like "Mucked Restoro Bot" contain "muck" but are
  // mechanical sentinels, not muckers.
  if (/robot|sentinel|construct|\bbot\b/.test(label)) {
    return "robot";
  }
  if (/\bhex(er)?\b/.test(label)) {
    return "hex";
  }
  if (/muck|muckling|mucker/.test(label)) {
    return "mucker";
  }
  if (ANIMAL_LABEL_RE.test(label)) {
    return "animal";
  }
  return "live_entity";
}

// Respawn window: a killed creature comes back somewhere between 30 and 60
// minutes later. Tunable in one place.
export const HARTHMERE_LIVE_CREATURE_RESPAWN_MIN_MS = 30 * 60 * 1000;
export const HARTHMERE_LIVE_CREATURE_RESPAWN_MAX_MS = 60 * 60 * 1000;

/**
 * Random respawn delay in [30min, 60min]. `rng` defaults to Math.random but is
 * injectable so the scheduler is deterministic under test.
 */
export function harthmereLiveCreatureRespawnDelayMs(
  rng: () => number = Math.random
): number {
  const span =
    HARTHMERE_LIVE_CREATURE_RESPAWN_MAX_MS -
    HARTHMERE_LIVE_CREATURE_RESPAWN_MIN_MS;
  const r = Math.min(1, Math.max(0, rng()));
  return Math.round(HARTHMERE_LIVE_CREATURE_RESPAWN_MIN_MS + r * span);
}

/**
 * Absolute respawn timestamp for a creature killed at `killedAtMs`.
 */
export function harthmereLiveCreatureRespawnAt(input: {
  killedAtMs: number;
  rng?: () => number;
}): number {
  return input.killedAtMs + harthmereLiveCreatureRespawnDelayMs(input.rng);
}

/**
 * A creature scheduled for respawn at `respawnAtMs` is eligible to come back
 * once now has reached that time.
 */
export function harthmereLiveCreatureShouldRespawn(input: {
  nowMs: number;
  respawnAtMs: number;
}): boolean {
  return (
    Number.isFinite(input.respawnAtMs) && input.nowMs >= input.respawnAtMs
  );
}
