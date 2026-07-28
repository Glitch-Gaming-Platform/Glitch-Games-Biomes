#!/usr/bin/env bash
set -euo pipefail

# Complete local release gate for frontend -> backend -> native ECS behavior.
# The caller must start the production image/stack first; this script never
# deploys and never points at production unless the caller explicitly supplies
# that URL. HARTHMERE_NATIVE_ECS_E2E_REQUIRE_BROWSER=0 is intended only for a
# fast source/unit pass, never for a deployment candidate.

ROOT="${1:-$(pwd)}"
cd "$ROOT"

# Match the repository's ./b test environment. In particular, deterministic
# loot rolls prevent rare-drop branches from making authority tests flaky.
export MOCHA_TEST=1

TS_MOCHA=(
  npx ts-mocha
  --no-config
  --require ts-node/register/transpile-only
  --require tsconfig-paths/register
  --project tsconfig.json
)
CLIENT_TS_MOCHA=(
  "${TS_MOCHA[@]}"
  --require src/server/test/global_setup.ts
  --timeout 10000
)
SERVER_TS_MOCHA=(
  "${TS_MOCHA[@]}"
  --require src/server/test/global_setup.ts
  # This gate deliberately batches Redis, world-edit, and ECS suites. A few
  # valid integration cases take 5-15 seconds under parallel CPU contention,
  # so use a batch-safe ceiling while preserving each test's own assertions.
  --timeout 30000
  --parallel
  --jobs 4
)

echo "== Native ECS topology and security contracts =="
node scripts/harthmere/test-harthmere-stream-workers-production.cjs "$ROOT"
node scripts/harthmere/test-harthmere-native-farming-e2e-contract.cjs "$ROOT"
node scripts/harthmere/test-harthmere-native-ecs-all-jobs-e2e-contract.cjs "$ROOT"
node scripts/harthmere/test-harthmere-native-robot-story-e2e-contract.cjs "$ROOT"
node scripts/harthmere/test-harthmere-native-chase-e2e-contract.cjs "$ROOT"
"${TS_MOCHA[@]}" \
  src/client/game/e2e/harthmere_native_ecs_e2e.test.ts \
  src/pages/api/harthmere/test/visual_test_auth.test.ts

echo "== Visible frontend interaction contracts =="
# Keep onboarding, active-leaf notifications, and their real completion
# fixtures inside the release gate rather than relying on ad-hoc local runs.
"${CLIENT_TS_MOCHA[@]}" \
  src/client/game/scripts/audio.test.ts \
  src/client/components/challenges/worldInteractionDispatcher.browser.test.tsx \
  src/client/components/challenges/TalkDialogModalStep.browser.test.tsx \
  src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.validation.test.ts \
  src/client/game/context_managers/garden_hose.test.ts \
  src/client/components/overlays/inspected/interactionRoleResolver.test.ts \
  src/client/components/biomes_ui/__tests__/BiomesHotbar.actions.browser.test.tsx \
  src/client/components/biomes_ui/__tests__/InventoryTab.actions.browser.test.tsx \
  src/client/components/biomes_ui/__tests__/InventoryTab.fullStack.test.tsx \
  src/client/components/biomes_ui/__tests__/FarmingTab.test.tsx \
  src/client/components/biomes_ui/__tests__/mapQuestMainQuest.test.tsx \
  src/client/components/biomes_ui/hotbar/hotbarAction.test.ts \
  src/client/components/biomes_ui/hotbar/nativeHotbarActions.test.ts \
  src/client/components/biomes_ui/adapters/__tests__/nativeQuestMapAdapter.test.ts \
  src/client/components/biomes_ui/adapters/__tests__/mainQuestSelection.test.ts \
  src/client/components/biomes_ui/adapters/__tests__/farmingMapQuest.test.ts \
  src/client/components/biomes_ui/adapters/__tests__/mapAdapter.test.ts \
  src/client/components/biomes_ui/adapters/__tests__/jobsBoardQuestMapAdapter.test.ts \
  src/client/components/biomes_ui/adapters/__tests__/questProjectionDedupe.test.ts \
  src/client/components/challenges/harthmereGatheringNodeWorldInteraction.test.ts \
  src/client/components/harthmere_jobs_board/__tests__/HarthmereJobsBoardPanel.keyboard.test.tsx \
  src/client/components/harthmere_jobs_board/__tests__/jobsBoardLiveAdapter.test.ts \
  src/client/components/harthmere_jobs_board/__tests__/jobsBoardInteractionPriority.test.ts \
  src/client/components/test/harthmere_live_fetch_coalesce.test.ts \
  src/client/util/nux/state_machines.test.ts \
  src/shared/harthmere/test/world_object_f_interaction_all_props.test.ts \
  src/shared/harthmere/test/harthmere_world_object_inspectable.test.ts \
  src/shared/harthmere/test/snapshot_grove_trigger_contract.test.ts \
  src/shared/harthmere/test/gathering_node_authority.test.ts \
  src/shared/harthmere/test/harthmere_item_source_reachability.test.ts \
  src/shared/harthmere/test/world_object_interaction_authority.test.ts

echo "== Native ECS handler and authority contracts =="
"${SERVER_TS_MOCHA[@]}" \
  src/pages/api/harthmere/test/native_container.test.ts \
  src/pages/api/harthmere/test/native_combat_api_helpers.test.ts \
  src/pages/api/harthmere/test/live_mode_api_persistence.test.ts \
  src/client/game/interact/items/terrain.test.ts \
  src/server/logic/events/handlers/test/drops.test.ts \
  src/server/logic/events/handlers/test/farming_harvest.test.ts \
  src/server/gaia/simulations/farming/test/harthmere_harvest_drop_suppression.test.ts \
  src/server/logic/test/harthmere_consumption.test.ts \
  src/server/logic/test/harthmere_inventory_transaction.test.ts \
  src/server/logic/test/harthmere_native_respawn.test.ts \
  src/server/logic/test/harthmere_npc_hit.test.ts \
  src/server/logic/test/harthmere_placeable_transaction.test.ts \
  src/server/logic/test/inventory.test.ts \
  src/server/shared/triggers/test/challenge_claim_rewards_roundtrip.test.ts \
  src/server/shared/triggers/test/native_road_ahead_inventory_triggers.test.ts \
  src/server/shared/triggers/test/native_robot_story_continuation.test.ts \
  src/server/shared/triggers/test/engine_cleanup.test.ts \
  src/server/harthmere/test/native_vitals_scheduler.test.ts \
  src/server/harthmere/test/native_vitals_environment.test.ts \
  src/server/harthmere/test/native_skill_materialization.test.ts \
  src/server/harthmere/test/live_mode_escort_scheduler.test.ts \
  src/shared/physics/movement.test.ts \
  src/shared/npc/behavior/test/chase_attack_logic.test.ts \
  src/shared/harthmere/test/harthmere_native_combat.test.ts \
  src/shared/harthmere/test/harthmere_native_vitals.test.ts \
  src/shared/harthmere/test/harthmere_skill_progression.test.ts \
  src/shared/harthmere/test/live_mode_skill_progression.test.ts \
  src/shared/harthmere/test/inventory_system_full_stack.test.ts \
  src/shared/harthmere/test/native_road_ahead_contract.test.ts \
  src/shared/harthmere/test/mmo_building_authority.test.ts \
  src/shared/harthmere/test/mmo_combat_authority.test.ts \
  src/shared/harthmere/test/mmo_farming_food_stamina.test.ts \
  src/shared/harthmere/test/mmo_inventory_authority.test.ts \
  src/shared/harthmere/test/mmo_inventory_loot_authority.test.ts \
  src/shared/harthmere/test/mmo_jobs_board_authority.test.ts \
  src/shared/harthmere/test/mmo_jobs_board_auto_seed.test.ts \
  src/shared/harthmere/test/harthmere_native_bikkie_items.test.ts \
  src/shared/harthmere/test/live_mode_native_actor_binding.test.ts \
  src/client/game/glitch/harthmere_cloud_save_restore_policy.test.ts \
  src/client/game/glitch/test/harthmere_glitch_identity_normalization.test.ts \
  src/client/util/storage/__tests__/glitch_cloud_save_transport.test.ts \
  src/pages/api/glitch/test/harthmere_cloud_save_identity.test.ts

echo "== Snapshot Grove native completion reducer contracts =="
# The full live-mode reducer suite is intentionally large. This focused gate
# runs the transport-success/gameplay-rejection and final-turn-in cases that
# keep all onboarding lessons completable and removable from the journal.
"${TS_MOCHA[@]}" \
  src/shared/harthmere/test/live_mode_backend.test.ts \
  --grep "Snapshot Grove|generic completion"

if [ "${HARTHMERE_NATIVE_ECS_E2E_REQUIRE_BROWSER:-1}" != "1" ]; then
  echo "INFO browser round-trip skipped by HARTHMERE_NATIVE_ECS_E2E_REQUIRE_BROWSER=0"
  exit 0
fi

if [ -z "${HARTHMERE_E2E_CONTROL_TOKEN:-}" ]; then
  echo "ERROR HARTHMERE_E2E_CONTROL_TOKEN is required for browser round-trip tests" >&2
  exit 1
fi

echo "== Browser -> logic -> native ECS -> sync round trips =="
HARTHMERE_E2E_SKILLS_ONLY=1 \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs

HARTHMERE_E2E_SNAPSHOT_GROVE_ONBOARDING_ONLY=1 \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs

# Run each browser mode serially. Starting multiple WebGL clients alongside the
# production-shaped local stack can exhaust Docker Desktop memory and conceal
# gameplay failures behind browser or Redis OOM exits.
node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs

if [ "${HARTHMERE_NATIVE_ECS_E2E_SKIP_EXHAUSTIVE_ROBOT_STORY:-0}" != "1" ]; then
  echo "== Exhaustive Busted -> Get the Muck Out -> Muck vs. Machine round trip =="
  HARTHMERE_E2E_ROBOT_STORY_EXHAUSTIVE=1 \
    node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
fi
