/*
 * Harthmere third-party combat AI integration v1.
 *
 * This module is deliberately dependency-light: it defines the production adapter
 * contracts and deterministic fallback decision engine without importing optional
 * third-party packages at module load time. The live runtime can plug in
 * Mistreevous, Yuka, recast-navigation-js, py_trees, or transitions when those
 * packages are installed, while tests and server validation remain deterministic.
 */

export const HARTHMERE_THIRD_PARTY_COMBAT_AI_VERSION_V1 = "harthmere-third-party-combat-ai-v1";

export const HARTHMERE_THIRD_PARTY_COMBAT_AI_STACK_V1 = [
  {
    id: "mistreevous",
    packageName: "mistreevous",
    language: "typescript",
    role: "behavior_tree",
    liveModeUse: "Broad tactical mode selection, boss phase trees, patrol-alert-fight-flee logic, and deterministic combat trees.",
    optional: true,
    deterministicRequired: true,
    fallbackProvider: "harthmere_deterministic_behavior_tree",
    adapterExports: ["buildMistreevousCombatTreeSpecV1", "createBehaviorTreeAdapterPlanV1"],
    serverOnlyRules: ["tree may request actions, but server combat rules still validate legality", "tree output cannot claim hit/damage/death"],
  },
  {
    id: "yuka",
    packageName: "yuka",
    language: "typescript",
    role: "steering_perception_memory",
    liveModeUse: "Agent steering, perception, memory, pursuit, evade, arrive, obstacle avoidance, and group spacing helpers.",
    optional: true,
    deterministicRequired: true,
    fallbackProvider: "harthmere_deterministic_steering",
    adapterExports: ["buildYukaSteeringPlanV1", "createSteeringAdapterPlanV1"],
    serverOnlyRules: ["movement suggestions must be clamped by server nav/physics", "perception memory cannot reveal hidden targets without validation"],
  },
  {
    id: "recast_navigation_js",
    packageName: "recast-navigation",
    language: "typescript",
    role: "navmesh_pathfinding_crowd",
    liveModeUse: "Navmesh path requests, chase paths, retreat paths, flank anchors, temporary obstacle awareness, and crowd simulation hooks.",
    optional: true,
    deterministicRequired: true,
    fallbackProvider: "harthmere_grid_or_direct_path",
    adapterExports: ["buildRecastNavigationRequestV1", "createNavigationAdapterPlanV1"],
    serverOnlyRules: ["path output is advisory until server movement authority accepts it", "invalid off-navmesh points must be rejected"],
  },
  {
    id: "py_trees",
    packageName: "py_trees",
    language: "python",
    role: "simulation_behavior_tree",
    liveModeUse: "Python-side behavior-tree simulations and archetype balancing before porting to TypeScript runtime trees.",
    optional: true,
    deterministicRequired: true,
    fallbackProvider: "typescript_test_simulation",
    adapterExports: ["buildPythonCombatAISimulationSpecV1"],
    serverOnlyRules: ["python simulation output is never accepted as live damage authority", "simulation seeds must be recorded"],
  },
  {
    id: "transitions",
    packageName: "transitions",
    language: "python",
    role: "simulation_fsm",
    liveModeUse: "Python-side finite-state-machine simulations for hard combat state validation and boss phase correctness.",
    optional: true,
    deterministicRequired: true,
    fallbackProvider: "typescript_fsm_validation",
    adapterExports: ["buildPythonCombatAISimulationSpecV1"],
    serverOnlyRules: ["FSM forbids impossible actions, but server combat system performs final action validation"],
  },
  {
    id: "harthmere_utility_ai",
    packageName: "internal",
    language: "typescript",
    role: "utility_scoring",
    liveModeUse: "Scores specific moves once the behavior tree chooses the tactical mode.",
    optional: false,
    deterministicRequired: true,
    fallbackProvider: "none",
    adapterExports: ["scoreHarthmereCombatAIActionV1"],
    serverOnlyRules: ["scores choose intent only", "server validates resources, cooldowns, range, target legality, and combat state"],
  },
  {
    id: "harthmere_combat_fsm",
    packageName: "internal",
    language: "typescript",
    role: "hard_state_machine",
    liveModeUse: "Prevents dead/stunned/windup/recovery/downed/spawn-protected actors from selecting illegal actions.",
    optional: false,
    deterministicRequired: true,
    fallbackProvider: "none",
    adapterExports: ["evaluateHarthmereCombatAIFSMV1"],
    serverOnlyRules: ["state machine is pre-validation; server action pipeline is final validation"],
  },
];

export const HARTHMERE_COMBAT_AI_ACTIONS_V1 = {
  die: { category: "state", serverActionKind: "request_death_transition", requiresTarget: false, hostile: false, minRange: 0, maxRange: 0, cooldownKey: "none" },
  wait_stunned: { category: "state", serverActionKind: "request_npc_ai_tick", requiresTarget: false, hostile: false, minRange: 0, maxRange: 0, cooldownKey: "none" },
  flee_to_help: { category: "movement", serverActionKind: "request_npc_ai_tick", requiresTarget: false, hostile: false, minRange: 0, maxRange: 50, cooldownKey: "flee" },
  call_help: { category: "support", serverActionKind: "request_ability_cast", requiresTarget: false, hostile: false, minRange: 0, maxRange: 25, cooldownKey: "call_help" },
  chase: { category: "movement", serverActionKind: "request_npc_ai_tick", requiresTarget: true, hostile: false, minRange: 0, maxRange: 60, cooldownKey: "none" },
  flank: { category: "movement", serverActionKind: "request_npc_ai_tick", requiresTarget: true, hostile: false, minRange: 1, maxRange: 15, cooldownKey: "flank" },
  backpedal: { category: "movement", serverActionKind: "request_npc_ai_tick", requiresTarget: true, hostile: false, minRange: 0, maxRange: 8, cooldownKey: "backpedal" },
  strafe: { category: "movement", serverActionKind: "request_npc_ai_tick", requiresTarget: true, hostile: false, minRange: 1, maxRange: 12, cooldownKey: "strafe" },
  block: { category: "defense", serverActionKind: "request_ability_cast", requiresTarget: true, hostile: false, minRange: 0, maxRange: 4, cooldownKey: "block" },
  dodge: { category: "defense", serverActionKind: "request_ability_cast", requiresTarget: true, hostile: false, minRange: 0, maxRange: 5, cooldownKey: "dodge" },
  taunt: { category: "control", serverActionKind: "request_ability_cast", requiresTarget: true, hostile: true, minRange: 0, maxRange: 12, cooldownKey: "taunt" },
  light_attack: { category: "attack", serverActionKind: "request_attack", requiresTarget: true, hostile: true, minRange: 0, maxRange: 2.6, cooldownKey: "light_attack" },
  heavy_attack: { category: "attack", serverActionKind: "request_attack", requiresTarget: true, hostile: true, minRange: 0, maxRange: 2.8, cooldownKey: "heavy_attack" },
  shield_bash: { category: "control", serverActionKind: "request_ability_cast", requiresTarget: true, hostile: true, minRange: 0, maxRange: 2.4, cooldownKey: "shield_bash" },
  ranged_shot: { category: "attack", serverActionKind: "request_attack", requiresTarget: true, hostile: true, minRange: 4, maxRange: 28, cooldownKey: "ranged_shot" },
  fireball: { category: "spell", serverActionKind: "request_ability_cast", requiresTarget: true, hostile: true, minRange: 3, maxRange: 30, cooldownKey: "fireball" },
  root: { category: "control", serverActionKind: "request_ability_cast", requiresTarget: true, hostile: true, minRange: 3, maxRange: 22, cooldownKey: "root" },
  heal_ally: { category: "support", serverActionKind: "request_ability_cast", requiresTarget: true, hostile: false, minRange: 0, maxRange: 24, cooldownKey: "heal_ally" },
  revive_ally: { category: "support", serverActionKind: "request_revive", requiresTarget: true, hostile: false, minRange: 0, maxRange: 5, cooldownKey: "revive_ally" },
  boss_phase_mechanic: { category: "boss", serverActionKind: "request_boss_tick", requiresTarget: false, hostile: true, minRange: 0, maxRange: 40, cooldownKey: "boss_phase_mechanic" },
  idle_watch: { category: "idle", serverActionKind: "request_npc_ai_tick", requiresTarget: false, hostile: false, minRange: 0, maxRange: 0, cooldownKey: "none" },
};

export const HARTHMERE_COMBAT_AI_ARCHETYPES_V1 = {
  basic_melee: {
    id: "basic_melee",
    name: "Basic Melee Enemy",
    treeProvider: "mistreevous",
    steeringProvider: "yuka",
    navigationProvider: "recast_navigation_js",
    preferredRange: [1.6, 2.4],
    actions: ["chase", "flank", "light_attack", "heavy_attack", "dodge", "block", "call_help"],
    utilityWeights: { closePressure: 1.0, defense: 0.35, support: 0.1, retreat: 0.2, rangeControl: 0.4 },
    requiredFacts: ["targetId", "distanceToTarget", "lineOfSight", "healthPercent", "cooldowns"],
    serverValidation: ["target legality", "range", "line of sight", "cooldown", "combat state", "safe zone", "threat/credit"],
  },
  shield_guard: {
    id: "shield_guard",
    name: "Shield Guard",
    treeProvider: "mistreevous",
    steeringProvider: "yuka",
    navigationProvider: "recast_navigation_js",
    preferredRange: [1.4, 2.2],
    actions: ["chase", "block", "taunt", "shield_bash", "light_attack", "call_help"],
    utilityWeights: { closePressure: 0.75, defense: 1.0, support: 0.45, retreat: 0.15, rangeControl: 0.35 },
    requiredFacts: ["targetId", "targetIsCasting", "allyHealthLowestPercent", "lineOfSight", "cooldowns"],
    serverValidation: ["taunt eligibility", "block cooldown", "guard law/faction", "non-lethal rules for civilians"],
  },
  archer_kiter: {
    id: "archer_kiter",
    name: "Archer Kiter",
    treeProvider: "mistreevous",
    steeringProvider: "yuka",
    navigationProvider: "recast_navigation_js",
    preferredRange: [10, 22],
    actions: ["backpedal", "strafe", "ranged_shot", "root", "flee_to_help", "dodge"],
    utilityWeights: { closePressure: 0.3, defense: 0.55, support: 0.05, retreat: 0.65, rangeControl: 1.0 },
    requiredFacts: ["targetId", "distanceToTarget", "lineOfSight", "navmeshHasRetreat", "cooldowns"],
    serverValidation: ["projectile line of sight", "minimum range", "kiting leash", "ammo/resource if enabled"],
  },
  caster_controller: {
    id: "caster_controller",
    name: "Caster Controller",
    treeProvider: "mistreevous",
    steeringProvider: "yuka",
    navigationProvider: "recast_navigation_js",
    preferredRange: [8, 26],
    actions: ["root", "fireball", "backpedal", "strafe", "dodge", "call_help"],
    utilityWeights: { closePressure: 0.45, defense: 0.45, support: 0.1, retreat: 0.55, rangeControl: 0.9 },
    requiredFacts: ["manaPercent", "targetIsCasting", "lineOfSight", "distanceToTarget", "cooldowns"],
    serverValidation: ["spell school lockout", "mana", "cast time", "interruptibility", "LOS"],
  },
  healer_support: {
    id: "healer_support",
    name: "Healer Support",
    treeProvider: "mistreevous",
    steeringProvider: "yuka",
    navigationProvider: "recast_navigation_js",
    preferredRange: [8, 22],
    actions: ["heal_ally", "revive_ally", "backpedal", "dodge", "call_help", "idle_watch"],
    utilityWeights: { closePressure: 0.1, defense: 0.6, support: 1.0, retreat: 0.45, rangeControl: 0.55 },
    requiredFacts: ["allyHealthLowestPercent", "downedAllyNearby", "lineOfSight", "manaPercent", "cooldowns"],
    serverValidation: ["ally eligibility", "revive eligibility", "anti-heal-spam contribution", "mana/cooldown"],
  },
  pack_wolf: {
    id: "pack_wolf",
    name: "Pack Creature",
    treeProvider: "mistreevous",
    steeringProvider: "yuka",
    navigationProvider: "recast_navigation_js",
    preferredRange: [1.2, 2.0],
    actions: ["flank", "light_attack", "dodge", "call_help", "flee_to_help"],
    utilityWeights: { closePressure: 0.9, defense: 0.25, support: 0.35, retreat: 0.45, rangeControl: 0.25 },
    requiredFacts: ["alliesNearby", "enemiesNearby", "healthPercent", "targetId", "distanceToTarget"],
    serverValidation: ["pack leash", "creature faction", "anti-stacking movement", "target threat"],
  },
  boss_phase_controller: {
    id: "boss_phase_controller",
    name: "Boss Phase Controller",
    treeProvider: "mistreevous",
    steeringProvider: "yuka",
    navigationProvider: "recast_navigation_js",
    preferredRange: [0, 40],
    actions: ["boss_phase_mechanic", "taunt", "heavy_attack", "root", "fireball", "call_help"],
    utilityWeights: { closePressure: 0.8, defense: 0.4, support: 0.55, retreat: 0.05, rangeControl: 0.75 },
    requiredFacts: ["bossPhase", "enrageTimerSeconds", "raidThreatTopActorId", "healthPercent", "cooldowns"],
    serverValidation: ["phase gate", "telegraph window", "raid lockout", "encounter reset", "boss immunity table"],
  },
  elite_duelist: {
    id: "elite_duelist",
    name: "Elite Duelist",
    treeProvider: "mistreevous",
    steeringProvider: "yuka",
    navigationProvider: "recast_navigation_js",
    preferredRange: [1.5, 2.7],
    actions: ["strafe", "dodge", "block", "light_attack", "heavy_attack", "shield_bash"],
    utilityWeights: { closePressure: 0.95, defense: 0.8, support: 0.0, retreat: 0.2, rangeControl: 0.65 },
    requiredFacts: ["targetFacing", "targetIsBlocking", "targetIsCasting", "staminaPercent", "cooldowns"],
    serverValidation: ["facing", "parry window", "combo cooldown", "PvP fairness if player target"],
  },
  civilian_flee: {
    id: "civilian_flee",
    name: "Civilian Fleeing NPC",
    treeProvider: "mistreevous",
    steeringProvider: "yuka",
    navigationProvider: "recast_navigation_js",
    preferredRange: [18, 40],
    actions: ["flee_to_help", "call_help", "idle_watch"],
    utilityWeights: { closePressure: 0.0, defense: 0.2, support: 0.25, retreat: 1.0, rangeControl: 0.9 },
    requiredFacts: ["threateningHostileNearby", "safeAnchorId", "navmeshHasRetreat"],
    serverValidation: ["civilian cannot perform hostile attack unless explicitly configured", "law/crime witness event", "safe retreat anchor must be valid"],
  },
};

export function clampV1(value, min, max) {
  if (Number.isNaN(value) || value === undefined || value === null) return min;
  return Math.max(min, Math.min(max, Number(value)));
}

export function createHarthmereCombatAIBlackboardV1(input) {
  const src = input || {};
  return {
    actorId: src.actorId || "npc:unknown",
    archetypeId: src.archetypeId || "basic_melee",
    targetId: src.targetId || null,
    nowMs: Number(src.nowMs || 0),
    serverTick: Number(src.serverTick || 0),
    actorCombatState: src.actorCombatState || "idle",
    healthPercent: clampV1(src.healthPercent ?? 1, 0, 1),
    staminaPercent: clampV1(src.staminaPercent ?? 1, 0, 1),
    manaPercent: clampV1(src.manaPercent ?? 1, 0, 1),
    targetHealthPercent: clampV1(src.targetHealthPercent ?? 1, 0, 1),
    allyHealthLowestPercent: clampV1(src.allyHealthLowestPercent ?? 1, 0, 1),
    distanceToTarget: Math.max(0, Number(src.distanceToTarget ?? 999)),
    lineOfSight: src.lineOfSight !== false,
    facingTarget: src.facingTarget !== false,
    targetFacing: src.targetFacing || "unknown",
    targetIsBlocking: Boolean(src.targetIsBlocking),
    targetIsCasting: Boolean(src.targetIsCasting),
    downedAllyNearby: Boolean(src.downedAllyNearby),
    threateningHostileNearby: Boolean(src.threateningHostileNearby || src.targetId),
    alliesNearby: Number(src.alliesNearby || 0),
    enemiesNearby: Number(src.enemiesNearby || 1),
    navmeshHasPath: src.navmeshHasPath !== false,
    navmeshHasRetreat: src.navmeshHasRetreat !== false,
    currentWeaponType: src.currentWeaponType || "sword",
    cooldowns: Object.assign({}, src.cooldowns || {}),
    legalTargets: Array.isArray(src.legalTargets) ? src.legalTargets.slice() : (src.targetId ? [src.targetId] : []),
    safeZone: Boolean(src.safeZone),
    spawnProtected: Boolean(src.spawnProtected),
    pvpAllowed: src.pvpAllowed !== false,
    bossPhase: Number(src.bossPhase || 1),
    enrageTimerSeconds: Number(src.enrageTimerSeconds ?? 999),
    raidThreatTopActorId: src.raidThreatTopActorId || src.targetId || null,
    safeAnchorId: src.safeAnchorId || "nearest_guard_post",
    position: src.position || { x: 0, y: 0, z: 0 },
    targetPosition: src.targetPosition || { x: 0, y: 0, z: 0 },
    retreatPosition: src.retreatPosition || null,
    deterministicSeed: Number(src.deterministicSeed || 1),
  };
}

export function cooldownReadyV1(blackboard, cooldownKey) {
  if (!cooldownKey || cooldownKey === "none") return true;
  const readyAt = Number((blackboard.cooldowns || {})[cooldownKey] || 0);
  return readyAt <= blackboard.nowMs;
}

export function evaluateHarthmereCombatAIFSMV1(blackboardInput) {
  const b = createHarthmereCombatAIBlackboardV1(blackboardInput);
  const blockedReasons = [];
  let state = b.actorCombatState;
  if (["dead", "downed"].includes(state) || b.healthPercent <= 0) {
    return { state: "dead", canAct: false, recommendedMode: "dead", blockedReasons: ["actor_dead_or_downed"] };
  }
  if (["stunned", "frozen", "asleep", "feared"].includes(state)) {
    return { state, canAct: false, recommendedMode: "incapacitated", blockedReasons: [`actor_${state}`] };
  }
  if (b.spawnProtected) blockedReasons.push("spawn_protected_cannot_hostile_act");
  if (b.safeZone && b.targetId) blockedReasons.push("safe_zone_blocks_hostile_ai");
  if (b.healthPercent < 0.22 && b.navmeshHasRetreat) return { state: "fleeing", canAct: true, recommendedMode: "flee", blockedReasons };
  if (b.downedAllyNearby && b.allyHealthLowestPercent <= 0.05) return { state: "supporting", canAct: true, recommendedMode: "revive", blockedReasons };
  if (b.allyHealthLowestPercent < 0.45 && b.manaPercent > 0.18) return { state: "supporting", canAct: true, recommendedMode: "heal", blockedReasons };
  if (!b.targetId) return { state: "idle", canAct: true, recommendedMode: b.threateningHostileNearby ? "investigate" : "idle", blockedReasons };
  if (!b.lineOfSight) return { state: "chasing", canAct: true, recommendedMode: "reposition", blockedReasons };
  if (b.distanceToTarget > 28) return { state: "chasing", canAct: true, recommendedMode: "chase", blockedReasons };
  return { state: "in_combat", canAct: blockedReasons.length === 0, recommendedMode: "fight", blockedReasons };
}

export function scoreHarthmereCombatAIActionV1(actionId, blackboardInput, archetypeInput) {
  const b = createHarthmereCombatAIBlackboardV1(blackboardInput);
  const action = HARTHMERE_COMBAT_AI_ACTIONS_V1[actionId];
  if (!action) return { actionId, score: -9999, legal: false, reasons: ["unknown_action"] };
  const archetype = typeof archetypeInput === "string" ? HARTHMERE_COMBAT_AI_ARCHETYPES_V1[archetypeInput] : (archetypeInput || HARTHMERE_COMBAT_AI_ARCHETYPES_V1[b.archetypeId] || HARTHMERE_COMBAT_AI_ARCHETYPES_V1.basic_melee);
  const reasons = [];
  const fsm = evaluateHarthmereCombatAIFSMV1(b);
  if (!fsm.canAct && actionId !== "die" && actionId !== "wait_stunned") return { actionId, score: -9999, legal: false, reasons: fsm.blockedReasons };
  if (action.requiresTarget && !b.targetId) reasons.push("missing_target");
  if (action.requiresTarget && b.targetId && b.legalTargets.length && !b.legalTargets.includes(b.targetId)) reasons.push("target_not_legal");
  if (action.hostile && (b.safeZone || b.spawnProtected || !b.pvpAllowed)) reasons.push("hostile_action_blocked_by_context");
  if (!cooldownReadyV1(b, action.cooldownKey)) reasons.push("cooldown_not_ready");
  if (action.requiresTarget && b.distanceToTarget < action.minRange) reasons.push("target_too_close");
  if (action.requiresTarget && b.distanceToTarget > action.maxRange) reasons.push("target_too_far");
  if (["ranged_shot", "fireball", "root"].includes(actionId) && !b.lineOfSight) reasons.push("no_line_of_sight");
  if (["light_attack", "heavy_attack", "shield_bash", "ranged_shot"].includes(actionId) && !b.facingTarget) reasons.push("not_facing_target");
  if (reasons.length > 0) return { actionId, score: -9999, legal: false, reasons };

  const weights = Object.assign({ closePressure: 1, defense: 0.4, support: 0.2, retreat: 0.3, rangeControl: 0.4 }, archetype.utilityWeights || {});
  const preferred = archetype.preferredRange || [1.5, 3];
  const center = (preferred[0] + preferred[1]) / 2;
  const distanceError = Math.abs(b.distanceToTarget - center);
  const inPreferredRange = b.distanceToTarget >= preferred[0] && b.distanceToTarget <= preferred[1];
  let score = 0;

  if (actionId === "die") score += b.healthPercent <= 0 ? 1000 : -500;
  if (actionId === "wait_stunned") score += ["stunned", "frozen", "asleep", "feared"].includes(b.actorCombatState) ? 900 : -100;
  if (actionId === "flee_to_help") score += (1 - b.healthPercent) * 110 * weights.retreat + (b.enemiesNearby > b.alliesNearby ? 24 : 0) + (b.navmeshHasRetreat ? 20 : -50);
  if (actionId === "call_help") score += (b.enemiesNearby > b.alliesNearby ? 45 : 8) + (1 - b.healthPercent) * 35 * weights.support;
  if (actionId === "chase") score += Math.min(90, distanceError * 12) * weights.rangeControl + (!b.lineOfSight ? 35 : 0) + (b.navmeshHasPath ? 15 : -80);
  if (actionId === "flank") score += (inPreferredRange ? 35 : 5) + b.alliesNearby * 8 + (b.targetIsBlocking ? 16 : 0);
  if (actionId === "backpedal") score += (b.distanceToTarget < preferred[0] ? 80 : 5) * weights.retreat + (b.healthPercent < 0.55 ? 20 : 0);
  if (actionId === "strafe") score += (inPreferredRange ? 30 : 8) + (b.targetIsCasting ? 10 : 0);
  if (actionId === "block") score += (b.targetIsCasting ? 12 : 0) + (1 - b.healthPercent) * 70 * weights.defense + (b.distanceToTarget <= 3 ? 18 : 0);
  if (actionId === "dodge") score += (1 - b.healthPercent) * 55 * weights.defense + (b.distanceToTarget <= 5 ? 14 : 0) + (b.staminaPercent > 0.25 ? 12 : -30);
  if (actionId === "taunt") score += (b.allyHealthLowestPercent < 0.5 ? 70 : 18) * weights.support + (b.distanceToTarget <= 12 ? 15 : 0);
  if (actionId === "light_attack") score += (inPreferredRange ? 72 : 18) * weights.closePressure + (b.staminaPercent > 0.15 ? 12 : -35);
  if (actionId === "heavy_attack") score += (inPreferredRange ? 55 : 5) * weights.closePressure + (b.targetIsBlocking ? -10 : 18) + (b.staminaPercent > 0.45 ? 16 : -50);
  if (actionId === "shield_bash") score += (b.targetIsCasting ? 85 : 25) + (b.distanceToTarget <= 2.4 ? 20 : -60);
  if (actionId === "ranged_shot") score += (inPreferredRange ? 82 : 10) * weights.rangeControl + (b.lineOfSight ? 18 : -100);
  if (actionId === "fireball") score += (inPreferredRange ? 80 : 18) * weights.rangeControl + (b.manaPercent > 0.2 ? 18 : -70) + (b.targetIsBlocking ? 8 : 0);
  if (actionId === "root") score += (b.distanceToTarget < preferred[0] ? 75 : 22) + (b.targetIsCasting ? 12 : 0) + (b.manaPercent > 0.15 ? 10 : -60);
  if (actionId === "heal_ally") score += (1 - b.allyHealthLowestPercent) * 120 * weights.support + (b.manaPercent > 0.2 ? 10 : -80);
  if (actionId === "revive_ally") score += b.downedAllyNearby ? 130 * weights.support : -90;
  if (actionId === "boss_phase_mechanic") score += 60 + Math.max(0, 80 - b.enrageTimerSeconds) + b.bossPhase * 8;
  if (actionId === "idle_watch") score += b.targetId ? -20 : 20;

  const seededJitter = ((b.deterministicSeed * 1103515245 + actionId.length * 12345) % 997) / 9970;
  score += seededJitter;
  return { actionId, score, legal: true, reasons };
}

export function chooseHarthmereCombatAIDecisionV1(input) {
  const blackboard = createHarthmereCombatAIBlackboardV1(input);
  const archetype = HARTHMERE_COMBAT_AI_ARCHETYPES_V1[blackboard.archetypeId] || HARTHMERE_COMBAT_AI_ARCHETYPES_V1.basic_melee;
  const fsm = evaluateHarthmereCombatAIFSMV1(blackboard);
  let candidates = archetype.actions.slice();
  if (fsm.recommendedMode === "dead") candidates = ["die"];
  if (fsm.recommendedMode === "incapacitated") candidates = ["wait_stunned"];
  if (fsm.recommendedMode === "flee") candidates = ["flee_to_help", "call_help", "dodge"];
  if (fsm.recommendedMode === "revive") candidates = ["revive_ally", "heal_ally", "flee_to_help"];
  if (fsm.recommendedMode === "heal") candidates = ["heal_ally", "call_help", "backpedal"];
  if (fsm.recommendedMode === "chase" || fsm.recommendedMode === "reposition") candidates = ["chase", "backpedal", "strafe"].filter((x) => archetype.actions.includes(x) || x === "chase");
  const scored = candidates.map((actionId) => scoreHarthmereCombatAIActionV1(actionId, blackboard, archetype)).sort((a, b) => b.score - a.score);
  const selected = scored.find((s) => s.legal) || { actionId: "idle_watch", score: 0, legal: true, reasons: ["fallback_idle"] };
  const movementRequest = buildYukaSteeringPlanV1(blackboard, archetype, selected.actionId);
  const navmeshRequest = buildRecastNavigationRequestV1(blackboard, archetype, selected.actionId);
  return {
    version: HARTHMERE_THIRD_PARTY_COMBAT_AI_VERSION_V1,
    actorId: blackboard.actorId,
    targetId: blackboard.targetId,
    archetypeId: archetype.id,
    selectedActionId: selected.actionId,
    score: selected.score,
    legal: selected.legal,
    reason: selected.reasons.length ? selected.reasons.join(",") : `highest_score_${selected.actionId}`,
    fsmState: fsm.state,
    recommendedMode: fsm.recommendedMode,
    behaviorTreeProvider: archetype.treeProvider,
    steeringProvider: archetype.steeringProvider,
    navigationProvider: archetype.navigationProvider,
    behaviorTreeNode: inferBehaviorTreeNodeV1(selected.actionId),
    utilityScores: scored,
    movementRequest,
    navmeshRequest,
    serverActionRequest: buildServerActionRequestV1(blackboard, selected.actionId),
    auditTags: ["third_party_ai_intent_only", "server_authority_required", `archetype:${archetype.id}`, `action:${selected.actionId}`],
  };
}

export function inferBehaviorTreeNodeV1(actionId) {
  if (["die", "wait_stunned"].includes(actionId)) return "hard_state_guard";
  if (["flee_to_help", "call_help"].includes(actionId)) return "survival_or_help_sequence";
  if (["heal_ally", "revive_ally"].includes(actionId)) return "support_sequence";
  if (["chase", "flank", "backpedal", "strafe"].includes(actionId)) return "movement_sequence";
  if (["block", "dodge"].includes(actionId)) return "defensive_reaction_sequence";
  if (["taunt", "shield_bash", "root"].includes(actionId)) return "control_sequence";
  if (actionId === "boss_phase_mechanic") return "boss_phase_sequence";
  return "attack_sequence";
}

export function buildServerActionRequestV1(blackboard, actionId) {
  const action = HARTHMERE_COMBAT_AI_ACTIONS_V1[actionId] || HARTHMERE_COMBAT_AI_ACTIONS_V1.idle_watch;
  return {
    actionKind: action.serverActionKind,
    actorId: blackboard.actorId,
    targetId: action.requiresTarget ? blackboard.targetId : undefined,
    source: "server_scheduled_tick",
    subsystem: action.category === "boss" ? "boss_encounter" : action.serverActionKind === "request_npc_ai_tick" ? "npc_ai" : "combat",
    requestedIntent: actionId,
    serverMustValidate: ["actor_state", "target_legality", "range", "line_of_sight", "cooldowns", "resources", "safe_zone", "pvp_or_faction_rules", "anti_abuse"],
    rejectedClientClaims: ["hit", "damage", "crit", "death", "xp", "loot", "threat"],
  };
}

export function buildMistreevousCombatTreeSpecV1(archetypeId) {
  const archetype = HARTHMERE_COMBAT_AI_ARCHETYPES_V1[archetypeId] || HARTHMERE_COMBAT_AI_ARCHETYPES_V1.basic_melee;
  return {
    provider: "mistreevous",
    format: "json_tree_spec",
    deterministic: true,
    archetypeId: archetype.id,
    root: {
      type: "selector",
      name: `${archetype.id}_combat_root`,
      children: [
        { type: "sequence", name: "dead_or_incapacitated_guard", children: ["is_dead_or_downed", "resolve_death_or_wait"] },
        { type: "sequence", name: "safe_zone_or_spawn_protection_guard", children: ["hostile_action_blocked", "reposition_or_idle"] },
        { type: "sequence", name: "survival_sequence", children: ["health_low", "can_retreat", "flee_or_call_help"] },
        { type: "sequence", name: "support_sequence", children: ["ally_needs_help", "heal_or_revive"] },
        { type: "sequence", name: "movement_sequence", children: ["target_missing_or_out_of_range", "pathfind_or_reposition"] },
        { type: "sequence", name: "defensive_reaction_sequence", children: ["incoming_threat", "block_dodge_or_counter"] },
        { type: "sequence", name: "attack_sequence", children: ["target_valid", "utility_select_attack", "request_server_action"] },
        { type: "action", name: "idle_watch" },
      ],
    },
    blackboardKeys: archetype.requiredFacts,
    serverValidation: archetype.serverValidation,
  };
}

export function buildYukaSteeringPlanV1(blackboardInput, archetypeInput, selectedActionId) {
  const b = createHarthmereCombatAIBlackboardV1(blackboardInput);
  const archetype = typeof archetypeInput === "string" ? HARTHMERE_COMBAT_AI_ARCHETYPES_V1[archetypeInput] : (archetypeInput || HARTHMERE_COMBAT_AI_ARCHETYPES_V1[b.archetypeId] || HARTHMERE_COMBAT_AI_ARCHETYPES_V1.basic_melee);
  const behaviors = [];
  if (selectedActionId === "flee_to_help" || selectedActionId === "backpedal") behaviors.push("flee", "arrive", "obstacle_avoidance");
  else if (selectedActionId === "chase") behaviors.push("pursue", "seek", "obstacle_avoidance");
  else if (selectedActionId === "flank" || selectedActionId === "strafe") behaviors.push("offset_pursuit", "separation", "obstacle_avoidance");
  else behaviors.push("arrive", "separation");
  const preferred = archetype.preferredRange || [1, 3];
  return {
    provider: "yuka",
    optionalPackage: "yuka",
    selectedActionId,
    desiredRangeMin: preferred[0],
    desiredRangeMax: preferred[1],
    behaviors,
    perception: { requiresLineOfSight: true, memorySeconds: 6, forgetIfUnseenAndUnheardSeconds: 12 },
    crowd: { separationRadius: 1.2, maxNeighbors: 6, avoidStacking: true },
    note: "Yuka output is a steering suggestion; server movement/nav authority must clamp it.",
  };
}

export function buildRecastNavigationRequestV1(blackboardInput, archetypeInput, selectedActionId) {
  const b = createHarthmereCombatAIBlackboardV1(blackboardInput);
  const archetype = typeof archetypeInput === "string" ? HARTHMERE_COMBAT_AI_ARCHETYPES_V1[archetypeInput] : (archetypeInput || HARTHMERE_COMBAT_AI_ARCHETYPES_V1[b.archetypeId] || HARTHMERE_COMBAT_AI_ARCHETYPES_V1.basic_melee);
  let destinationKind = "target_ring";
  if (selectedActionId === "flee_to_help") destinationKind = "safe_anchor";
  if (selectedActionId === "backpedal") destinationKind = "retreat_ring";
  if (selectedActionId === "flank" || selectedActionId === "strafe") destinationKind = "flank_anchor";
  if (selectedActionId === "chase") destinationKind = "target_path";
  return {
    provider: "recast_navigation_js",
    optionalPackage: "recast-navigation",
    selectedActionId,
    navmeshId: "harthmere-runtime-navmesh-v1",
    from: b.position,
    to: destinationKind === "safe_anchor" ? (b.retreatPosition || { anchorId: b.safeAnchorId }) : b.targetPosition,
    destinationKind,
    desiredRange: archetype.preferredRange,
    agent: { radius: 0.42, height: 1.8, maxClimb: 0.5, maxSlopeDegrees: 50 },
    crowd: { enabled: true, avoidCrowding: true, maxAgentsInMeleeRing: 4 },
    validation: ["point_on_navmesh", "path_exists", "not_inside_wall", "not_inside_safe_zone_exploit", "leash_bounds"],
  };
}

export function buildPythonCombatAISimulationSpecV1(archetypeId) {
  const archetype = HARTHMERE_COMBAT_AI_ARCHETYPES_V1[archetypeId] || HARTHMERE_COMBAT_AI_ARCHETYPES_V1.basic_melee;
  return {
    archetypeId: archetype.id,
    pythonProviders: ["py_trees", "transitions"],
    pyTrees: {
      package: "py_trees",
      root: `${archetype.id}_combat_root`,
      blackboardKeys: archetype.requiredFacts,
      behaviours: ["is_dead_or_downed", "health_low", "ally_needs_help", "target_valid", "utility_select_action", "record_server_intent"],
    },
    transitions: {
      package: "transitions",
      states: ["idle", "alert", "chasing", "windup", "attacking", "recovery", "blocking", "dodging", "stunned", "fleeing", "dead"],
      forbidden: ["dead->attacking", "stunned->casting", "downed->loot", "spawn_protected->hostile_attack"],
    },
    replayContract: { seedRequired: true, deterministicAssertions: true, outputIsIntentOnly: true },
  };
}

export function createBehaviorTreeAdapterPlanV1(providerId) {
  return {
    providerId: providerId || "mistreevous",
    adapterKind: "behavior_tree",
    optionalImport: providerId === "behavior3js" ? "behavior3js" : "mistreevous",
    requiredMethods: ["tick", "load_tree_or_dsl", "bind_blackboard", "return_intent_only"],
    forbiddenMethods: ["apply_damage", "grant_xp", "drop_loot", "mutate_player_state_directly"],
    deterministicFallback: "buildMistreevousCombatTreeSpecV1 + chooseHarthmereCombatAIDecisionV1",
  };
}

export function createSteeringAdapterPlanV1() {
  return {
    providerId: "yuka",
    adapterKind: "steering_perception_memory",
    optionalImport: "yuka",
    requiredMethods: ["update_agent", "calculate_steering", "sense_target", "write_memory"],
    forbiddenMethods: ["teleport_actor", "bypass_collision", "ignore_server_nav_validation"],
    deterministicFallback: "buildYukaSteeringPlanV1",
  };
}

export function createNavigationAdapterPlanV1() {
  return {
    providerId: "recast_navigation_js",
    adapterKind: "navmesh_pathfinding_crowd",
    optionalImport: "recast-navigation",
    requiredMethods: ["find_path", "sample_nearest", "validate_destination", "avoid_crowding"],
    forbiddenMethods: ["move_without_server_authority", "accept_off_navmesh_destination"],
    deterministicFallback: "buildRecastNavigationRequestV1",
  };
}

export function validateThirdPartyAIDependencyPlanV1(packageJson, pythonRequirementsText) {
  const deps = Object.assign({}, (packageJson && packageJson.dependencies) || {}, (packageJson && packageJson.devDependencies) || {}, (packageJson && packageJson.optionalDependencies) || {});
  const pythonText = String(pythonRequirementsText || "");
  const recommendedNpm = ["mistreevous", "yuka", "recast-navigation"];
  const recommendedPython = ["py_trees", "transitions"];
  const missingNpm = recommendedNpm.filter((name) => !(name in deps));
  const missingPython = recommendedPython.filter((name) => !new RegExp(`(^|\\n)\\s*${name.replace("_", "[_-]")}(==|>=|~=|\\s|$)`, "i").test(pythonText));
  return {
    ok: true,
    liveModeSafeWithoutOptionalPackages: true,
    missingNpm,
    missingPython,
    recommendedInstallCommands: {
      npm: "npm install mistreevous yuka recast-navigation --save",
      python: "pip install py_trees transitions",
    },
    hardRequirement: "No optional third-party AI package may become the authority for hit, damage, death, XP, loot, or persistence.",
    reason: "Adapters are optional. The deterministic Harthmere fallback keeps tests and server ticks stable until packages are installed.",
  };
}

export function validateHarthmereCombatAIReadinessV1() {
  const roles = HARTHMERE_THIRD_PARTY_COMBAT_AI_STACK_V1.map((x) => x.role);
  const archetypes = Object.values(HARTHMERE_COMBAT_AI_ARCHETYPES_V1);
  const errors = [];
  for (const role of ["behavior_tree", "steering_perception_memory", "navmesh_pathfinding_crowd", "utility_scoring", "hard_state_machine"]) {
    if (!roles.includes(role)) errors.push(`missing_provider_role:${role}`);
  }
  for (const archetype of archetypes) {
    if (!archetype.actions || archetype.actions.length < 3) errors.push(`archetype_has_too_few_actions:${archetype.id}`);
    if (!archetype.requiredFacts || archetype.requiredFacts.length < 3) errors.push(`archetype_missing_blackboard_facts:${archetype.id}`);
    if (!archetype.serverValidation || archetype.serverValidation.length < 3) errors.push(`archetype_missing_server_validation:${archetype.id}`);
  }
  const stackText = JSON.stringify(HARTHMERE_THIRD_PARTY_COMBAT_AI_STACK_V1).toLowerCase();
  if (stackText.includes("llm") || stackText.includes("chatgpt") || stackText.includes("openai")) errors.push("combat_ai_stack_must_not_depend_on_llms");
  return {
    ok: errors.length === 0,
    errors,
    providerCount: HARTHMERE_THIRD_PARTY_COMBAT_AI_STACK_V1.length,
    archetypeCount: archetypes.length,
    productionReadiness: ["intent_only_ai", "server_authoritative_validation", "deterministic_fallback", "optional_third_party_adapters", "testable_blackboard", "anti_cheat_boundaries"],
  };
}
