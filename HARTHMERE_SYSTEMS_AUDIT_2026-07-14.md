# Harthmere Systems Audit — 2026-07-14

**Scope:** (1) all quests/jobs/side quests/missions, (2) house & business system end-to-end + 19 business interiors, (3) farming system, (4) Harthmere town (flatness, connector, dragon quest start).
**Method:** static review at working tree (HEAD `e117f54b` + uncommitted 2026-07-13 audit fixes, verified present), ~490 unit tests and ~25 validation scripts executed in the sandbox.

---

## 1. Quests / Jobs / Missions

### Verified working
- **Catalog integrity (85 quests):** 13 main (Q1–Q12 + Q2.5), 42 side, 3 hidden, 9 starter, 21 repeatable. All bible-grounded checks pass: every giver resolves to a real NPC, every prerequisite resolves, no cycles, main-chain hour ordering correct, all dialogue states authored (no placeholders), every quest has objectives + reward previews. All 21 quest-giver NPCs exist in `npc_compendium.ts` **and** in the world renderer.
- **Runtime state machine:** accept (idempotent, never wipes progress), objective ordering, server-only authority, distance/LoS validation, single reward grant, repeatable re-grant per cycle, fail/abandon/retry, party complete/fail — all green (`quest_runtime` scripts + 78 mocha tests).
- **Jobs board:** 63+ tests green. Auto-seeded jobs use **obtainable items only** (`jobs_board_auto_seed_obtainable.test.ts`), muck bounty targets are seed-backed from the live muck-monster pool (monsters exist), escort/delivery/pickup flows tested, both boards (Grove + Harthmere town) present with proximity gates.
- **Playable quest surfaces:** 9 starter quests + "Read the Jobs Board" + Mira intro wired in the client; 36 Grove authored quests with aligned objectives/triggers/markers; Road Ahead tutorial — the muck-buster soft-lock fix (3-source inventory check incl. live-server snapshot) is confirmed in `LocalDevSnapshotMissionBridge.tsx:678–702`. Mission-critical suite v112 passes.
- **Main-quest spaces:** 18/18 dungeons implemented incl. `wyrms_bed_thaedryn_arena` (interactables, accessibility, collision plans). Thaedryn boss contract validates (wake→slay, solo + group tuning).

### Findings
| # | Severity | Finding |
|---|---|---|
| Q-1 | **P0** | **The 85-quest bible catalog is not reachable in the shipped game.** `quest_compendium.ts`/`quest_runtime.ts` are imported only by the chain validator and the local-dev debug bridge (`LocalDevHarthmereQuestRuntime.tsx`). 0 of the 55 main/side quest titles appear in any playable quest definition; no HUD, NPC dialog, or `live_mode` path accepts/advances them (the 9 starters are separately mirrored client-side and DO work). Consequence: players cannot start Q1 "Cracks in the Bridge" and can never reach the Q12 Thaedryn (dragon) finale. |
| Q-2 | **P0** | **Thaedryn boss logic is not wired to runtime.** `thaedryn_boss.ts` is referenced only by test scripts. The dragon exists as an NPC record and its arena exists, but nothing spawns it or drives its encounter; `live_mode_backend` only has generic `request_boss_tick` accounting. |
| Q-3 | P1 | **Placement map stale** (`generatedAtIso: 2026-06-07`, 5+ weeks old) with the same 6 `fallback_authored_y` exotic-matter deposit records — quest-find items can bury/float. Known open item; needs the in-VNet regen (commands in the 7/13 audit). |
| Q-4 | P2 | Test hygiene: `test-jobs-board-starter-quest.cjs` reports 2 false FAILs (format-sensitive string match; the constants exist at `LocalDevHarthmereQuests.tsx:75–76`). `audit-harthmere-bible-implementation.cjs` reports "Quests: 0 records / all missing" because its `jsonConst` uses raw `JSON.parse` on the escaped template literal — the same parser bug fixed in `check-harthmere-quest-bible-grounded.cjs` on 7/13. Both scripts lie in opposite directions; worth fixing so signal isn't lost. |

**Bottom line:** everything that is wired is startable and completable with obtainable items and existing monsters. The main story arc + 42 side quests are authored, validated, spatially placed — and unreachable. Wiring the compendium/runtime into NPC dialogue + live_mode acceptance is the single biggest content unlock in the game.

---

## 2. House & Business System

### End-to-end lifecycle (buy → build → access → decorate) — verified in `live_mode_backend.ts`
- **Buy land:** `claim_plot` — validates price vs. actor gold (`validateHarthmerePlotClaim`), debits gold, records ownership, handles mucked plots (safe-zone + materialization plan), civil/legal blockers, and is **idempotent on retry** (lost responses can't block progression).
- **Build:** `terraform_plot` → `place` → `start_construction` → `contribute_stage` (materials), blueprint preview; construction materials are craftable/obtainable (`building_material_sources.test.ts` green).
- **Access:** `open_door`, `set_access_mode`, `set_permission`, `add_guest`/`remove_guest`, `use_storage` (+ `set_storage_item_count`).
- **Own/operate:** assess/manage, `pay_property_tax`, `repair_property`, `upgrade_property`, `demolish_property`, `abandon_property`, `list_property_for_sale`/`transfer_property`, `start_business` + revenue cycles.
- **Decorate:** `request_home_decoration` backend green; placeable decor catalogue tests green; Home Console UI (`harthmere_home/`, 8 tests) and `LandTab` (all sub-actions mapped) mounted in the unified HUD.
- 110 building/decoration tests + 27 building-system tests: **all green**.

### 19 business interiors
- All 19 business types have `interiorFixtureLabels` (4 functional surfaces each) + thematic "character" props in `HARTHMERE_BUSINESS_THEMATIC_INTERIOR_FIXTURES` (19/19 types covered), with the door→queue→counter→exit passability validator enforced.
- Production-readiness audit script: **all 19 outposts OK** — pad Y matches terrain span at all 6 sample points, server-owned voxel buildings (9.6k–11.9k voxel edits each), safe zones + dashboard markers present on every outpost, auto-rebuild on revision mismatch (no admin call needed).
- Renderer prefab gating tests green (10); customer simulator 26 green; **exhaustive mini-game coverage passes: every ask template for every one of the 19 businesses can be served successfully** (25s test, green). Employee AI, daily check-in, owner/customer NPC seeds, cosmetics, crafting-station seeds: 51 tests green.
- Owner vs. customer UI mode resolves from the property-purchase system (`getHarthmereBusinessActorMode`); `HarthmereBusinessLiveContainer` mounted in HUD.

### Findings
| # | Severity | Finding |
|---|---|---|
| B-1 | P2 | `mmo_economy_business_customer_session.test.ts` has one previously-known failing assertion (`business_permission_required`, ~line 537) noted in an earlier session as pre-existing; sandbox time caps prevented reaching it today — every test in the file that did run passes. Worth one targeted run to confirm/fix. |
| B-2 | P2 | Interior fixtures are metadata-rendered (not voxels) with a fixed allowed-prefab set — fine, but any new thematic label must avoid duplicating that type's 4 functional labels or the fixture-ID test fails (documented footgun). |

**Bottom line:** the housing/business chain from land purchase to decorated, permissioned, revenue-generating property is fully implemented and test-covered. No blocking gaps found.

---

## 3. Farming System

### Verified working
- **Full op set, server-authoritative** (`request_farming_action`): `gather_seed`, `plant` (sunlight flag), `water`, `harvest`, `forage_food`, `hunt_animal` (protected species/livestock ownership checks), `cook_food` (station-gated recipes + spoilage ticks), `eat_food`, `feed_livestock`, `collect_livestock_product`, `native_plant_harvest` (fully-grown gate, per-plant claim dedupe, carry-weight, farming XP), plus exotic-matter deposit mining with dual-coordinate proximity (shifted-cave fix present).
- **Tests:** 46 shared farming/food tests + 6 native ECS harvest handler tests + 3 plant-inspection overlay tests — all green. Farming tools are **both craftable (recipes exist) and vendor-purchasable** (Orchard Produce Stand), incl. hoe and watering can (`harthmere_farming_tools_obtainable.test.ts`).
- **Id-bridge gap (previously open) is closed at the catalog level:** Bikkie seed/food/recipe rows are merged into `HARTHMERE_SEED_DEFINITIONS`/food definitions, so farmed Wheat (`4647276549161506`) and Cotton grant the same numeric Bikkie ids the specialized-block recipes consume; the 7/13 reverse id bridge guarantees round-trips for everything else.
- **UI:** farming/food quick actions (F/R/T) with disabled-state reasons ("No seed in backpack", "Needs oven"), cooking station panel, optimistic eat-stamina feedback, daily-task hooks (`garden_care`, `eat_meal`).

### Findings
| # | Severity | Finding |
|---|---|---|
| F-1 | P1 | Muck patches in the production snapshot are still grass/moss blocks (mined muckwad yields "Grass") — world-data rematerialization from the in-VNet host, per the July 1 runbook §2. Still open. |
| F-2 | P2 | Tree-type native harvests are explicitly rejected (`tree_harvest_not_supported`) — intentional, but players inspecting a grown tree get a silent no-op path; a blocked-reason string exists only server-side. |

**Bottom line:** farming is complete and healthy end-to-end; the only real gap is world data (muck patches), not code.

---

## 4. Harthmere Town

### Connector — ✅ verified
Authored road `[128,-209] → [392,-209]` (shifted world `[640,-209] → [904,-209]`) from the snapshot Grove edge to the Harthmere west gate; connected-town design checks all pass (road present in wilds registry, route anchors, map presentation "Road to Harthmere", reveal-at-west-gate rule, lamps/signposts/patrol readability). Town collision/placement suites pass.

### Flat land — ❌ NOT flat
- Production terrain under the town rectangle (authored X 440–620, Z −300…−120) spans **surface Y 48–86** (median 66; core mass at 57–75) per the placement-map scan — a ~38-block swing.
- The renderer defaults ~400 town props/shells to a flat `GROUND_Y = 53.05` (`harthmere_assets.ts:358`), while measured live ground is 65 at the market and 70 at the Grove board — the code compensates per-placement with measured constants and grounding probes, which is why things mostly look right, but the underlying land is sloped.
- **No terraform pass exists for the town.** Business outposts materialize their own level pads via voxel rebuild plans; the town core does not. If "completely flat land" is the design requirement, that is an in-VNet world-data job: flatten the town rectangle, then regenerate the placement map (same command as finding Q-3) so all 1,446 records re-ground.
- Caveat: the scan data is from 2026-06-07; if terrain was flattened after that date, only the placement-map regen will show it. The two known high-Y NPC outliers (Jenny @151 et al.) no longer appear in the map's NPC records, but final confirmation needs live world data.

### Dragon quest start — authored ✅ / playable ❌
- Q1 "Cracks in the Bridge" (start of the Bellbound dragon arc) is correctly authored **in town**: giver Reeve Caldus Merrow at Old Bridge, authored (476, −212) — inside the town bounds; the chain runs Q1 → … → Q11 → Q12 "Thaedryn the Bellbound" at the Wyrm Bed arena (implemented, with encounter placements).
- But per finding **Q-1/Q-2**, the arc cannot be started by a player and the dragon has no runtime encounter wiring. The dragon quest "begins in Harthmere" only on paper right now.

---

## Priority fix list

1. **Wire the bible quest catalog into the game** (Q-1): NPC dialogue offers (`HARTHMERE_QUEST_DIALOGUE_LINKS` already maps 8 giver NPCs → quest ids), a `live_mode` accept/advance/complete path (the runtime functions are written and tested), and journal/map surfacing (adapter pattern already exists for Grove quests).
2. **Wire Thaedryn's encounter** (Q-2): spawn from the NPC compendium record into the arena, drive with the validated boss contract via `request_boss_tick`.
3. **In-VNet world-data batch** (Q-3, F-1, town flatness): flatten town rectangle (if required), regenerate placement map, rematerialize muck patches, verify NPC outliers — one session, no deploy risk.
4. Confirm/fix the pre-existing business-permission test assertion (B-1) and the two lying audit scripts (Q-4).

---

# Fix status (implemented 2026-07-14, same day)

Every code-fixable finding above was implemented, commented inline (marker:
`bible-wiring fix, 2026-07-14` / `flat-town fix, 2026-07-14` /
`Audit fix (2026-07-14)`), unit-tested, and validated. ~230 tests across the
touched suites re-run green; scoped `tsc` typechecks clean on every new and
modified module.

| Finding | Fix | Where | Tests |
|---|---|---|---|
| **Q-1** — 85-quest bible catalog unreachable | Full server-authoritative wiring: `bible_quest_accept/advance/complete/abandon/retry` operations through `request_quest_state_update`, driven by the already-tested `quest_runtime` state machine; per-player slice persisted in `quests.bible` (normalized on deserialize); journal mirrors into `quests.active/completed`; map pins via `building.inWorldMarkers`; giver→quest map **derived from the catalog** (19 givers, not the 8-NPC hand map); NPC talk-dialog offers/objective actions/turn-ins; starter twins deduped; hidden world-trigger quests auto-accept on proximity | `bible_quest_live_authority.ts` (new), `live_mode_backend.ts`, `bibleQuestLiveAdapter.ts` (new), `LocalDevHarthmereBibleQuests.tsx` (new), `TalkToNPCDefaultDialog.tsx`, `HarthmereUnifiedHUD.tsx`, `mapLiveAdapter.ts` | `bible_quest_live_authority.test.ts` (16), `live_mode_bible_quests_backend.test.ts` (7), `bibleQuestLiveAdapter.test.ts` (10) |
| **Q-2** — Thaedryn encounter unwired | Boss is a live combat entity (`bible-boss:thaedryn_bellbound`) seeded at Q12 accept, hp mapped 1:1 to the `thaedryn_boss.ts` state machine (machine authoritative); real `request_attack` damage feeds the machine incl. wake-collapse tracking; chain anchors / ring cycles / path commitment / resolution via `bible_quest_boss_event`; path rewards + Q12 auto-objective completion on resolve; rendered attackable actor at the arena anchor routed to the boss id | same files + `visible_combat_target.ts`, `harthmere_assets.ts` | backend suite incl. full slay-path E2E through a real attack |
| **Reachability** (user requirement) | ONE canonical arena anchor — authored (640, **64**, −268), the renderer's existing dragon-chamber assets, grounded at the flat town level (found & fixed a would-be gap: a Y-0 anchor under ~64-high terrain makes 3D combat reach impossible). Q12 authored-waypoint disagreements (3 different locations in data) overridden to the anchor; `validateHarthmereDragonQuestReachability()` contract + plain-node tripwire script guard the whole chain | `bible_quest_live_authority.ts`, `check-harthmere-dragon-quest-reachability.cjs` (new) | contract test + 13-point wiring script (PASS) |
| **Town flatness** | Pure flatten math (district-union rectangle **minus a ±16 protected hole around the dragon arena**; carve/fill/grass-cap minimal deltas; idempotent; water-safe; bounded) + direct-redis apply script with APPLY=1 arming gate and a contract check that refuses to run when violated. Deliberately NOT a live_mode mutation (finding-4 contention). Requires the in-VNet host to execute | `town_flatten_terraform.ts` (new), `flatten-harthmere-town-terrain.cjs` (new), `docs/harthmere/TOWN_FLATTEN_RUNBOOK.md` (new) | `town_flatten_terraform.test.ts` (9) |
| **Q-4** — lying audit scripts | Starter-quest script: frozen line-wrap string match → whitespace-flexible regex. Bible-implementation script: raw `JSON.parse` of escaped template literal → VM evaluation (same fix pattern as 7/13); now reports **85 quest records, 0 missing, PASS** | `test-jobs-board-starter-quest.cjs`, `audit-harthmere-bible-implementation.cjs` | both scripts PASS end-to-end |
| **B-1** — business permission assertion | Investigated: the previously-reported failing assertion no longer exists at HEAD; 22/23 tests in the file confirmed green individually (the one exhaustive rejection-matrix test exceeds the sandbox 45s cap — no failure observed; confirm in CI) | — | targeted `--grep` runs |
| **F-2** — silent tree-harvest rejection | Server `farming_rejected:*` warnings now surface as corrective toasts (tree / already-harvested / not-ready reasons) instead of leaving the optimistic "Harvested" toast as the last word | `PlantInspectionOverlayComponent.tsx` | existing overlay tests green |
| Gap (code review, no test caught it) | The catalog's 72 reward item ids exist in no item catalogue → definitions are now registered at grant time (`isQuestItem`, quest-bound) so inventory rows are nameable | `bible_quest_live_authority.ts` + backend reward applier | asserted in backend completion test |

### Still requires the in-VNet host (world data, not code)
1. Run the town flatten (dry-run → APPLY=1) per `docs/harthmere/TOWN_FLATTEN_RUNBOOK.md`.
2. Regenerate the placement map (clears Q-3's stale 2026-06-07 map + the 6 `fallback_authored_y` deposits).
3. Rematerialize muck patches as `muckwad` (F-1, July 1 runbook §2).
4. One full CI run of `mmo_economy_business_customer_session.test.ts` to close B-1 formally.
