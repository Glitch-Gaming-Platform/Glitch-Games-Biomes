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
