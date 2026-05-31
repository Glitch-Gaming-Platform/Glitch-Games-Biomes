export const HARTHMERE_COMBAT_VISUAL_DIAGNOSTICS_VERSION_V1 =
  "harthmere-combat-visual-diagnostics-v1" as const;

export type HarthmereCombatVisualAttackFamilyV1 =
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

export type HarthmereCombatVisualFailureCodeV1 =
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

export interface HarthmereCombatVisualDiagnosisInputV1 {
  scenario: string;
  attackFamily: HarthmereCombatVisualAttackFamilyV1;
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

export interface HarthmereCombatVisualDiagnosisResultV1 {
  version: typeof HARTHMERE_COMBAT_VISUAL_DIAGNOSTICS_VERSION_V1;
  scenario: string;
  passed: boolean;
  mode: "contact" | "projectile";
  effectiveRangeMeters: number;
  distanceMeters?: number;
  failures: HarthmereCombatVisualFailureCodeV1[];
  warnings: string[];
}

const CONTACT_FAMILIES_V1 = new Set<HarthmereCombatVisualAttackFamilyV1>([
  "unarmed",
  "player_body",
  "npc_body",
  "animal_body",
  "monster_body",
  "melee_weapon",
  "tool",
  "bikkie_tool",
]);

const BODY_FAMILIES_V1 = new Set<HarthmereCombatVisualAttackFamilyV1>([
  "unarmed",
  "player_body",
  "npc_body",
  "animal_body",
  "monster_body",
]);

const WEAPON_OR_TOOL_FAMILIES_V1 = new Set<HarthmereCombatVisualAttackFamilyV1>([
  "melee_weapon",
  "tool",
  "bikkie_tool",
]);

function finiteNumberV1(value: number | undefined): number | undefined {
  return Number.isFinite(value) ? Number(value) : undefined;
}

function addFailureV1(
  failures: HarthmereCombatVisualFailureCodeV1[],
  code: HarthmereCombatVisualFailureCodeV1
) {
  if (!failures.includes(code)) {
    failures.push(code);
  }
}

export function harthmereCombatVisualAttackModeV1(
  family: HarthmereCombatVisualAttackFamilyV1
): "contact" | "projectile" {
  return CONTACT_FAMILIES_V1.has(family) ? "contact" : "projectile";
}

export function evaluateHarthmereCombatVisualDiagnosisV1(
  input: HarthmereCombatVisualDiagnosisInputV1
): HarthmereCombatVisualDiagnosisResultV1 {
  const failures: HarthmereCombatVisualFailureCodeV1[] = [];
  const warnings: string[] = [];
  const mode = harthmereCombatVisualAttackModeV1(input.attackFamily);
  const distanceMeters = finiteNumberV1(input.distanceMeters);
  const attackerRadiusMeters = Math.max(
    0,
    finiteNumberV1(input.attackerRadiusMeters) ?? 0.5
  );
  const targetRadiusMeters = Math.max(
    0,
    finiteNumberV1(input.targetRadiusMeters) ?? 0.5
  );
  const contactReachMeters = Math.max(
    0.25,
    finiteNumberV1(input.contactReachMeters) ?? 1.35
  );
  const projectileMinRangeMeters = Math.max(
    0,
    finiteNumberV1(input.projectileMinRangeMeters) ?? 1.25
  );
  const projectileMaxRangeMeters = Math.max(
    projectileMinRangeMeters,
    finiteNumberV1(input.projectileMaxRangeMeters) ?? 18
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
    addFailureV1(failures, "renderer_not_ready");
  }
  if (input.loadingOverlayGone === false) {
    addFailureV1(failures, "loading_overlay_active");
  }
  if (input.combatEffectObserved === false) {
    addFailureV1(failures, "combat_effect_missing");
  }
  if (input.serverMutationObserved === false) {
    addFailureV1(failures, "server_mutation_missing");
  }

  if (mode === "contact") {
    if (input.actorPositionObserved === false) {
      addFailureV1(failures, "actor_position_missing");
    }
    if (distanceMeters !== undefined && distanceMeters > effectiveRangeMeters) {
      addFailureV1(failures, "contact_range_too_far");
    }
    if (
      BODY_FAMILIES_V1.has(input.attackFamily) &&
      input.bodyAnimationObserved === false
    ) {
      addFailureV1(failures, "body_attack_animation_missing");
    }
    if (
      WEAPON_OR_TOOL_FAMILIES_V1.has(input.attackFamily) &&
      input.weaponAnimationObserved === false
    ) {
      addFailureV1(failures, "weapon_attack_animation_missing");
    }
  } else {
    if (input.lineOfSight === false) {
      addFailureV1(failures, "line_of_sight_missing");
    }
    if (distanceMeters !== undefined && distanceMeters < projectileMinRangeMeters) {
      addFailureV1(failures, "projectile_range_too_close");
    }
    if (distanceMeters !== undefined && distanceMeters > projectileMaxRangeMeters) {
      addFailureV1(failures, "projectile_range_too_far");
    }
    if (input.projectileVisualObserved === false) {
      addFailureV1(failures, "projectile_visual_missing");
    }
  }

  if (expectsDamage && !hpChanged && !resourceChanged) {
    addFailureV1(failures, "health_or_resource_delta_missing");
  }
  if (
    (input.attackerIsPlayer || input.targetIsPlayer) &&
    (hpChanged || resourceChanged) &&
    input.hudDeltaObserved === false
  ) {
    addFailureV1(failures, "hud_delta_missing");
  }
  if (input.safeZone === true && hpChanged) {
    addFailureV1(failures, "safe_zone_damage");
  }
  if (
    (input.targetAttackable === false || input.targetProtected === true) &&
    hpChanged
  ) {
    addFailureV1(failures, "protected_target_damaged");
  }
  if (
    input.crimeExpected === true &&
    hpChanged &&
    input.crimeOrOwnerPenaltyObserved === false
  ) {
    addFailureV1(failures, "crime_or_owner_penalty_missing");
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
    version: HARTHMERE_COMBAT_VISUAL_DIAGNOSTICS_VERSION_V1,
    scenario: input.scenario,
    passed: failures.length === 0,
    mode,
    effectiveRangeMeters,
    distanceMeters,
    failures,
    warnings,
  };
}
