export type HarthmereCombatKeyAction = "basic" | "heavy" | "spark";

export const HARTHMERE_NATIVE_COMBAT_KEY_EVENT =
  "biomes:harthmere-native-combat-key";

export type HarthmereCombatKeyRoute =
  "native_ecs_input" | "legacy_combat_simulator";

/**
 * Keep keyed combat and its HUD buttons on the same authority as mouse/hotbar
 * combat.
 *
 * Native ECS mode must drive InteractScript so the selected item, cursor hit,
 * attack animation, UpdateNpcHealthEvent, server validation, and Anima
 * retaliation all observe one action. The retired local simulator is retained
 * only for the explicit legacy authority mode.
 */
export function routeHarthmereCombatKeyForAuthority(input: {
  action: HarthmereCombatKeyAction;
  nativeEcsAuthority: boolean;
  dispatchNativeInput: (action: HarthmereCombatKeyAction) => void;
  performLegacyAttack: (action: HarthmereCombatKeyAction) => void;
}): HarthmereCombatKeyRoute {
  if (input.nativeEcsAuthority) {
    input.dispatchNativeInput(input.action);
    return "native_ecs_input";
  }
  input.performLegacyAttack(input.action);
  return "legacy_combat_simulator";
}

export function harthmereNativeCombatKeyInputSource(
  action: HarthmereCombatKeyAction
) {
  return `harthmere-native-combat-key:${action}`;
}
