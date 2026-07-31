import {
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS,
  HARTHMERE_NATIVE_MUCK_SCARRED_HELIX_SEED,
  HARTHMERE_NATIVE_THAEDRYN_SEED,
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereGroundedMuckMonsterSeedsInTerritory,
} from "@/shared/harthmere/live_entity_production_seed";
import {
  harthmereNativeNpcCombatProfileForSeed,
  type HarthmereNativeNpcCombatProfile,
} from "@/shared/harthmere/harthmere_native_combat";
import { harthmereBossNativeCombatTuningForLabel } from "@/shared/harthmere/boss_attack_catalog";
import type { BiomesId } from "@/shared/ids";
import { HARTHMERE_NATIVE_BANDIT_SEEDS } from "@/shared/harthmere/bandit_production_seed";

export function allHarthmereNativeNpcCombatProfiles() {
  const profiles = [
    ...HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS,
    ...harthmereGroundedMuckMonsterSeedsInTerritory(),
    ...harthmereGroundedLivestockSeedsInTerritory(),
    ...HARTHMERE_NATIVE_BANDIT_SEEDS,
    HARTHMERE_NATIVE_MUCK_SCARRED_HELIX_SEED,
    HARTHMERE_NATIVE_THAEDRYN_SEED,
  ].map(harthmereNativeNpcCombatProfileForSeed);
  return [
    ...new Map(profiles.map((profile) => [profile.id, profile])).values(),
  ];
}

let byId: Map<BiomesId, HarthmereNativeNpcCombatProfile> | undefined;

export function harthmereNativeNpcCombatProfileForTypeId(id: BiomesId) {
  byId ??= new Map(
    allHarthmereNativeNpcCombatProfiles().map((profile) => [
      profile.id,
      profile,
    ])
  );
  return byId.get(id);
}

/**
 * Resolve the authoritative combat profile for a concrete native ECS entity.
 *
 * Most Harthmere creatures have a dedicated native NPC type, so type id alone
 * is sufficient. Several quest/public-event bosses predate those overlays and
 * still use a generic snapshot type; their stable label selects the same
 * server-owned profile without requiring encounter code to fork Anima.
 */
export function harthmereNativeNpcCombatProfileForEntity(input: {
  typeId: BiomesId;
  displayName?: string;
  maxHp?: number;
}): HarthmereNativeNpcCombatProfile | undefined {
  const base = harthmereNativeNpcCombatProfileForTypeId(input.typeId);
  const tuning = harthmereBossNativeCombatTuningForLabel(input.displayName);
  if (!tuning) return base;
  const maxHp = Number.isFinite(input.maxHp)
    ? Math.max(1, Math.trunc(input.maxHp!))
    : base?.maxHp ?? tuning.maxHp;
  return {
    key: `boss_${tuning.bossId}`,
    id: input.typeId,
    displayName: String(
      input.displayName || base?.displayName || tuning.bossId
    ),
    level: tuning.level,
    maxHp,
    attackDamage: tuning.attackDamage,
    attackDistance: tuning.attackDistance,
    attackIntervalSecs: tuning.attackIntervalSecs,
    attackStrikeMomentSecs: tuning.attackStrikeMomentSecs,
    attackFovDeg: tuning.attackFovDeg,
    aggroTrigger:
      tuning.aggroTrigger === "onlyIfAttacked"
        ? { kind: "onlyIfAttacked" }
        : { kind: "proximity", distance: tuning.aggroDistance },
    disengageDistance: tuning.disengageDistance,
    walkSpeed: tuning.walkSpeed,
    runSpeed: tuning.runSpeed,
    rotateSpeed: tuning.rotateSpeed,
    behaviorKind: "hostile",
    dropItems: base?.dropItems ?? [],
    questDropBikkieItems: base?.questDropBikkieItems ?? [],
    killXp: base?.killXp ?? Math.max(100, tuning.level * 35),
    isBoss: true,
    projectileVisualId: tuning.attacks[0]?.projectileVisualId,
    rangedAttacks: tuning.attacks,
  };
}
