# Harthmere 19-Business In-World Simulation — Completion Audit (2026-08-03)

Audit only. No source, asset, world, image, or deployment change was made.

Scope: the `[BUSINESS-SIM-HANDOFF-V1]` package — replace the detached card
mini-game in all 19 businesses with a real third-person customer-service
simulation inside the actual persisted building, using the completed Blender
interiors and the native ECS/economy/inventory stack.

Verdict: **assets are done and green; the runtime is roughly 70% built and is
blocked on two defects, one of which is a systemic world-geometry mismatch that
must be fixed in the authored generators and survive deploy + reconciliation —
not patched by a repair script.**

---

## 1. What is actually complete

### 1.1 Asset gates — all pass, zero regression

`node scripts/harthmere/test-business-interior-assets.cjs` re-run during this
audit:

```json
{
  "businesses": 19,           "fixtures": 211,
  "collisionBoxes": 178,      "glbs": 38,
  "totalGlbBytes": 2197880,   "maximumGlbBytes": 106248,
  "maximumDrawCount": 9,      "fixtureOverlaps": 0,
  "protectedAisleIntrusions": 0, "stairIntrusions": 0,
  "verifiedNavigationRoutes": 239
}
```

Every accepted gate in the handoff matches exactly. Also verified on disk: 38
combined GLBs, **zero `.raw.glb`**, 32 furniture GLBs, 16 exact 256×256 icons,
16 furniture identities in
`src/shared/harthmere/generated/harthmere_business_furniture_manifest.ts`.
Cinderlane's Drawers workbench is at local X `7.4` (the corrected value). The
five 28×22 expansions are present in the manifest.

Nothing in this audit touched Blender. No pipeline-issue lesson is at risk.

### 1.2 Runtime code that already exists and is correct

| Layer | File | State |
| --- | --- | --- |
| Manifest → runtime contract | `src/shared/harthmere/business_interior_runtime.ts` | Done. Single source; no duplicated fixture arrays. |
| Combined-interior rendering + LOD | `src/client/game/renderers/local_dev/harthmere_business_interiors.ts` | Done. 16 m / 28 m / hidden honored; static clutter tagged; debug bridge for browser evidence. |
| Native furniture identities | `harthmere_native_bikkie_items.ts`, `placeables/helpers.ts` | Done. Blender LOD0 URL resolved ahead of donor/Galois fallback; exact icon precedence. |
| Session → ECS materializer | `src/server/harthmere/business_customer_session_ecs.ts` | Done. Ordered admission, restart deferral, HFC/RC partitioning, distance-gated safe delete, no queue teleport. 8/8 tests pass. |
| Customer locomotion behavior | `src/shared/npc/behavior/business_customer_tick.ts` + `logic.ts` | Built. A* per waypoint, arrival radius, look-at during serving, spawn grounding snap. 10/10 tests pass. |
| Spatial in-world HUD | `HarthmereBusinessShiftHUD.tsx` | Built. Card is projected over the real customer entity; world stays visible and controllable. |
| Server-side authority gate | `mmo_economy_business_systems.ts:1739` + `live_mode.ts:4349/4400` | **Done and strong.** The server *deletes* any client-supplied `nativeCustomerReady` and re-derives it from real ECS state. A serve cannot be committed unless a real NPC is authoritatively at the counter. This is the guarantee that kills parallel card authority. |

Tests re-run green during this audit:

- `harthmere_business_interior_placement.test.ts` — 1 passing
- `business_interior_runtime.test.ts` — 3 passing
- `harthmere_business_interiors.test.ts` (renderer) — 2 passing
- `business_customer_logic.test.ts` — 10 passing
- `business_customer_session_ecs.test.ts` — 8 passing (full lane)

---

## 2. RETRACTED — "every interior is bigger than its real building"

**This section was wrong. It is kept, struck through, because the mistake is
instructive and the corrected finding replaced it.**

The comparison was made against the *raw authored* `outpost.building.width/depth`
values in `HARTHMERE_BUSINESS_OUTPOSTS`. Those are not the footprint the world
is built from. `harthmereBusinessOutpostMinigameFootprint` already expands every
outpost to the audited minimum — 28x22 for large profiles and the five declared
expansions, 24x20 otherwise — and every downstream consumer (origin, plot,
blueprint, terrain grounding, door axis, decor) derives from that expanded
value.

Verified directly against `HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS`:

- all 19 effective footprints match the manifest exactly;
- all 19 shell origins match `shellOrigin` exactly;
- door axis and service counter agree with the manifest to 0.71 m, which is the
  expected voxel-corner versus voxel-centre offset, not drift.

**Mismatched rows: 0 of 19.** The lesson: never audit a generated world against
authored input fields without first checking what the generator does to them.

The one real finding buried in the original section survives — Redpot's building
*profile* was `bakery` — and it has been corrected.

### The corrected defect: a one-voxel front door

The actual systemic geometry defect was in the storefront dressing, not the
footprint.

`buildingSystemDoorOpeningColumns` opened two wall columns, but the Grove
front-door pass then re-walled `doorX ± 1` at body height to read as jambs,
under a comment describing an "open 1x2 doorway". Net traversable opening:
**exactly one voxel at `doorX`.**

A native NPC body (`LOCAL_DEV_HUMAN`) has collision size `[1, 1.8, 1]`, and
`npcGroundTraversalProfile` leaves it alone because it is not oversized. **The
body is exactly as wide as the hole.** Its swept AABB is face-coincident with
both jambs, so any floating-point drift registers as an intersection.

That single fact explains every symptom in the issues log: a real customer, a
valid A* path straight through the door (A* traverses voxel *centres*, which are
traversable), a body that walks up the approach and stops dead outside the wall,
and rigid-body velocity `[0, 10, 0]` — the collision escape force, not a route
speed. All 19 live rows timed out in phase `entering`.

Verified by collapsing the authored materialization plan to final voxel state
(last write wins, as the world applies it) and measuring the free span at body
height: Ashline's wall row had exactly one free column, `x=674`.

## 3. Superseded — "every interior is bigger than its real building"

*Original text retained below for the record; see the retraction above.*

The combined interiors are correctly *centered* on their outposts (centre delta
≤ 0.5 m everywhere) but every authored interior footprint is **larger than the
procedural building shell it is supposed to live inside**:

| Outpost | Real building W×D | Interior W×D | Δ width | Δ depth |
| --- | --- | --- | --- | --- |
| ashline_containment_works | 22×16 | 28×22 | +6 | +6 |
| north_anchor_repair_shed | 18×14 | 28×22 | +10 | +8 |
| glassyard_biome_studio | 16×14 | 24×20 | +8 | +6 |
| redoubt_contract_yard | 20×14 | 28×22 | +8 | +8 |
| eastgate_portal_office | 24×18 | 28×22 | +4 | +4 |
| southplot_rare_foods | 18×14 | 24×20 | +6 | +6 |
| cinderlane_tool_forge | 20×16 | 28×22 | +8 | +6 |
| moonstall_ward_shop | 18×16 | 24×20 | +6 | +4 |
| westtrail_guide_table | 16×12 | 24×20 | +8 | +8 |
| keylot_property_office | 20×15 | 24×20 | +4 | +5 |
| brightcart_general_house | 18×14 | 24×20 | +6 | +6 |
| ridgecooler_larder | 17×13 | 28×22 | +11 | +9 |
| greenlamp_walk_in_clinic | 18×15 | 28×22 | +10 | +7 |
| returnstone_pad_office | 16×13 | 24×20 | +8 | +7 |
| clearbarrel_cleanup_yard | 18×14 | 24×20 | +6 | +6 |
| hingehall_repair_shop | 16×13 | 28×22 | +12 | +9 |
| redpot_service_kitchen | 18×14 | 28×22 | +10 | +8 |
| stampspur_courier_office | 16×13 | 28×22 | +12 | +9 |
| lanternrest_road_inn | 24×18 | 28×22 | +4 | +4 |

Floor counts do match (the four 2-floor businesses are 2-floor on both sides).

Consequences, all of which are handoff violations:

1. **The interior geometry pokes through the real walls** by 2–6 m on every
   side. "Renders at its audited origin with no duplicate rendering" cannot be
   claimed while the shell and its contents disagree.
2. **The authored entrance is not the real door.** The manifest entrance sits at
   interior local Y `-0.5`, i.e. 2–4.5 m *outside* the real south wall. Ashline:
   entrance world `z = -55.5`, real south wall `z ≈ -52.2`.
3. **Two competing anchor sets exist.** `business_interior_runtime.ts` derives
   entrance/queue/customer/staff from the manifest; `business_customer_simulator.ts`
   (≈ line 11546) derives `doorX`/`entrance`/`queueNode` from the *building*
   footprint. Nothing reconciles them. `HarthmereBusinessWorldInteraction.tsx`
   uses the manifest staff point; the procedural building uses its own.
4. The five declared 28×22 expansions (North Anchor, Greenlamp, Hingehall,
   Redpot, Stampspur) are exactly the worst offenders (+10…+12 wide). The
   interiors were expanded; **the exterior shells were never regenerated.**

Separately: `outpost_restaurant_redpot`'s building profile is literally
`"bakery"`. The handoff says keep Redpot restaurant-only.

**This must not be fixed with a repair script.** The buildings are authored data
(`HARTHMERE_BUSINESS_OUTPOSTS[*].building` in `business_customer_simulator.ts`)
consumed by the procedural building generator, the seeders, the visual decor
pass and the map/marker feeds. The fix belongs in the authored table + generator
so that a cold deploy, a warm-Redis refresh, and any world reconciliation pass
all produce a shell that matches the manifest. Per
`HARTHMERE_SEEDER_COMPOSITION_AND_DEPLOY_ORDER`, a widened shell also has to be
composed in the right seeder order or the next writer will silently drop it, and
per the placement-map lesson a seedId-keyed placement map can quietly undo a
moved/resized structure. Both need explicit coverage.

---

## 3. Blocking defect B — the manifest collision boxes are not real collision

`grep` for `collisionBoxes` across `src/` returns exactly three hits: one lookup
of the counter box in `business_interior_runtime.ts:269`, one debug counter in
the renderer, and tests. **Nothing registers the 178 collision proxies with
physics.**

So today:

- The service counter is *not* genuinely collidable. The handoff requires
  customer and staff points on opposite sides of a genuinely collidable counter.
- Customers can walk through fixtures; "queue advance without clipping through
  wall, counter, furniture, stairs" cannot be demonstrated.
- Both the outpost building shell (`harthmere_business_outpost_buildings.ts`)
  and the interiors renderer are **client-side THREE only**. Server-side NPC
  physics sees neither. Server A* runs on the voxel terrain graph, which is why
  the pathfinder cheerfully routes straight through where walls ought to be.

The handoff's "do not use render-mesh triangle collision; use manifest collision
boxes/proxies" is currently satisfied only in the negative sense that there is
no collision at all.

---

## 4. Blocking defect C — live customers still do not walk (open, documented)

`docs/harthmere/HARTHMERE_BUSINESS_CUSTOMER_SIMULATION_ISSUES.md` tracks this and
several real fixes have already landed (stale-HFC cleanup, HFC/RC partitioning,
`dtSecs` validation at the last tick boundary, initial-yaw authoring, restart
deferral, ordered admission). It is still open.

Latest evidence — `artifacts/harthmere-business-live-browser/1785750160251-6887-report.json`,
image `sha256:e19b1428…`, BUILD_ID `business-customers-final-20260803-r3`, Anima
`/ready=OK` + HFC bootstrap complete, Redis `PONG` / 340,827 keys, all three
containers `RestartCount=0`, `OOMKilled=false`, **zero browser console failures**:

- 6 of 6 attempted rows failed identically: `native customer serving timed out`.
- Ashline's lead customer holds `phase: "entering"`, `waypointIndex: 0`, at
  `[673.36, 67.02, -61.34]` with a valid, freshly-searched A* path whose last
  node is `[675, 67, -55]`. It moved a few metres off spawn and stopped.
- Earlier grouped run recorded rigid-body velocity `[0, 10, 0]` — the collision
  escape force, not a route speed.

Remaining candidate causes, in the order I would test them:

1. **Authored Y vs hilly terrain.** Spawn/entrance/departure Y all come from
   `originY + 1` with no runtime surface probe
   (`business_interior_runtime.ts:143-163`). This is the exact Harthmere failure
   mode recorded for creature seeding. `groundedBusinessCustomerSpawnPosition`
   snaps *once*, only at spawn, only within 4 m, and never again — so a body
   that drifts onto a higher column mid-route re-embeds and gets the escape
   force.
2. **Nothing to walk into, nothing to walk on.** With no server-side building or
   fixture collision (defect B) the only thing that can stop the body is terrain,
   which points back to (1).
3. **Walking force at the ground-locomotion boundary.** `logic.ts` already has a
   focused probe behind `GLITCH_FOCUSED_NATIVE_E2E_STACK=1` that logs
   `walkingForceCoefficient` + pre/post physics for business customers. That
   probe has not yet been run to conclusion in the report artifacts.

---

## 5. Product gap — the card mini-game is still reachable as a primary surface

`HarthmereBusinessLiveContainer.tsx` renders **both** `HarthmereBusinessInterfacePanel`
(the 5,702-line panel, whose `CustomerMiniGamePane` still uses `miniGameArenaStyle`
and is tab-labelled "Day Job Mini-Game") **and** the spatial `HarthmereBusinessShiftHUD`.
Pressing F at the counter opens the full detached panel.

The economy gate means the panel *cannot* fraudulently complete a serve — that
part is genuinely fixed. But the handoff's product requirement is that the card
board no longer be the primary experience covering the 3D room. Today it is
still the thing that opens. The panel's other tabs (overview, services, orders,
storefront) are legitimate owner UI and should stay; the customer-service pane
is what has to stop being the front door.

---

## 6. Test-matrix status against the required A/B/C matrices

| Matrix | Required | Actual |
| --- | --- | --- |
| A — unit/contract, per business | 19 rows × full contract | Coverage exists but is **aggregated**, not per-business rows. `business_customer_native_e2e.test.ts` loops all 19 interiors inside a *single* `it`. `business_customer_logic.test.ts` is 10 behavioral cases, not 19 rows. Placement test is 1 `it`. A single failure collapses the whole matrix and produces no per-business report. |
| B — native E2E, per business | 19 rows, each a complete transaction | Present as one aggregated test over `HARTHMERE_BUSINESS_INTERIORS`; needs bootstrapped lane (`.mocharc.json`, >2 min). Not split into resumable per-business rows. |
| C — live browser, per business | 19 rows with JSON + visual evidence | Runner `test-harthmere-business-live-browser.cjs` (958 lines) is correctly built for all 19 and supports row selection/resume. **Best run to date: 0 of 19 green.** Latest report has 7 interior screenshots and 6 failure screenshots; `rows: []`. |

The interior screenshots are worth noting as partial good news: rows 01–07 got
far enough to capture an interior frame before the customer timed out, so the
combined GLBs *are* loading and rendering in the warm stack.

---

## 7. What remains, in dependency order

Everything below is source/generator work plus one immutable candidate image.
No production deploy, push, traffic change, restart, or Redis mutation is
authorized by this audit.

**Phase 1 — make the world match the manifest (unblocks everything else)**

1. Regenerate the 19 outpost building shells from the audited manifest footprints
   (24×20 / 28×22, matching floors) in the authored table + procedural building
   generator. Correct Redpot's `bakery` profile to a restaurant profile.
2. Make the manifest the *single* source of the door/entrance/queue/staff anchors.
   Delete or derive the second anchor set in `business_customer_simulator.ts`
   (~line 11546) so the real door and the authored entrance are the same point.
3. Prove it survives the pipeline, not just the test: cold seed, warm-Redis
   application refresh, and reconciliation must all land the same shell.
   Add contracts for seeder composition order and for the seedId-keyed placement
   map so a resized shell is not silently reverted on the next deploy.
4. Add a 19-row contract asserting `interior footprint ⊆ building footprint`,
   `entrance == real door`, and centre delta ≈ 0. This is the regression guard
   that makes step 1 permanent.

**Phase 2 — give the simulation something solid**

5. Register the 178 manifest collision proxies as server-side collision at the
   audited world transform (boxes/proxies, not render-mesh triangles; remember
   the Blender `(W,D,H)` → native `(X,Y,Z)` reorder). Counter must be collidable
   with customer and staff provably on opposite sides.
6. Make the building shell itself server-authoritative for physics, or expose the
   shell as collision proxies the same way — otherwise A* keeps routing through
   walls.
7. Feed those proxies into the NPC navigation graph so queue/aisle routes avoid
   fixtures instead of relying on the protected-aisle rectangle alone.

**Phase 3 — close the locomotion defect**

8. Runtime-probe the surface for spawn, entrance, queue, customer, staff and
   departure points instead of shipping `originY + 1` verbatim; re-ground on
   drift, not only once at spawn.
9. Run the existing `GLITCH_FOCUSED_NATIVE_E2E_STACK=1` physics probe to a
   conclusion on one Ashline customer and record the walking-force/velocity trace
   in the issues log.
10. Per the issues log's own instruction: keep to the **Ashline smoke only** until
    entrance → queue → service → departure → safe off-screen despawn completes.

**Phase 4 — product**

11. Make the in-world spatial flow the front door: F at the counter starts the
    shift and hands control to the shift HUD; retire `CustomerMiniGamePane` as the
    primary customer surface and re-label the tab. Keep owner tabs.
12. Verify shift end resolves/cancels cleanly, restores movement, cleans temporary
    customers, and preserves authoritative outcomes.

**Phase 5 — matrices and evidence**

13. Split matrices A and B into 19 named rows each so failures batch and resume
    per business, and distribute the negative cases (incorrect / timeout /
    insufficient stock / payment) across the 19 rather than duplicating.
14. Build **one** immutable candidate only after source, assets, `.next` and
    `dist` are final; run all 19 browser rows serially against that exact image
    ID; retain per-business JSON + screenshots.
15. Focused revalidation of the original mini-game compatibility paths (race /
    Spleef / Deathmatch) that were newer than the tested image. Do not replay all
    74.

---

## 8. Honest completion estimate

| Area | Done |
| --- | --- |
| Blender assets + manifests + icons | 100% |
| Manifest→runtime contract, LOD rendering, furniture/Bikkie/inventory | ~95% |
| ECS session materializer, queue ordering, authority gating | ~85% |
| World geometry (building shells match interiors) | **0%** |
| Server-side collision for interiors and shells | **0%** |
| Customer locomotion actually working live | **0% observed** |
| Card→in-world product replacement | ~50% |
| A / B / C matrices green | 0 / 0 / 0 of 19 |

The expensive, crash-prone part (Blender) is finished and safe. The remaining
work is integration, and defect A is the keystone — the geometry mismatch is
very likely why customers are stalling outside a door that does not exist where
the manifest says it does, and it has to be fixed in the authored generators so
it holds through deploy and reconciliation.
