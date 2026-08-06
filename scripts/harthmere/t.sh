#!/usr/bin/env bash
# t.sh — the fast test entry point.
#
#   scripts/harthmere/t.sh ch1            # Chapter 1 suite      (~4 s)
#   scripts/harthmere/t.sh quests         # quest/container path (~2 s)
#   scripts/harthmere/t.sh bible          # Bible catalog suite  (~1 s)
#   scripts/harthmere/t.sh bible:main     # main arc only — parses 13 of 85 rows
#   scripts/harthmere/t.sh bible:e2e      # pure-data 85-quest playthrough
#   scripts/harthmere/t.sh grove          # Grove catalog suite  (~1 s)
#   scripts/harthmere/t.sh grove:fountain # fountain arc only — 13 of 51 rows
#   scripts/harthmere/t.sh grove:catalog  # pure-data 51-quest walk (topology only)
#   scripts/harthmere/t.sh grove:live     # all 51 Grove live authority rows
#   scripts/harthmere/t.sh ui             # BiomesUI tabs        (~2 s)
#   scripts/harthmere/t.sh water          # river/still-water + repair exemptions
#   scripts/harthmere/t.sh boards         # the four request boards
#   scripts/harthmere/t.sh boards:e2e     # board requests through the trigger engine
#   scripts/harthmere/t.sh jobs           # the MMO jobs board (~7 s) — NOT `boards`
#   scripts/harthmere/t.sh postgimme      # Hoedown -> Battery Not Included
#   scripts/harthmere/t.sh icons          # inventory icon assets + aliases + UI
#   scripts/harthmere/t.sh gate           # quest + UI + types in one batch
#   scripts/harthmere/t.sh cutscene       # cutscene generator   (~2 s)
#   scripts/harthmere/t.sh promo          # promo still registry (~1 s)
#   scripts/harthmere/t.sh visuals        # terrain + promo tests/types (~3 s warm)
#   scripts/harthmere/t.sh perf           # FPS/polling/save/telemetry contracts
#   scripts/harthmere/t.sh combat         # targeting, retaliation, NPC damage, chase, and combat presentation
#   scripts/harthmere/t.sh watch ch1      # re-run on save
#   scripts/harthmere/t.sh types          # scoped typecheck     (~3 s)
#   scripts/harthmere/t.sh types:stack    # focused stack wiring typecheck
#   scripts/harthmere/t.sh file <path>    # one file
#   scripts/harthmere/t.sh full           # everything, server bootstrap on
#
# THREE TIERS, AND NONE OF THEM REPLACES THE NEXT
#   grove:catalog  quest topology, ids, gates, waypoint existence. No items,
#                  no controls, no dialogue, no rewards, no rendering.
#   grove:live     live authority coverage against the backend.
#   browser run    the actual 51-quest player flow. Still required before
#                  shipping; nothing above proves a player can finish a quest.
#
#   `grove:e2e` is deliberately NOT a preset any more. It named the live rows,
#   then briefly named the pure-data walk — so the command someone reaches for
#   by habit would silently have run the weakest tier. Ask for a tier by name.
#
# WHY THIS IS FASTER THAN `./b test`
#   `.mocharc.json` requires src/server/test/global_setup.ts, which runs
#   serverTestInit() + prepareBikkieForTest() on EVERY invocation — ~2.5 s
#   before a single assertion, even for pure-data suites that never touch a
#   server or Bikkie. `.mocharc.fast.json` drops it.
#   Measured: single file 3.73 s -> 1.19 s; Chapter 1 suite 8.06 s -> 4.15 s.
#
# WHEN YOU MUST USE `full` (bootstrap required)
#   Anything importing Bikkie item/biscuit data, the ECS gen layer, server
#   handlers, or the trigger engine. If a suite fails ONLY under the fast
#   preset, that is the signal — run it with `full` and note it here.
#
# NOT USED ON PURPOSE: --parallel. Each worker re-pays ts-node startup, so
#   4 jobs measured SLOWER than serial (5.93 s vs 4.95 s on a 323-test slice).
#   Parallelism only pays once a slice is large enough to amortise that, which
#   in this repo means the `full` preset, not these.

set -euo pipefail
cd "$(dirname "$0")/../.."

# The broad suite imports the native zRPC WebSocket server. After any install
# refresh, uWebSockets.js exposes only the ABI binaries supported by the
# repository pin, so a transitional Node 20 shell fails before Mocha can run a
# single assertion. Keep the cheap focused presets cross-version, but make the
# final `full` gate select the exact .nvmrc runtime before defining NODE_OPTIONS
# or launching Mocha.
if [ "${1:-}" = "full" ]; then
  REQUIRED_NODE_VERSION="$(tr -d '[:space:]' < .nvmrc)"
  CURRENT_NODE_VERSION="$(node -p 'process.versions.node' 2>/dev/null || true)"
  if [ "$CURRENT_NODE_VERSION" != "$REQUIRED_NODE_VERSION" ]; then
    PINNED_NODE_BIN="$HOME/.nvm/versions/node/v${REQUIRED_NODE_VERSION}/bin"
    if [ -x "$PINNED_NODE_BIN/node" ]; then
      export PATH="$PINNED_NODE_BIN:$PATH"
      CURRENT_NODE_VERSION="$(node -p 'process.versions.node')"
    fi
  fi
  if [ "$CURRENT_NODE_VERSION" != "$REQUIRED_NODE_VERSION" ]; then
    echo "full test gate requires Node $REQUIRED_NODE_VERSION from .nvmrc; found ${CURRENT_NODE_VERSION:-none}." >&2
    exit 1
  fi
fi

# Node 22+ can let its native TypeScript loader intercept Mocha's dynamic
# import before ts-node and tsconfig-paths apply this repo's CommonJS/alias
# contract. Node 20 does not recognize the opt-out flag, so keep the fast
# launcher usable while developer shells move to the repository's Node 24 pin.
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( NODE_MAJOR >= 22 )); then
  export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--no-experimental-strip-types"
fi

FAST=(node_modules/.bin/mocha --config .mocharc.fast.json)

CH1=(
  'src/shared/harthmere/test/ch1_*.test.ts'
  'src/shared/cutscene/test/ch1_scenes.test.ts'
  'src/server/harthmere/test/ch1_fragment_authority.test.ts'
  'src/server/harthmere/test/ch1_encounter_scheduler_lease.test.ts'
  'src/server/harthmere/test/ch1_prop_ecs_seed.test.ts'
  'src/server/harthmere/test/ch1_warp_token.test.ts'
  'src/pages/api/harthmere/test/chapter1_progress.test.ts'
  'src/client/game/scripts/test/harthmere_npc_projection.test.ts'
  'src/client/game/scripts/test/overlays_talk_radius.test.ts'
  'src/client/game/cutscene/ch1_playback.test.ts'
  'src/client/components/challenges/Chapter1NativeObjectivePrompt.test.ts'
  'src/client/components/challenges/Chapter1PollingPerformance.test.ts'
  'src/shared/harthmere/test/material_acquisition_guidance.test.ts'
  'src/shared/harthmere/test/harthmere_business_storefront_purchase.test.ts'
)
QUESTS=(
  'src/shared/harthmere/test/ch1_live_fixes.test.ts'
  'src/shared/harthmere/test/harthmere_world_object_*.test.ts'
  'src/shared/harthmere/test/world_object_f_interaction_all_props.test.ts'
  'src/shared/harthmere/test/native_road_ahead_contract.test.ts'
  'src/shared/harthmere/test/snapshot_grove_trigger_contract.test.ts'
  'src/shared/harthmere/test/snapshot_grove_live_mode_backend.test.ts'
  'src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.validation.test.ts'
  'src/client/game/renderers/local_dev/test/harthmere_quest_object_markers.test.ts'
  'src/client/components/biomes_ui/adapters/__tests__/mapAdapter.test.ts'
  'src/client/components/biomes_ui/__tests__/MapQuestsTab.activeOnly.test.ts'
)
# Bible catalog. Every module under src/shared/harthmere/bible/ is pure data or
# pure functions and imports nothing from the server, the client, the ECS gen
# layer or Bikkie item data at value position, so the whole surface runs under
# the fast config with no bootstrap. bible_engine_contracts.test.ts asserts
# that over the real import graph — if a value import leaks in, that test fails
# BEFORE the suite starts needing `full`.
BIBLE=(
  'src/shared/harthmere/test/bible_quest_schema.test.ts'
  'src/shared/harthmere/test/bible_quest_ids.test.ts'
  'src/shared/harthmere/test/bible_quest_gate.test.ts'
  'src/shared/harthmere/test/bible_native_quests.test.ts'
  'src/shared/harthmere/test/bible_waypoints.test.ts'
  'src/shared/harthmere/test/bible_live_slice.test.ts'
  'src/shared/harthmere/test/bible_engine_contracts.test.ts'
  'src/shared/harthmere/test/bible_e2e_playthrough.test.ts'
)
# Main-arc inner loop: id stability + projection + the Q12 arena agreement,
# without parsing the 72 side/starter/repeatable rows.
BIBLE_MAIN=(
  'src/shared/harthmere/test/bible_quest_ids.test.ts'
  'src/shared/harthmere/test/bible_native_quests.test.ts'
  'src/shared/harthmere/test/bible_waypoints.test.ts'
)
# Grove catalog. Same discipline as BIBLE: every module under
# src/shared/harthmere/grove/ is pure data or pure functions with no
# server/client/ECS-gen/Bikkie value imports, asserted by
# grove_engine_contracts.test.ts over the real import graph.
GROVE=(
  'src/shared/harthmere/test/grove_quest_catalog.test.ts'
  'src/shared/harthmere/test/grove_engine_contracts.test.ts'
  'src/shared/harthmere/test/grove_giver_reassignment.test.ts'
  'src/shared/harthmere/test/grove_gate_enforcement.test.ts'
  'src/shared/harthmere/test/grove_waypoints_production_wiring.test.ts'
  # Kept as its own file: it loads the ~53k-line generated placement map, and
  # sharing a file with the I/O-bound wiring scan pushed that scan past Mocha's
  # 5s ceiling.
  'src/shared/harthmere/test/grove_waypoint_grounding.test.ts'
)
# Fountain inner loop: ids, projection and the reassignment, without parsing
# the 38 story/economy/neighbour rows.
GROVE_FOUNTAIN=(
  'src/shared/harthmere/test/grove_quest_catalog.test.ts'
  'src/shared/harthmere/test/grove_giver_reassignment.test.ts'
)
# HARTHMERE_AUTHORED_WATER / REQUEST BOARDS.
#
# `water` is the regression tier for "the river keeps getting filled in with
# dirt": the authored-water predicate, the surface-repair exemptions, the
# river/still-water geometry, and the fishability contract. Run it after ANY
# change to the extension's terrain maintenance — the surface repair, the
# unsolid-surface scan, or the seed writer — because all three used to treat
# the Brell as damage.
WATER=(
  'src/shared/harthmere/test/harthmere_authored_water.test.ts'
  'src/shared/harthmere/test/harthmere_authored_water_plan.test.ts'
  'src/shared/harthmere/test/harthmere_river.test.ts'
  'src/shared/harthmere/test/harthmere_still_water.test.ts'
  'src/shared/harthmere/test/extension_surface_repair.test.ts'
)
# The four snapshot request boards: catalogue, per-board scoping, the physical
# registry seam, and the panel projection. `boards:e2e` adds the trigger-engine
# playthrough, which is the only tier that proves a request can actually be
# filled.
BOARDS=(
  'src/shared/harthmere/test/native_request_boards.test.ts'
  'src/shared/harthmere/test/native_request_board_locations.test.ts'
  'src/client/components/biomes_ui/adapters/__tests__/nativeRequestBoardAdapter.test.ts'
  'src/shared/harthmere/test/world_interaction_graphics.test.ts'
  'src/client/game/renderers/local_dev/test/harthmere_request_board_markers.test.ts'
  'src/client/components/biomes_ui/__tests__/biomesUIMountWorldObjectPanels.test.ts'
  'src/client/components/challenges/claimRewardsEntityMatching.test.ts'
  'src/server/logic/events/handlers/test/quest_step_validation.test.ts'
  'src/server/harthmere/test/request_board_ecs_seed.test.ts'
)
BOARDS_E2E=(
  'src/server/shared/triggers/test/native_request_board_progression.test.ts'
)
# THE MMO JOBS BOARD — a DIFFERENT system from `boards`.
#
# `boards` covers the four snapshot REQUEST boards (`native_request_boards.ts`).
# The jobs board is `mmo_jobs_board_authority.ts`: posting, accepting, field
# completion, escrow and rewards. Its 21 test files were in no preset at all and
# ran only under `full`, which is why a critical read-vs-accept bug shipped with
# a green suite. They cost ~7 s under the fast config.
#
# `jobs_board_auto_seed_determinism.test.ts` is the load-bearing one: the state
# GET seeds without persisting, so the draw must be a function of durable state
# or a job id stops denoting one job. Run this preset after ANY change to the
# auto-seed path.
JOBS=(
  'src/shared/harthmere/test/harthmere_job_objective.test.ts'
  'src/shared/harthmere/test/jobs_board_*.test.ts'
  'src/shared/harthmere/test/legacy_protection_escort_destinations.test.ts'
  'src/shared/harthmere/test/live_mode_jobs_board_proximity.test.ts'
  'src/shared/harthmere/test/mmo_jobs_board_*.test.ts'
  'src/client/components/harthmere_jobs_board/__tests__/*.test.ts'
  'src/client/components/challenges/HarthmereUnifiedHUD.jobsBoardContext.test.ts'
  'src/client/components/challenges/harthmereJobRewardBridge.test.ts'
  'src/client/components/challenges/harthmereLiveModeClientEvents.test.ts'
  'src/client/components/biomes_ui/adapters/__tests__/jobsBoardQuestMapAdapter.test.ts'
  'src/pages/api/harthmere/test/live_mode_jobs_board_state_api.test.ts'
)
# Post-Gimme quest arc (Hoedown -> Battery Not Included).
POSTGIMME=(
  'src/shared/harthmere/test/native_post_gimme_contract.test.ts'
  'src/shared/harthmere/test/native_post_gimme_world.test.ts'
  'src/server/shared/triggers/test/native_post_gimme_progression.test.ts'
)
UI=('src/client/components/biomes_ui/__tests__/QuestsTab*.ts*')
ICONS=(
  'src/client/components/challenges/harthmereNativeItemPresentation.test.ts'
  'src/client/components/biomes_ui/__tests__/InventoryTab.fullStack.test.tsx'
  'src/client/components/biomes_ui/__tests__/InventoryTab.dragDrop.test.tsx'
  'src/client/components/biomes_ui/__tests__/InventoryTab.actions.browser.test.tsx'
)
CLIENT_CONFIG=('src/client/game/client_config.test.ts')
CUTSCENE=('src/shared/cutscene/test/*.test.ts')
# Promo stills validate without a browser/stack/GPU; the capture needs all three.
PROMO=('src/shared/cutscene/test/promo_scenes.test.ts')
PERF=(
  'src/client/components/ThreeObjectPreview.test.ts'
  'src/client/game/glitch/harthmere_glitch_bridge_save_dedupe.test.ts'
  'src/client/game/renderers/static_object_matrices.test.ts'
  'src/server/glitch/test/harthmere_store_save_response.test.ts'
  'src/client/components/challenges/Chapter1NativeObjectivePrompt.test.ts'
  'src/client/components/challenges/Chapter1PollingPerformance.test.ts'
  'src/shared/cutscene/test/ch1_projection_puppets.test.ts'
  # 2026-08-03 captured-session frame-loop pass. The overlay script was the
  # single largest per-frame cost in production (unbounded terrainMarch calls +
  # unconditional React invalidation); the render-scale ladder never engaged
  # without a GPU timer. Both are source/behaviour contracts, not benchmarks,
  # so they belong in the fast lane.
  'src/client/game/scripts/overlaysFrameBudget.test.ts'
  'src/client/game/resources/dynamic_settings_updater.test.ts'
  'src/client/game/resources/graphics_settings.test.ts'
)

# 2026-08-03 captured-session combat pass. The production capture proved 21
# swing emotes and ZERO updateNpcHealthEvents in 374 s of play: melee acquisition
# and combat VFX were both broken in the shipped build while every existing suite
# stayed green. These are the contracts that would have caught it.
COMBAT=(
  'src/client/components/challenges/harthmere_combat_lock_on.test.ts'
  'src/client/game/renderers/local_dev/harthmere_combat_vfx_always_on.test.ts'
  'src/client/game/renderers/npc_stagger_effect.test.ts'
  'src/client/game/resources/melee_attack_region.test.ts'
  'src/client/game/renderers/local_dev/harthmere_projectiles.test.ts'
  'src/shared/harthmere/test/future_stagger_animation_assets.test.ts'
  'src/shared/harthmere/test/native_chase_live_browser_runner_contract.test.ts'
  'src/shared/harthmere/test/native_player_attack_live_browser_runner_contract.test.ts'
  'src/shared/harthmere/test/premium_projectile_wiring.test.ts'
  'src/shared/harthmere/test/anima_hill_combat_e2e.test.ts'
  'src/shared/npc/behavior/test/chase_attack_logic.test.ts'
  'src/shared/npc/behavior/test/npc_locomotion_selection.test.ts'
  'src/shared/npc/test/simulated_combat_state.test.ts'
  'src/shared/npc/test/stagger.test.ts'
  'src/shared/npc/test/threat_targeting.test.ts'
)
# Deliberately NOT in COMBAT:
#   src/client/game/interact/item_types/attack_destroy_delegate_item_spec.test.ts
# It needs the Bikkie bootstrap `.mocharc.fast.json` drops (it builds real items
# and resolves destruction hardness). Under the fast preset it reports 12 passing
# / 5 failing; under the default bootstrap it passes 17/17. Run it with:
#   node_modules/.bin/mocha --config .mocharc.json src/client/game/interact/item_types/attack_destroy_delegate_item_spec.test.ts

run_scoped_types() {
  NODE_OPTIONS="--max-old-space-size=8192" \
    node_modules/.bin/tsc -p tsconfig.ch1check.json
  echo "scoped typecheck OK"
}

cmd="${1:-ch1}"
shift || true

case "$cmd" in
  ch1)
    "${FAST[@]}" "${CH1[@]}"
    node scripts/harthmere/test-harthmere-deploy-chapter1-seed-gate.cjs
    ;;
  quests)   "${FAST[@]}" "${QUESTS[@]}" ;;
  bible)    "${FAST[@]}" "${BIBLE[@]}" ;;
  grove)    "${FAST[@]}" "${GROVE[@]}" ;;
  grove:fountain) "${FAST[@]}" "${GROVE_FOUNTAIN[@]}" ;;
  grove:catalog)
    "${FAST[@]}" src/shared/harthmere/test/grove_engine_contracts.test.ts
    ;;
  grove:e2e)
    # Retired name. It meant the live authority rows, then briefly meant the
    # pure-data walk — so it now means neither, on purpose.
    echo "grove:e2e is retired because it named two different tiers." >&2
    echo "  grove:catalog  pure-data walk (topology, ids, gates, waypoints)" >&2
    echo "  grove:live     live authority rows" >&2
    echo "  browser run    the actual player flow — neither of the above" >&2
    exit 2
    ;;
  bible:main) "${FAST[@]}" "${BIBLE_MAIN[@]}" ;;
  bible:e2e)
    "${FAST[@]}" src/shared/harthmere/test/bible_e2e_playthrough.test.ts
    ;;
  grove:live)
    # The live-authority rows. `grove:catalog` answers the topology questions
    # in milliseconds, but it does NOT replace this tier or the browser run:
    # neither of those proves items appear, controls work, dialogue completes,
    # recipes count, rewards materialize, or the map renders.
    HARTHMERE_GROVE_CATALOG_E2E=1 "${FAST[@]}" \
      src/shared/harthmere/test/snapshot_grove_live_mode_backend.test.ts
    ;;
  ui)       "${FAST[@]}" "${UI[@]}" ;;
  water)    "${FAST[@]}" "${WATER[@]}" ;;
  boards)
    node scripts/harthmere/test-world-interaction-graphics.cjs
    "${FAST[@]}" "${BOARDS[@]}"
    ;;
  jobs)     "${FAST[@]}" "${JOBS[@]}" ;;
  boards:e2e)
    node scripts/harthmere/test-world-interaction-graphics.cjs
    "${FAST[@]}" "${BOARDS[@]}" "${BOARDS_E2E[@]}"
    ;;
  postgimme) "${FAST[@]}" "${POSTGIMME[@]}" ;;
  icons)
    # Inventory icons cross three identity spellings: semantic ids, native
    # numeric Bikkie ids, and `b:<id>`. Keep the executable asset validator,
    # live presentation tests, and image/glyph DOM rendering in one serial
    # lane so a green semantic-only unit test cannot hide a live ECS alias bug.
    node scripts/harthmere/blender/generate_inventory_icon_manifest.cjs
    node scripts/harthmere/validate-inventory-icons.cjs
    "${FAST[@]}" "${ICONS[@]}"
    node scripts/harthmere/test-biomes-ui-inventory-icon-shim-startup.cjs
    run_scoped_types
    ;;
  gate)
    # One Mocha process means one ts-node startup for the whole changed
    # quest/container/UI surface. Keep the static browser contract and scoped
    # typecheck in the same handoff command so failures are collected together
    # and fixed as a batch instead of triggering one-test-at-a-time reruns.
    "${FAST[@]}" "${QUESTS[@]}" "${BIBLE[@]}" "${GROVE[@]}" "${UI[@]}" "${CLIENT_CONFIG[@]}"
    node scripts/harthmere/test-harthmere-native-robot-story-e2e-contract.cjs
    run_scoped_types
    ;;
  cutscene) "${FAST[@]}" "${CUTSCENE[@]}" ;;
  promo)    "${FAST[@]}" "${PROMO[@]}" ;;
  combat)   "${FAST[@]}" "${COMBAT[@]}" ;;
  perf)
    "${FAST[@]}" "${PERF[@]}"
    node scripts/harthmere/check-harthmere-performance-response.cjs
    node scripts/harthmere/test-harthmere-glitch-cloud-save-all-state.cjs
    node scripts/harthmere/test-glitch-aegis-telemetry-mucker-clearance.cjs
    ;;
  visuals)
    "${FAST[@]}" \
      src/shared/harthmere/test/ch1_dungeon_terrain.test.ts \
      src/shared/harthmere/test/ch1_e2e_dungeon_traversal.test.ts \
      src/shared/cutscene/test/promo_scenes.test.ts
    NODE_OPTIONS="--max-old-space-size=8192" \
      node_modules/.bin/tsc -p tsconfig.ch1visuals.json
    echo "Chapter 1 visuals batch OK"
    ;;
  file)     "${FAST[@]}" "$@" ;;
  watch)
    target="${1:-ch1}"
    case "$target" in
      ch1)      set -- "${CH1[@]}" ;;
      quests)   set -- "${QUESTS[@]}" ;;
      bible)    set -- "${BIBLE[@]}" ;;
      grove)    set -- "${GROVE[@]}" ;;
      grove:fountain) set -- "${GROVE_FOUNTAIN[@]}" ;;
      bible:main) set -- "${BIBLE_MAIN[@]}" ;;
      ui)       set -- "${UI[@]}" ;;
      icons)    set -- "${ICONS[@]}" ;;
      cutscene) set -- "${CUTSCENE[@]}" ;;
      *)        ;;
    esac
    "${FAST[@]}" --watch --watch-files 'src/**/*.ts' 'src/**/*.tsx' "$@"
    ;;
  types)
    run_scoped_types
    ;;
  types:grove)
    NODE_OPTIONS="--max-old-space-size=8192" \
      node_modules/.bin/tsc -p tsconfig.grovecheck.json
    echo "grove typecheck OK"
    ;;
  types:bible)
    # ~13-15 s. Slower than `types` because tsc structurally checks 14k lines
    # of generated quest literals against BibleQuestDef — which is the point:
    # that check is what catches a malformed row at conversion time. Not part
    # of `gate`; run it after editing catalog data or the schema.
    NODE_OPTIONS="--max-old-space-size=8192" \
      node_modules/.bin/tsc -p tsconfig.biblecheck.json
    echo "bible typecheck OK"
    ;;
  types:client)
    NODE_OPTIONS="--max-old-space-size=8192" \
      node_modules/.bin/tsc -p tsconfig.ch1renderer.json
    echo "client typecheck OK"
    ;;
  types:stack)
    NODE_OPTIONS="--max-old-space-size=8192" \
      node_modules/.bin/tsc -p tsconfig.teststack.json
    echo "focused test-stack typecheck OK"
    ;;
  full)
    TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' MOCHA_TEST=1 \
      node_modules/.bin/mocha "src/**{/test/*.ts,/*.test.ts}" \
      --ignore '**/node_modules/**/*' \
      --ignore 'src/cayley/**' \
      --ignore 'src/benchmarks/**' "$@"
    ;;
  *)
    echo "unknown preset: $cmd" >&2
    sed -n '2,20p' "$0" >&2
    exit 2
    ;;
esac
