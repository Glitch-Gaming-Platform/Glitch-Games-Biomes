import type {
  ReadonlyTriggerState,
  TriggerState,
} from "@/shared/ecs/gen/components";
import type { Item, ReadonlyItem } from "@/shared/game/item";
import { HARTHMERE_MEDICAL_ITEM_DEFINITIONS } from "@/shared/harthmere/mmo_medical_health";
import { HARTHMERE_FOOD_DEFINITIONS } from "@/shared/harthmere/mmo_farming_food_stamina";
import { harthmereNativeItemDefinitionForBiomesId } from "@/shared/harthmere/harthmere_native_combat";
import type { BiomesId } from "@/shared/ids";

export const HARTHMERE_NATIVE_VITALS_VERSION =
  "harthmere-native-vitals-v1" as const;
export const HARTHMERE_NATIVE_VITALS_MIGRATION_VERSION = 1;
export const HARTHMERE_NATIVE_MAX_BREATH_SECONDS = 15;
export const HARTHMERE_NATIVE_STAMINA_DRAIN_PER_SECOND = 100 / (2 * 60 * 60);
export const HARTHMERE_NATIVE_DROWNING_DAMAGE_PER_SECOND = 5;
export const HARTHMERE_GROVE_RESPAWN_POSITION = [496, 70, -126] as const;

export const HARTHMERE_NATIVE_VITALS_TRIGGER_ROOT =
  8_740_000_000_000_101 as BiomesId;
const MANA_KEY = 8_740_000_000_000_102 as BiomesId;
const MAX_MANA_KEY = 8_740_000_000_000_103 as BiomesId;
const STAMINA_KEY = 8_740_000_000_000_104 as BiomesId;
const MAX_STAMINA_KEY = 8_740_000_000_000_105 as BiomesId;
const BREATH_KEY = 8_740_000_000_000_106 as BiomesId;
const MAX_BREATH_KEY = 8_740_000_000_000_107 as BiomesId;
const LAST_TICK_MS_KEY = 8_740_000_000_000_108 as BiomesId;
const UNDERWATER_KEY = 8_740_000_000_000_109 as BiomesId;
const LIKEABILITY_KEY = 8_740_000_000_000_110 as BiomesId;
const LEGAL_KEY = 8_740_000_000_000_111 as BiomesId;
const NOTORIETY_KEY = 8_740_000_000_000_112 as BiomesId;
const NOTORIETY_FLOOR_KEY = 8_740_000_000_000_113 as BiomesId;
const STANDING_SCOPE_KEY = 8_740_000_000_000_114 as BiomesId;
const MIGRATION_VERSION_KEY = 8_740_000_000_000_115 as BiomesId;
const STATUS_PROJECTION_UPDATED_AT_MS_KEY = 8_740_000_000_000_116 as BiomesId;

export interface HarthmereNativeVitals {
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  breath: number;
  maxBreath: number;
  lastTickMs: number;
  underwater: boolean;
  likeability: number;
  legal: number;
  notoriety: number;
  notorietyFloor: number;
  standingScopeId: string;
  migrationVersion: number;
  statusProjectionUpdatedAtMs: number;
}

function finite(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function readHarthmereNativeVitals(
  state: ReadonlyTriggerState | TriggerState | undefined
): HarthmereNativeVitals {
  const values = state?.by_root.get(HARTHMERE_NATIVE_VITALS_TRIGGER_ROOT);
  const maxMana = Math.max(1, finite(values?.get(MAX_MANA_KEY), 100));
  const maxStamina = Math.max(1, finite(values?.get(MAX_STAMINA_KEY), 100));
  const maxBreath = Math.max(
    1,
    finite(values?.get(MAX_BREATH_KEY), HARTHMERE_NATIVE_MAX_BREATH_SECONDS)
  );
  const notorietyFloor = Math.max(
    0,
    Math.round(finite(values?.get(NOTORIETY_FLOOR_KEY), 0))
  );
  return {
    mana: clamp(finite(values?.get(MANA_KEY), maxMana), 0, maxMana),
    maxMana,
    stamina: clamp(finite(values?.get(STAMINA_KEY), maxStamina), 0, maxStamina),
    maxStamina,
    breath: clamp(finite(values?.get(BREATH_KEY), maxBreath), 0, maxBreath),
    maxBreath,
    lastTickMs: Math.max(0, finite(values?.get(LAST_TICK_MS_KEY), 0)),
    underwater: Number(values?.get(UNDERWATER_KEY) ?? 0) > 0,
    likeability: clamp(
      Math.round(finite(values?.get(LIKEABILITY_KEY), 0)),
      -10_000,
      10_000
    ),
    legal: clamp(
      Math.round(finite(values?.get(LEGAL_KEY), 0)),
      -10_000,
      10_000
    ),
    notoriety: Math.max(
      notorietyFloor,
      Math.round(finite(values?.get(NOTORIETY_KEY), 0))
    ),
    notorietyFloor,
    standingScopeId: String(values?.get(STANDING_SCOPE_KEY) ?? "harthmere"),
    migrationVersion: Math.max(
      0,
      Math.trunc(finite(values?.get(MIGRATION_VERSION_KEY), 0))
    ),
    statusProjectionUpdatedAtMs: Math.max(
      0,
      Math.trunc(finite(values?.get(STATUS_PROJECTION_UPDATED_AT_MS_KEY), 0))
    ),
  };
}

export function writeHarthmereNativeVitals(
  state: TriggerState,
  changes: Partial<HarthmereNativeVitals>
) {
  const next = { ...readHarthmereNativeVitals(state), ...changes };
  next.maxMana = Math.max(1, finite(next.maxMana, 100));
  next.mana = clamp(finite(next.mana, next.maxMana), 0, next.maxMana);
  next.maxStamina = Math.max(1, finite(next.maxStamina, 100));
  next.stamina = clamp(
    finite(next.stamina, next.maxStamina),
    0,
    next.maxStamina
  );
  next.maxBreath = Math.max(
    1,
    finite(next.maxBreath, HARTHMERE_NATIVE_MAX_BREATH_SECONDS)
  );
  next.breath = clamp(finite(next.breath, next.maxBreath), 0, next.maxBreath);
  next.likeability = clamp(Math.round(next.likeability), -10_000, 10_000);
  next.legal = clamp(Math.round(next.legal), -10_000, 10_000);
  next.notorietyFloor = Math.max(0, Math.round(next.notorietyFloor));
  next.notoriety = Math.max(next.notorietyFloor, Math.round(next.notoriety));

  let values = state.by_root.get(HARTHMERE_NATIVE_VITALS_TRIGGER_ROOT);
  if (!values) {
    values = new Map();
    state.by_root.set(HARTHMERE_NATIVE_VITALS_TRIGGER_ROOT, values);
  }
  values.set(MANA_KEY, next.mana);
  values.set(MAX_MANA_KEY, next.maxMana);
  values.set(STAMINA_KEY, next.stamina);
  values.set(MAX_STAMINA_KEY, next.maxStamina);
  values.set(BREATH_KEY, next.breath);
  values.set(MAX_BREATH_KEY, next.maxBreath);
  values.set(LAST_TICK_MS_KEY, Math.max(0, Math.trunc(next.lastTickMs)));
  values.set(UNDERWATER_KEY, next.underwater ? 1 : 0);
  values.set(LIKEABILITY_KEY, next.likeability);
  values.set(LEGAL_KEY, next.legal);
  values.set(NOTORIETY_KEY, next.notoriety);
  values.set(NOTORIETY_FLOOR_KEY, next.notorietyFloor);
  values.set(STANDING_SCOPE_KEY, next.standingScopeId || "harthmere");
  values.set(
    MIGRATION_VERSION_KEY,
    Math.max(0, Math.trunc(next.migrationVersion))
  );
  values.set(
    STATUS_PROJECTION_UPDATED_AT_MS_KEY,
    Math.max(0, Math.trunc(next.statusProjectionUpdatedAtMs))
  );
  return readHarthmereNativeVitals(state);
}

export interface HarthmereNativeVitalsTickResult {
  vitals: HarthmereNativeVitals;
  elapsedSeconds: number;
  damage: number;
  deathCause?: "stamina" | "drowning";
}

/**
 * Advances only active-play survival time. The elapsed window is bounded so a
 * suspended tab, network outage, or rolling deploy cannot apply hours of
 * starvation/drowning in one heartbeat.
 */
export function tickHarthmereNativeVitals(
  state: TriggerState,
  input: {
    nowMs: number;
    gameplayActive: boolean;
    underwater: boolean;
    alive: boolean;
    maxElapsedMs?: number;
  }
): HarthmereNativeVitalsTickResult {
  const before = readHarthmereNativeVitals(state);
  const elapsedMs =
    before.lastTickMs > 0
      ? clamp(input.nowMs - before.lastTickMs, 0, input.maxElapsedMs ?? 10_000)
      : 0;
  const elapsedSeconds = elapsedMs / 1000;
  let stamina = before.stamina;
  let breath = before.breath;
  let damage = 0;
  let deathCause: HarthmereNativeVitalsTickResult["deathCause"];

  if (input.alive && input.gameplayActive) {
    stamina = Math.max(
      0,
      stamina - elapsedSeconds * HARTHMERE_NATIVE_STAMINA_DRAIN_PER_SECOND
    );
    if (stamina <= 0) {
      deathCause = "stamina";
    }

    if (input.underwater) {
      const unprotectedSeconds = Math.max(0, elapsedSeconds - breath);
      breath = Math.max(0, breath - elapsedSeconds);
      if (unprotectedSeconds > 0) {
        damage = Math.max(
          1,
          Math.ceil(
            unprotectedSeconds * HARTHMERE_NATIVE_DROWNING_DAMAGE_PER_SECOND
          )
        );
        deathCause = "drowning";
      }
    } else {
      breath = before.maxBreath;
    }
  } else if (!input.underwater) {
    breath = before.maxBreath;
  }

  const vitals = writeHarthmereNativeVitals(state, {
    stamina,
    breath,
    underwater: input.underwater,
    lastTickMs: input.nowMs,
  });
  return { vitals, elapsedSeconds, damage, deathCause };
}

export function restoreHarthmereNativeVitalsForRespawn(
  state: TriggerState,
  nowMs: number
) {
  const before = readHarthmereNativeVitals(state);
  return writeHarthmereNativeVitals(state, {
    mana: before.maxMana,
    stamina: before.maxStamina,
    breath: before.maxBreath,
    underwater: false,
    lastTickMs: nowMs,
  });
}

export interface HarthmereNativeConsumableProfile {
  itemId: string;
  staminaRestore: number;
  manaRestore: number;
  healthRestore: number;
  action: "eat" | "drink";
}

export function harthmereNativeConsumableProfile(
  item: Pick<ReadonlyItem | Item, "id"> | undefined
): HarthmereNativeConsumableProfile | undefined {
  const definition = item
    ? harthmereNativeItemDefinitionForBiomesId(item.id)
    : undefined;
  if (!definition?.isConsumable) return undefined;
  const food = HARTHMERE_FOOD_DEFINITIONS[definition.itemId];
  const medical = HARTHMERE_MEDICAL_ITEM_DEFINITIONS[definition.itemId];
  const staminaRestore =
    food && food.edible !== false ? Math.max(0, food.staminaRestore) : 0;
  const manaRestore = Math.max(
    0,
    Number(definition.stats.manaRestore ?? definition.stats.restoreMana ?? 0) ||
      0
  );
  const healthRestore = Math.max(
    0,
    Number(
      medical?.healthRestore ??
        definition.stats.useHeal ??
        definition.stats.healthRestore ??
        0
    ) || 0
  );
  return {
    itemId: definition.itemId,
    staminaRestore,
    manaRestore,
    healthRestore,
    action:
      food?.source === "drink" ||
      /potion|draught|tonic|drink/i.test(
        `${definition.itemId} ${definition.displayName}`
      )
        ? "drink"
        : "eat",
  };
}

export function applyHarthmereNativeConsumableToVitals(
  state: TriggerState,
  profile: HarthmereNativeConsumableProfile
) {
  const before = readHarthmereNativeVitals(state);
  return writeHarthmereNativeVitals(state, {
    stamina: Math.min(
      before.maxStamina,
      before.stamina + profile.staminaRestore
    ),
    mana: Math.min(before.maxMana, before.mana + profile.manaRestore),
  });
}
