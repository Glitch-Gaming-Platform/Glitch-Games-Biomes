export const HARTHMERE_LOCAL_COMBAT_SAFETY_VERSION =
  "harthmere-local-combat-safety" as const;

export const HARTHMERE_LOCAL_COMBAT_LINE_OF_SIGHT_RANGE = 28;
export const HARTHMERE_LOCAL_COMBAT_ATTACK_CONTACT_GRACE = 0.45;

export interface HarthmereLocalCombatSafetyNpc {
  attackRange: number;
  movementSpeed?: number;
}

export interface HarthmereLocalCombatDamageGateInput {
  npc: HarthmereLocalCombatSafetyNpc;
  npcPosition?: readonly number[];
  playerPosition?: readonly number[];
  playerHp: number;
  playerCombatState: string;
  targetRadius?: number;
  lineOfSight?: boolean;
}

function positionXZ(
  position: readonly number[] | undefined
): [number, number] | undefined {
  if (!Array.isArray(position)) return undefined;
  const x = Number(position[0]);
  const z = Number(position.length >= 3 ? position[2] : position[1]);
  return Number.isFinite(x) && Number.isFinite(z) ? [x, z] : undefined;
}

export function harthmereLocalCombatDistance2d(
  left: readonly number[] | undefined,
  right: readonly number[] | undefined
) {
  const a = positionXZ(left);
  const b = positionXZ(right);
  return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : undefined;
}

export function isHarthmereLocalCombatSafeZonePosition(
  position: readonly number[] | undefined
) {
  const point = positionXZ(position);
  if (!point) return false;
  const [x, z] = point;
  const inGroveAndTownCore = x >= 340 && x <= 650 && z >= -335 && z <= -70;
  const inGroveRespawnPoint =
    Math.hypot(x - 496, z - -126) <= 95 ||
    Math.hypot(x - 612, z - -245) <= 95;
  return inGroveAndTownCore || inGroveRespawnPoint;
}

export function harthmereLocalCombatHasLineOfSight(
  npcPosition: readonly number[] | undefined,
  playerPosition: readonly number[] | undefined,
  maxRange = HARTHMERE_LOCAL_COMBAT_LINE_OF_SIGHT_RANGE
) {
  const distance = harthmereLocalCombatDistance2d(
    npcPosition,
    playerPosition
  );
  return distance !== undefined && distance <= maxRange;
}

export function harthmereLocalCombatDamageGate(
  input: HarthmereLocalCombatDamageGateInput
) {
  if (
    input.playerHp <= 0 ||
    ["dead", "downed", "respawning"].includes(input.playerCombatState)
  ) {
    return { canDamage: false, reason: "player_not_alive" as const };
  }
  if (
    ["invulnerable", "protected_after_respawn"].includes(
      input.playerCombatState
    )
  ) {
    return { canDamage: false, reason: "player_protected" as const };
  }
  if (isHarthmereLocalCombatSafeZonePosition(input.playerPosition)) {
    return { canDamage: false, reason: "safe_zone" as const };
  }
  if (input.lineOfSight === false) {
    return { canDamage: false, reason: "no_line_of_sight" as const };
  }
  const distance = harthmereLocalCombatDistance2d(
    input.npcPosition,
    input.playerPosition
  );
  if (distance === undefined) {
    return {
      canDamage: false,
      reason: "missing_player_or_target_position" as const,
    };
  }
  const reach =
    Math.max(1.1, Number(input.npc.attackRange) || 1.1) +
    Math.max(0.35, Number(input.targetRadius ?? 1.15) || 1.15) +
    HARTHMERE_LOCAL_COMBAT_ATTACK_CONTACT_GRACE;
  if (distance > reach) {
    return {
      canDamage: false,
      reason: "target_out_of_range" as const,
      distance,
      reach,
    };
  }
  return {
    canDamage: true,
    reason: "actual_melee_contact" as const,
    distance,
    reach,
  };
}
