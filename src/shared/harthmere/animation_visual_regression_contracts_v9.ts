// Harthmere animation visual regression contracts v9
// This file intentionally describes animation expectations across runtime systems.
// Static and live tests use it to prevent animation code from passing while visuals regress.

export const HARTHMERE_CREATURE_SOCIAL_DEATH_HANDTRACKING_VERSION_V9 =
  "harthmere-creature-social-death-handtracking-v9";

export const HARTHMERE_WEAPON_HAND_TRACKING_CONTRACT_V9 = {
  version: HARTHMERE_CREATURE_SOCIAL_DEATH_HANDTRACKING_VERSION_V9,
  maxGripDistanceMeters: 0.22,
  samples: ["drawnIdle", "windup", "impact", "recovery", "returnToIdle"] as const,
  requirement:
    "Weapon transform must be recomputed from the current hand/arm anchor every frame during swings; captured start transforms are not allowed to detach the blade from the arm swipe.",
} as const;

export const HARTHMERE_CREATURE_ANIMAL_ANIMATION_CONTRACT_V9 = {
  version: HARTHMERE_CREATURE_SOCIAL_DEATH_HANDTRACKING_VERSION_V9,
  families: ["wolf", "rat", "boar", "bear", "deer", "fox", "crow", "livestock", "undead"] as const,
  states: [
    "idle",
    "walk",
    "run",
    "attack",
    "hit",
    "death",
    "flee",
    "turnInPlace",
    "pathVelocitySync",
  ] as const,
  locomotionDeadzoneMetersPerSecond: 0.06,
  maxBlendDtSeconds: 1 / 24,
} as const;

export const HARTHMERE_SOCIAL_WORK_NPC_ANIMATION_CONTRACT_V9 = {
  version: HARTHMERE_CREATURE_SOCIAL_DEATH_HANDTRACKING_VERSION_V9,
  states: [
    "vendorIdle",
    "talkGesture",
    "questGesture",
    "sit",
    "eat",
    "drink",
    "sleep",
    "workLoop",
    "smithWork",
    "cookWork",
    "dockWork",
    "healerWork",
    "guardPatrolIdle",
    "crowdEmote",
  ] as const,
  requirement:
    "Work/social loops must be explicit states, not random walk/idles only, so schedules can drive believable NPC behavior.",
} as const;

export const HARTHMERE_DEATH_RESPAWN_CINEMATIC_CONTRACT_V9 = {
  version: HARTHMERE_CREATURE_SOCIAL_DEATH_HANDTRACKING_VERSION_V9,
  deathPoseDurationMs: 1250,
  corpseHoldScale: 0.84,
  npcCorpseShouldRemainVisible: true,
  playerControlsLockDuringDeath: true,
  respawnSequence: ["deathPose", "cameraHold", "fadeOut", "respawn", "fadeIn", "controlReturn"] as const,
  requirement:
    "Actors must not vanish immediately on death. NPCs hold a corpse pose; players lock controls, play death, fade/respawn, then return control.",
} as const;
