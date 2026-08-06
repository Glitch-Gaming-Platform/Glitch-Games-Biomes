export const HARTHMERE_FUTURE_STAGGER_ANIMATION_ASSETS_VERSION =
  "harthmere-future-stagger-animation-assets-v1" as const;

/**
 * Authored humanoid NPC stagger clips. These are packaged in the shared
 * character animation library but deliberately not selected by runtime code
 * until player-like NPC stagger authority is implemented.
 */
export const HARTHMERE_FUTURE_NPC_STAGGER_CLIPS = [
  "NpcStaggerLight",
  "NpcStaggerMedium",
  "NpcStaggerHeavy",
] as const;

/**
 * Authored on every bespoke live boss rig. Boss hyper-armor/poise and clip
 * execution remain a later gameplay feature.
 */
export const HARTHMERE_FUTURE_BOSS_STAGGER_CLIPS = [
  "BossStaggerLight",
  "BossStaggerMedium",
  "BossStaggerHeavy",
] as const;

export const HARTHMERE_FUTURE_STAGGER_RUNTIME_EXECUTION = Object.freeze({
  npc: false,
  boss: false,
});

export type HarthmereFutureNpcStaggerClip =
  (typeof HARTHMERE_FUTURE_NPC_STAGGER_CLIPS)[number];

export type HarthmereFutureBossStaggerClip =
  (typeof HARTHMERE_FUTURE_BOSS_STAGGER_CLIPS)[number];
