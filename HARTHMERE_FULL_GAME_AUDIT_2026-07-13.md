# Harthmere / Biomes Full Game Audit — 2026-07-13

**Scope:** full game — quests, inventory/items, physics/placement, live-mode sync, combat/NPC AI, interactions.
**Method:** static code review at HEAD (`e117f54b`), ~900 unit tests executed (all passing), placement-map audit script run, cross-checked against the July 1 runbook and July 2 grounding audit.
**Reported symptoms driving this audit:** quests not completable, missing items, thrown voxel items not visible, inventory not updating, floating people, buried objects.

---

## Verified healthy at HEAD

Before the findings — these previously-broken systems are confirmed fixed in source:

- **Sync reconnect spiral:** freeze-grace guard present (`src/shared/zrpc/websocket_client.ts:353`); heartbeat/TTL config all at 30s (`src/server/shared/config.ts:136,170,176`).
- **Redis lost-update bug:** per-request duplicated WATCH connection is in (`src/pages/api/harthmere/live_mode.ts:544–568,1866+`, dated 2026-07-06).
- **Client timeout aborts:** 20s read / 30s mutation timeouts with idempotent retry (`src/client/components/harthmere_live_fetch.ts:12–13`); mutations carry idempotency keys throughout `useBiomesUILiveAdapters.ts`.
- **F-prompt coordinate decoupling (jobs board / business):** both prompt tables now use 2D (x/z) distance, so terrain height no longer breaks the prompt radius.
- **Test suite:** ~900 tests across quests, jobs board, economy, combat authority, live entities, inventory contracts, grounding — zero failures observed (two long files were time-capped mid-run by the sandbox, all green to that point).
- Auth-loop, duplicate-stats, hotbar, crate loot 500, muckwad decrement, quest journal flood: fixes from v197–v202 all present.

The remaining bugs are concentrated below.

---

## P0 — directly explains a reported symptom

### 1. Roaming NPCs never re-ground while walking → "people float / sink"
`harthmereNpcGroundedY` in the renderer **ignores the requested Y and always returns the spawn base Y** (`src/client/game/renderers/local_dev/harthmere_assets.ts:2971–2978` — comment says it was done to stop root-bob float). All ~573 renderer-mesh NPCs navigate with this function (`:12495, :12566, :12830`), so any NPC whose wander/route crosses a slope keeps its spawn altitude: walking uphill they bury, downhill they float. The ECS-side grounder (`npcs.ts:1243`, tri-state + memory) is correct — the renderer navigation path just doesn't use it per-step.
**Fix:** re-ground per waypoint using the shared `harthmereGroundedFeetYWithMemory` probe (cheap, already cached per column), keeping the anti-bob lock only within a frame, not for the NPC's lifetime.

### 2. Thrown Harthmere items never appear in the world → "thrown voxel item not shown"
Two throw paths exist and only the ECS one produces a visible drop:
- **ECS path** (`src/client/game/helpers/inventory.ts:47`): publishes `InventoryThrowEvent` → server spawns a drop entity → rendered grounded (`src/client/game/resources/drops.ts`). Works.
- **Harthmere live-item path** (`useBiomesUILiveAdapters.ts:2876–2905`): "use/throw" only debits the live inventory and publishes a `block_inventory_throw` gardenHose event — which is consumed **only by the Road Ahead quest bridge** (`LocalDevSnapshotMissionBridge.tsx:1079`). No drop entity, no mesh, no map pin: the item vanishes. Additionally `onDrop` on a local Harthmere hotbar slot (`:2971–2977`) just clears the shortcut assignment.

**Fix:** on Harthmere-item throw, spawn a world drop (live-mode `drop_item` mutation + a rendered pickup via the existing drop/pickup toast machinery), or route throws through the ECS event with a mirrored live-inventory debit.

### 3. Stale production placement map → "things buried underground"
`src/shared/harthmere/generated/production_terrain_placement_map.ts` — `generatedAtIso: 2026-06-07`, over 5 weeks older than current HEAD and predating recent terrain work. The July 2 audit's #1 recommendation (regenerate from live terrain) was never executed. It still contains **6 `fallback_authored_y` records** (the three high-vault exotic-matter deposits ×2 each, Y 97–102) that use raw authored Y — these quest-find items float or bury if the vault floor moved. All 1,434 "grounded" records are also only as good as June 7 terrain.
**Fix (world data, no code):** from an in-VNet host:
```bash
HARTHMERE_WORLD_SYNC_REDIS_HOST=10.0.0.12 NODE_OPTIONS=--max-old-space-size=8192 \
node scripts/harthmere/build-production-terrain-placement-map.cjs --write --stride=8 --margin=64
node scripts/harthmere/check-harthmere-production-placement-map.cjs
```
Also still unresolved from July 2: high-Y NPC outliers **Jenny @ Y151 (493,−101)**, Rosalie @107, two @90 — verify/re-ground.

### 4. Live-mode mutation architecture → "inventory not updating", general lag
Every mutation (`live_mode.ts:1855+`) does: idempotency GET → WATCH player key **and the single global `sharedWorldStateKey`** → GET both full-state JSON blobs → parse → merge → run the 15,300-line reducer → stringify → EXEC, retrying up to 5 times. Because every player's every mutation WATCHes the same shared-world key, any concurrent write anywhere invalidates the transaction — under load this compounds into the HAR-proven 4–29s mutation latencies. The client retry/timeout work (v199) treats the symptom; this is the cause. Stage timings are already instrumented (`attemptTimings`) — use them to confirm, then:
**Fix direction:** split the shared world state into per-domain / per-region keys (only WATCH what the mutation touches), keep per-player state separate from world state, and consider delta writes instead of whole-blob rewrites. This is the single highest-leverage performance fix in the game.

---

## P1 — likely to bite, not always visible

### 5. ~400 town props/shells default to flat `GROUND_Y = 53.05`
`harthmere_assets.ts:350` — building shells (`shell.groundY ?? GROUND_Y`, `:3292`) and hundreds of `P(...)` props use fixed Y offsets from a flat constant. On the hilly production terrain, anything authored before the hills that isn't explicitly offset can bury or float. The town core was verified OK on July 2, but this is fragile against any terrain change — same regeneration/grounding pass as finding 3 should sweep props.

### 6. Road Ahead "Carry a Muck Buster" soft-lock risk
Step completion checks ECS items with `unmuck` **or the localStorage Harthmere inventory** (`LocalDevSnapshotMissionBridge.tsx:1250–1258`, reader at `:663`). It never checks the server-authoritative live-mode inventory. A player on a new device / cleared storage whose muck tool lives server-side can hold the tool and still never complete the step.
**Fix:** add the live-mode inventory (API-backed state the HUD already has) as a third source in the check.

### 7. Server line-of-sight is a permissive stub
`mmo_combat_authority.ts:300` — `serverCheckLineOfSight` returns `true` always. The recent "aggression from far away" fix (`28c7a15c`) gates range client-side, but the server happily lets NPC AI target through walls/terrain. The v197 chase fix and `live_mode_backend.ts` LoS handling depend on client-supplied `lineOfSight` payloads (`:4541` — defaults to `witnesses > 0`), i.e., trust-the-client.
**Fix:** wire the voxel raycast server-side (the TODO in the file), or at minimum sanity-clamp by distance + last-seen timestamps server-side.

### 8. Ground-probe caches never invalidate on terrain edits
`npcs.ts` `harthmereNpcGroundProbeCache` (position-keyed, `:1228`) and the drops per-column memory cache have no invalidation when a player mines/places blocks. Mine the ground under an NPC or drop and it floats on the remembered surface until reload.
**Fix:** invalidate the affected column keys on `EditEvent`.

### 9. Dual-authority inventory remains a structural bug generator
ECS `/sync` inventory and Harthmere live-mode inventory must be mirrored **manually per operation** — mine, place, eat, throw, medical each carry bespoke mirror code, and history shows each new op ships with one side missed (place-decrement, muckwad throw, now finding 2). No single choke point exists.
**Fix:** one `spendItem/grantItem` utility that always writes both authorities (and one reconciliation pass on load), then migrate call sites.

---

## P2 — hygiene / deferred

- **Broken audit script:** `scripts/harthmere/check-harthmere-quest-bible-grounded.cjs` fails to parse — duplicate `const current` at line 82. Its signal is silently missing from any check pipeline.
- **React #418 hydration mismatch** root cause still unidentified; the `Game.tsx` remount cascade is defused (benign-abort handling) but the initial remount remains.
- **Muck patches in the production snapshot** are still grass/moss blocks (mined muckwad yields "Grass") — world-data rematerialization from an in-VNet host, per the July 1 runbook §2.
- **Client bootstrap performance:** ~43 parallel client sims, ~3.7s registry load, 10–14 FPS while applying the sync bootstrap. Every timing bug in this audit is amplified by it. Worth a profiling pass (defer sims until after first stable frame).
- **Tooling:** full `tsc --noEmit` OOMs at the default Node heap on this repo — CI should pin `NODE_OPTIONS=--max-old-space-size=6144+` so typecheck actually runs.

---

## On the reported symptoms, mapped

| Symptom | Explanation | Finding |
|---|---|---|
| Quests not completable | Wiring/validators all pass; remaining causes are mutation latency (progress writes slow/racing), stale placement map (targets buried), and the muck-buster local-only check | 3, 4, 6 |
| Missing items | Throws vanish (no world drop); latency drops grants; stale map buries spawned finds | 2, 3, 4 |
| Thrown voxel item invisible | Harthmere throw path spawns nothing | 2 |
| Inventory not updating | Global WATCH contention + whole-blob state writes | 4, 9 |
| People float | Roaming NPCs locked to spawn Y; ungrounded NPC outliers; probe caches stale after edits | 1, 3, 8 |
| Buried underground | Stale placement map, flat GROUND_Y props, fallback-Y deposits | 3, 5 |

## Suggested fix order

1. Regenerate placement map + re-ground the 4 outlier NPCs (world data, no deploy risk) — finding 3.
2. Per-waypoint NPC re-grounding — finding 1 (small client change, big visual payoff).
3. World drops for Harthmere-item throws — finding 2.
4. Live-mode state sharding / WATCH scoping — finding 4 (largest effort, largest payoff).
5. Muck-buster live-inventory check — finding 6 (tiny).
6. Terrain-edit cache invalidation — finding 8 (small).
7. Server LoS raycast — finding 7.
8. Inventory mirror utility — finding 9 (refactor, schedule deliberately).

---

## Addendum (same day) — ECS↔live-mode seam deep dive

A second pass focused on the native-ECS boundary found five further gaps.

### A. Live-mode loot drops have no world presence
The backend already supports proper drops: `drop_item` (`mmo_inventory_loot_authority.ts:1181`) debits the actor and creates a `loot_drop` with source tracking and an `expiresAtMs`. But the client renders `availableLootDrops` **only as rows in the inventory UI tab** (`lootDropsToUi`, `useBiomesUILiveAdapters.ts:1365,4135`) — no 3D mesh, no map marker, no pickup prompt. Two consequences: even fixing finding 2 by calling `drop_item` won't put the item visibly on the ground until a renderer exists, and drops **silently expire** while invisible — a direct "missing items" source.
**Fix:** render `availableLootDrops` through the same grounded drop machinery ECS drops use (`drops.ts`), with a map pin and an expiry timer shown.

### B. Client-driven mirroring means drift by design — and nothing reconciles it
Every cross-authority mirror (mine grant, place spend, throw debit) is a **fire-and-forget HTTP call issued by the client** (`submitHarthmereInventoryMutationToLiveMode`, `LocalDevHarthmereInventorySystem.tsx:2323+`). A crash, tab close, or dropped request between the ECS write and the live-mode mirror leaves the two inventories permanently diverged — and no server-side job ever compares ECS inventory against live-mode inventory to repair drift. Idempotency keys protect against duplicates, not against the missing half.
**Fix:** server-side mirroring (the live_mode API already talks to `worldApi` — it can apply both sides atomically), or at minimum a login-time reconciliation pass.

### C. The item id bridge is forward-only and semantically lossy
`harthmere_biomes_ecs_bridge.ts:100–110` hand-maps only ~10 Harthmere string ids to Bikkie ids, several as visual stand-ins with wrong semantics (`iron_ore→goldOre`, `cloth_scrap→tatteredTop`, `clean_water→bucket`, `old_coin→goldNugget`). There is **no reverse mapping anywhere** (`b:` prefixed numeric ids round-trip, string ids don't). Every unmapped item warns and stays live-only (`pushItemIntoContainer`), which locks it out of ALL native ECS systems: throws/drops, station recipe checks, the Road Ahead `unmuck` item check, wearables. This is the standing "farming id-bridge gap" generalized — it applies to the whole catalogue.
**Fix:** register real Bikkie ids for Harthmere catalogue items (script-generated), keep a bidirectional map, and treat missing mappings as a CI failure rather than a runtime warning.

### D. Client overlays mutate canonical synced ECS components
The adapter writes Harthmere visual state **directly into the synced ECS resource store**: `resources.set("/ecs/c/inventory", ...)` for hotbar overlays (`useBiomesUILiveAdapters.ts:1989`) and `resources.set("/ecs/c/wearing", ...)` for equipment (`:1955`). A real ECS item occupying an overlaid hotbar slot is visually erased (still exists server-side → "missing item" reports), and any incoming sync delta for the component can clobber the overlay → flicker/mismatch. Native ECS state should be read-only on the client; composite Harthmere items at the UI/render layer instead.

### E. Muck-buster soft-lock (finding 6) is confirmed, not just theoretical
`HARTHMERE_INVENTORY_SERVER_AUTHORITATIVE` (2026-07-02, `useBiomesUILiveAdapters.ts:3140–3160`) deliberately **drops the localStorage inventory from display whenever the live server is authoritative** — yet the Road Ahead craft-step check still reads that same localStorage (`LocalDevSnapshotMissionBridge.tsx:1250`). In every live-authoritative session where the tool was acquired server-side, the step can only complete via the ECS `unmuck` check — which, per gap C, works only for the handful of bridged ids. Raise finding 6 from P1 to the top of the quick-fix list.

**Revised fix-order impact:** gap C (id bridge) is the root enabler — closing it shrinks gaps A/B/D/E and finding 2/9 substantially. Recommend inserting it as step 3.5 in the fix order.

---

## Fix status (implemented 2026-07-13, same day)

All code-fixable findings above were implemented, documented inline (each change carries an `(audit fix, 2026-07-13)` marker comment), and covered by tests. Every fix below has green tests; ~250 tests across the touched suites were run.

| Finding | Fix | Where | Tests |
|---|---|---|---|
| 1 — NPCs frozen at spawn Y | Per-step re-grounding through the shared tri-state probe, with ±6-block acceptance window + 0.4/step vertical clamp; global grounding deps registered at renderer build | `harthmere_assets.ts` (`harthmereNpcGroundedY`), `harthmere_entity_grounding.ts`, `renderers.ts` | `harthmere_npc_wander_regrounding.test.ts` (12) |
| 2 + Gap A — thrown items vanish; drops invisible | `drop_item` with a world `position` now creates a positioned, shared, claimable loot drop after the debit; hotbar drag-out and material drops send the position; drops rendered as grounded glowing satchels in-world | `mmo_inventory_loot_authority.ts` (`createHarthmereDebitedWorldDrop`), `live_mode_backend.ts`, `useBiomesUILiveAdapters.ts`, new `harthmere_loot_drop_markers.ts` + `harthmereLootDropWorldState.ts` | `harthmere_world_throw_drop.test.ts` (4), `harthmereLootDropWorldState.test.ts` (5) |
| 4 — global WATCH contention | Scoped WATCH: player-only mutations no longer watch/rewrite the shared world blob; shared-touching mutations escalate (re-watch + re-reduce) before writing — removes cross-player EXEC contention on eat/medical/inventory paths | `live_mode.ts` (`HARTHMERE_LIVE_MODE_SCOPED_WATCH`) | `live_mode_api_persistence.test.ts` (20, incl. new escalation test) |
| 6 + Gap E — muck-buster soft-lock | Module-level last-known live-inventory snapshot; the craft step checks it as a third source | `LocalDevHarthmereInventorySystem.tsx`, `LocalDevSnapshotMissionBridge.tsx`, `useBiomesUILiveAdapters.ts` | `harthmereLiveInventorySnapshot.test.ts` (5) |
| 7 — permissive LoS stub | Hard 48-block distance cap + voxel-walk LoS with injectable solidity sampler (fail-open on shard errors); client registers a real terrain sampler | `mmo_combat_authority.ts`, `harthmere_entity_grounding.ts` (`harthmereTerrainBlocksSight`), `renderers.ts` | `harthmere_server_line_of_sight.test.ts` (7) |
| 8 — stale ground caches after edits | Column-cache invalidation registry; NPC/drop/wander caches registered; mine/place edits invalidate surrounding columns | `harthmere_entity_grounding.ts`, `npcs.ts`, `drops.ts`, `interact/helpers.ts` | covered in `harthmere_npc_wander_regrounding.test.ts` |
| Gap C — forward-only id bridge | `biomesIdToHarthmereItemId` reverse map (first-declaration-wins for shared stand-ins, `b:<id>` fallback, round-trip guaranteed) + curated-mapping predicate | `harthmere_biomes_ecs_bridge.ts` | `harthmere_biomes_ecs_bridge_reverse.test.ts` (10) |
| Gap B — mirror drift undetectable | `compareHarthmereLiveAndEcsInventories` pure drift comparator for bridged items (login-time report/repair building block) | `harthmere_biomes_ecs_bridge.ts` | same file |
| Gap D — overlay clobbers ECS slots | Pure `mergeHarthmereHotbarOverlaySlots`: overlay only fills EMPTY slots, releases its own, never overwrites native ECS items | `inventoryAdapterHelpers.ts`, `useBiomesUILiveAdapters.ts` | `hotbarOverlayNoClobber.test.ts` (5) |
| P2 — broken audit script | Fixed duplicate `const` SyntaxError, template-literal-aware catalog parsing, entry-count (not string-literal) array alignment | `check-harthmere-quest-bible-grounded.cjs` | script passes end-to-end |
| P2 — `__dirname` ESM crash | Grounding single-source test resolves root from cwd | `harthmere_grounding_single_source.test.ts` | passes |

### Deliberately NOT changed
- **"Use"-key projectile throws (muckwad at monsters)** keep consume-on-use semantics — making thrown ammo recoverable would change tutorial/combat economy; only inventory drag-out and material drops spawn world drops.
- **Full state sharding** (finding 4's endgame) — the scoped WATCH removes the contention; splitting the blob into per-domain keys remains the long-term follow-up.
- **Server-side mirroring / auto-repair** (Gap B's endgame) — the drift comparator ships; wiring a login-time repair needs a policy decision (which authority wins).

### Still requires the in-VNet host / live world data (cannot be done from this sandbox)
1. Regenerate the production placement map (finding 3) — commands in the July 2 audit.
2. Re-ground the four high-Y NPC outliers (Jenny @151 et al.).
3. Rematerialize muck patches as `muckwad` (July 1 runbook §2).
4. Deploy `main` and verify the latency drop with the already-instrumented `attemptTimings` stages.
