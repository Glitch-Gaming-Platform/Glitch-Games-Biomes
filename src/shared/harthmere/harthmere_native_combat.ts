import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import type {
  ReadonlyTriggerState,
  TriggerState,
} from "@/shared/ecs/gen/components";
import type { Item, ReadonlyItem } from "@/shared/game/item";
import {
  harthmereAllowedEquipmentSlots,
  listHarthmereItemDefinitions,
  type HarthmereEquipmentSlot,
  type HarthmereItemDefinition,
} from "@/shared/harthmere/mmo_inventory_authority";
import {
  harthmereNativeBiomesIdForItemId,
  harthmereNativeBiomesIdForNpcType,
} from "@/shared/harthmere/harthmere_native_item_ids";
import type { BiomesId } from "@/shared/ids";

export const HARTHMERE_NATIVE_COMBAT_VERSION =
  "harthmere-native-combat-v1" as const;

export interface HarthmereNativeCombatSeedLike {
  seedId: string;
  displayName: string;
  kind: "robot_sentinel" | "ambient_muck_monster" | "ambient_livestock";
  combatKind?: "mux" | "hex";
  areaId?: string;
  combatLevel?: number;
  combatHp?: number;
  species?: string;
  sizeTier?: "small" | "medium" | "large";
  meatUnits?: number;
  attackDamage?: number;
  killXp?: number;
}

export interface HarthmereNativeNpcCombatProfile {
  key: string;
  id: BiomesId;
  displayName: string;
  level: number;
  maxHp: number;
  attackDamage: number;
  attackDistance: number;
  attackIntervalSecs: number;
  attackStrikeMomentSecs: number;
  attackFovDeg: number;
  aggroTrigger:
    | { kind: "proximity"; distance: number }
    | { kind: "onlyIfAttacked" };
  disengageDistance: number;
  walkSpeed: number;
  runSpeed: number;
  rotateSpeed: number;
  behaviorKind: "hostile" | "retaliate" | "sentinel";
  dropItems: ReadonlyArray<{ itemId: string; count: number }>;
  killXp: number;
  isBoss: boolean;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+\d+$/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function harthmereNativeNpcTypeKeyForSeed(
  seed: HarthmereNativeCombatSeedLike
) {
  if (/muck[- ]scarred helix/i.test(seed.displayName)) {
    return "boss_muck_scarred_helix";
  }
  if (/thaedryn/i.test(seed.displayName)) {
    return "boss_thaedryn_bellbound";
  }
  if (seed.kind === "ambient_livestock") {
    return `livestock_${slug(seed.species || seed.displayName)}`;
  }
  if (seed.kind === "robot_sentinel") return "robot_sentinel";
  return `monster_${slug(seed.displayName)}`;
}

function monsterDamage(seed: HarthmereNativeCombatSeedLike) {
  if (Number.isFinite(seed.attackDamage)) {
    return Math.max(0, Math.trunc(seed.attackDamage!));
  }
  const level = Math.max(1, Math.trunc(seed.combatLevel ?? 1));
  return (
    (seed.combatKind === "hex"
      ? level >= 4
        ? 24
        : 18
      : level >= 3
      ? 16
      : 14) * 5
  );
}

export function harthmereNativeNpcCombatProfileForSeed(
  seed: HarthmereNativeCombatSeedLike
): HarthmereNativeNpcCombatProfile {
  const key = harthmereNativeNpcTypeKeyForSeed(seed);
  const level = Math.max(1, Math.trunc(seed.combatLevel ?? 1));
  const boss = /boss|muck[- ]scarred helix/i.test(`${key} ${seed.displayName}`);
  const livestock = seed.kind === "ambient_livestock";
  const sentinel = seed.kind === "robot_sentinel";
  const tutorialRetaliationOnly = seed.areaId === "road_muckwad_patch";
  const hex = seed.combatKind === "hex" || /hex/i.test(seed.displayName);
  const thaedryn = key === "boss_thaedryn_bellbound";
  return {
    key,
    id: harthmereNativeBiomesIdForNpcType(key)!,
    displayName: seed.displayName.replace(/\s+\d+$/, ""),
    level: boss ? Math.max(5, level) : level,
    maxHp: Math.max(
      1,
      Math.trunc(
        boss
          ? seed.combatHp ?? 1800
          : seed.kind === "ambient_muck_monster"
          ? (seed.combatHp ?? 110) * 5
          : seed.combatHp ?? (sentinel ? 1 : 40)
      )
    ),
    attackDamage: sentinel
      ? 0
      : boss
      ? Math.max(120, monsterDamage(seed))
      : monsterDamage(seed),
    attackDistance: thaedryn ? 8 : boss ? 3.2 : hex ? 3 : livestock ? 2 : 2.4,
    attackIntervalSecs: boss ? 1.6 : hex ? 2.1 : livestock ? 2.4 : 1.9,
    attackStrikeMomentSecs: boss ? 0.42 : 0.5,
    attackFovDeg: boss ? 170 : 125,
    aggroTrigger:
      sentinel || livestock || tutorialRetaliationOnly || thaedryn
        ? { kind: "onlyIfAttacked" }
        : { kind: "proximity", distance: boss ? 18 : hex ? 12 : 10.5 },
    disengageDistance: boss ? 42 : livestock ? 16 : 34,
    walkSpeed:
      sentinel || thaedryn
        ? 0
        : livestock
        ? seed.sizeTier === "small"
          ? 2.4
          : 1.4
        : hex
        ? 2.5
        : 2.2,
    runSpeed:
      sentinel || thaedryn
        ? 0
        : livestock
        ? seed.sizeTier === "small"
          ? 4.4
          : 3.1
        : hex
        ? 4.8
        : 4.4,
    rotateSpeed: sentinel ? 0 : boss ? 260 : 220,
    behaviorKind: sentinel
      ? "sentinel"
      : livestock || tutorialRetaliationOnly
      ? "retaliate"
      : "hostile",
    dropItems: thaedryn
      ? []
      : livestock
      ? [{ itemId: "raw_meat", count: Math.max(1, seed.meatUnits ?? 1) }]
      : boss
      ? [
          { itemId: "mana_essence", count: 4 },
          { itemId: "muckwad", count: 8 },
        ]
      : hex
      ? [{ itemId: "mana_essence", count: Math.max(1, level - 1) }]
      : [{ itemId: "raw_meat", count: Math.max(1, Math.floor(level / 2)) }],
    killXp: Math.max(
      1,
      Math.trunc(seed.killXp ?? (boss ? 500 : 20 + level * 15))
    ),
    isBoss: boss,
  };
}

export function harthmereNativeNpcBiscuit(
  profile: HarthmereNativeNpcCombatProfile,
  presentation?: Biscuit
): Biscuit {
  return {
    id: profile.id,
    name: `harthmere_npc_${profile.key}`,
    displayName: profile.displayName,
    boxSize: presentation?.boxSize ?? [1, 1.2, 1],
    rotateSpeed: profile.rotateSpeed,
    walkSpeed: profile.walkSpeed,
    runSpeed: profile.runSpeed,
    galoisPath: presentation?.galoisPath,
    effectsProfile: presentation?.effectsProfile,
    // Native death/respawn remains ECS-owned. Fixed Harthmere seed ids are
    // revived by the logic respawn service so process restarts cannot reset a
    // browser-local suppression timer or create a second copy.
    persistent: profile.key !== "boss_thaedryn_bellbound",
    respawnAfterSecs:
      profile.key === "boss_thaedryn_bellbound"
        ? undefined
        : profile.isBoss
        ? 30 * 60
        : 5 * 60,
    drop: profile.dropItems.length
      ? ([
          [
            "guaranteed",
            profile.dropItems.map(({ itemId, count }) => [
              harthmereNativeBiomesIdForItemId(itemId)!,
              count,
            ]),
          ],
        ] as Biscuit["drop"])
      : undefined,
    behavior: {
      damageable: {
        maxHp: profile.maxHp,
        attackable: profile.behaviorKind !== "sentinel",
      },
      chaseAttack:
        profile.attackDamage > 0
          ? {
              aggroTrigger: profile.aggroTrigger,
              disengageDistance: profile.disengageDistance,
              attackDistance: profile.attackDistance,
              attackAnimationMultiplier: 1,
              attackStrikeMomentSecs: profile.attackStrikeMomentSecs,
              attackIntervalSecs: profile.attackIntervalSecs,
              attackFovDeg: profile.attackFovDeg,
              attackDamage: profile.attackDamage,
            }
          : undefined,
      meander:
        profile.behaviorKind === "sentinel"
          ? undefined
          : { stayDistanceFromSpawn: profile.disengageDistance * 0.6 },
      questGiver: false,
      hideNameOverlay: { hideNameOverlay: false },
    },
  } as unknown as Biscuit;
}

export interface HarthmereNativeItemCombatProfile {
  itemId?: string;
  kind: "unarmed" | "melee" | "heavy" | "ranged" | "spell";
  damagePerHit: number;
  dps: number;
  intervalSecs: number;
  reach: number;
  levelRequirement: number;
  durabilityCostMs: number;
  armor: number;
  defense: number;
  evasion: number;
  manaCost: number;
  slots: readonly HarthmereEquipmentSlot[];
}

export function harthmereNativeItemDefinitionForBiomesId(id?: BiomesId) {
  if (!id) return undefined;
  return listHarthmereItemDefinitions().find(
    (definition) => harthmereNativeBiomesIdForItemId(definition.itemId) === id
  );
}

export function harthmereNativeItemCombatProfile(
  item: Pick<ReadonlyItem, "id"> | undefined
): HarthmereNativeItemCombatProfile | undefined {
  if (!item) {
    return {
      kind: "unarmed",
      damagePerHit: 8,
      dps: 16,
      intervalSecs: 0.5,
      reach: 3.5,
      levelRequirement: 1,
      durabilityCostMs: 0,
      armor: 0,
      defense: 0,
      evasion: 0,
      manaCost: 0,
      slots: [],
    };
  }
  const definition = harthmereNativeItemDefinitionForBiomesId(item.id);
  if (!definition) return undefined;
  const stats = definition.stats ?? {};
  const damagePerHit = Math.max(
    0,
    Number(
      stats.attackPoints ??
        stats.attack ??
        stats.rangedAttack ??
        stats.damage ??
        (definition.category === "tool" ? 5 : 0)
    ) || 0
  );
  const text = `${definition.itemId} ${definition.displayName}`.toLowerCase();
  const ranged =
    /bow|crossbow/.test(text) || Number(stats.rangedAttack ?? 0) > 0;
  const spell =
    definition.isSpellTome ||
    /staff|wand|tome|spell/.test(`${text} ${definition.category ?? ""}`);
  const heavy =
    definition.twoHanded === true || /two.?hand|greatsword|maul/.test(text);
  const intervalSecs = ranged
    ? 0.9
    : spell
    ? 0.75
    : heavy
    ? 0.8
    : /dagger/.test(text)
    ? 0.42
    : /axe/.test(text)
    ? 0.68
    : 0.55;
  return {
    itemId: definition.itemId,
    kind: ranged ? "ranged" : spell ? "spell" : heavy ? "heavy" : "melee",
    damagePerHit,
    dps: damagePerHit / intervalSecs,
    intervalSecs,
    reach: ranged ? 24 : spell ? 18 : heavy ? 4 : 3.5,
    levelRequirement: Math.max(1, Math.trunc(definition.levelRequirement || 1)),
    durabilityCostMs: definition.durabilityMax
      ? Math.max(1, Math.round(intervalSecs * 1000))
      : 0,
    armor: Math.max(0, Number(stats.armor ?? 0) || 0),
    defense: Math.max(0, Number(stats.defense ?? 0) || 0),
    evasion: Math.max(0, Number(stats.evasion ?? 0) || 0),
    manaCost: spell
      ? Math.max(1, Number(stats.manaCost ?? stats.resourceCost ?? 12) || 12)
      : 0,
    slots: harthmereAllowedEquipmentSlots(definition),
  };
}

export function harthmereNativeItemLifetimeDurabilityMs(
  definition: HarthmereItemDefinition,
  profile = harthmereNativeItemCombatProfile({
    id: harthmereNativeBiomesIdForItemId(definition.itemId)!,
  })
) {
  if (!definition.durabilityMax) return undefined;
  return definition.durabilityMax > 1000
    ? Math.trunc(definition.durabilityMax)
    : Math.max(
        1,
        Math.trunc(
          definition.durabilityMax * (profile?.durabilityCostMs ?? 500)
        )
      );
}

export const HARTHMERE_NATIVE_COMBAT_TRIGGER_ROOT =
  8_740_000_000_000_001 as BiomesId;
const LEVEL_KEY = 8_740_000_000_000_002 as BiomesId;
const XP_KEY = 8_740_000_000_000_003 as BiomesId;
const LAST_ATTACK_MS_KEY = 8_740_000_000_000_004 as BiomesId;
const BOSS_KILLS_KEY = 8_740_000_000_000_005 as BiomesId;
const MIGRATION_VERSION_KEY = 8_740_000_000_000_006 as BiomesId;

export interface HarthmereNativeCombatProgression {
  level: number;
  xp: number;
  lastAttackMs: number;
  bossKills: number;
  migrationVersion: number;
}

export function readHarthmereNativeCombatProgression(
  state: ReadonlyTriggerState | TriggerState | undefined
): HarthmereNativeCombatProgression {
  const values = state?.by_root.get(HARTHMERE_NATIVE_COMBAT_TRIGGER_ROOT);
  return {
    level: Math.max(1, Math.trunc(Number(values?.get(LEVEL_KEY) ?? 1) || 1)),
    xp: Math.max(0, Math.trunc(Number(values?.get(XP_KEY) ?? 0) || 0)),
    lastAttackMs: Math.max(
      0,
      Number(values?.get(LAST_ATTACK_MS_KEY) ?? 0) || 0
    ),
    bossKills: Math.max(
      0,
      Math.trunc(Number(values?.get(BOSS_KILLS_KEY) ?? 0) || 0)
    ),
    migrationVersion: Math.max(
      0,
      Math.trunc(Number(values?.get(MIGRATION_VERSION_KEY) ?? 0) || 0)
    ),
  };
}

export function writeHarthmereNativeCombatProgression(
  state: TriggerState,
  changes: Partial<HarthmereNativeCombatProgression>
) {
  const next = { ...readHarthmereNativeCombatProgression(state), ...changes };
  let values = state.by_root.get(HARTHMERE_NATIVE_COMBAT_TRIGGER_ROOT);
  if (!values) {
    values = new Map();
    state.by_root.set(HARTHMERE_NATIVE_COMBAT_TRIGGER_ROOT, values);
  }
  values.set(LEVEL_KEY, Math.max(1, Math.trunc(next.level)));
  values.set(XP_KEY, Math.max(0, Math.trunc(next.xp)));
  values.set(LAST_ATTACK_MS_KEY, Math.max(0, Math.trunc(next.lastAttackMs)));
  values.set(BOSS_KILLS_KEY, Math.max(0, Math.trunc(next.bossKills)));
  values.set(
    MIGRATION_VERSION_KEY,
    Math.max(0, Math.trunc(next.migrationVersion))
  );
  return readHarthmereNativeCombatProgression(state);
}

export function harthmereNativeXpForNextLevel(level: number) {
  return Math.max(100, Math.round(100 * Math.pow(Math.max(1, level), 1.45)));
}

export function awardHarthmereNativeCombatXp(
  state: TriggerState,
  xpDelta: number,
  bossKill = false
) {
  const current = readHarthmereNativeCombatProgression(state);
  let level = current.level;
  let xp = current.xp + Math.max(0, Math.trunc(xpDelta));
  while (xp >= harthmereNativeXpForNextLevel(level) && level < 100) {
    xp -= harthmereNativeXpForNextLevel(level++);
  }
  return writeHarthmereNativeCombatProgression(state, {
    level,
    xp,
    bossKills: current.bossKills + (bossKill ? 1 : 0),
  });
}

export function nativeCombatArmorStats(items: Iterable<ReadonlyItem | Item>) {
  let armor = 0;
  let defense = 0;
  let evasion = 0;
  for (const item of items) {
    const profile = harthmereNativeItemCombatProfile(item);
    armor += profile?.armor ?? 0;
    defense += profile?.defense ?? 0;
    evasion += profile?.evasion ?? 0;
  }
  return { armor, defense, evasion };
}

export function mitigateHarthmereNativeIncomingDamage(input: {
  rawDamage: number;
  armor: number;
  defense: number;
  evasion?: number;
  attackerLevel: number;
  defenderLevel: number;
}) {
  if (!Number.isFinite(input.rawDamage) || input.rawDamage <= 0) return 0;
  const effectiveArmor = Math.max(0, input.armor + input.defense * 0.6);
  const reduction =
    effectiveArmor /
    (effectiveArmor + 100 + 8 * Math.max(1, input.attackerLevel));
  const levelFactor = Math.max(
    0.65,
    Math.min(1.75, 1 + (input.attackerLevel - input.defenderLevel) * 0.05)
  );
  // Resolve evasion deterministically on the server. A random client-side miss
  // would disagree between observers; this bounded reduction preserves the stat
  // while keeping replayed native events deterministic.
  const evasionReduction = Math.min(
    0.35,
    Math.max(0, input.evasion ?? 0) / (Math.max(0, input.evasion ?? 0) + 200)
  );
  return Math.max(
    1,
    Math.round(
      Math.max(0, input.rawDamage) *
        levelFactor *
        (1 - Math.min(0.75, reduction)) *
        (1 - evasionReduction)
    )
  );
}
