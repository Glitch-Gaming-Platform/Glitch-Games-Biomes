export const HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_VERSION =
  "harthmere-voxel-interaction-attack-reach";

// Keep Harthmere body/melee attacks aligned with the default voxel break/change
// reach (`building.changeRadius`). The client may add temporary reach modifiers,
// but the server baseline must match the world-interaction distance.
export const HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS = 8.78;

// Native UpdateNpcHealthEvent attacks are validated from entity centers on the
// server, while the client melee trace measures to the target AABB. This modest
// allowance covers ordinary NPC half-width plus latency without restoring the
// former 8.78-block remote-hit exploit.
export const HARTHMERE_NATIVE_NPC_MELEE_MAX_CENTER_DISTANCE = 5.5;
