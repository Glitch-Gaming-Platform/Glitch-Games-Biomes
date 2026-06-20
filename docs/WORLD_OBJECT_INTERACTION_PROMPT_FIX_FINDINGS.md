# World-Object Interaction Prompt — Investigation & Fix

_Devin's report: NPCs show an "F Talk" toaster and the Jobs Board shows "F Jobs Board",
but crates, chests, boxes, etc. show their floating name label yet **no** interaction
prompt. Only the Jobs Board works._

## How the systems are wired

There are **three separate** prompt systems in play:

1. **NPC talk** — `getInspectableOverlay()` in `src/client/game/scripts/overlays.ts`.
   When the cursor ray hits an entity with `npc_metadata`, it returns an `npc`
   overlay → `NpcOverlayComponent` → the `F Talk` shortcut.

2. **Jobs Board** — a **bespoke** HUD system
   (`HarthmereUnifiedHUD` → `nearestHarthmereJobsBoardPhysicalPrompt`) that draws
   its own proximity prompt from its **own** position table. This is why it is the only
   thing that works — it does **not** depend on the generic object-inspection path.

3. **Generic world objects** (crates/chests/boards/...) — added recently in commit
   `8b33fd5e "Fixing world object and API"`:
   `getNearbyHarthmereObjectInspectableOverlay()` builds a `harthmere_object` overlay,
   resolved to an interaction by label via `harthmereObjectInteractionForLabel()`
   (`src/shared/harthmere/object_interaction_semantics.ts`). The label→interaction
   logic is correct and unit-tested
   (`harthmere_world_object_inspectable.test.ts`).

## Root cause

The generic system only ever sees a **static, hard-coded candidate list**.
`harthmereWorldObjectInspectCandidates()` builds candidates **exclusively** from two
source-code landmark tables:

- `SNAPSHOT_GROVE_LANDMARKS`
- `GROVE_ECONOMY_STARTER_LANDMARKS`

Hand-authored props that happen to be in those tables (e.g. `Road Kit Crate`,
`First-Aid Bin`) can resolve. But the **live world objects** the player actually runs
into are **not** in any source table. Confirmed from the live `dump.rdb`:
`Chest The Grove Underwater <variant>` exists as a **real persisted ECS entity with a
`label` component** (no dialogue text, unlike NPCs), and the labels `Clothing Crate` /
`Chest The Grove Underwater Main` appear **only** in the semantics map — never in a
landmark table.

So the candidate list never contains them → the proximity selector returns nothing →
no toaster.

Worse, in `getInspectableOverlay()` the cursor-ray **entity** branch only returns a
usable overlay for `player` / `robot` / `npc_metadata` / `placeable_component &&
placed_by`. A **seeded** container (a `placeable_component` with **no** `placed_by`, i.e.
not placed by a player) matches none of those, so the directly-hit chest falls straight
through to the static-list fallback and produces nothing — even though we are literally
pointing at it and already hold the entity (with its label) in hand.

## Fix (data-driven, not hard-coded)

Make the prompt come from the **actual world objects present**, keyed on the entity's
`label`/`entity_description` (the same gate the semantics already use), instead of a
hand-maintained list.

**Part A — direct cursor hit** (`getInspectableOverlay`, entity branch):
if the hit entity's label marks it a non-living world object, build a `harthmere_object`
overlay straight from that entity (real `entityId`, label, description, position). Ordered
so genuine NPCs (non-object labels) and genuine player-placed placeables keep their
existing rich overlays; objects mis-bridged as `npc_metadata` are also caught.

**Part B — proximity fallback** (`getNearbyHarthmereObjectInspectableOverlay`):
also scan the live ECS table (`PlaceableSelector`, `NpcMetadataSelector`,
`NamedQuestGiverSelector`) within range for entities whose label is a world object, and
merge them with the static candidates. This makes the toaster appear when you are *near*
an object (matching NPC-talk behaviour) and carries the real `entityId` through so each
container de-dupes per instance. Player-placed placeables (`placed_by`) are skipped here
so their richer aimed overlay still wins.

**Part C — overlay component** (`CursorInspectionOverlayComponent.tsx`):
use the overlay's real `entityId` for the interaction (static beacons still pass
`INVALID_BIOMES_ID`, so their behaviour is unchanged).

The label→interaction resolver already maps every requested item class (containers open,
doors open, signs read, cookpots cook, gather/repair/practice/...), so once an object is a
**candidate**, it automatically gets the right action.

## Files changed

- `src/client/game/scripts/overlays.ts`
  - Direct-hit branch of `getInspectableOverlay()`: NPC branch now excludes object-
    labeled entities; added `harthmereWorldObjectOverlayForEntity()` returned before
    the static fallback.
  - `getNearbyHarthmereObjectInspectableOverlay()` now merges static landmark
    candidates with live ECS candidates from
    `harthmereLiveWorldObjectInspectCandidates()` (scans `PlaceableSelector`,
    `NpcMetadataSelector`, `NamedQuestGiverSelector`) and threads the real entityId.
- `src/client/components/overlays/inspected/CursorInspectionOverlayComponent.tsx`
  - Uses the overlay's real `entityId` for the interaction (static beacons still pass
    `INVALID_BIOMES_ID`).
- `src/shared/harthmere/test/harthmere_world_object_live_candidate.test.ts` — new
  regression tests using the exact in-game labels.

## Verification

- `harthmere_world_object_live_candidate.test.ts` + existing
  `harthmere_world_object_inspectable.test.ts`: **12 passing**.
- `scripts/harthmere/check-road-ahead-object-container-regression.cjs`: **passed**.
- Single-file strict semantic type-check (skipLibCheck, full resolved import graph) of
  both changed client files: **0 diagnostics**.

## Ground truth used

Confirmed against the live `dump.rdb` (today's world): `Chest The Grove Underwater
<variant>` is a persisted ECS entity carrying a `label` (no dialogue, unlike NPC
`Jackie` which carries `<text>...`), and is absent from every static landmark table —
exactly the class of object the fix now surfaces.

## CORRECTION (double-check against live prod redis) — the real root cause

The original analysis above was **wrong about what the reported objects are**, and
the first fix therefore **did not touch them**. Verified by decoding prod redis
(`20.127.78.175:6379`, 335k entities) with the project's own serde
(`deserializeRedisEntityState` + `LazyEntity`):

`"Clothing Crate"` (id `5165478204703095`) and `"Chest The Grove Underwater Main"`
(id `4149747832010135`) — the exact screenshot labels — are **placed placeables**:

```
components: collideable, created_by, default_dialog, label, locked_in_place,
            orientation, picture_frame_contents, placeable_component, placed_by,
            position, quest_giver, size
placeable_component.item_id = <a picture-frame item>   placed_by = <player, 2023>
container_inventory = NONE
```

So they are **picture-frame placeables** carrying a `quest_giver` + a world-object
`label` — **not** label-only seeded entities, and **not** real storage containers.
A full keyspace scan found **14 of 17** chest/crate-labeled objects are
`placeable_component + placed_by` (frame placeables), 1 is npc-bridged
(`King's Chest`), 2 are position-less junk.

Why the first fix missed them entirely:
- **Direct cursor hit:** `entity.placeable_component && entity.placed_by` returns the
  `placeable` overlay *before* the new world-object code runs. `OverlayView` then
  routes a frame item to `FramePlaceableOverlayComponent` (a "Like" prompt) —
  never a container/engagement prompt.
- **Proximity scan:** `harthmereLiveWorldObjectInspectCandidates` explicitly
  **skipped** every `placeable_component && placed_by` entity.

The synthetic "Open Container" itself does **not** need `container_inventory`:
`openHarthmereObjectContainer` is a client-side, label+entityId-keyed loot system
(`harthmereContainerLootForLabel` + localStorage). So the label-driven design is
intentional and viable for these frame placeables — the only missing piece was
surfacing the prompt for the placed-placeable class.

### Corrected fix (V199)

Route the **authored** placed-placeable class to the world-object prompt in both
paths (`isAuthoredHarthmereWorldObjectPlaceable`), gated so player builds are
untouched:
- must carry a `quest_giver` (authored-content marker — player storage chests/decor
  don't), **and**
- the placeable item must have **no interactive overlay of its own**
  (`placeableItemHasOwnInteractiveOverlay`: not container/door/sign/shop/crafting/
  outfit/mailbox/media). Frames and flagless placeables qualify; real player
  containers/doors/signs keep their native overlay.

- Direct-hit `placeable` branch now excludes that class → it falls through to
  `harthmereWorldObjectOverlayForEntity`.
- Proximity scan no longer skips that class → they become candidates.

### Residual risk / must verify in-world

- These props also carry `quest_giver` + `default_dialog`. They never had a working
  Talk (no `npc_metadata`), so adding the container/engagement prompt is a net gain,
  **but** if a quest expects the player to "talk" to one to advance, confirm the
  open-container event still satisfies it.
- The new client routing (raycast-hit + table scan over `OverlayScript`) is **not**
  unit-tested (ECS/React-coupled, per repo convention). Verified by type-check
  (0 new errors; total stays at the 15-error baseline) + the pure-logic unit tests.
  **A live in-world smoke test is still required** to confirm the raycast resolves
  these placeables and the toaster appears.

## Note for QA

`az`/Azure CLI is not available in this workspace and production Redis is not reachable
from here, so this was validated against the local `dump.rdb`, the unit/regression tests,
and type-checking. Recommend a quick in-world smoke test: walk up to a chest, crate, bin,
sign, door, and cookpot and confirm each shows its `F` toaster with the correct verb.
