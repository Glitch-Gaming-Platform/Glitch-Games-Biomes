// CHAPTER_1_DUNGEON_MECHANICS
//
// Server-authoritative survival consequences for the two Chapter 1 Mouths.
// The dungeon catalog describes the fiction; this module turns every authored
// zone into durable resource use plus native health/stamina consequences.
//
// Important authority split:
//   * water/fuel/light are a reservation of the pack verified at gate entry;
//   * health, stamina, breath, and drowning remain native ECS state;
//   * AUGUR-9 charge remains Chapter 1 server state (there is no ECS component
//     for its narrative log economy);
//   * the browser can choose an authored route, but never supplies costs.

import type { TriggerState } from "@/shared/ecs/gen/components";
import {
  ch1Augur9EnvironmentalDrain,
  type Ch1Augur9State,
} from "@/shared/harthmere/ch1_augur9";
import {
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import type { BiomesId } from "@/shared/ids";

export const CH1_DUNGEON_MECHANICS_VERSION =
  "ch1-dungeon-mechanics-v1" as const;

export type Ch1DungeonResourceKey = "water" | "fuel" | "light";

export interface Ch1DungeonSurvivalState {
  dungeonId: "ch1_dungeon_desert" | "ch1_dungeon_winter";
  resourceKey: "water" | "fuel";
  resourceInitial: number;
  resourceRemaining: number;
  lightInitial: number;
  lightRemaining: number;
  completedObjectiveIds: string[];
  lastOutcome?: string;
}

export interface Ch1DungeonMechanicEffect {
  effectKey: string;
  staminaDelta: number;
  healthDamage: number;
  resourceConsumes: Partial<Record<Ch1DungeonResourceKey, number>>;
  outcome: string;
}

export interface Ch1DungeonMechanicResult {
  ok: boolean;
  reason?: string;
  survival: Ch1DungeonSurvivalState;
  augur9: Ch1Augur9State;
  effect: Ch1DungeonMechanicEffect;
}

interface ZoneMechanic {
  dungeonId: Ch1DungeonSurvivalState["dungeonId"];
  minutes: number;
  resourceCost: number;
  lightCost?: number;
  staminaDelta: number;
  baseHealthDamage?: number;
  carryWeightLimit?: number;
  choices?: Readonly<Record<string, { staminaDelta?: number; healthDamage?: number; outcome: string }>>;
  requiredChoice?: boolean;
  correctChoice?: string;
  outcome: string;
}

// The per-zone resource totals deliberately equal the mandatory pack check:
// 12 water for the desert and 18 fuel for the winter. A player who packs only
// the minimum has no waste margin; extra supplies remain meaningful.
export const CH1_DUNGEON_ZONE_MECHANICS: Readonly<Record<string, ZoneMechanic>> =
  Object.freeze({
    d1_dune_threshold: {
      dungeonId: "ch1_dungeon_desert",
      minutes: 15,
      resourceCost: 1,
      staminaDelta: -8,
      outcome: "Heat drains stamina while the first water ration is spent.",
    },
    d1_salt_market: {
      dungeonId: "ch1_dungeon_desert",
      minutes: 25,
      resourceCost: 2,
      staminaDelta: -9,
      requiredChoice: true,
      choices: {
        drop_awnings: {
          staminaDelta: 3,
          outcome: "The collapsing awnings break the pack without a prolonged fight.",
        },
        fight_open: {
          healthDamage: 8,
          staminaDelta: -5,
          outcome: "Fighting in the open costs blood and more stamina.",
        },
      },
      outcome: "The Salt Market fight consumes water and stamina.",
    },
    d1_cistern_stair: {
      dungeonId: "ch1_dungeon_desert",
      minutes: 25,
      resourceCost: 1,
      lightCost: 3,
      staminaDelta: -6,
      requiredChoice: true,
      choices: {
        lit_stair: {
          outcome: "Three torches buy the slower stair and visible air pockets.",
        },
        no_air_shortcut: {
          staminaDelta: -8,
          healthDamage: 12,
          outcome: "The no-air shortcut saves time but exacts a drowning-risk penalty.",
        },
      },
      outcome: "The cistern consumes light, water, and stamina.",
    },
    ch1_a3_d1_hall_of_weights: {
      dungeonId: "ch1_dungeon_desert",
      minutes: 30,
      resourceCost: 2,
      staminaDelta: 2,
      requiredChoice: true,
      correctChoice: "temple_balance",
      choices: {
        temple_balance: {
          outcome: "Comparative measurement opens the vault; the modern readings are discarded.",
        },
        modern_scale_a: {
          outcome: "The first modern instrument drifts and cannot open the vault.",
        },
        modern_scale_b: {
          outcome: "The second modern instrument disagrees by a small, impossible amount.",
        },
      },
      outcome: "Shade and stillness restore a little stamina during the calibration.",
    },
    d1_sun_court: {
      dungeonId: "ch1_dungeon_desert",
      minutes: 20,
      resourceCost: 2,
      staminaDelta: -8,
      requiredChoice: true,
      choices: {
        stealth_bypass: {
          staminaDelta: 4,
          outcome: "The Bull never sees the player; its core remains in the guardian.",
        },
        break_horns: {
          healthDamage: 10,
          staminaDelta: -8,
          outcome: "The pillars break the Bull's horns before the final phase.",
        },
      },
      outcome: "The exposed Sun Court consumes water quickly.",
    },
    d1_seed_vault: {
      dungeonId: "ch1_dungeon_desert",
      minutes: 20,
      resourceCost: 1,
      staminaDelta: 5,
      outcome: "The cool Seed Vault restores stamina while one water ration is shared.",
    },
    d1_find_iris: {
      dungeonId: "ch1_dungeon_desert",
      minutes: 0,
      resourceCost: 0,
      staminaDelta: 0,
      outcome: "Iris is found alive; no additional survival interval elapses.",
    },
    d1_the_long_walk: {
      dungeonId: "ch1_dungeon_desert",
      minutes: 25,
      resourceCost: 3,
      staminaDelta: -18,
      baseHealthDamage: 4,
      outcome: "The sandstorm escort spends the last planned water and batters the party.",
    },
    d2_ice_shelf: {
      dungeonId: "ch1_dungeon_winter",
      minutes: 20,
      resourceCost: 2,
      staminaDelta: -10,
      outcome: "Fuel holds exposure back long enough to leave the landing.",
    },
    d2_longhouse: {
      dungeonId: "ch1_dungeon_winter",
      minutes: 30,
      resourceCost: 2,
      staminaDelta: -10,
      outcome: "The under-ice route consumes fuel and stamina; native breath remains the hard timer.",
    },
    d2_hanged_wood: {
      dungeonId: "ch1_dungeon_winter",
      minutes: 30,
      resourceCost: 2,
      staminaDelta: -8,
      requiredChoice: true,
      choices: {
        silent_path: {
          staminaDelta: 3,
          outcome: "Slow movement keeps the sound-hunters outside striking range.",
        },
        fight_through: {
          staminaDelta: -8,
          healthDamage: 12,
          outcome: "Noise draws unfinished things into an expensive running fight.",
        },
      },
      outcome: "The Hanged Wood punishes noise, not curiosity.",
    },
    d2_whale_road: {
      dungeonId: "ch1_dungeon_winter",
      minutes: 25,
      resourceCost: 2,
      staminaDelta: -12,
      // This is intentionally higher than the ordinary 25 lb encumbrance cap:
      // the player provisioned for an expedition, but still must make a real
      // load decision before thin ice accepts them.
      carryWeightLimit: 55,
      outcome: "The outbound ice crossing turns excess carry weight into a hard gate.",
    },
    d2_sorrels_camp: {
      dungeonId: "ch1_dungeon_winter",
      minutes: 25,
      resourceCost: 1,
      staminaDelta: 4,
      outcome: "Shelter at Sorrel's camp restores stamina but still burns carried fuel.",
    },
    d2_the_oath: {
      dungeonId: "ch1_dungeon_winter",
      minutes: 0,
      resourceCost: 0,
      staminaDelta: 0,
      outcome: "The oath advances story state without charging another survival interval.",
    },
    d2_ash_hall: {
      dungeonId: "ch1_dungeon_winter",
      minutes: 35,
      resourceCost: 6,
      staminaDelta: -14,
      requiredChoice: true,
      choices: {
        feed_hearth: {
          healthDamage: 8,
          outcome: "Six fuel units keep the Hearth Fails phase visible through the loop.",
        },
        fight_dark: {
          staminaDelta: -10,
          healthDamage: 24,
          outcome: "Refusing the hearth saves no authored fuel interval and makes the fight brutal.",
        },
      },
      outcome: "The Ninth Winter consumes the expedition's largest fuel interval.",
    },
    d2_hallrs_choice: {
      dungeonId: "ch1_dungeon_winter",
      minutes: 0,
      resourceCost: 0,
      staminaDelta: 0,
      outcome: "Hallr's decision is logged but never scored.",
    },
    d2_the_breaking_year: {
      dungeonId: "ch1_dungeon_winter",
      minutes: 25,
      resourceCost: 3,
      staminaDelta: -18,
      baseHealthDamage: 5,
      // Sorrel's added load makes the return threshold stricter.
      carryWeightLimit: 45,
      outcome: "The return crossing adds Sorrel to the load while nine years of weather arrive.",
    },
  });

export function ch1InitialDungeonSurvivalState(input: {
  dungeonId: Ch1DungeonSurvivalState["dungeonId"];
  carried: Readonly<Record<string, number>>;
}): Ch1DungeonSurvivalState {
  const resourceKey =
    input.dungeonId === "ch1_dungeon_desert" ? "water" : "fuel";
  const resourceInitial = Math.max(
    0,
    Math.trunc(Number(input.carried[resourceKey] ?? 0))
  );
  const lightInitial = Math.max(
    0,
    Math.trunc(Number(input.carried.light ?? 0))
  );
  return {
    dungeonId: input.dungeonId,
    resourceKey,
    resourceInitial,
    resourceRemaining: resourceInitial,
    lightInitial,
    lightRemaining: lightInitial,
    completedObjectiveIds: [],
  };
}

export function normalizeCh1DungeonSurvivalState(
  raw: unknown
): Ch1DungeonSurvivalState | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const dungeonId =
    value.dungeonId === "ch1_dungeon_desert" ||
    value.dungeonId === "ch1_dungeon_winter"
      ? value.dungeonId
      : undefined;
  if (!dungeonId) return undefined;
  const resourceKey = dungeonId === "ch1_dungeon_desert" ? "water" : "fuel";
  const bounded = (candidate: unknown) =>
    Math.max(0, Math.min(999, Number(candidate) || 0));
  return {
    dungeonId,
    resourceKey,
    resourceInitial: bounded(value.resourceInitial),
    resourceRemaining: bounded(value.resourceRemaining),
    lightInitial: bounded(value.lightInitial),
    lightRemaining: bounded(value.lightRemaining),
    completedObjectiveIds: Array.isArray(value.completedObjectiveIds)
      ? [...new Set(value.completedObjectiveIds.filter((entry): entry is string => typeof entry === "string"))]
      : [],
    lastOutcome:
      typeof value.lastOutcome === "string"
        ? value.lastOutcome.slice(0, 500)
        : undefined,
  };
}

export function ch1DungeonMechanicForObjective(stepId: string) {
  return CH1_DUNGEON_ZONE_MECHANICS[stepId];
}

export function ch1ApplyDungeonObjectiveMechanic(input: {
  survival: Ch1DungeonSurvivalState;
  augur9: Ch1Augur9State;
  stepId: string;
  choice?: string;
  carryWeight: number;
}): Ch1DungeonMechanicResult {
  const config = ch1DungeonMechanicForObjective(input.stepId);
  const noEffect: Ch1DungeonMechanicEffect = {
    effectKey: `${input.survival.dungeonId}/${input.stepId}`,
    staminaDelta: 0,
    healthDamage: 0,
    resourceConsumes: {},
    outcome: input.survival.lastOutcome ?? "No dungeon survival interval applied.",
  };
  if (!config || config.dungeonId !== input.survival.dungeonId) {
    return {
      ok: true,
      survival: input.survival,
      augur9: input.augur9,
      effect: noEffect,
    };
  }
  if (input.survival.completedObjectiveIds.includes(input.stepId)) {
    return {
      ok: true,
      survival: input.survival,
      augur9: input.augur9,
      effect: noEffect,
    };
  }
  if (config.requiredChoice && !input.choice) {
    return {
      ok: false,
      reason: "Choose how to handle this dungeon mechanic before continuing.",
      survival: input.survival,
      augur9: input.augur9,
      effect: noEffect,
    };
  }
  const choiceEffect = input.choice ? config.choices?.[input.choice] : undefined;
  if (config.requiredChoice && !choiceEffect) {
    return {
      ok: false,
      reason: "That is not a valid route through this dungeon mechanic.",
      survival: input.survival,
      augur9: input.augur9,
      effect: noEffect,
    };
  }
  if (config.correctChoice && input.choice !== config.correctChoice) {
    return {
      ok: false,
      reason: choiceEffect?.outcome ?? "The attempted solution does not work.",
      survival: input.survival,
      augur9: input.augur9,
      effect: noEffect,
    };
  }
  if (
    config.carryWeightLimit !== undefined &&
    input.carryWeight > config.carryWeightLimit
  ) {
    return {
      ok: false,
      reason:
        `The ice will not hold ${input.carryWeight.toFixed(1)} lb. ` +
        `Leave gear until the carried load is ${config.carryWeightLimit} lb or less.`,
      survival: input.survival,
      augur9: input.augur9,
      effect: noEffect,
    };
  }

  const resourceAvailable = input.survival.resourceRemaining;
  const resourceSpent = Math.min(resourceAvailable, config.resourceCost);
  const resourceShortage = Math.max(0, config.resourceCost - resourceSpent);
  const lightCost = config.lightCost ?? 0;
  const lightSpent = Math.min(input.survival.lightRemaining, lightCost);
  const lightShortage = Math.max(0, lightCost - lightSpent);
  const healthDamage = Math.max(
    0,
    (config.baseHealthDamage ?? 0) +
      (choiceEffect?.healthDamage ?? 0) +
      resourceShortage * 12 +
      lightShortage * 5
  );
  const staminaDelta =
    config.staminaDelta + (choiceEffect?.staminaDelta ?? 0) - resourceShortage * 8;
  const environment =
    input.survival.dungeonId === "ch1_dungeon_desert" ? "desert" : "winter";
  const augur9 = ch1Augur9EnvironmentalDrain(input.augur9, {
    hours: config.minutes / 60,
    environment,
  });
  const outcome = choiceEffect?.outcome ?? config.outcome;
  const survival: Ch1DungeonSurvivalState = {
    ...input.survival,
    resourceRemaining: Math.max(0, resourceAvailable - resourceSpent),
    lightRemaining: Math.max(0, input.survival.lightRemaining - lightSpent),
    completedObjectiveIds: [
      ...input.survival.completedObjectiveIds,
      input.stepId,
    ],
    lastOutcome:
      resourceShortage > 0 || lightShortage > 0
        ? `${outcome} Missing supplies convert directly into health and stamina loss.`
        : outcome,
  };
  return {
    ok: true,
    survival,
    augur9,
    effect: {
      effectKey: `${input.survival.dungeonId}/${input.stepId}`,
      staminaDelta,
      healthDamage,
      resourceConsumes: {
        [input.survival.resourceKey]: resourceSpent,
        ...(lightSpent > 0 ? { light: lightSpent } : {}),
      },
      outcome: survival.lastOutcome!,
    },
  };
}

export const CH1_DUNGEON_NATIVE_EFFECT_TRIGGER_ROOT =
  8_740_000_000_000_301 as BiomesId;
const CH1_DUNGEON_NATIVE_LAST_EFFECT_KEY =
  8_740_000_000_000_302 as BiomesId;

/**
 * Apply one objective's survival consequence to native ECS state. The last
 * effect key makes a retry after a progress-publish failure harmless.
 */
export function applyCh1DungeonNativeEffectForTest(input: {
  triggerState: TriggerState;
  health: { hp: number; maxHp: number };
  effect: Ch1DungeonMechanicEffect;
}) {
  let values = input.triggerState.by_root.get(
    CH1_DUNGEON_NATIVE_EFFECT_TRIGGER_ROOT
  );
  if (!values) {
    values = new Map();
    input.triggerState.by_root.set(CH1_DUNGEON_NATIVE_EFFECT_TRIGGER_ROOT, values);
  }
  if (values.get(CH1_DUNGEON_NATIVE_LAST_EFFECT_KEY) === input.effect.effectKey) {
    return { applied: false, vitals: readHarthmereNativeVitals(input.triggerState) };
  }
  const before = readHarthmereNativeVitals(input.triggerState);
  const vitals = writeHarthmereNativeVitals(input.triggerState, {
    stamina: Math.max(
      0,
      Math.min(before.maxStamina, before.stamina + input.effect.staminaDelta)
    ),
  });
  input.health.hp = Math.max(
    0,
    Math.min(input.health.maxHp, input.health.hp - input.effect.healthDamage)
  );
  values.set(CH1_DUNGEON_NATIVE_LAST_EFFECT_KEY, input.effect.effectKey);
  return { applied: true, vitals };
}
