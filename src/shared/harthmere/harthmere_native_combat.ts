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
import {
  getHarthmereProjectileVisual,
  harthmereNativeNpcProjectileVisualId,
} from "@/shared/harthmere/projectile_visual_manifest";
import type {
  Behavior,
  BehaviorRangedAttackParams,
} from "@/shared/npc/npc_types";
import {
  getHarthmereEnergyWeapon,
  type HarthmereEnergyWeaponId,
} from "@/shared/harthmere/energy_weapon_catalog";
import { harthmereBossAttacksForLabel } from "@/shared/harthmere/boss_attack_catalog";
import { harthmereMuckCreatureAssetKeyForLabel } from "@/shared/harthmere/muck_creature_assets";

export const HARTHMERE_NATIVE_COMBAT_VERSION =
  "harthmere-native-combat-v1" as const;

export const HARTHMERE_HEX_FIREBALL_COOLDOWN_SECS = 20;
export const HARTHMERE_HEX_FIREBALL_RANGE = 12;
export const HARTHMERE_HEX_FIREBALL_MINIMUM_RANGE = 4.25;
export const HARTHMERE_HEX_FIREBALL_CAST_TIME_SECS = 0.65;
export const HARTHMERE_HEX_BOSS_SECONDARY_COOLDOWN_SECS = 5.5;
export const HARTHMERE_HEX_BOSS_RANGED_RANGE = 18;

export interface HarthmereNativeCombatSeedLike {
  seedId: string;
  displayName: string;
  kind:
    | "robot_sentinel"
    | "ambient_muck_monster"
    | "ambient_livestock"
    | "ambient_bandit";
  combatKind?: "mux" | "hex";
  areaId?: string;
  combatLevel?: number;
  combatHp?: number;
  species?: string;
  sizeTier?: "small" | "medium" | "large";
  meatUnits?: number;
  attackDamage?: number;
  killXp?: number;
  banditRole?:
    | "scout"
    | "archer"
    | "skirmisher"
    | "brute"
    | "captain"
    | "prisoner";
  /**
   * HARTHMERE_QUEST_GUARANTEED_DROP: extra guaranteed drops carried by an
   * original-snapshot Bikkie item id.
   *
   * Deliberately typed as a BiomesId rather than a Harthmere item slug. The
   * items these seeds owe are authored in the immutable May 2026 tray (e.g.
   * Mucker Tooth 1534621126189454) and must NOT be re-minted as Harthmere
   * native items: doing so would put a second identity into
   * `HARTHMERE_NATIVE_ITEM_ID_MANIFEST`, give it a reverse projection, and let
   * the live-mode inventory bridge treat a snapshot item as a Harthmere one.
   *
   * These merge with, and never replace, the generic family drops.
   */
  questDropBikkieItems?: ReadonlyArray<{
    bikkieItemId: BiomesId;
    count: number;
  }>;
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
  behaviorKind: "hostile" | "retaliate" | "sentinel" | "prisoner";
  dropItems: ReadonlyArray<{ itemId: string; count: number }>;
  /** See `questDropBikkieItems` on the seed; carried through verbatim. */
  questDropBikkieItems: ReadonlyArray<{
    bikkieItemId: BiomesId;
    count: number;
  }>;
  killXp: number;
  isBoss: boolean;
  /** Original snapshot renderer route for this native NPC type. */
  galoisPath?: string;
  /** Human NPCs use the same generated wearable mesh as real players. */
  isPlayerLikeAppearance?: true;
  projectileVisualId?: string;
  rangedAttacks?: readonly BehaviorRangedAttackParams[];
}

export function harthmereNativeNpcProjectilePresentation(input: {
  profile: HarthmereNativeNpcCombatProfile | undefined;
  attackTime: number | undefined;
  rangedState:
    | {
        abilityId: string;
        projectileVisualId: string;
        castTime: number;
        aimPoint: readonly [number, number, number];
        result?: "hit" | "miss";
      }
    | undefined;
}) {
  const { profile, attackTime, rangedState } = input;
  const rangedAttack = profile?.rangedAttacks?.find(
    ({ abilityId, projectileVisualId }) =>
      rangedState?.abilityId === abilityId &&
      rangedState.projectileVisualId === projectileVisualId
  );
  if (
    rangedAttack &&
    rangedState &&
    attackTime !== undefined &&
    Math.abs(rangedState.castTime - attackTime) <= 0.001
  ) {
    return {
      projectileVisualId: rangedState.projectileVisualId,
      abilityId: rangedState.abilityId,
      displayName: rangedAttack.displayName,
      attackShape: rangedAttack.attackShape,
      damageType: rangedAttack.damageType,
      animationClip: rangedAttack.animationClip,
      specialAnimationClip: rangedAttack.specialAnimationClip,
      attackDistance: rangedAttack.attackDistance,
      hitRadius: rangedAttack.hitRadius,
      coneAngleDeg: rangedAttack.coneAngleDeg,
      windupSecs: rangedAttack.castTimeSecs,
      aimPoint: rangedState.aimPoint,
      result: rangedState.result,
    };
  }
  if (profile?.rangedAttacks?.length || !profile?.projectileVisualId) {
    return undefined;
  }
  return { projectileVisualId: profile.projectileVisualId };
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
  if (seed.kind === "ambient_bandit") {
    return `bandit_${seed.banditRole ?? "scout"}`;
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
  const bandit = seed.kind === "ambient_bandit";
  const banditRole = seed.banditRole ?? "scout";
  const prisoner = bandit && banditRole === "prisoner";
  const quickerLargeLivestock =
    livestock && (seed.species === "cow" || seed.species === "sheep");
  const tutorialRetaliationOnly = seed.areaId === "road_muckwad_patch";
  const hex = seed.combatKind === "hex" || /hex/i.test(seed.displayName);
  const thaedryn = key === "boss_thaedryn_bellbound";
  const isPlayerLikeAppearance = bandit ? true : undefined;
  const galoisPath = sentinel
    ? "npcs/helping_robot"
    : livestock
    ? harthmereMuckCreatureAssetKeyForLabel(
        `${seed.species ?? ""} ${seed.displayName}`
      )
    : bandit
    ? undefined
    : harthmereMuckCreatureAssetKeyForLabel(seed.displayName) ??
      (hex ? "npcs/brown_hexer" : "npcs/mossy_mucker");
  const attackDamage = sentinel
    ? 0
    : boss
    ? Math.max(120, monsterDamage(seed))
    : monsterDamage(seed);
  const fireballVisual = getHarthmereProjectileVisual("fireball");
  const secondaryVisual = getHarthmereProjectileVisual(
    thaedryn ? "thaedryn_resonance" : "hex_bolt"
  );
  const fireballAttack: BehaviorRangedAttackParams | undefined =
    hex && fireballVisual?.id === "fireball"
      ? {
          abilityId: "fireball",
          projectileVisualId: fireballVisual.id,
          minimumDistance: boss ? 5 : HARTHMERE_HEX_FIREBALL_MINIMUM_RANGE,
          attackDistance: boss
            ? HARTHMERE_HEX_BOSS_RANGED_RANGE
            : HARTHMERE_HEX_FIREBALL_RANGE,
          attackDamage: Math.max(30, Math.round(attackDamage * 0.7)),
          castTimeSecs: HARTHMERE_HEX_FIREBALL_CAST_TIME_SECS,
          cooldownSecs: HARTHMERE_HEX_FIREBALL_COOLDOWN_SECS,
          sharedCooldownSecs: boss
            ? 2.75
            : HARTHMERE_HEX_FIREBALL_COOLDOWN_SECS,
          hitRadius: boss ? 1.05 : 0.8,
        }
      : undefined;
  const bossSecondaryAttack: BehaviorRangedAttackParams | undefined =
    hex && boss && secondaryVisual
      ? {
          abilityId: thaedryn ? "thaedryn_resonance" : "hex_bolt",
          projectileVisualId: secondaryVisual.id,
          minimumDistance: 4,
          attackDistance: HARTHMERE_HEX_BOSS_RANGED_RANGE,
          attackDamage: Math.max(40, Math.round(attackDamage * 0.82)),
          castTimeSecs: thaedryn ? 0.8 : 0.55,
          cooldownSecs: HARTHMERE_HEX_BOSS_SECONDARY_COOLDOWN_SECS,
          sharedCooldownSecs: 2.75,
          hitRadius: thaedryn ? 1.25 : 0.9,
        }
      : undefined;
  const authoredBossAttacks = boss
    ? harthmereBossAttacksForLabel(seed.displayName)
    : undefined;
  const rangedAttacks = authoredBossAttacks
    ? [...authoredBossAttacks]
    : [fireballAttack, bossSecondaryAttack].filter(
        (attack): attack is BehaviorRangedAttackParams => Boolean(attack)
      );
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
    attackDamage,
    attackDistance: thaedryn
      ? 8
      : boss
      ? 3.2
      : banditRole === "archer"
      ? 12
      : hex
      ? 3
      : livestock
      ? 2
      : 2.4,
    attackIntervalSecs: boss
      ? 1.6
      : banditRole === "skirmisher"
      ? 1.35
      : banditRole === "captain"
      ? 1.5
      : banditRole === "archer"
      ? 1.7
      : banditRole === "brute"
      ? 2.2
      : hex
      ? 2.1
      : livestock
      ? quickerLargeLivestock
        ? 1.8
        : 2.4
      : 1.9,
    attackStrikeMomentSecs: boss ? 0.42 : 0.5,
    attackFovDeg: boss || banditRole === "captain" ? 170 : bandit ? 145 : 125,
    aggroTrigger:
      sentinel || livestock || tutorialRetaliationOnly || thaedryn || prisoner
        ? { kind: "onlyIfAttacked" }
        : {
            kind: "proximity",
            distance: boss ? 18 : bandit ? 14 : hex ? 12 : 10.5,
          },
    disengageDistance: boss
      ? 42
      : prisoner
      ? 8
      : livestock
      ? 16
      : bandit
      ? 32
      : 34,
    walkSpeed:
      sentinel || thaedryn || prisoner
        ? 0
        : bandit
        ? banditRole === "brute"
          ? 1.8
          : banditRole === "captain"
          ? 2.4
          : 2.7
        : livestock
        ? seed.sizeTier === "small"
          ? 2.4
          : quickerLargeLivestock
          ? 1.65
          : 1.4
        : hex
        ? 2.5
        : 2.2,
    runSpeed:
      sentinel || thaedryn || prisoner
        ? 0
        : bandit
        ? banditRole === "brute"
          ? 4.2
          : banditRole === "captain"
          ? 5.2
          : banditRole === "skirmisher"
          ? 5.8
          : 5.1
        : livestock
        ? seed.sizeTier === "small"
          ? 4.4
          : quickerLargeLivestock
          ? 3.5
          : 3.1
        : hex
        ? 4.8
        : 4.4,
    rotateSpeed: sentinel || prisoner ? 0 : boss ? 260 : bandit ? 250 : 220,
    behaviorKind: sentinel
      ? "sentinel"
      : prisoner
      ? "prisoner"
      : livestock || tutorialRetaliationOnly
      ? "retaliate"
      : "hostile",
    dropItems: thaedryn
      ? []
      : prisoner
      ? []
      : bandit
      ? [{ itemId: "old_coin", count: banditRole === "captain" ? 4 : 2 }]
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
    questDropBikkieItems: seed.questDropBikkieItems ?? [],
    killXp: Math.max(
      1,
      Math.trunc(seed.killXp ?? (boss ? 500 : 20 + level * 15))
    ),
    isBoss: boss,
    galoisPath,
    isPlayerLikeAppearance,
    projectileVisualId: harthmereNativeNpcProjectileVisualId({
      key,
      displayName: seed.displayName,
      combatKind: seed.combatKind,
      banditRole,
    }),
    rangedAttacks: rangedAttacks.length ? rangedAttacks : undefined,
  };
}

/**
 * Canonical Anima combat behavior for a native Harthmere NPC type.
 *
 * The production Bikkie tray can temporarily lag a code-authored combat
 * profile during a rolling data migration. Keep the conversion in one place so
 * both the biscuit overlay and Anima derive exactly the same attack parameters
 * instead of letting a stale legacy `attackable: false` shape disable combat.
 */
export function harthmereNativeNpcChaseAttackParams(
  profile: HarthmereNativeNpcCombatProfile
): NonNullable<Behavior["chaseAttack"]> | undefined {
  if (profile.attackDamage <= 0) {
    return undefined;
  }
  return {
    aggroTrigger: profile.aggroTrigger,
    disengageDistance: profile.disengageDistance,
    attackDistance: profile.attackDistance,
    attackAnimationMultiplier: 1,
    attackStrikeMomentSecs: profile.attackStrikeMomentSecs,
    attackIntervalSecs: profile.attackIntervalSecs,
    attackFovDeg: profile.attackFovDeg,
    attackDamage: profile.attackDamage,
    rangedAttacks: profile.rangedAttacks
      ? [...profile.rangedAttacks]
      : undefined,
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
    // Preserve the May 2026 renderer split: humans use the generated
    // player/wearables mesh; creatures and robots use their authored Galois
    // rigs. Never borrow dMucker's body merely because it donates behavior
    // presentation metadata.
    galoisPath: profile.galoisPath ?? presentation?.galoisPath,
    ...(profile.isPlayerLikeAppearance
      ? { isPlayerLikeAppearance: true as const }
      : {}),
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
    // HARTHMERE_QUEST_GUARANTEED_DROP: quest items join the SAME "guaranteed"
    // bucket as the family drop. `rollSpec` in the npc kill handler rolls each
    // bucket independently, so a separate bucket would make the quest item
    // probabilistic and turn "Collect 6 Mucker Teeth" into an open-ended grind.
    drop:
      profile.dropItems.length || profile.questDropBikkieItems.length
        ? ([
            [
              "guaranteed",
              [
                ...profile.dropItems.map(({ itemId, count }) => [
                  harthmereNativeBiomesIdForItemId(itemId)!,
                  count,
                ]),
                ...profile.questDropBikkieItems.map(
                  ({ bikkieItemId, count }) => [bikkieItemId, count]
                ),
              ],
            ],
          ] as Biscuit["drop"])
        : undefined,
    behavior: {
      damageable: {
        maxHp: profile.maxHp,
        attackable: profile.behaviorKind !== "sentinel",
      },
      chaseAttack: harthmereNativeNpcChaseAttackParams(profile),
      meander:
        profile.behaviorKind === "sentinel" ||
        profile.behaviorKind === "prisoner"
          ? undefined
          : { stayDistanceFromSpawn: profile.disengageDistance * 0.6 },
      hideNameOverlay: { hideNameOverlay: false },
    } satisfies Behavior,
  } as unknown as Biscuit;
}

export interface HarthmereNativeItemCombatProfile {
  itemId?: string;
  energyWeaponId?: HarthmereEnergyWeaponId;
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
  const energyWeapon = getHarthmereEnergyWeapon(definition.itemId);
  if (energyWeapon) {
    return {
      itemId: definition.itemId,
      energyWeaponId: energyWeapon.id,
      kind: "ranged",
      damagePerHit: energyWeapon.baseDamage,
      dps: energyWeapon.baseDamage / (energyWeapon.cooldownMs / 1000),
      intervalSecs: energyWeapon.cooldownMs / 1000,
      reach: energyWeapon.hardMaxRange,
      levelRequirement: energyWeapon.requiredLevel,
      durabilityCostMs: 0,
      armor: 0,
      defense: 0,
      evasion: 0,
      manaCost: 0,
      slots: harthmereAllowedEquipmentSlots(definition),
    };
  }
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

export interface HarthmereNativeOffensiveStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  accuracy: number;
  criticalChance: number;
  spellPower: number;
}

export interface HarthmereNativeAttackStatResult {
  damage: number;
  critical: boolean;
  attributeMultiplier: number;
  accuracyMultiplier: number;
  criticalMultiplier: number;
}

function nativeCombatDeterministicRoll(
  seed: ReadonlyArray<string | number | bigint | undefined>
) {
  // FNV-1a over stable server-owned attack inputs. The previous committed
  // attack timestamp changes after every accepted swing, while transaction
  // retries see the same seed and therefore resolve the same critical result.
  let hash = 0x811c9dc5;
  const text = seed.map((part) => String(part ?? "")).join(":");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

/**
 * Applies the level-derived offensive attributes before target-level and armor
 * mitigation. Level 1 is deliberately neutral: its 10/10/10 attributes,
 * 75 accuracy, zero spell power, and zero critical chance reproduce the
 * historical native damage exactly.
 */
export function applyHarthmereNativeAttackStats(input: {
  baseDamage: number;
  kind: HarthmereNativeItemCombatProfile["kind"];
  stats: HarthmereNativeOffensiveStats;
  targetEvasion?: number;
  criticalSeed: ReadonlyArray<string | number | bigint | undefined>;
}): HarthmereNativeAttackStatResult {
  const strengthBonus = Math.max(0, input.stats.strength - 10);
  const dexterityBonus = Math.max(0, input.stats.dexterity - 10);
  const intelligenceBonus = Math.max(0, input.stats.intelligence - 10);
  const attributeMultiplier =
    input.kind === "spell"
      ? 1 + intelligenceBonus * 0.004 + input.stats.spellPower * 0.001
      : input.kind === "ranged"
      ? 1 + dexterityBonus * 0.005
      : input.kind === "heavy"
      ? 1 + strengthBonus * 0.006
      : input.kind === "melee"
      ? 1 + strengthBonus * 0.005
      : 1 + strengthBonus * 0.004;

  const accuracyBonus = Math.max(0, input.stats.accuracy - 75);
  const accuracyPressure =
    accuracyBonus - Math.max(0, input.targetEvasion ?? 0);
  const accuracyMultiplier = Math.max(
    0.9,
    Math.min(1.1, 1 + accuracyPressure * 0.002)
  );
  const criticalChance = Math.max(
    0,
    Math.min(0.75, input.stats.criticalChance)
  );
  const critical =
    criticalChance > 0 &&
    nativeCombatDeterministicRoll(input.criticalSeed) < criticalChance;
  const criticalMultiplier = critical ? 1.5 : 1;
  return {
    damage: Math.max(
      1,
      Math.round(
        Math.max(0, input.baseDamage) *
          attributeMultiplier *
          accuracyMultiplier *
          criticalMultiplier
      )
    ),
    critical,
    attributeMultiplier,
    accuracyMultiplier,
    criticalMultiplier,
  };
}

export function mitigateHarthmereNativeIncomingDamage(input: {
  rawDamage: number;
  armor: number;
  defense: number;
  magicResistance?: number;
  damageType?: BehaviorRangedAttackParams["damageType"];
  evasion?: number;
  accuracy?: number;
  attackerLevel: number;
  defenderLevel: number;
}) {
  if (!Number.isFinite(input.rawDamage) || input.rawDamage <= 0) return 0;
  const physicalDamage =
    input.damageType === undefined ||
    ["physical", "slashing", "piercing", "blunt"].includes(input.damageType);
  const effectiveArmor = Math.max(
    0,
    physicalDamage
      ? input.armor + input.defense * 0.6
      : input.magicResistance ?? input.defense * 0.8
  );
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
  const accuracyPressure = Math.max(0, (input.accuracy ?? 75) - 75) * 0.5;
  const effectiveEvasion = Math.max(
    0,
    Math.max(0, input.evasion ?? 0) - accuracyPressure
  );
  const evasionReduction = Math.min(
    0.35,
    effectiveEvasion / (effectiveEvasion + 200)
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
