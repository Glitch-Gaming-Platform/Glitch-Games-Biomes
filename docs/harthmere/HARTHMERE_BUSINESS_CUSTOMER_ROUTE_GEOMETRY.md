# Harthmere business customer route geometry

How a native NPC customer physically gets from outside a business to its service
counter, what can stop it, and the contracts that keep those things from coming
back.

This is the companion to `HARTHMERE_BUSINESS_INTERIOR_ASSET_PIPELINE.md` (which
owns the visual assets) and `HARTHMERE_BUSINESS_CUSTOMER_SIMULATION_ISSUES.md`
(which owns the live defect log). Read this one before changing any storefront
dressing, outpost decor, NPC post, or interior fixture.

## The one number that governs everything

A native Harthmere NPC body is **one metre wide**.

`LOCAL_DEV_HUMAN` has an authored collision size of `[1, 1.8, 1]`, and
`npcGroundTraversalProfile` returns it unchanged because the body is not
"oversized". One metre is also exactly one voxel. So:

> **A one-voxel gap is not a gap.** The swept AABB is face-coincident with the
> voxels either side, and any floating-point drift is an intersection.

Everything below follows from that.

### Why the pathfinder cannot be trusted to tell you

`AStarPathfinder` reasons about voxel **centres**. A one-voxel gap has a
perfectly good centre, so A* returns a valid route through it, repeatedly and
forever, for a body that can never fit. A refreshing path search timestamp
proves Anima owns the entity; it proves nothing about locomotion.

This cost the original investigation several live browser runs. Acceptance must
require changing authoritative **position**, not a changing path.

## The route

```
spawn (~9.5 m out, fanned)
  → approach lane      graded apron, 9 voxels wide
  → doorway            3 voxels at body height, jambs at doorX ± 2
  → protected aisle    manifest `protectedAisle`, keep-out for everything
  → queue slots        spaced along the aisle
  → customer point     opposite the staff point, across a collidable counter
  → departure          back out through the real door, despawn off-screen
```

Anchors come from `business_interior_runtime.ts`, which reads the audited
manifest. Nothing else may invent them.

## The three ways the route gets blocked

### 1. The doorway (fixed)

Owner: `business_customer_simulator.ts`, marker `HARTHMERE_BUSINESS_DOORWAY_WIDTH`.

The shell opens door columns; the storefront dressing pass used to re-wall
`doorX ± 1` at body height, leaving one traversable voxel. The opening is now
three voxels with the jambs pushed out to `doorX ± 2`, the header spanning the
whole opening above the body band, and an explicit **clear** of the body band
written last — because the edit stream is last-write-wins and a later dressing
pass must not be able to fill the door back in.

`buildingSystemDoorOpeningColumns` was widened to match for any blueprint that
can afford three columns; narrower blueprints still degrade to two and one.

### 2. The approach apron (fixed)

Owner: `business_customer_simulator.ts`, marker `HARTHMERE_BUSINESS_APPROACH_LANE`.

Exterior dressing is authored per business type, and several passes legitimately
place props across the shopfront — glass display columns at Glassyard, planting
beds at Southplot, porch framing at Westtrail. Each narrowed its own approach
below body width.

`addHarthmereOutpostCustomerApproachLane` runs **dead last**, after every
dressing, signature and grading pass. It grades a flat pad and clears the body
band across `doorX ± 4` for 12 voxels out. The half-width is not arbitrary: it is
sized to contain the authored spawn fan (`entrance.x ± 3.7`) and both departure
points (`entrance.x ± 3.4`), so no customer is ever created on raw hilly terrain
at an authored Y — the failure mode Harthmere has hit repeatedly with authored
creature seeding.

### 3. Persistent NPC posts (fixed)

Owner: `business_aisle_keep_out.ts`, marker `HARTHMERE_BUSINESS_AISLE_KEEP_OUT`.

A collidable one-metre NPC standing in a three-voxel doorway is, to physics,
a wall. The asset pipeline validated the protected aisle rigorously — but only
against *fixtures*. Nothing checked bodies. Two families were in the lane:

- **Shop owners.** `ownerPositionForSafeSite` placed all 19 at the footprint
  centre, which is the middle of the aisle. They now stand on the staff side of
  their own counter, which is better staging anyway.
- **Chapter 1 / Grove / additive-town NPCs**, authored in their own tables with
  no knowledge of which business shell they now stand inside. Ashline had two
  across its entrance.

The second family is handled generically at the seeding boundary rather than by
chasing every authoring table:
`applyHarthmereBusinessAisleKeepOutToSeedChanges` corrects posts **before they
are written**, in `shim/main.ts`. Correcting in place beats relocating
afterwards — the world never contains the obstruction, and a warm-Redis refresh
converges on the same state as a cold seed.

> **The trap:** `spawn_position` drives return-home and meander. An NPC moved by
> position alone walks straight back into the lane and the reconciliation looks
> like it silently failed. Both are always moved together.

Session-only business customers are exempt. They are *supposed* to be in the
aisle; that is the feature.

## Stall detection and re-grounding

Owner: `business_customer_tick.ts`.

Grounding used to happen once, at spawn, within four metres. That covered "the
authored spawn Y was wrong" and nothing else. A customer can also be shouldered
off the apron by the body behind it, or drift onto a column a voxel higher.

Progress is now tracked on the authoritative position on every moving phase. A
body that is **both** off its walking surface **and** has made no progress for
three seconds is re-seated onto the A* source voxel it is already standing over,
within 1.5 m. Both conditions are required so a customer stepping over a doorsill
is never teleported mid-stride, and the tolerance is one voxel so this can never
become the queue-node teleport the design forbids.


## Playing the shift: behind the counter, in character

Two rules make the shift a mini-game rather than a menu.

**The player must be on the staff side.** `harthmereBusinessPointIsStaffSide`
measures sidedness along the room's depth axis — every audited interior puts the
entrance at low local depth, the counter across the middle and the staff point
behind it. The four counter operations (start / serve / tick / end) require it
and reject with `economy_rejected:business_staff_side_required`.

Proximity alone was not enough: the 4.25 m radius around the counter is
satisfied just as well from the customer side, so a shift could be run from
inside the queue's own lane. The production HAR shows a Greenlamp shift started
from the side dashboard console at `(652, 65, -178)` rather than the audited
staff point at `(656.5, 65, -175)`.

Business *management* is deliberately not gated this way. Ledgers, storefront
and licences stay reachable from anywhere near the building.

**Service choices appear by talking to the customer.** The options are not a
panel; they are that customer's dialogue. `harthmereBusinessCustomerTalkState`
holds a registry keyed by entity id, published wholesale from the shift for
every waiting ticket, and `TalkToNPCScreen` branches on it before any quest or
ambient dialogue.

Every customer in the queue is registered, not only the one at the counter — a
queued customer talking about the weather instead of their own errand is the
defect this replaces. But `ready`, and therefore the presence of service
choices, stays restricted to the current ticket in phase `serving`, so a queued
customer is talkable in character without letting the player serve out of order.

> **The trap:** the registry used to be a single variable published by the
> projected customer card, which is proximity- and visibility-gated. Talking is
> not. When routing depends on module-level state, the contract has to cover the
> publisher's lifetime, not just the reader's logic.

## Contracts

| File | Rows | Proves |
| --- | --- | --- |
| `test/harthmere_business_route_clearance.test.ts` | 19 × 4 | A traversable corridor from approach to counter; door opening centred on the door axis; every route anchor standable; spawn and departure anchors on the graded apron. |
| `test/business_aisle_keep_out.test.ts` | 19 × 6 + sweep | Owner clear of its own aisle and inside its shell; route anchors and queue slots protected; lateral relocation works; collision proxies clear; a genuinely collidable counter between customer and staff. |
| `test/business_staff_side_shift.test.ts` | 19 x 5 | Staff point accepted; customer point, queue slots, entrance and spawn rejected; counter sits on the staff/customer boundary. |
| `__tests__/businessCustomerTalkState.test.ts` | registry | Whole queue talkable; offers only for the served ticket; stale entries dropped; per-card cleanup cannot return. |
| `test/business_customer_logic.test.ts` | behavioural | Stall detection, re-ground preconditions, one-voxel re-seat bound, serialization round trip. |
| `test/business_customer_session_ecs.test.ts` | 19 + cases | Customers carry every component `NpcSelector` needs, so Anima will actually simulate them. |

All of these are pure-data contracts over the **authored materialization plan** —
the same plan the seeder and any reconciliation replay consume. Green here means
the shipped world is traversable, not merely that a fixture was.

Per `TESTING_FASTER.md` they belong in the fast lane; the ECS rows need the
bootstrapped lane.

### Modelling notes for anyone extending the clearance checker

Two mistakes are easy and both produce confidently wrong results:

- **Last write wins.** Edits are a stream and dressing passes genuinely repaint
  voxels the shell already wrote. Treating "some edit touched this voxel" as
  "solid" reports phantom walls and misses restored ones.
- **A one-voxel step is walkable.** `maxStepHeight` is 1 for ordinary bodies, so
  porch decks, doorsills and graded pads are traversable. Ignoring that reports
  every raised porch in Harthmere as impassable and buries the real defects.
  Foot level is carried forward row by row along the route, and support above the
  reference level must be an authored solid voxel — otherwise the model floats
  bodies upward over open ground and calls walls walkable.

## Deployment and reconciliation

Every fix here lives in authored shared data or the authored generator, never in
a repair script. That is deliberate: a cold seed, a warm-Redis application
refresh, and a reconciliation replay must all converge on the same walkable
world. Two prior lessons make this non-negotiable — seeder composition order can
drop a later writer's work, and the seedId-keyed placement map can silently undo
a moved or resized structure.
