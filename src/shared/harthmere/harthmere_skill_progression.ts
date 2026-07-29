import type {
  ReadonlyTriggerState,
  TriggerState,
} from "@/shared/ecs/gen/components";
import {
  HARTHMERE_SKILL_XP_PER_LEVEL,
  HARTHMERE_SKILL_DEFINITIONS,
  harthmereSkillProgressFromTotalXp,
  harthmereSkillTotalXpCap,
  isHarthmereSkillId,
} from "@/shared/harthmere/mmo_class_ability_collectibles";
import type { BiomesId } from "@/shared/ids";

export const HARTHMERE_NATIVE_SKILL_TRIGGER_ROOT =
  8_740_000_000_000_101 as BiomesId;

export const HARTHMERE_SKILL_IDS = Object.freeze(
  Object.keys(HARTHMERE_SKILL_DEFINITIONS)
);

const SPECIALIZED_SKILL_IDS = HARTHMERE_SKILL_IDS.filter(
  (skillId) => skillId !== "character_level"
);

// These ids are persisted in TriggerState. Keep the mapping explicit so
// reordering HARTHMERE_SKILL_DEFINITIONS cannot reinterpret existing XP.
const SKILL_TRIGGER_KEYS = new Map<string, BiomesId>([
  ["combat", 8_740_000_000_000_200 as BiomesId],
  ["melee_combat", 8_740_000_000_000_201 as BiomesId],
  ["ranged_combat", 8_740_000_000_000_202 as BiomesId],
  ["shield_mastery", 8_740_000_000_000_203 as BiomesId],
  ["dagger_mastery", 8_740_000_000_000_204 as BiomesId],
  ["lockpicking", 8_740_000_000_000_205 as BiomesId],
  ["archery", 8_740_000_000_000_206 as BiomesId],
  ["tracking", 8_740_000_000_000_207 as BiomesId],
  ["fire_magic", 8_740_000_000_000_208 as BiomesId],
  ["arcane_literacy", 8_740_000_000_000_209 as BiomesId],
  ["holy_magic", 8_740_000_000_000_210 as BiomesId],
  ["medicine", 8_740_000_000_000_211 as BiomesId],
  ["death_lore", 8_740_000_000_000_212 as BiomesId],
  ["shadow_magic", 8_740_000_000_000_213 as BiomesId],
  ["nature_magic", 8_740_000_000_000_214 as BiomesId],
  ["farming", 8_740_000_000_000_215 as BiomesId],
  ["mining", 8_740_000_000_000_216 as BiomesId],
  ["gathering", 8_740_000_000_000_217 as BiomesId],
  ["cooking", 8_740_000_000_000_218 as BiomesId],
  ["crafting", 8_740_000_000_000_219 as BiomesId],
  ["blacksmithing", 8_740_000_000_000_220 as BiomesId],
  ["leatherworking", 8_740_000_000_000_221 as BiomesId],
  ["carpentry", 8_740_000_000_000_222 as BiomesId],
  ["tailoring", 8_740_000_000_000_223 as BiomesId],
  ["alchemy", 8_740_000_000_000_224 as BiomesId],
  ["enchanting", 8_740_000_000_000_225 as BiomesId],
  ["exotic_refining", 8_740_000_000_000_226 as BiomesId],
  ["bell_forging", 8_740_000_000_000_227 as BiomesId],
  ["fishing", 8_740_000_000_000_228 as BiomesId],
  ["care", 8_740_000_000_000_229 as BiomesId],
  ["persuasion", 8_740_000_000_000_230 as BiomesId],
  ["performance", 8_740_000_000_000_231 as BiomesId],
  ["business_operations", 8_740_000_000_000_232 as BiomesId],
]);

export interface HarthmereSkillXpAward {
  skillId: string;
  xp: number;
  source: string;
}

export interface HarthmereNativeSkillProgress {
  skillId: string;
  totalXp: number;
  level: number;
  xp: number;
  nextLevel: number;
  atCap: boolean;
}

export interface HarthmereSkillClientProjection {
  id: string;
  name: string;
  category: string;
  description?: string;
  maxLevel: number;
  level: number;
  xp: number;
  nextLevel: number;
  title: string;
  trainingActions: readonly string[];
  [key: string]: unknown;
}

function projectedSkillTitle(level: number) {
  return level >= 50
    ? "Adept"
    : level >= 25
    ? "Apprentice"
    : level > 0
    ? "Novice"
    : "Untrained";
}

function finiteNonNegativeInteger(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : fallback;
}

export function createHarthmereSkillClientProjection(input: {
  triggerState: ReadonlyTriggerState | TriggerState | undefined;
  progressionSkills?: readonly Record<string, unknown>[];
  characterProgression: {
    level: number;
    xp: number;
    nextLevel: number;
  };
}): HarthmereSkillClientProjection[] {
  const progressionById = new Map(
    (input.progressionSkills ?? []).flatMap((skill) => {
      const id = typeof skill.id === "string" ? skill.id : undefined;
      return id ? [[id, skill] as const] : [];
    })
  );
  const nativeProgressionInitialized = hasHarthmereNativeSkillProgression(
    input.triggerState
  );

  return Object.values(HARTHMERE_SKILL_DEFINITIONS).map((definition) => {
    const progression = progressionById.get(definition.id);
    if (definition.id === "character_level") {
      const level = finiteNonNegativeInteger(
        input.characterProgression.level,
        1
      );
      return {
        ...definition,
        ...progression,
        id: definition.id,
        name: definition.name,
        category: definition.category,
        maxLevel: definition.maxLevel,
        level,
        xp: finiteNonNegativeInteger(input.characterProgression.xp, 0),
        nextLevel: Math.max(
          1,
          finiteNonNegativeInteger(input.characterProgression.nextLevel, 1)
        ),
        title: projectedSkillTitle(level),
        trainingActions: HARTHMERE_SKILL_ACTION_COVERAGE.character_level ?? [],
      };
    }

    const progressionLevel = Math.max(
      1,
      finiteNonNegativeInteger(progression?.level, 1)
    );
    const progressionTotalXp = Math.min(
      harthmereSkillTotalXpCap(definition.id),
      Math.max(
        0,
        (progressionLevel - 1) * HARTHMERE_SKILL_XP_PER_LEVEL +
          finiteNonNegativeInteger(progression?.xp, 0)
      )
    );
    const nativeTotalXp = readHarthmereNativeSkillTotalXp(
      input.triggerState,
      definition.id
    );
    const progress = harthmereSkillProgressFromTotalXp(
      definition.id,
      nativeProgressionInitialized
        ? nativeTotalXp
        : Math.max(nativeTotalXp, progressionTotalXp)
    );
    const level = progress.level;
    return {
      ...definition,
      ...progression,
      id: definition.id,
      name: definition.name,
      category: definition.category,
      maxLevel: definition.maxLevel,
      level,
      xp: progress.xp,
      nextLevel: Math.max(1, progress.nextLevel),
      title: projectedSkillTitle(level),
      trainingActions: HARTHMERE_SKILL_ACTION_COVERAGE[definition.id] ?? [],
    };
  });
}

function skillValues(
  state: ReadonlyTriggerState | TriggerState | undefined
): ReadonlyMap<BiomesId, string | number> | undefined {
  return state?.by_root.get(HARTHMERE_NATIVE_SKILL_TRIGGER_ROOT);
}

export function hasHarthmereNativeSkillProgression(
  state: ReadonlyTriggerState | TriggerState | undefined
) {
  const values = skillValues(state);
  return (
    values !== undefined &&
    SPECIALIZED_SKILL_IDS.every((skillId) => {
      const key = harthmereNativeSkillTriggerKey(skillId);
      return key !== undefined && values.has(key);
    })
  );
}

export function harthmereNativeSkillTriggerKey(skillId: string) {
  return SKILL_TRIGGER_KEYS.get(skillId);
}

export function hasHarthmereNativeSkillEntry(
  state: ReadonlyTriggerState | TriggerState | undefined,
  skillId: string
) {
  const key = harthmereNativeSkillTriggerKey(skillId);
  return key !== undefined && (skillValues(state)?.has(key) ?? false);
}

export function readHarthmereNativeSkillTotalXp(
  state: ReadonlyTriggerState | TriggerState | undefined,
  skillId: string
) {
  if (!isHarthmereSkillId(skillId) || skillId === "character_level") {
    return 0;
  }
  const key = harthmereNativeSkillTriggerKey(skillId);
  const stored = Number((key && skillValues(state)?.get(key)) ?? 0);
  return Math.min(
    harthmereSkillTotalXpCap(skillId),
    Math.max(0, Number.isFinite(stored) ? Math.trunc(stored) : 0)
  );
}

export function readHarthmereNativeSkillProgress(
  state: ReadonlyTriggerState | TriggerState | undefined,
  skillId: string
): HarthmereNativeSkillProgress | undefined {
  if (!isHarthmereSkillId(skillId) || skillId === "character_level") {
    return undefined;
  }
  const totalXp = readHarthmereNativeSkillTotalXp(state, skillId);
  return {
    skillId,
    ...harthmereSkillProgressFromTotalXp(skillId, totalXp),
  };
}

export function readAllHarthmereNativeSkillTotalXp(
  state: ReadonlyTriggerState | TriggerState | undefined
) {
  return Object.fromEntries(
    SPECIALIZED_SKILL_IDS.map((skillId) => [
      skillId,
      readHarthmereNativeSkillTotalXp(state, skillId),
    ])
  );
}

export function writeHarthmereNativeSkillTotalXp(
  state: TriggerState,
  skillId: string,
  totalXp: number
) {
  if (!isHarthmereSkillId(skillId) || skillId === "character_level") {
    return undefined;
  }
  const key = harthmereNativeSkillTriggerKey(skillId);
  if (!key) return undefined;
  let values = state.by_root.get(HARTHMERE_NATIVE_SKILL_TRIGGER_ROOT);
  if (!values) {
    values = new Map();
    state.by_root.set(HARTHMERE_NATIVE_SKILL_TRIGGER_ROOT, values);
  }
  const capped = Math.min(
    harthmereSkillTotalXpCap(skillId),
    Math.max(0, Math.trunc(Number(totalXp) || 0))
  );
  values.set(key, capped);
  return readHarthmereNativeSkillProgress(state, skillId);
}

export function awardHarthmereNativeSkillXp(
  state: TriggerState,
  awards: readonly HarthmereSkillXpAward[]
) {
  const combined = new Map<string, number>();
  for (const award of awards) {
    if (
      award.skillId === "character_level" ||
      !isHarthmereSkillId(award.skillId) ||
      !Number.isFinite(award.xp) ||
      award.xp <= 0
    ) {
      continue;
    }
    combined.set(
      award.skillId,
      (combined.get(award.skillId) ?? 0) + Math.trunc(award.xp)
    );
  }
  return [...combined].flatMap(([skillId, xp]) => {
    const next = writeHarthmereNativeSkillTotalXp(
      state,
      skillId,
      readHarthmereNativeSkillTotalXp(state, skillId) + xp
    );
    return next ? [next] : [];
  });
}

function award(skillId: string, xp: number, source: string) {
  return { skillId, xp, source } satisfies HarthmereSkillXpAward;
}

function normalizedText(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

export function harthmereNativeCombatSkillAwards(input: {
  itemId?: string;
  kind: "unarmed" | "melee" | "heavy" | "ranged" | "spell";
  damage: number;
}) {
  const xp = Math.max(1, Math.min(25, Math.ceil(input.damage / 8)));
  const text = normalizedText(input.itemId);
  const awards = [award("combat", xp, "native_combat_hit")];
  if (input.kind === "ranged") {
    awards.push(award("ranged_combat", xp, "native_ranged_hit"));
    if (/bow|crossbow/.test(text)) {
      awards.push(award("archery", xp, "native_archery_hit"));
    }
  } else if (input.kind === "spell") {
    if (/holy|bless|smite|radiant|chapel|prayer/.test(text)) {
      awards.push(award("holy_magic", xp, "native_holy_spell_hit"));
    } else if (/shadow|death|drain|curse|necrom|skull|soul/.test(text)) {
      awards.push(award("shadow_magic", xp, "native_shadow_spell_hit"));
      awards.push(
        award(
          "death_lore",
          Math.max(1, Math.floor(xp / 2)),
          "native_death_spell_hit"
        )
      );
    } else if (/nature|root|thorn|druid|wild|sickle|growth/.test(text)) {
      awards.push(award("nature_magic", xp, "native_nature_spell_hit"));
    } else {
      awards.push(award("fire_magic", xp, "native_fire_spell_hit"));
    }
  } else {
    awards.push(award("melee_combat", xp, "native_melee_hit"));
    if (/dagger|knife|stiletto/.test(text)) {
      awards.push(award("dagger_mastery", xp, "native_dagger_hit"));
    }
  }
  return awards;
}

export function harthmereNativeShieldSkillAwards(input: {
  equippedItemIds: readonly string[];
  damageTaken: number;
}) {
  if (
    input.damageTaken <= 0 ||
    !input.equippedItemIds.some((itemId) => /shield|buckler/i.test(itemId))
  ) {
    return [];
  }
  return [
    award(
      "shield_mastery",
      Math.max(1, Math.min(20, Math.ceil(input.damageTaken / 10))),
      "native_shield_defense"
    ),
  ];
}

export function harthmereNativeMedicalSkillAwards(input: {
  itemId?: string;
  healthRestored: number;
}) {
  if (!Number.isFinite(input.healthRestored) || input.healthRestored <= 0) {
    return [];
  }
  const xp = Math.max(1, Math.min(20, Math.ceil(input.healthRestored / 10)));
  const awards = [award("medicine", xp, "native_medical_consumption")];
  if (
    /holy|bless|radiant|chapel|prayer|reviv|sanct/i.test(input.itemId ?? "")
  ) {
    awards.push(
      award(
        "holy_magic",
        Math.max(1, Math.floor(xp / 2)),
        "native_holy_medical_consumption"
      )
    );
  }
  return awards;
}

export function harthmereNativeFarmingSkillAwards(
  action: "till" | "plant" | "water" | "fertilize" | "harvest"
) {
  const farmingXp = action === "harvest" ? 12 : action === "plant" ? 8 : 5;
  return [
    award("farming", farmingXp, `native_farming_${action}`),
    award(
      "nature_magic",
      Math.max(1, Math.floor(farmingXp / 3)),
      `native_nature_${action}`
    ),
  ];
}

export function harthmereNativeGatheringSkillAwards(input: {
  sourceId?: string;
  mining?: boolean;
  fishing?: boolean;
  tracking?: boolean;
}) {
  const source = input.sourceId ?? "world_resource";
  const awards = [award("gathering", 6, `native_gathering:${source}`)];
  if (input.mining) awards.push(award("mining", 8, `native_mining:${source}`));
  if (input.fishing)
    awards.push(award("fishing", 10, `native_fishing:${source}`));
  if (input.tracking)
    awards.push(award("tracking", 8, `native_tracking:${source}`));
  return awards;
}

const PROFESSION_ALIASES: Readonly<Record<string, string>> = {
  smithing: "blacksmithing",
  logging: "gathering",
  herbalism: "gathering",
  scavenging: "gathering",
  magical_harvesting: "gathering",
  archaeology: "gathering",
  skinning: "gathering",
  monster_harvesting: "gathering",
  foraging: "gathering",
  trading: "business_operations",
  community: "persuasion",
};

export function normalizeHarthmereSkillId(skillId: string | undefined) {
  if (!skillId) return undefined;
  const normalized = PROFESSION_ALIASES[skillId] ?? skillId;
  return isHarthmereSkillId(normalized) ? normalized : undefined;
}

export function harthmereCraftingSkillAwards(input: {
  professionId?: string;
  xp: number;
  source: string;
}) {
  const professionId = normalizeHarthmereSkillId(input.professionId);
  const xp = Math.max(1, Math.trunc(input.xp));
  const awards = [award("crafting", xp, input.source)];
  if (professionId && professionId !== "crafting") {
    awards.push(award(professionId, xp, input.source));
  }
  return awards;
}

export function harthmereWorldInteractionSkillAwards(input: {
  kind: string;
  label?: string;
}) {
  const text = normalizedText(input.kind, input.label);
  const awards: HarthmereSkillXpAward[] = [];
  if (input.kind === "open_door" || input.kind === "open_gate") {
    awards.push(award("lockpicking", 8, "world_lock_interaction"));
  }
  if (input.kind === "repair") {
    awards.push(
      ...harthmereCraftingSkillAwards({
        professionId: "carpentry",
        xp: 8,
        source: "world_repair",
      })
    );
  }
  if (input.kind === "gather" || input.kind === "recover") {
    awards.push(
      ...harthmereNativeGatheringSkillAwards({
        sourceId: input.label,
        mining: /ore|stone|rock|mine|deposit|crystal/.test(text),
        fishing: /fish|pond|river|lake|pool|trout/.test(text),
        tracking: /track|trail|animal|wildlife|hunt/.test(text),
      })
    );
  }
  if (input.kind === "tend") {
    awards.push(...harthmereNativeFarmingSkillAwards("water"));
    awards.push(award("care", 5, "world_tend"));
  }
  if (input.kind === "practice") {
    awards.push(award("performance", 8, "world_practice"));
  }
  if (
    input.kind === "read" ||
    input.kind === "inspect" ||
    input.kind === "use"
  ) {
    if (/track|trail|hoof|antler|claw|wildlife|hunt/.test(text)) {
      awards.push(award("tracking", 8, "world_tracking_study"));
    } else if (/holy|bless|radiant|chapel|prayer|sanct/.test(text)) {
      awards.push(award("holy_magic", 8, "world_holy_study"));
    } else if (
      /grave|crypt|coffin|death|spirit|corpse|thaedryn|necrom/.test(text)
    ) {
      awards.push(award("death_lore", 8, "world_death_lore"));
      awards.push(award("shadow_magic", 4, "world_shadow_study"));
    } else if (/tree|plant|grove|soil|seed|animal|nature|root/.test(text)) {
      awards.push(award("nature_magic", 8, "world_nature_study"));
    } else {
      awards.push(award("arcane_literacy", 8, "world_arcane_study"));
    }
  }
  return awards;
}

export const HARTHMERE_SKILL_ACTION_COVERAGE: Readonly<
  Record<string, readonly string[]>
> = {
  character_level: ["Defeat enemies", "Complete quests"],
  combat: ["Hit an enemy"],
  melee_combat: ["Hit an enemy with your fists or a melee weapon"],
  ranged_combat: ["Hit an enemy from a distance"],
  shield_mastery: ["Take an enemy hit while a shield is equipped"],
  dagger_mastery: ["Hit an enemy with a dagger or knife"],
  lockpicking: ["Open a locked door or gate"],
  archery: ["Hit an enemy with a bow or crossbow"],
  tracking: ["Hunt wildlife or inspect tracks and trails"],
  fire_magic: ["Hit an enemy with a fire spell"],
  arcane_literacy: ["Read runes, inspect magical objects, or enchant an item"],
  holy_magic: ["Use a holy item, perform a healing rite, or cast a holy spell"],
  medicine: ["Restore health with a medical item or treat a patient"],
  death_lore: ["Study graves, defeat undead enemies, or use death magic"],
  shadow_magic: ["Cast shadow magic or study dark and haunted objects"],
  nature_magic: ["Tend crops or study plants, animals, and natural landmarks"],
  farming: ["Till soil, plant seeds, water, fertilize, or harvest crops"],
  mining: ["Mine ore, stone, or mineral deposits"],
  gathering: ["Harvest natural resources, forage, fish, or gather materials"],
  cooking: ["Cook a recipe or collect a completed cooking order"],
  crafting: ["Craft an item"],
  blacksmithing: ["Craft a blacksmithing recipe"],
  leatherworking: ["Craft a leatherworking recipe"],
  carpentry: ["Craft a carpentry recipe or repair a structure"],
  tailoring: ["Craft a tailoring recipe"],
  alchemy: ["Craft an alchemy recipe"],
  enchanting: ["Enchant an item"],
  exotic_refining: ["Refine exotic materials or craft an exotic recipe"],
  bell_forging: ["Forge a bell or bell-making material"],
  fishing: ["Catch a fish or fish at a fishing spot"],
  care: ["Complete a daily care task or tend a garden or community space"],
  persuasion: ["Talk to someone or complete a negotiation"],
  performance: ["Practice or perform at a stage, instrument, or training area"],
  business_operations: [
    "Run a business, trade at a market, manage staff, or complete a contract",
  ],
};
