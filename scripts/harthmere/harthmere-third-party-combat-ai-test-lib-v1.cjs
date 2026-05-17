/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${message}`);
  }
}

function loadModule(root) {
  const modulePath = path.join(root, "src/shared/harthmere/third_party_combat_ai_v1.ts");
  assert(fs.existsSync(modulePath), "third_party_combat_ai_v1.ts exists");

  const source = fs.readFileSync(modulePath, "utf8");

  // This test library executes a .ts source file through Node's vm module.
  // The combat AI module intentionally uses normal TypeScript syntax such as
  // `as const`, `export type`, and typed function parameters, so running the raw
  // file as JavaScript breaks the full suite. Transpile the module first, then
  // execute the emitted CommonJS in the sandbox.
  let ts;
  try {
    const tsPath = require.resolve("typescript", { paths: [root, process.cwd(), __dirname] });
    ts = require(tsPath);
  } catch (error) {
    console.error("FAIL TypeScript package is required to load third_party_combat_ai_v1.ts in tests");
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
    throw error;
  }

  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
      isolatedModules: false,
      skipLibCheck: true,
    },
    fileName: modulePath,
  }).outputText;

  const module = { exports: {} };
  const sandbox = {
    exports: module.exports,
    module,
    require,
    console,
    Math,
    Number,
    Boolean,
    Object,
    Array,
    String,
    RegExp,
    JSON,
    Date,
    Set,
    Map,
  };
  vm.createContext(sandbox);
  vm.runInContext(output, sandbox, { filename: modulePath });
  return { modulePath, text: source, api: module.exports };
}

function assertContracts(root) {
  const { text, api } = loadModule(root);
  assert(api.HARTHMERE_THIRD_PARTY_COMBAT_AI_VERSION_V1 === "harthmere-third-party-combat-ai-v1", "version marker exists");
  const stack = api.HARTHMERE_THIRD_PARTY_COMBAT_AI_STACK_V1;
  assert(Array.isArray(stack) && stack.length >= 6, "provider stack has third-party plus internal providers");
  for (const id of ["mistreevous", "yuka", "recast_navigation_js", "py_trees", "transitions", "harthmere_utility_ai", "harthmere_combat_fsm"]) {
    assert(stack.some((provider) => provider.id === id), `provider stack includes ${id}`);
  }
  for (const role of ["behavior_tree", "steering_perception_memory", "navmesh_pathfinding_crowd", "utility_scoring", "hard_state_machine"]) {
    assert(stack.some((provider) => provider.role === role), `provider role exists: ${role}`);
  }
  assert(!/openai|chatgpt|llm/i.test(JSON.stringify(stack)), "combat AI stack does not depend on LLMs");
  assert(text.includes("serverOnlyRules"), "providers declare server-only authority rules");
  const readiness = api.validateHarthmereCombatAIReadinessV1();
  assert(readiness.ok, `readiness validation passes: ${readiness.errors.join(",")}`);
}

function assertBehaviorTreeAndFSM(root) {
  const { api } = loadModule(root);
  const tree = api.buildMistreevousCombatTreeSpecV1("shield_guard");
  assert(tree.provider === "mistreevous", "Mistreevous tree spec provider is explicit");
  assert(tree.root.type === "selector", "behavior tree root is a selector");
  assert(JSON.stringify(tree.root).includes("survival_sequence"), "behavior tree includes survival sequence");
  assert(JSON.stringify(tree.root).includes("attack_sequence"), "behavior tree includes attack sequence");
  assert(tree.serverValidation.length >= 3, "behavior tree carries server validation rules");

  const dead = api.evaluateHarthmereCombatAIFSMV1({ actorCombatState: "dead", healthPercent: 0 });
  assert(!dead.canAct && dead.recommendedMode === "dead", "FSM blocks dead actors");
  const stunned = api.evaluateHarthmereCombatAIFSMV1({ actorCombatState: "stunned", healthPercent: 0.8 });
  assert(!stunned.canAct && stunned.recommendedMode === "incapacitated", "FSM blocks stunned actors");
  const flee = api.evaluateHarthmereCombatAIFSMV1({ actorCombatState: "in_combat", healthPercent: 0.12, targetId: "player:1", navmeshHasRetreat: true });
  assert(flee.canAct && flee.recommendedMode === "flee", "FSM recommends flee at low health");
  const revive = api.evaluateHarthmereCombatAIFSMV1({ actorCombatState: "in_combat", healthPercent: 0.9, downedAllyNearby: true, allyHealthLowestPercent: 0, manaPercent: 0.8 });
  assert(revive.recommendedMode === "revive", "FSM prioritizes downed ally revive");
}

function assertUtilityMovement(root) {
  const { api } = loadModule(root);
  const archer = api.chooseHarthmereCombatAIDecisionV1({ archetypeId: "archer_kiter", actorId: "npc:archer", targetId: "player:1", distanceToTarget: 2, healthPercent: 0.9, lineOfSight: true, legalTargets: ["player:1"], nowMs: 1000 });
  assert(["backpedal", "root", "dodge"].includes(archer.selectedActionId), `archer kiter reacts to close target (${archer.selectedActionId})`);
  assert(archer.movementRequest.provider === "yuka", "decision includes Yuka steering plan");
  assert(archer.navmeshRequest.provider === "recast_navigation_js", "decision includes recast-navigation-js nav plan");
  assert(archer.serverActionRequest.rejectedClientClaims.includes("damage"), "server action rejects client damage claims");

  const melee = api.chooseHarthmereCombatAIDecisionV1({ archetypeId: "basic_melee", actorId: "npc:melee", targetId: "player:1", distanceToTarget: 20, healthPercent: 0.8, lineOfSight: true, legalTargets: ["player:1"], nowMs: 1000 });
  assert(melee.selectedActionId === "chase", "melee chases distant target");
  assert(melee.navmeshRequest.destinationKind === "target_path", "chase uses target path nav request");

  const guard = api.chooseHarthmereCombatAIDecisionV1({ archetypeId: "shield_guard", actorId: "npc:guard", targetId: "player:1", distanceToTarget: 2, healthPercent: 0.45, allyHealthLowestPercent: 1, targetIsCasting: true, legalTargets: ["player:1"], nowMs: 1000 });
  assert(["shield_bash", "taunt", "block"].includes(guard.selectedActionId), `shield guard uses control/defense (${guard.selectedActionId})`);

  const healer = api.chooseHarthmereCombatAIDecisionV1({ archetypeId: "healer_support", actorId: "npc:healer", targetId: "ally:1", distanceToTarget: 4, downedAllyNearby: true, allyHealthLowestPercent: 0, manaPercent: 0.8, legalTargets: ["ally:1"], nowMs: 1000 });
  assert(healer.selectedActionId === "revive_ally", "healer support revives downed ally");
}

function assertAdapterAvailability(root) {
  const { api } = loadModule(root);
  const emptyPlan = api.validateThirdPartyAIDependencyPlanV1({ dependencies: {} }, "");
  assert(emptyPlan.liveModeSafeWithoutOptionalPackages, "system remains live-mode safe without optional packages");
  assert(emptyPlan.missingNpm.includes("mistreevous"), "dependency plan recommends Mistreevous when missing");
  assert(emptyPlan.missingNpm.includes("yuka"), "dependency plan recommends Yuka when missing");
  assert(emptyPlan.missingNpm.includes("recast-navigation"), "dependency plan recommends recast-navigation when missing");
  assert(emptyPlan.missingPython.includes("py_trees"), "dependency plan recommends py_trees when missing");
  assert(emptyPlan.missingPython.includes("transitions"), "dependency plan recommends transitions when missing");
  assert(emptyPlan.recommendedInstallCommands.npm.includes("npm install mistreevous yuka recast-navigation"), "npm install command is provided");

  const fullPlan = api.validateThirdPartyAIDependencyPlanV1({ dependencies: { mistreevous: "^4", yuka: "^0", "recast-navigation": "^0" } }, "py_trees==2.4.0\ntransitions>=0.9\n");
  assert(fullPlan.missingNpm.length === 0, "dependency plan detects installed npm packages");
  assert(fullPlan.missingPython.length === 0, "dependency plan detects installed python packages");

  assert(api.createBehaviorTreeAdapterPlanV1("mistreevous").forbiddenMethods.includes("apply_damage"), "behavior-tree adapter forbids direct damage");
  assert(api.createSteeringAdapterPlanV1().forbiddenMethods.includes("teleport_actor"), "steering adapter forbids teleport authority");
  assert(api.createNavigationAdapterPlanV1().requiredMethods.includes("find_path"), "navigation adapter requires pathfinding method");
}

function assertNavigationPerception(root) {
  const { api } = loadModule(root);
  const b = api.createHarthmereCombatAIBlackboardV1({ archetypeId: "pack_wolf", targetId: "player:1", position: { x: 1, y: 0, z: 2 }, targetPosition: { x: 8, y: 0, z: 9 }, distanceToTarget: 9 });
  const steering = api.buildYukaSteeringPlanV1(b, "pack_wolf", "flank");
  assert(steering.behaviors.includes("offset_pursuit"), "flank uses offset pursuit steering");
  assert(steering.behaviors.includes("separation"), "flank uses separation to avoid stacking");
  assert(steering.perception.memorySeconds > 0, "perception memory has finite memory seconds");

  const nav = api.buildRecastNavigationRequestV1(b, "pack_wolf", "flank");
  assert(nav.destinationKind === "flank_anchor", "flank nav request targets flank anchor");
  assert(nav.validation.includes("point_on_navmesh"), "nav request validates point on navmesh");
  assert(nav.crowd.avoidCrowding, "nav request enables anti-crowding");

  const fleeNav = api.buildRecastNavigationRequestV1({ archetypeId: "civilian_flee", targetId: "wolf", safeAnchorId: "guard_yard", distanceToTarget: 3, retreatPosition: { x: 0, y: 0, z: 20 } }, "civilian_flee", "flee_to_help");
  assert(fleeNav.destinationKind === "safe_anchor", "flee nav request targets safe anchor");
}

function assertEndToEnd(root) {
  const { api } = loadModule(root);
  const scenarios = [
    { name: "dead", input: { archetypeId: "basic_melee", actorCombatState: "dead", healthPercent: 0 }, expected: "die" },
    { name: "caster roots close target", input: { archetypeId: "caster_controller", actorId: "npc:mage", targetId: "player:1", distanceToTarget: 2, manaPercent: 0.9, lineOfSight: true, legalTargets: ["player:1"], nowMs: 5000 }, allowed: ["root", "backpedal", "dodge", "call_help"] },
    { name: "boss phase", input: { archetypeId: "boss_phase_controller", actorId: "boss:bell", targetId: "player:tank", distanceToTarget: 12, healthPercent: 0.35, bossPhase: 3, enrageTimerSeconds: 30, legalTargets: ["player:tank"], nowMs: 5000 }, allowed: ["boss_phase_mechanic", "fireball", "root", "taunt"] },
    { name: "civilian flees", input: { archetypeId: "civilian_flee", actorId: "npc:civilian", targetId: "bandit", distanceToTarget: 5, healthPercent: 1, navmeshHasRetreat: true, legalTargets: ["bandit"], nowMs: 5000 }, allowed: ["flee_to_help", "call_help"] },
  ];
  for (const scenario of scenarios) {
    const decision = api.chooseHarthmereCombatAIDecisionV1(scenario.input);
    if (scenario.expected) assert(decision.selectedActionId === scenario.expected, `${scenario.name} selects ${scenario.expected}`);
    if (scenario.allowed) assert(scenario.allowed.includes(decision.selectedActionId), `${scenario.name} selects one of ${scenario.allowed.join("/")} (${decision.selectedActionId})`);
    assert(decision.auditTags.includes("server_authority_required"), `${scenario.name} decision requires server authority`);
    assert(decision.serverActionRequest.serverMustValidate.includes("anti_abuse"), `${scenario.name} server action validates anti-abuse`);
  }
}

function assertProductionHardening(root) {
  const { api } = loadModule(root);
  const start = Date.now();
  const actions = new Set();
  for (let i = 0; i < 300; i += 1) {
    const archetypeId = Object.keys(api.HARTHMERE_COMBAT_AI_ARCHETYPES_V1)[i % Object.keys(api.HARTHMERE_COMBAT_AI_ARCHETYPES_V1).length];
    const decisionA = api.chooseHarthmereCombatAIDecisionV1({ archetypeId, actorId: `npc:${i}`, targetId: "player:1", legalTargets: ["player:1"], distanceToTarget: (i % 35) + 1, healthPercent: ((i % 100) + 1) / 100, manaPercent: 0.8, staminaPercent: 0.8, lineOfSight: i % 7 !== 0, deterministicSeed: 42, nowMs: 10000 });
    const decisionB = api.chooseHarthmereCombatAIDecisionV1({ archetypeId, actorId: `npc:${i}`, targetId: "player:1", legalTargets: ["player:1"], distanceToTarget: (i % 35) + 1, healthPercent: ((i % 100) + 1) / 100, manaPercent: 0.8, staminaPercent: 0.8, lineOfSight: i % 7 !== 0, deterministicSeed: 42, nowMs: 10000 });
    assert(decisionA.selectedActionId === decisionB.selectedActionId, `deterministic decision ${i}`);
    assert(api.HARTHMERE_COMBAT_AI_ACTIONS_V1[decisionA.selectedActionId], `decision ${i} selects known action ${decisionA.selectedActionId}`);
    actions.add(decisionA.selectedActionId);
  }
  const elapsed = Date.now() - start;
  assert(elapsed < 1500, `300 deterministic combat AI decisions stay under smoke-test budget (${elapsed}ms)`);
  assert(actions.size >= 6, "stress scenarios exercise varied combat actions");
}

module.exports = {
  assertContracts,
  assertBehaviorTreeAndFSM,
  assertUtilityMovement,
  assertAdapterAvailability,
  assertNavigationPerception,
  assertEndToEnd,
  assertProductionHardening,
};
