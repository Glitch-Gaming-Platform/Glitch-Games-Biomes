// (foraging fix F-B, 2026-07-14)
// -----------------------------------------------------------------------------
// Native-plant harvest double-grant reconciliation.
//
// A Harthmere player harvesting a biomes-native farmed plant used to be credited
// TWICE for the same crop:
//   1. the ECS path — HarvestPlantEvent -> gaia growth ticker destroy() ->
//      newDrop() of the plant's container yield into the world (collected into
//      the ECS inventory), and
//   2. the live-mode path — the `native_plant_harvest` op granting the crop's
//      yield straight into the live-mode inventory.
//
// In Harthmere the live-mode inventory is authoritative: the ECS inventory is a
// PROJECTION of it (see createHarthmereBiomesEcsInventory in
// harthmere_biomes_ecs_bridge.ts). So the live-mode grant is the correct single
// source of truth, and the ECS gaia yield-drop is the spurious duplicate.
//
// This mirrors the combat reconciliation precedent, where the ECS npcHealth
// handler yields to the live-mode combat reducer for Harthmere-managed entities
// (isHarthmereLiveModeManagedCombatEntity). Here the gaia growth ticker yields
// to the live-mode farming grant for the fully-grown container yield.
//
// The suppression is gated on the deployment actually running Harthmere live
// mode. Harthmere prod runs on the Glitch runtime (GLITCH_RUNTIME=1), the same
// signal the live-mode robot-energy scheduler uses to decide it is active. A
// plain biomes deployment (flag unset) keeps its ECS farming drops unchanged, so
// regular farming is never affected. An explicit override is also honoured for
// tests and for pinning the behaviour on/off in a deployment.
// -----------------------------------------------------------------------------

export const HARTHMERE_LIVE_MODE_FARMING_AUTHORITY_VERSION =
  "harthmere-live-mode-farming-authority-2026-07-14" as const;

export type HarthmereFarmingAuthorityEnv = {
  /** Set to "1" in Harthmere Glitch deployments. */
  GLITCH_RUNTIME?: string;
  /**
   * Explicit override:
   *   "1" -> force live-mode farming grant authoritative (suppress ECS drop),
   *   "0" -> force the ECS drop to remain (never suppress).
   */
  HARTHMERE_LIVE_MODE_FARMING_AUTHORITATIVE?: string;
};

/**
 * Returns true when the live-mode `native_plant_harvest` grant is the single
 * authoritative source for a harvested crop's yield, and therefore the ECS gaia
 * yield-drop for that same crop must be suppressed to avoid a double-grant.
 *
 * Pure: the environment is injected so every branch is unit-testable without
 * mutating process.env.
 */
export function harthmereLiveModeFarmingGrantIsAuthoritative(
  env: HarthmereFarmingAuthorityEnv = process.env as HarthmereFarmingAuthorityEnv
): boolean {
  // Explicit override wins in both directions.
  if (env.HARTHMERE_LIVE_MODE_FARMING_AUTHORITATIVE === "0") {
    return false;
  }
  if (env.HARTHMERE_LIVE_MODE_FARMING_AUTHORITATIVE === "1") {
    return true;
  }
  // Otherwise follow the live-mode deployment signal.
  return env.GLITCH_RUNTIME === "1";
}
