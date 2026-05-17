# Harthmere Third-Party Combat AI Integration v1

This patch implements the production-ready combat AI adapter layer for Harthmere.
It is designed for the recommended stack:

- Mistreevous for behavior trees and boss/combat decision trees.
- Yuka for steering, perception, memory, pursuit, evasion, and spacing.
- recast-navigation-js through the `recast-navigation` npm package for navmesh pathfinding and crowd-aware movement requests.
- py_trees for Python behavior-tree simulations.
- transitions for Python finite-state-machine simulations.
- Harthmere internal utility scoring and combat FSM as deterministic fallbacks.

The key design rule is non-negotiable: third-party AI can choose intent, movement suggestions, and tactical mode. It may not directly apply hits, damage, death, XP, loot, reputation, or persistence. Those must continue to pass through the shared combat/progression/live-mode server authority layers.

## Installed module

```text
src/shared/harthmere/third_party_combat_ai_v1.ts
```

The module exports:

```text
HARTHMERE_THIRD_PARTY_COMBAT_AI_STACK_V1
HARTHMERE_COMBAT_AI_ARCHETYPES_V1
HARTHMERE_COMBAT_AI_ACTIONS_V1
createHarthmereCombatAIBlackboardV1
buildMistreevousCombatTreeSpecV1
buildYukaSteeringPlanV1
buildRecastNavigationRequestV1
buildPythonCombatAISimulationSpecV1
createBehaviorTreeAdapterPlanV1
createSteeringAdapterPlanV1
createNavigationAdapterPlanV1
validateThirdPartyAIDependencyPlanV1
validateHarthmereCombatAIReadinessV1
evaluateHarthmereCombatAIFSMV1
scoreHarthmereCombatAIActionV1
chooseHarthmereCombatAIDecisionV1
```

## Archetypes included

```text
basic_melee
shield_guard
archer_kiter
caster_controller
healer_support
pack_wolf
boss_phase_controller
elite_duelist
civilian_flee
```

Each archetype declares:

```text
behavior-tree provider
steering provider
navigation provider
preferred range
actions
utility weights
required blackboard facts
server validation requirements
```

## Optional dependency command

The patch works without optional packages because it includes deterministic fallback plans. To wire actual third-party libraries, install:

```bash
npm install mistreevous yuka recast-navigation --save
pip install py_trees transitions
```

Keep these optional. The production server should still be able to run deterministic fallback decisions during CI, tests, and emergency package rollback.

## Test coverage

```text
test-harthmere-third-party-combat-ai-contracts-v1.cjs
test-harthmere-third-party-combat-ai-behavior-fsm-v1.cjs
test-harthmere-third-party-combat-ai-utility-movement-v1.cjs
test-harthmere-third-party-combat-ai-adapters-v1.cjs
test-harthmere-third-party-combat-ai-navigation-perception-v1.cjs
test-harthmere-third-party-combat-ai-end-to-end-v1.cjs
test-harthmere-third-party-combat-ai-production-hardening-v1.cjs
```

The tests cover:

- provider stack completeness
- no LLM dependency
- behavior-tree specs
- combat FSM correctness
- utility action scoring
- melee chase behavior
- archer kiting behavior
- guard control/defense behavior
- healer revive behavior
- boss phase intent
- civilian flee/call-help behavior
- Yuka steering plans
- recast-navigation-js path requests
- Python py_trees/transitions simulation specs
- optional dependency detection
- forbidden authority methods
- deterministic repeatability
- high-volume smoke performance

## Live-mode integration boundary

For live mode, the tick flow should be:

```text
1. Server builds CombatBlackboard from authoritative state.
2. Behavior tree / utility / steering / nav adapters return intent only.
3. Server converts intent into a live-mode action request.
4. Existing combat/progression/live-mode validation checks legality.
5. Server applies database mutations and appends audit logs.
6. Client receives UI events, animations, movement, combat logs, and floating text.
```

Do not let client-side AI or third-party package output bypass server validation.
