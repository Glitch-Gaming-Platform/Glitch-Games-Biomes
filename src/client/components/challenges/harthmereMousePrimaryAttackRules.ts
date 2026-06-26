// HARTHMERE_MOUSE_PRIMARY_ATTACK
import {
  harthmereLiveModeCombatTargetIdForEcsEntity as sharedHarthmereLiveModeCombatTargetIdForEcsEntity,
  harthmereServerMuckCombatTargetIdForSeed,
} from "@/shared/harthmere/visible_combat_target";

// Pure decision rule for whether a raw left mouse-down should resolve a Harthmere
// basic attack. The left mouse button is shared with voxel-block breaking and
// camera/UI interaction, so combat is only engaged when ALL of these hold:
//   - it is the primary (left) button,
//   - the player is actively in first-person play (pointer locked or clicking
//     the game canvas in an embed where pointer lock is unavailable),
//   - the event did not originate inside a text field, and
//   - there is actually an attackable target within striking distance.
// Extracted into its own module (no React/renderer imports) so every branch can
// be unit-tested without a DOM, per the repo's pure-function test convention.
export function shouldEngageHarthmereMousePrimaryAttack(input: {
  button: number;
  pointerLocked: boolean;
  gameplayCanvasTarget?: boolean;
  typingTarget: boolean;
  hasAttackableTargetNearby: boolean;
}): boolean {
  return (
    input.button === 0 &&
    (input.pointerLocked || Boolean(input.gameplayCanvasTarget)) &&
    !input.typingTarget &&
    input.hasAttackableTargetNearby
  );
}

// Left mouse is the voxel-break / native attack action. It must resolve like
// the original cursor attack path, not like the keyboard B/H hotkeys where the
// first press can be consumed by weapon draw state.
export function shouldBypassHarthmereKeyboardDrawGateForMousePrimaryAttack(input: {
  source: "mouse_primary" | "keyboard_hotkey";
  hasPhysicalWeapon: boolean;
  weaponDrawn: boolean;
}): boolean {
  return (
    input.source === "mouse_primary" &&
    input.hasPhysicalWeapon &&
    !input.weaponDrawn
  );
}

export function harthmereLiveModeCombatTargetIdForSeed(input: {
  seedId: string;
  idOffset: number;
}): string | undefined {
  return harthmereServerMuckCombatTargetIdForSeed(input);
}

export function harthmereLiveModeCombatTargetIdForEcsEntity(
  entityId: number | string | undefined
): string | undefined {
  return sharedHarthmereLiveModeCombatTargetIdForEcsEntity(entityId);
}
