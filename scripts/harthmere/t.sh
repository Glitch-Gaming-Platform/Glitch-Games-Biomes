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
#   scripts/harthmere/t.sh gate           # quest + UI + types in one batch
#   scripts/harthmere/t.sh cutscene       # cutscene generator   (~2 s)
#   scripts/harthmere/t.sh promo          # promo still registry (~1 s)
#   scripts/harthmere/t.sh visuals        # terrain + promo tests/types (~3 s warm)
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

FAST=(node_modules/.bin/mocha --config .mocharc.fast.json)

CH1=(
  'src/shared/harthmere/test/ch1_*.test.ts'
  'src/shared/cutscene/test/ch1_scenes.test.ts'
  'src/server/harthmere/test/ch1_fragment_authority.test.ts'
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
)
# Fountain inner loop: ids, projection and the reassignment, without parsing
# the 38 story/economy/neighbour rows.
GROVE_FOUNTAIN=(
  'src/shared/harthmere/test/grove_quest_catalog.test.ts'
  'src/shared/harthmere/test/grove_giver_reassignment.test.ts'
)
UI=('src/client/components/biomes_ui/__tests__/QuestsTab*.ts*')
CLIENT_CONFIG=('src/client/game/client_config.test.ts')
CUTSCENE=('src/shared/cutscene/test/*.test.ts')
# Promo stills validate without a browser/stack/GPU; the capture needs all three.
PROMO=('src/shared/cutscene/test/promo_scenes.test.ts')

run_scoped_types() {
  NODE_OPTIONS="--max-old-space-size=8192" \
    node_modules/.bin/tsc -p tsconfig.ch1check.json
  echo "scoped typecheck OK"
}

cmd="${1:-ch1}"
shift || true

case "$cmd" in
  ch1)      "${FAST[@]}" "${CH1[@]}" ;;
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
