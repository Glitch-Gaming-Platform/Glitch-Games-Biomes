// HARTHMERE_MOUSE_PRIMARY_ATTACK_V1
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
export function shouldEngageHarthmereMousePrimaryAttackV1(input: {
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
