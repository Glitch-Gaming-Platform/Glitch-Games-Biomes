# Remaining quest and Jobs Board browser coverage

This document is the catalog checklist for production-shaped browser testing.
It exists so a future pass enumerates the whole authored catalog first, runs
independent rows in batches, and does not stop after the first failure.

## July 26, 2026 wrap: Grove paused; Bible catalog started

The user explicitly moved browser execution off Snapshot Grove before its
remaining retries were closed. Preserve all Grove reports from
`1785094439045-14879-report.json` through
`1785105634711-14351-report.json`; do not replay their completed rows. The
current report campaign contains 22 unambiguous full quest completions,
including the successful retries for `songline_under_the_lawn` and
`cove_keeps_pictures`. These ten IDs still need a failure-only Grove rerun if
that catalog is resumed:

- `letter_for_the_north_gate`
- `antlers_for_the_watch`
- `tone_beneath_the_road`
- `fountain_trade_table_promises`
- `grove_road_graduation`
- `econ_billys_map_pin_run`
- `econ_gus_fresh_loaves_to_fountain`
- `econ_fern_water_the_sprout_beds`
- `econ_kit_heavy_parcel_to_crossroads`
- `econ_mel_broken_hinge_hunt`

The Fresh Loaves placeable-item contract and Grove graduation prerequisite
fixture are patched and contract-tested, but remain on that browser retry list.

The 76-row Bible catalog then started on the existing warm stack, with no
rebuild. No Bible row is yet a retained pass. The interrupted reports are:

- `1785106199829-19870-report.json`: `bellbound_q01_cracks_in_bridge` exposed
  the shared placeholder-Y movement defect.
- `1785106826493-26381-report.json`: movement advanced past that defect;
  `bellbound_q01_cracks_in_bridge` then hit a transient live-state read timeout,
  and `bellbound_q02_whispers_at_well` exposed a dialogue-action mismatch.
  `bellbound_q02_5_rat_girl_knows` closed only because the run was interrupted
  and is not a product failure.

The host-side browser runner now treats authored marker `Y=0` as unresolved,
lets the production teleport hook choose its grounded height, and publishes
that exact accepted pose to ECS. It also retries the read-only Bible snapshot
refresh on `harthmere_live_fetch_timeout`. Both runner changes pass syntax and
diff checks but were not browser-reverified before this wrap. Resume with one
group containing the first eight Bible IDs; after it passes, continue the other
nine groups and rerun only genuine failures.

## July 25, 2026 final wrap: client catalog closed, Grove/Bible remain

Do not repeat the 11 client compatibility quests. Every ID now has retained
browser completion evidence across these reports:

- `1785015764300-50628-report.json`
- `1785016423103-65714-report.json`
- `1785017667020-95863-report.json`
- `1785017846125-98059-report.json`
- `1785018214622-21402-report.json`
- `1785018393704-26889-report.json`

The final three-row report is globally green. Two earlier reports contain
passing quest scenarios plus explicitly classified text-to-speech abort or
fixture-cleanup transients; retain the scenario passes instead of replaying
their quest IDs.

The all-48 Grove batch was stopped on request under run prefix
`1785019146297-47707`. It produced accepted/failure screenshots through
`cove_keeps_pictures`, but no report existed because the process was interrupted
before its final write. Those images are diagnostic evidence, not passes.

Two shared harness defects found during that batch are now fixed without a
rebuild:

- Grove actor resets use the live-mode persistence serializer, preserving
  Maps, Sets, and the complete authority schema between rows.
- The report is checkpointed after every Grove row, including failures, so a
  stopped batch retains completed IDs and can rerun failures only.

The remaining production-browser work is still 48 Grove rows and 76 Bible
rows. Keep the warm stack, run each catalog as a non-fail-fast batch, and use
the checkpoint report to filter subsequent invocations to failures only. Do
not replay the client catalog, Chapter 1, robot story, locked onboarding
lessons, Quests UI, or retained Jobs Board passes.

## July 24, 2026 handoff: stopped before full catalog completion

The local full-catalog campaign was intentionally stopped because the retained
Linux/AMD64 production snapshot takes tens of seconds per live-mode mutation
and several hours for the remaining catalog. Do not describe the remaining
catalog as browser-tested until new reports are written.

### July 25 focused closure (do not replay)

- The HAR proves Road Ahead's Clothing Crate and Billy's Toolbag requests
  succeeded. Its Busted failure occurred before any underwater-container API
  request, which isolated the problem to world prompt discovery rather than a
  clothing-container mismatch.
- `1784962944155-29904-report.json` records a passing real F prompt, real
  container UI, real Take All transaction, and every authored Busted action
  through completion. The outer report failed only on three local profile
  image 404s; the runner now preserves those URL-bearing diagnostics as
  transients and keeps every other same-origin HTTP 4xx/5xx fatal.
- `1784963562747-35318-report.json` is green for the dedicated Quests UI in one
  combined browser session: All/Active/Available/Failed/Completed filters,
  Failed count/list agreement, detail selection, responsive stacking, and Show
  on Map.
- Chapter 1 is a separate native challenge family from the Grove/Bible/Jobs
  Board catalogs below. All 31 Chapter 1 quests and all 80 objectives pass via
  retained checkpoints ending in
  `1784986267883-76489-report.json` (30 objectives in the final run, 50 retained,
  zero browser failures). Do not include Chapter 1 in the remaining counts or
  replay it while working through the unrelated catalogs.

These are locked passes. Resume the still-uncovered catalogs below in batches;
do not rerun Road Ahead, Busted, Get the Muck Out, Muck vs. Machine, or the
Quests UI merely to refresh timestamps.

### Retained browser evidence

- Native robot story is fully green: `1784841463814-34632-report.json` has 72
  passing scenarios covering every authored action and item contract in The
  Road Ahead continuation, Busted, Get the Muck Out, and Muck vs. Machine.
- All 20 auto-seeded Jobs Board templates have per-template browser passes in
  `1784829975215-4998-report.json` and
  `1784831792676-61154-report.json`. The reports themselves finish red because
  of unrelated disconnect/post-catalog assertions, so use them as row-level
  evidence rather than claiming a globally green run.
- Six of the 19 business Jobs Board templates have retained browser passes:
  `refinery_raw_exotic_supply`, `biome_repair_anchor_patch`,
  `design_studio_decor_materials`, `security_clear_safe_route`,
  `portal_transit_fuel_delivery`, and `farm_crop_harvest`. Their evidence is
  spread across `1784921757213-15366-report.json`,
  `1784922330638-21208-report.json`, `1784923255236-37230-report.json`,
  `1784923498998-42940-report.json`, and
  `1784926828694-3734-report.json`.

### Still requiring browser execution

- 13 business templates:
  `weapons_tools_iron_supply`, `magic_goods_relic_components`,
  `exploration_route_survey`, `property_building_materials`,
  `general_trader_stock_rations`, `hunter_wild_meat_supply`,
  `medical_herb_run`, `teleport_pad_crystal_delivery`,
  `sanitation_cleanup_waste`, `repair_person_fixture_fix`,
  `restaurant_food_supply`, `courier_medicine_delivery`, and
  `hospitality_room_reset`.
- 48 Snapshot Grove lessons not listed as recent skips below.
- 76 non-starter Bible quests.
- One browser round trip for each live helper family (`food_water`,
  `exotic_matter`, and `hard_boss`), the Wilds Combat Primer, and the shared
  quest-invite accept/deny lifecycle.

### Changes made but not production-browser reverified

- Native Grove/Bible acceptance and objective materialization now write the
  reducer-approved `Challenges` and `TriggerState` transition atomically. The
  previous two-event path could race the logic replica: Cloud Save advanced,
  while native ECS stayed empty and the frontend could never finish the row.
  Focused materializer tests pass, but this change still needs the one rebuilt
  production image and affected catalog reruns below.
- Missing native identities were added for all executable business-template
  items, including `crop_bundle`, `herb_bundle`, `wild_meat`, and the other
  non-snapshot business materials.
- Jobs Board browser mutations now retry only with the same request ID, relying
  on the server idempotency ledger when an already-committed production request
  outlives the browser fetch timeout.
- Field objective proximity now compares horizontal X/Z distance. Production
  terrain scans can recommend a marker Y more than ten meters above the actual
  grounded player, which previously made reachable jobs impossible to finish.
  The authority regression passes, but the final production image rebuild and
  browser retest were stopped before completion.

The final packaged Chapter 1 image is
`biomes-node:local-chapter1-live-20260725-r11`. The warm validation stack uses
the same built `.next` and `dist` outputs through read-only bind mounts. The
remaining Grove/Bible/client/business catalog rows are still not
browser-verified by that fact alone. Preserve the stack and resume only those
uncovered rows instead of rebuilding between catalogs.

### July 24 diagnostic browser batches (failure collection, not pass evidence)

- Client compatibility catalog: all 11 rows attempted in
  `1784930904673-47024-report.json`. Shared failures were missing exact legacy
  NPC entities and native completion not materializing from the Jobs Board
  shortcut.
- Representative Bible categories: five rows attempted in
  `1784931559108-49905-report.json`. Most movement failures were harness
  equality drift (fixed to an interaction tolerance); the remaining shared
  issue was missing native giver content in the retained `r10` world.
- Representative Snapshot Grove trigger families: ten rows attempted in
  `1784931725431-51067-report.json`. The local lesson runtime advanced, but
  native `Challenges`/`TriggerState` stayed empty. This is the evidence behind
  the atomic materialization fix above.

These reports deliberately used short diagnostic gates to collect a failure
batch. Do not count their rows as browser passes.

## Faster future execution plan

Use three tiers instead of running every catalog row against an emulated full
production snapshot on a developer laptop.

1. **Catalog contract tier (minutes):** run all quest definitions through
   server reducer, native-item, trigger, reward, marker, and frontend-adapter
   tests in one process. This should enumerate every row and report every
   failure without starting Chromium.
2. **Browser catalog tier (tens of minutes):** run Chromium against a minimal
   quest fixture world containing only the player, required givers, markers,
   containers, Bikkie overlay, and live-mode services. Reuse one warm browser
   and actor per authority family, resetting only that family's state through a
   deterministic control endpoint. Disable unrelated Bible/vitals/status polls
   in the isolated E2E session so they cannot contend with the mutation under
   test.
3. **Production-shape tier (one smoke per authority family):** after the fast
   catalog is green, run one representative Grove, Bible, client, Jobs Board,
   helper, invite, and combat path against the full production image/snapshot.
   The native robot story already has its own exhaustive production report.

Additional speed requirements for the next implementation pass:

- Build once after collecting/fixing the whole failure batch. Do not rebuild
  after the first failed row.
- Add a `--package-existing-artifacts` deploy mode so an interrupted Docker
  packaging step cannot force another Next/webpack compilation.
- Automatically checkpoint each passing catalog ID with the Git tree hash and
  authority-version hash. Resume from that manifest rather than maintaining a
  manual skip list.
- Keep rows non-fail-fast, but reset the owning subsystem after each failure so
  one active job/quest cannot contaminate the next row.
- Shard Grove, Bible, and business catalogs across CI machines. Keep local
  execution serial for memory safety; do not run multiple local Chromium games
  against the full snapshot.
- Use a native ARM64 local image for catalog debugging on Apple Silicon. Reserve
  Linux/AMD64 emulation for the final production-shape smoke.
- Record mutation, native ECS, frontend projection, and reward timings per row
  so performance failures are separate from correctness failures.
- Preserve one warm production stack between catalogs. Snapshot import and sync
  bootstrap should happen once, not once per runner invocation.
- For focused source tests, use the build wrapper's pattern option, for example
  `./b test -b -p 'src/server/harthmere/test/native_hidden_quest_materialization.test.ts'`.
  Passing test files positionally with raw Mocha parallel flags can select the
  repository-wide suite and waste several minutes before it is noticed.

### Resume command for business templates

After rebuilding the image and starting the warm stack, resume without the six
retained passes:

```bash
HARTHMERE_E2E_SKIP_JOB_TEMPLATE_IDS=refinery_raw_exotic_supply,biome_repair_anchor_patch,design_studio_decor_materials,security_clear_safe_route,portal_transit_fuel_delivery,farm_crop_harvest \
HARTHMERE_E2E_REMAINING_JOBS_ONLY=1 \
node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

Use the common Redis, web, sync, token, timeout, and memory environment from
the Batch execution section below.

## Authority groups

Do not treat every quest-shaped surface as if it has the same persistence
owner. The browser proof must match the system that owns that row:

- **Native robot story:** native `Challenges` and `TriggerState`, live-mode
  materialization, containers/inventory, and the rendered quest projection.
- **Snapshot Grove lessons:** native `Challenges` and `TriggerState`, the
  lesson runtime, live-mode Cloud Save, and the rendered quest projection.
- **Bible catalog:** server live-mode Bible runtime, native challenge/step
  materialization, persisted rewards, and the rendered quest projection.
- **Jobs Board:** shared live-mode posting/todo state, server-read native
  player position and inventory, native reward currency, and the rendered
  todo/quest/map projection.
- **Client starter twins:** string-keyed compatibility quests intentionally do
  not fabricate numeric native challenge IDs when native authority is enabled.
  Test their rendered dialogue, item flow, local mission state, and the
  starter-to-Bible prerequisite translation as a distinct compatibility gate.
- **Dynamic helper/invite quests:** test one complete browser round trip for
  every authored action family; do not invent a finite catalog count for
  player-created invitations.

## Catalog inventory and skip evidence

The runner derives counts from the same modules used by the product rather
than maintaining a second handwritten list.

| Catalog                          | Total | Recently browser-tested and skipped                                       | Remaining batch |
| -------------------------------- | ----: | ------------------------------------------------------------------------- | --------------: |
| Snapshot Grove lessons           |    51 | `fountain_buttons_first`, `tools_before_treasure`, `road_ready_bag_check` |              48 |
| Bible quests                     |    85 | 9 starter rows are owned by the client-twin surface                       |              76 |
| Auto-seeded Jobs Board templates |    20 | all 20                                                                    |               0 |
| Business Jobs Board templates    |    19 | none                                                                      |              19 |
| Native robot-story chapters      |     4 | Road Ahead → Busted → Get the Muck Out → Muck vs. Machine                 |               0 |
| Client compatibility quests      |    11 | all 11                                                                    |               0 |

Recent skip evidence is retained under
`artifacts/harthmere-native-ecs-e2e/`; do not rerun those catalogs merely to
obtain a newer timestamp when neither product code nor their authority path
changed.

## Batch execution

Run one catalog at a time so Chromium and the production image stay within the
local memory limit. The Grove runner covers all 51 authored quests in one
serial batch, reusing one warm browser actor while resetting its native ECS,
Cloud Save, inventory, RecipeBook, and local lesson state between rows. Bible
and Jobs Board runners use the same deterministic reset principle where their
authority allows it. Every catalog records all independently fixtureable
failures before returning a failed status.

```bash
COMMON_ENV=(
  GLITCH_REDIS_HOST=127.0.0.1
  LOCAL_REDIS_HOST=127.0.0.1
  GLITCH_REDIS_PORT=6389
  LOCAL_REDIS_PORT=6389
  HARTHMERE_E2E_BASE_URL=http://127.0.0.1:3017
  HARTHMERE_E2E_SYNC_BASE_URL=http://127.0.0.1:4907
  HARTHMERE_E2E_TIMEOUT_MS=180000
  # The full Redis snapshot under AMD64 emulation has been observed at 30-35s
  # for initial fixture synchronization. These are correctness catalogs; exact
  # timings remain in the report for a separate performance gate.
  HARTHMERE_E2E_ACCEPTANCE_GATE_MS=60000
  HARTHMERE_E2E_ORIGIN_SYNC_GATE_MS=60000
  HARTHMERE_E2E_SECOND_SYNC_GATE_MS=60000
  NODE_OPTIONS=--max-old-space-size=3072
)

env "${COMMON_ENV[@]}" HARTHMERE_E2E_REMAINING_JOBS_ONLY=1 \
  HARTHMERE_E2E_CONTROL_TOKEN="$HARTHMERE_E2E_CONTROL_TOKEN" \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs

env "${COMMON_ENV[@]}" HARTHMERE_E2E_REMAINING_QUESTS_ONLY=1 \
  HARTHMERE_E2E_CONTROL_TOKEN="$HARTHMERE_E2E_CONTROL_TOKEN" \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs

# Despite the retained environment-variable name, this is the complete
# Snapshot Grove catalog gate (51 quests), not only the old uncovered subset.
# Narrow repair runs may set HARTHMERE_E2E_GROVE_QUEST_IDS to a comma-separated
# list, but release evidence must omit that filter.

env "${COMMON_ENV[@]}" HARTHMERE_E2E_REMAINING_BIBLE_ONLY=1 \
  HARTHMERE_E2E_CONTROL_TOKEN="$HARTHMERE_E2E_CONTROL_TOKEN" \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs

env "${COMMON_ENV[@]}" HARTHMERE_E2E_REMAINING_CLIENT_QUESTS_ONLY=1 \
  HARTHMERE_E2E_CONTROL_TOKEN="$HARTHMERE_E2E_CONTROL_TOKEN" \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

If a failed non-fail-fast investigation already produced passing per-template
evidence, resume the business batch without repeating those rows:

```bash
HARTHMERE_E2E_SKIP_JOB_TEMPLATE_IDS=template_a,template_b
```

Keep both report paths as the combined evidence; never mark a skipped template
as passed without a retained browser report from the same code revision.

Bible repair runs use the same retained-evidence rule:

```bash
HARTHMERE_E2E_SKIP_BIBLE_QUEST_IDS=quest_a,quest_b
```

Only skip IDs with complete browser reports covering acceptance, every
objective, native ECS/frontend convergence, turn-in, and rewards.

The Bible batch uses a deterministic local-only clock/weather fixture so night,
dusk, and storm-gated rows can run together without waiting in real time:

```bash
HARTHMERE_E2E_BIBLE_NOW_MS=1784934000000
HARTHMERE_E2E_BIBLE_WEATHER=storm
```

Those values must be supplied while building/running the local production
container; normal production evaluation continues to use server time and
weather.

## Production-shaped harness pitfalls

- The retained Docker stack does not publish Redis. Use a local-only TCP relay
  and point the host runner at that relay; never change production Redis
  exposure for a browser test.
- Focused catalog runs intentionally use a small draw distance. Their browser
  context marks the one-shot partial-terrain recovery as already attempted so
  the product's delayed recovery reload cannot destroy an in-flight quest
  action. This changes only the isolated browser session.
- Distant job/quest marker teleports can also arm the normal missing-terrain-
  shard recovery. Keep that recovery guard recent inside the focused browser
  context; the fixture is proving server proximity and does not need to render
  every terrain shard between the old and new positions.
- Wait for `.loading-wrapper` to disappear before clicking **Enter Game**.
- Admin position fixtures must zero native velocity and synchronize
  `/sim/player`; otherwise the player controller can immediately overwrite the
  server-confirmed pickup/drop-off position.
- Retry transport failures only for idempotent ECS `update` fixtures. Never
  blindly replay `create` or `delete` after an unknown response.
- A production-shaped snapshot on emulated hardware can need 30-35 seconds to
  return the initial ECS fixture to the browser. Use the explicit 60-second
  correctness gates above while retaining the 180-second hard timeout; evaluate
  latency from the report in a separate performance run.

## Per-row completion evidence

A row passes only after its rendered action reaches its owning server/native
state and returns to the rendered frontend. Completion must also remove the
active quest/todo from its user-facing list and grant every authored item,
currency, XP, or unlock exactly once.

Store the JSON report and failure/complete screenshots in
`artifacts/harthmere-native-ecs-e2e/`. The report mode names are:

- `remaining-business-jobs-only`
- `remaining-grove-quests-only`
- `remaining-bible-quests-only`
- `remaining-client-quests-only`
