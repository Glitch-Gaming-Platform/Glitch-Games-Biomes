# Harthmere Town Horizon — the back country

The additive town of Harthmere sits on dead-flat ground and, until now, ended
in nothing. This layer gives it a **back**: a boundary the player cannot cross
and, behind it, terrain and buildings that imply a much larger kingdom.

It is the same idea as [the dungeon horizon](./CHAPTER_1_DUNGEON_HORIZON.md),
with one deliberate and important difference: **the dungeon gets a box, Harthmere
gets a single wall.**

---

## The rule that governs everything here

> **Only the back side is closed. Harthmere must stay reachable.**

Harthmere is an *additive* town: authored X `192..768`, shifted `+1600` into the
world's east extension, so it occupies world X `1792..2368`.

The player arrives from the **west** — the connector road enters at world X
`1792`, exactly the old/new map boundary, and runs east to the west gate. North
and south are the town's own authored approaches.

That leaves **east** as the only true back side. Walling any other side would
sever the town from the main world and turn every quest inside it into dead
content. This is not a stylistic preference; it is a correctness property, and
it has its own tests:

```
src/shared/harthmere/test/harthmere_town_horizon.test.ts
  ✓ never blocks the connector road from the main world
  ✓ leaves the whole town walkable, west gate to east content edge
  ✓ does not wall the north, south, or west approaches
  ✓ writes no backdrop voxel anywhere in the town
```

If you ever change the geometry, those four tests are the ones that matter.

---

## Layout, in authored X

```
  192 ─────────────── 768   778            956   960
   │      the town      │    │  back country │     │
   west gate       last bldg │               │  world edge
   (open, road in)           │               │  (engine's own
                        BACK WALL       backdrop ends    purple boundary)
```

| Constant | Authored X | World X | Meaning |
|---|---|---|---|
| `HARTHMERE_TOWN_EAST_CONTENT_X` | 768 | 2368 | last authored building |
| `HARTHMERE_TOWN_BACK_BOUNDARY_X` | 778 | 2378 | the wall (10 blocks of breathing room) |
| `HARTHMERE_TOWN_BACKDROP_END_X` | 956 | 2556 | scenery stops here |
| `HARTHMERE_TOWN_WORLD_EDGE_AUTHORED_X` | 960 | 2560 | engine world edge |

The backdrop deliberately stops **4 blocks short** of the world edge. Two
boundary walls in the same plane would z-fight and read as a rendering bug, and
the engine's own violet boundary should stay the outermost thing in frame.

---

## Why this particular landscape

Harthmere sits on the largest antimatter deposit on Earth and **refuses to mine
it**. So the back country is the land they will not open. Reading near to far:

| Band | Distance behind wall | Amplitude | Column | What it says |
|---|---|---|---|---|
| `terraced_farms` | 0–56 | 12 | soil / dirt / stone | the town feeds itself |
| `the_workings` | 56–132 | 34 | gravel / stone / **coal** | industry — but sealed |
| `the_deposit_range` | 132–178 | 86 | stone / **ironOre** | the reason for the war |

Six buildings punctuate it, including a `border_keep` (height 46, four tiers)
that watches the deposits, and two **sealed shaft heads** — the visual thesis of
the whole town. The player stands at the wall, looks at the cause of the war,
and cannot walk to it.

Palette discipline: no sand, no Exotic Matter glow. Stone, timber, coal, worked
earth. Snow is a strict 3-voxel `whiteWool` cap above +62, exactly as the
shipped world does it (`HARTHMERE_HORIZON_SNOW.depth === 3`, tested).

Rising ground behind a flat town is the cheapest possible way to make it feel
*sited* rather than stamped.

---

## The three pieces

### 1. Collision — `harthmereTownBackBoundarySlabs(entityAabb)`

One comparison, one slab. The dungeon version synthesises up to six because a
dungeon is a closed box; five sixths of that work is deleted here because five
sixths of the walls do not exist.

```ts
if (hi[0] <= boundaryWorldX) return [];   // still in town — nothing to do
```

The returned slab spans the full extension Z range, runs from Y −64 to well
above the wall top, and extends 256 blocks past the world edge, so the player
can neither jump it, tunnel under it, nor squeeze between it and the engine
boundary. It is handed to the ordinary swept-AABB resolver — no new physics.

### 2. Terrain — `harthmereHorizonBlockAt` / `harthmereTownSeederBlockAt`

Pure functions of `(authoredX, worldY, worldZ)`. They return `undefined` for
anything in or west of the town, which is what makes property #1 above provable
by brute force rather than by inspection.

`harthmereTownSeederBlockAt` composes them with the town's own generator, and
**the town always wins** — the backdrop can never overwrite authored content.

### 3. Visual — `src/client/game/renderers/harthmere_town_back_boundary.ts`

A single `PlaneGeometry` rotated `rotation.y = Math.PI / 2` to face west.

- **RGB constant, pattern as alpha.** Reads as a field, not as wallpaper.
- **Quintic depth fade**, `pow(1 - d/40, 5)` — invisible until you are nearly
  touching it.
- **UVs from world Z and Y**, not the plane's own UVs, which would stretch
  horribly across a wall hundreds of voxels wide.
- **Proximity culled at 26**, well inside the 40-block fade, so it can never
  pop in while opaque. Geometry and material are disposed the moment the player
  leaves — the Grove pays nothing for Harthmere's wall.

**Tint is iron-grey `[0.62, 0.66, 0.72]`, on purpose.** The dungeon walls borrow
their aperture's Exotic Matter palette because they are time-bleed edges.
Harthmere's back wall is a *political border*. Harthmere would find a glowing
barrier obscene.

---

## Engine contract

Nothing here is an ECS entity. No Gaia simulation, no Anima NPCs, no terrain
mutation, no collision ownership. The renderer draws a mesh; the shared module
returns numbers. That is the entire footprint.

---

## Files

| File | Role |
|---|---|
| `src/shared/harthmere/harthmere_horizon_noise.ts` | primitives shared with the dungeon horizon |
| `src/shared/harthmere/harthmere_town_horizon.ts` | geometry, bands, buildings, collision, cull maths |
| `src/client/game/renderers/harthmere_town_back_boundary.ts` | the wall mesh |
| `src/shared/harthmere/test/harthmere_town_horizon.test.ts` | 27 tests |

| `tsconfig.harthmerewall.json` | narrowest config that typechecks the renderer alone |

**Typechecking.** `node_modules/.bin/tsc -p tsconfig.ch1check.json` covers the
shared module and its tests in ~1 s — run it on every edit. The renderer imports
`ClientResources` and so drags in most of the client; it is covered by
`tsconfig.ch1renderer.json` (alongside the other Chapter 1 renderers) or, on its
own, by `tsconfig.harthmerewall.json`. Both take minutes on a cold run and are
merge-gate checks, not edit-loop checks.

> **Note on where code lives:** the fade/draw constants and
> `harthmereBackWallDistance()` sit in the *shared* module, not the renderer,
> even though only the renderer uses them. They are pure maths, and keeping them
> out of the client graph is what lets the cull contract be tested in ~1 s.
