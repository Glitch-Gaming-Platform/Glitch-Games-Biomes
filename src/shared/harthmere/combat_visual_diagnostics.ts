export const HARTHMERE_COMBAT_VISUAL_DIAGNOSTICS_VERSION =
  "harthmere-combat-visual-diagnostics" as const;

export type HarthmereCombatVisualAttackFamily =
  | "unarmed"
  | "player_body"
  | "npc_body"
  | "animal_body"
  | "monster_body"
  | "melee_weapon"
  | "tool"
  | "bikkie_tool"
  | "ranged_weapon"
  | "ranged_bikkie"
  | "projectile"
  | "magic_projectile";

export type HarthmereCombatVisualFailureCode =
  | "renderer_not_ready"
  | "loading_overlay_active"
  | "actor_position_missing"
  | "body_attack_animation_missing"
  | "weapon_attack_animation_missing"
  | "projectile_visual_missing"
  | "line_of_sight_missing"
  | "contact_range_too_far"
  | "projectile_range_too_close"
  | "projectile_range_too_far"
  | "combat_effect_missing"
  | "server_mutation_missing"
  | "health_or_resource_delta_missing"
  | "hud_delta_missing"
  | "safe_zone_damage"
  | "protected_target_damaged"
  | "crime_or_owner_penalty_missing";

export interface HarthmereCombatVisualDiagnosisInput {
  scenario: string;
  attackFamily: HarthmereCombatVisualAttackFamily;
  distanceMeters?: number;
  attackerRadiusMeters?: number;
  targetRadiusMeters?: number;
  contactReachMeters?: number;
  projectileMinRangeMeters?: number;
  projectileMaxRangeMeters?: number;
  lineOfSight?: boolean;
  rendererReady?: boolean;
  loadingOverlayGone?: boolean;
  actorPositionObserved?: boolean;
  bodyAnimationObserved?: boolean;
  weaponAnimationObserved?: boolean;
  projectileVisualObserved?: boolean;
  combatEffectObserved?: boolean;
  serverMutationObserved?: boolean;
  healthDelta?: number;
  resourceDelta?: number;
  hudDeltaObserved?: boolean;
  targetAttackable?: boolean;
  targetProtected?: boolean;
  safeZone?: boolean;
  allowZeroDamage?: boolean;
  attackerIsPlayer?: boolean;
  targetIsPlayer?: boolean;
  crimeExpected?: boolean;
  crimeOrOwnerPenaltyObserved?: boolean;
}

export interface HarthmereCombatVisualDiagnosisResult {
  version: typeof HARTHMERE_COMBAT_VISUAL_DIAGNOSTICS_VERSION;
  scenario: string;
  passed: boolean;
  mode: "contact" | "projectile";
  effectiveRangeMeters: number;
  distanceMeters?: number;
  failures: HarthmereCombatVisualFailureCode[];
  warnings: string[];
}

const CONTACT_FAMILIES = new Set<HarthmereCombatVisualAttackFamily>([
  "unarmed",
  "player_body",
  "npc_body",
  "animal_body",
  "monster_body",
  "melee_weapon",
  "tool",
  "bikkie_tool",
]);

const BODY_FAMILIES = new Set<HarthmereCombatVisualAttackFamily>([
  "unarmed",
  "player_body",
  "npc_body",
  "animal_body",
  "monster_body",
]);

const WEAPON_OR_TOOL_FAMILIES = new Set<HarthmereCombatVisualAttackFamily>([
  "melee_weapon",
  "tool",
  "bikkie_tool",
]);

function finiteNumber(value: number | undefined): number | undefined {
  return Number.isFinite(value) ? Number(value) : undefined;
}

function addFailure(
  failures: HarthmereCombatVisualFailureCode[],
  code: HarthmereCombatVisualFailureCode
) {
  if (!failures.includes(code)) {
    failures.push(code);
  }
}

export function harthmereCombatVisualAttackMode(
  family: HarthmereCombatVisualAttackFamily
): "contact" | "projectile" {
  return CONTACT_FAMILIES.has(family) ? "contact" : "projectile";
}

export function evaluateHarthmereCombatVisualDiagnosis(
  input: HarthmereCombatVisualDiagnosisInput
): HarthmereCombatVisualDiagnosisResult {
  const failures: HarthmereCombatVisualFailureCode[] = [];
  const warnings: string[] = [];
  const mode = harthmereCombatVisualAttackMode(input.attackFamily);
  const distanceMeters = finiteNumber(input.distanceMeters);
  const attackerRadiusMeters = Math.max(
    0,
    finiteNumber(input.attackerRadiusMeters) ?? 0.5
  );
  const targetRadiusMeters = Math.max(
    0,
    finiteNumber(input.targetRadiusMeters) ?? 0.5
  );
  const contactReachMeters = Math.max(
    0.25,
    finiteNumber(input.contactReachMeters) ?? 1.35
  );
  const projectileMinRangeMeters = Math.max(
    0,
    finiteNumber(input.projectileMinRangeMeters) ?? 1.25
  );
  const projectileMaxRangeMeters = Math.max(
    projectileMinRangeMeters,
    finiteNumber(input.projectileMaxRangeMeters) ?? 18
  );
  const effectiveRangeMeters =
    mode === "contact"
      ? attackerRadiusMeters + targetRadiusMeters + contactReachMeters
      : projectileMaxRangeMeters;
  const hpChanged = Number(input.healthDelta ?? 0) < 0;
  const resourceChanged = Number(input.resourceDelta ?? 0) !== 0;
  const expectsDamage =
    input.targetAttackable !== false &&
    input.targetProtected !== true &&
    input.safeZone !== true &&
    input.allowZeroDamage !== true;

  if (input.rendererReady === false) {
    addFailure(failures, "renderer_not_ready");
  }
  if (input.loadingOverlayGone === false) {
    addFailure(failures, "loading_overlay_active");
  }
  if (input.combatEffectObserved === false) {
    addFailure(failures, "combat_effect_missing");
  }
  if (input.serverMutationObserved === false) {
    addFailure(failures, "server_mutation_missing");
  }

  if (mode === "contact") {
    if (input.actorPositionObserved === false) {
      addFailure(failures, "actor_position_missing");
    }
    if (distanceMeters !== undefined && distanceMeters > effectiveRangeMeters) {
      addFailure(failures, "contact_range_too_far");
    }
    if (
      BODY_FAMILIES.has(input.attackFamily) &&
      input.bodyAnimationObserved === false
    ) {
      addFailure(failures, "body_attack_animation_missing");
    }
    if (
      WEAPON_OR_TOOL_FAMILIES.has(input.attackFamily) &&
      input.weaponAnimationObserved === false
    ) {
      addFailure(failures, "weapon_attack_animation_missing");
    }
  } else {
    if (input.lineOfSight === false) {
      addFailure(failures, "line_of_sight_missing");
    }
    if (distanceMeters !== undefined && distanceMeters < projectileMinRangeMeters) {
      addFailure(failures, "projectile_range_too_close");
    }
    if (distanceMeters !== undefined && distanceMeters > projectileMaxRangeMeters) {
      addFailure(failures, "projectile_range_too_far");
    }
    if (input.projectileVisualObserved === false) {
      addFailure(failures, "projectile_visual_missing");
    }
  }

  if (expectsDamage && !hpChanged && !resourceChanged) {
    addFailure(failures, "health_or_resource_delta_missing");
  }
  if (
    (input.attackerIsPlayer || input.targetIsPlayer) &&
    (hpChanged || resourceChanged) &&
    input.hudDeltaObserved === false
  ) {
    addFailure(failures, "hud_delta_missing");
  }
  if (input.safeZone === true && hpChanged) {
    addFailure(failures, "safe_zone_damage");
  }
  if (
    (input.targetAttackable === false || input.targetProtected === true) &&
    hpChanged
  ) {
    addFailure(failures, "protected_target_damaged");
  }
  if (
    input.crimeExpected === true &&
    hpChanged &&
    input.crimeOrOwnerPenaltyObserved === false
  ) {
    addFailure(failures, "crime_or_owner_penalty_missing");
  }

  if (
    input.attackFamily === "unarmed" &&
    input.weaponAnimationObserved === false
  ) {
    warnings.push("unarmed attacks do not require sword or weapon debug events");
  }
  if (distanceMeters === undefined) {
    warnings.push("distance was not provided; the range verdict is incomplete");
  }

  return {
    version: HARTHMERE_COMBAT_VISUAL_DIAGNOSTICS_VERSION,
    scenario: input.scenario,
    passed: failures.length === 0,
    mode,
    effectiveRangeMeters,
    distanceMeters,
    failures,
    warnings,
  };
}
