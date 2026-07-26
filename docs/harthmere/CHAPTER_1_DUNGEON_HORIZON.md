# Chapter 1 — The Dungeon Horizon

The land you can see but never reach.

**Status:** implemented, 31 dedicated tests, 407 in the full Chapter 1 sweep.
**Constraint honoured:** no existing dungeon file was modified. Not
`ch1_dungeon_terrain.ts`, not `ch1_dungeon_decor.ts`, not `ch1_dungeons.ts`.

---

## The problem

Each dungeon ended where its authored rooms ended. That reads as a *set*, not a
*place* — the player walks the Salt Market and there is simply nothing past the
last wall. Nerash-Utu is supposed to be a city; Hrafnsfjörðr a settlement of
sixty people. Neither felt like one.

## The shape of the fix

Two new files, both additive:

| File | What |
| --- | --- |
| `src/shared/harthmere/ch1_dungeon_horizon.ts` | Boundary derivation, backdrop terrain, skyline buildings, collision slabs |
| `src/client/game/renderers/ch1_dungeon_horizon_boundary.ts` | The visible wall |

Plus one line at the seeder's call site (documented in `ch1SeederBlockAt`) and
one renderer registration.

---

## 1. Safety first — how it cannot break a finished dungeon

You asked me not to touch the dungeons. Three mechanisms enforce that, and all
three are tested:

**The boundary is derived, never hand-copied.** `ch1PlayableBounds()` computes
the box from `CH1_DUNGEON_TERRAIN` at runtime. If a room is ever added or moved,
the boundary follows it and the backdrop keeps its distance automatically. There
is no second copy of the dungeon's extents to drift out of sync.

**`ch1HorizonBlockAt()` returns `undefined` for anything inside the playable
box.** It is the first check in the function. The backdrop physically cannot
overwrite a room, a doorway, a stair, or a water basin.

**The seeder composition puts the dungeon first:**

```ts
const block =
  ch1DungeonBlockAt(dungeonId, x, y, z) ??   // dungeon always wins
  ch1HorizonBlockAt(dungeonId, x, y, z);     // backdrop fills the rest
```

Tests sample a spread through **every voxel band of every room** and assert the
horizon returns air; they also assert every authored decor prop is un-buried,
and that the dungeon's own `blockAt` output is byte-identical to before.

---

## 2. The boundary

### Collision — one AABB, not six walls

Borrowed directly from the world boundary. Instead of building wall geometry,
`ch1HorizonBoundarySlabs()` synthesises **one copy of the playable box shifted
by its own size** on whichever axis was crossed, and hands it to the ordinary
swept-AABB resolver:

```ts
if (lo[0] < min[0]) slabs.push(shifted([-w, 0, 0]));
if (lo[1] < min[1]) slabs.push(shifted([0, -h, 0]));
// ...six independent tests
```

From the solver's point of view the region beyond is a solid slab as deep as
the dungeon is wide — effectively infinite. Six comparisons, no geometry, no
memory. A corner produces two or three overlapping slabs and the existing
resolver handles it. There is a **ceiling and a floor**, not just walls.

Because it feeds the normal solver, every consumer inherits it without knowing
a boundary exists: player controller, camera (so a third-person camera cannot
slip outside and look back in), NPCs, placement previews, server physics.

### The visual

One `BoxGeometry`, `DoubleSide` (you are always inside it), `polygonOffset`
biased toward the camera so it cannot z-fight the ground it hugs.

- **RGB is constant; the pattern is opacity.** That is what makes it read as an
  energy field rather than wallpaper.
- **Quintic depth fade** — `pow(1 - d/40, 5)`. ~0.1% opacity at 30 m, 24% at
  10 m, 88% at 1 m. Invisible while you play, unmistakable as you approach.
- **Triplanar UVs** from the face's own tangent frame, so the pattern holds a
  constant real-world scale on a box hundreds of voxels across.
- **Culled** unless within 24 m of a face — inside the 40 m fade, so the box
  always pops in while still fully transparent. Tested.
- Disposed the moment the player leaves a run. The Grove never pays for it.

**Deliberate difference from the world edge:** that wall is violet because it is
a fact about the universe. A dungeon boundary is a fact about the *aperture* —
only so much of the past came through — so it is tinted from the gate's own
palette. Bronze for Nerash-Utu, pale blue for Hrafnsfjörðr. The wall visually
belongs to the portal that made it.

---

## 3. The land beyond

Techniques taken from the world-gen pipeline, in its own idioms:

**Named-seed noise.** Every layer is seeded by a *string* — `"nerash_utu_dunes"`,
`"hrafnsfjordr_walls"`, `"hrafnsfjordr_snowline"` — adler32-hashed, so each is
independently reproducible and tunable without disturbing the others.

**Weight vectors as art direction.** `ch1ExplicitNoise(period, weights)` lets the
vector say "lots of structure at 192, none at 96, a little at 48" — which
fractal falloff cannot express. The two eras get deliberately opposite
directions, and a test asserts they stay different:

| Era | Weights | Reads as |
| --- | --- | --- |
| Desert | `[14, 0, 5, 2, 0.6]`, amplitude 26 | Long dune ridges — strong low frequency, a gap, fine ripple |
| Winter | `[10, 8, 5, 2, 1, 0.5]`, amplitude 44 | Fjord walls — energy at every octave, climbing hard |

**Feathering.** Backdrop height is multiplied by `ch1LinearBoundary(distance,
featherRadius)`, so the land **rises from the boundary** instead of starting as
a cliff. A test asserts the ground is within 3 voxels of base level *at* the
wall and has climbed at least 4 by three feather-radii out. This is the single
trick that stops the horizon looking like a painted backdrop.

**Stratigraphic columns.** Surfaces are a stack of materials, not a skin block,
and which stack a column gets is chosen by a coherent field — so topsoil depth
varies *smoothly* across the landscape. A test walks 50 samples and fails if the
surface material changes more than 20 times, because that would be noise rather
than strata.

**Snow is a cap, never a drift.** Exactly three voxels over stone, above a noisy
snow line, matching the shipped `snow_peak` column. Tested, because a mountain
buried in snow reads as a different game.

---

## 4. The skyline

Nine buildings, all wholly beyond the boundary (tested per corner):

**Nerash-Utu** — upper city terraces (3 tiers), the **great ziggurat** over the
Sleeping Weight (5 tiers, height 30 — the one silhouette that must read from
anywhere), north granary row, south kilns, and a long far city wall that closes
the horizon so it reads as a *city* rather than scattered ruins.

**Hrafnsfjörðr** — six more longhouses, the **stave hall** (3 tiers, height 26 —
the one vertical in a horizontal landscape), boat sheds on the far shore holding
nine years of boats nobody can sail, and grave cairns on the headland nobody has
needed for nine years.

Tiered buildings **step**, they do not extrude. A ziggurat is five insetting
boxes, and a test proves it: high up, the centre is solid and the outer edge is
open sky.

---

## 5. Performance

- **No new streaming class.** The backdrop is ordinary terrain through the
  existing shard pipeline. `ch1HorizonAuthoredExtent()` bounds the seeder's work
  to three feather-radii plus the skyline, so empty shards are never generated.
- **One draw call** for the boundary, procedural shader, **zero texture memory**.
- **Zero cost outside a dungeon** — the renderer disposes its geometry the
  moment `activeDungeonRunId` goes undefined.
- Backdrop terrain is pure `stone` below the column depth. It is scenery: it
  does not need ore, caves, or strata nobody will ever mine.

---

## 6. Two bugs found on the way

**A backtick inside a GLSL template literal.** A shader *comment* containing
`` `normal.yzx` `` silently terminated the string, and swc reported "Expected a
semicolon" pointing at the next line of GLSL. There is now a guard-rail comment
above both shaders.

**Client imports in a shared test blow the fast typecheck budget.** The cull
maths originally lived in the renderer, so importing it dragged the whole client
graph into `tsconfig.ch1check.json` and pushed it past its 43 s budget. Moving
`ch1HorizonDistanceToNearestFace` and the fade constants into the shared module
fixed it — and they belong there anyway, being pure maths rather than rendering.

Also fixed while passing through: an unannotated `reduce` accumulator in
`harthmere_cloud_save_rehydration.ts` inferring `unknown` under strict mode.

---

## 7. Remaining integration

The data and logic layer is complete and tested. Two call sites remain, both
one-liners documented in the source:

1. **Seeder**: `ch1SeederBlockAt(...)` in the Elsewhen terrain loop.
2. **Collision**: fold `ch1HorizonBoundarySlabs()` into the collision helper
   alongside `intersectWorldBounds`, so player, camera, NPCs and server physics
   all inherit it identically. Client and server must run the same rule against
   the same box, or you get rubber-banding at the edge — the usual failure mode
   for world borders.
