# Road Ahead Quest — Completability Audit (2026-07-07)

Full end-to-end audit of the `snapshot_road_ahead_full_chain` tutorial mission
(`Road Ahead`), the first quest a new Harthmere player runs. Source of truth:
`SNAPSHOT_ROAD_AHEAD_MISSION` in `src/shared/harthmere/snapshot_complete_port.ts`.

## The chain (10 steps)

| # | Step id | Trigger | Marker | Grants (on completion) |
|---|---------|---------|--------|------------------------|
| 1 | `meet_jackie_in_grove` | `talk_npc` (Jackie) | `npc_jackie` | route layer |
| 2 | `road_ahead_meet_up_with_billy` | `near_location` r=9 | `old_grove_road_post` | +35 XP |
| 3 | `road_ahead_collect_muckwad` | `destroy` (non-flora) | `muckwad_patch` | `muckwad_sample` |
| 4 | `road_ahead_place_blocks` | `place_voxel` | `building_practice_spot` | `road_repair_block_bundle` |
| 5 | `road_ahead_wear` | `inventory_change` (top+bottoms) | `lovely_locks_mirror` | `grove_travel_top`, `grove_travel_bottoms` |
| 6 | `road_ahead_find_bag` | `jump` (running) | `road_jump_stretch` | `road_snack` |
| 7 | `road_ahead_selfie` | `photo_post_attempt` | `selfie_overlook` | `cove_photo_frame` |
| 8 | `busted_wooden_axe` | `destroy` | `muckwad_patch` | `rough_repair_wood` |
| 9 | `busted_muck_busters` | `craft` (have muck-clearing tool) | `service_tower_platform` | `practice_muck_buster` |
| 10 | `return_to_jackie` | `talk_npc` (Jackie) | `npc_jackie` | Road Ready + XP |

## What is healthy

- **Advancement is order-independent and self-accepting.** `chooseSnapshotMissionStep` / `advanceSnapshotMissionProgress` (`snapshot_mission_advance.ts`) complete the earliest incomplete step for any matching event and auto-accept the mission, so the chain can never get stuck at step 0 waiting for a missed "talk Jackie" event.
- **Every trigger kind is wired** in `LocalDevSnapshotMissionBridge.tsx`: `dialog`, `destroy`, `place_voxel`, `running_jump`, `photo`, `wearing`, `location` (distance check), and `craft_muck_buster` (owned-item check). No trigger is orphaned.
- **`wear` step is safe**: completes automatically if the player is already wearing a top + bottoms (`hasRequiredClothing`), so starter clothing satisfies it; the granted travel set is a bonus.

## Gaps found

### GAP 1 — Muckwad step was a death trap (FIXED)
Step 3/8 send an effectively-unarmed new player to break terrain **inside the
`road_muckwad_patch` starter muck zone**, which also seeds a hostile *Road
Muckling* (`SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS`). Unprovoked muck aggression there
attacked and killed the player mid-step ("something was hitting me and killing me
while throwing the Muckwad") and blocked the chain.
**Fix applied:** `evaluateMuckMonsterAggression` now exempts the starter tutorial
muck patch (`road_muckwad_patch`) from *unprovoked* aggression. Retaliation (if the
player attacks) and the separate combat primer (player strikes first) are
unaffected. Covered by a new test in `muck_monster_aggression_ai.test.ts`.

### GAP 2 — "Craft a Muck Buster" (step 9) soft-lock (FIXED)
**Resolved:** added a cheap level-1 workbench recipe `harthmere_tool_muck_buster_recipe`
(1× `rough_stone` — mineable from any stone and buyable for 2 gold) in
`mmo_crafting_catalogue.ts`, taught it to new players via
`HARTHMERE_STARTER_KNOWN_RECIPE_IDS`, and extended the tutorial's muck-tool
detection to recognize the crafted tool's real item id. A recipe UX primer was
added to the crafting panel so players know how to craft it. Original analysis
below.


The step completes only when the player holds a muck-clearing tool
(`muck_rake` / `muck_buster` / `practice_muck_buster`). But:
- There is **no Muck Buster crafting recipe** defined (`HARTHMERE_FARMING_TOOL_RECIPES` only has hoe / watering can / bucket), and the Muck Buster recipe is **not** in `HARTHMERE_STARTER_KNOWN_RECIPE_IDS`.
- The step's own `practice_muck_buster` is granted only **on completion** (`snapshotCompletePortAllowedRoadAheadItemIds` gates grants to *completed* step indexes) — a chicken-and-egg.

So a player who follows only the tutorial has no path to obtain the tool, and the
chain stalls before `return_to_jackie`.
**Recommended fix (pick one):**
1. Grant `practice_muck_buster` when step 9 *activates* (matches the "or obtain a Muck Buster" wording) — smallest player-facing change; needs a grant-on-activation hook.
2. Add a real `harthmere_tool_muck_buster_recipe` (cheap, e.g. wood_plank + iron) and include it in the starter known-recipe set — matches the "Craft" verb.
3. Sell the Muck Buster at a Grove vendor within tutorial reach.

### GAP 3 — Grants arrive on completion, not activation (design note)
All step `itemGrantIds` are delivered when the step *completes*. This is fine for
every step whose completion doesn't depend on the granted item — but it's the
mechanism behind GAP 2 and is worth keeping in mind for any future step that asks
the player to *use* the thing it hands out.

## Related fixes shipped alongside this audit
- Server 500 on `request_loot_roll` for terrain biscuits (e.g. "Mined Grass") — fixed in `live_mode_backend.ts` (`anItem` guarded). This also affected the step-3 `muckwad_sample` grant and crate pickups.
- Thrown/used non-block consumables (Muckwad) now decrement the Harthmere inventory.
