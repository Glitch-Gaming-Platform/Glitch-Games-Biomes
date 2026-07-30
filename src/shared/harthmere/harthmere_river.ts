// HARTHMERE_RIVER
//
// The Brell — Harthmere's river, and the water in it.
//
// WHY THIS EXISTS
// -----------------------------------------------------------------------
// Harthmere has been written as a river town from the beginning and had no
// river. The evidence was all over the world already:
//
//   * a stone bridge with parapets authored at X 586..612, Z -212..-200, with
//     "the center remains open" — a bridge over nothing;
//   * a road segment literally commented "East river road across the bridge
//     into Briarfen";
//   * `river_dock_supply` (574..602, -196..-176) and `dock_warehouse`
//     (574..600, -170..-150) sitting on a dry bank;
//   * a `bridgeGateGap` cut through the east town wall so the road can reach
//     the bridge;
//   * "Thornbridge Crossing" up in the north-west;
//   * and NPC dialogue about the toll bridge, the Bridge Tax Riot, and "the
//     Brell ferry line — we have run this stretch of river since before the
//     bridge was hers".
//
// What existed instead was, in the wilds surface generator:
//
//     // Briarfen and river extension to the east/south-east.
//     if (worldX > 630 && worldZ > -360 && worldZ < 180) {
//       if (hash % 17 === 0) return materials.water;
//
// — a 1-in-17 scatter of single voxels across a 150 x 540 rectangle. And
// `materials.water` is `terrainId("water", terrainId("blue_wool", stone))`.
// There is no water *block* in Biomes at all (see the world-anatomy doc §5.1:
// water is a separate `ShardWater` field, not a terrain id), so that lookup
// fell through to its fallback and painted the Briarfen with **speckled blue
// wool**. Not water: not swimmable, not fishable, not flowable, and not even
// visually continuous.
//
// This module authors the real thing.
//
// HOW IT WORKS
// -----------------------------------------------------------------------
// Same shape as `harthmere_wilds_forest.ts`: a pure function of position with
// no allocation in the hot path, no global pass, and no dependency on the
// terrain registry — so it unit-tests in milliseconds and the seeder can call
// it per voxel.
//
// Following the world-anatomy doc:
//   * §5.1/§5.3 — water is a `ShardWater` value, not a block. Level 15 is a
//     source and never depletes, which is exactly the semantics an authored
//     river wants: `harthmereRiverWaterAt` returns the source level and Gaia's
//     `WaterSimulation` then owns spread, falling and player edits.
//   * §5.2 — the original map's oceans are authored tensors rather than
//     generated. This river is authored for the same reason: the additive
//     extension is a deliberately flat plane, so there is no basin for a
//     flood-fill to find.
//   * §5.4 — the channel is a parabolic cross-section, not a trench, so the
//     water-surface mesher's per-vertex height averaging gives a shore that
//     shelves instead of ending in a one-voxel cliff.
//   * §1.6 — the bed is a stratigraphic column (sand over gravel), not a
//     single skin block.
//
// The terrain around it stays perfectly flat: this module only ever *removes*
// ground inside the channel and puts a bed at the bottom. It never raises
// anything, so every existing assumption about `HARTHMERE_EXTENSION_GROUND_Y`
// outside the channel still holds.
//
// All coordinates here are AUTHORED (the seeder converts world -> authored
// before calling), matching `harthmere_wilds_forest.ts` and the rest of the
// town generators.

export const HARTHMERE_RIVER_VERSION = "harthmere-river-v1" as const;

/** Bed/bank materials, keyed by `localDevMaterials()` names like the forest. */
export type HarthmereRiverMaterial =
  | "sand"
  | "gravel"
  | "moss"
  | "oakLumber"
  | "stoneBrick";

// ---------------------------------------------------------------------------
// Course
// ---------------------------------------------------------------------------

/**
 * The Brell, north-east wilds to the southern Briarfen, as a polyline of
 * authored [x, z] nodes.
 *
 * Every node was chosen against the world that already exists, and
 * `harthmere_river.test.ts` re-asserts all of it:
 *
 *   * it passes UNDER the authored east bridge — the channel occupies X
 *     600..612 at the crossing, entirely within the 586..612 deck, so the
 *     bridge finally spans something;
 *   * it runs past the east face of `river_dock_supply` and `dock_warehouse`
 *     with the bank ~5 voxels clear of both, so the docks front onto water
 *     without the channel eating them;
 *   * it swings east around `edrik_vane_noble_rise_estate` (586..622,
 *     -276..-248) rather than through it;
 *   * it never enters the walled town rect (392..590, -282..-112);
 *   * it clears all 57 authored buildings entirely.
 *
 * It crosses exactly three roads. One is the east bridge, already decked. The
 * other two get plank crossings from this module — see
 * HARTHMERE_RIVER_TRAIL_CROSSINGS. No route across the map is severed.
 */
export const HARTHMERE_RIVER_COURSE: readonly (readonly [number, number])[] = [
  [664, -470],
  [652, -404],
  [644, -344],
  [638, -288],
  [634, -248],
  [604, -214],
  [607, -202],
  [616, -184],
  [626, -154],
  [638, -116],
  [652, -78],
  [668, -38],
  [686, 4],
  [704, 48],
  [716, 98],
  [726, 152],
  [732, 204],
] as const;

/**
 * Half-width of the carved channel, banks included.
 *
 * 6 gives a 13-voxel river. That is wide enough to read as a river from the
 * bridge and to cast into comfortably, and narrow enough to fit inside the
 * 27-voxel bridge deck and to clear the dock buildings. Widening this without
 * re-running the clearance test would put the channel through
 * `river_dock_supply`.
 */
export const HARTHMERE_RIVER_HALF_WIDTH = 6;

/**
 * Water voxels at the centre of the channel.
 *
 * `SHALLOW_WATER = 3` in `src/shared/loot_tables/predicates.ts`, so a river
 * shallower than four would only ever roll the shallow-water fish table. Five
 * puts the main channel in `isNormalDepthWater` while the shelving banks still
 * pass through the shallow band, so both tables are reachable from one bank.
 * `DEEP_WATER = 16` is deliberately NOT reached — deep-water species belong to
 * the original map's ocean.
 */
export const HARTHMERE_RIVER_CENTRE_WATER_DEPTH = 5;

/**
 * Deepest carve anywhere, water column plus the bed voxel under it.
 *
 * The seeder uses this to skip the water pass for shards that cannot possibly
 * hold any of the river, and the test pins it against the actual profile.
 */
export const HARTHMERE_RIVER_MAX_CARVE_DEPTH =
  HARTHMERE_RIVER_CENTRE_WATER_DEPTH + 1;

/**
 * The Briarfen mill pool: the wide, still water at the south end.
 *
 * A river you can only fish from a 13-voxel channel is fiddly. This is the
 * dedicated fishing hole the quest-side content can point at, out in the open
 * Briarfen where nothing else is authored.
 */
export const HARTHMERE_RIVER_POOL_CENTRE: readonly [number, number] = [710, 74];
export const HARTHMERE_RIVER_POOL_RADIUS = 19;

/**
 * Road segments the river crosses that are NOT the authored east bridge.
 *
 * Transcribed from `isHarthmereWideWildsRoad` in the shim. Kept here as data so
 * this module can deck its own crossings without importing the shim, and so
 * the test can prove every crossing is decked.
 */
export const HARTHMERE_RIVER_TRAIL_CROSSINGS: readonly {
  readonly label: string;
  readonly segment: readonly [number, number, number, number];
}[] = [
  // North-east wetland trail: [590, -250] -> [X1 - 110, Z0 + 120].
  { label: "wetland_trail", segment: [590, -250, 790, -440] },
  // South-east gravewood lane: [560, -112] -> [X1 - 130, Z1 - 130].
  { label: "gravewood_lane", segment: [560, -112, 770, 130] },
] as const;

/** Half-width of a plank crossing, matching the roads' own 4-voxel width. */
export const HARTHMERE_RIVER_CROSSING_HALF_WIDTH = 5;

/**
 * The authored east bridge deck. The river must not carve this, and the test
 * asserts the channel passes fully beneath it.
 */
export const HARTHMERE_RIVER_EAST_BRIDGE_DECK = {
  x0: 586,
  x1: 612,
  z0: -212,
  z1: -200,
} as const;

/**
 * Extra clearance the forest must keep off the water.
 *
 * Fishing's `inOpen` predicate requires `skyOcclusion <= CAVE_OCCLUSION_THRESHOLD`
 * (8), and every fish the Fish Food quest asks for is gated on it. A canopy
 * reaching over the channel would shade the water and quietly make those
 * species unrollable. `HARTHMERE_FOREST_MAX_CANOPY_RADIUS` is 5, so a 5-voxel
 * margin guarantees no leaf can overhang. It also keeps trunks out of the
 * water, which would otherwise decay anyway once Gaia found no soil beneath.
 */
export const HARTHMERE_RIVER_FOREST_MARGIN = 5;

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

function distanceToSegment2D(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t =
    len2 === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2)
        );
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

/** Distance from an authored column to the river centreline, pool included. */
export function harthmereRiverCentrelineDistance(
  authoredX: number,
  authoredZ: number
): number {
  let best = Infinity;
  for (let i = 0; i + 1 < HARTHMERE_RIVER_COURSE.length; i += 1) {
    const [ax, az] = HARTHMERE_RIVER_COURSE[i];
    const [bx, bz] = HARTHMERE_RIVER_COURSE[i + 1];
    const d = distanceToSegment2D(authoredX, authoredZ, ax, az, bx, bz);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Distance into the pool disc, expressed on the same scale as the channel.
 *
 * Inside the disc the radius is rescaled onto the channel's half-width, so one
 * cross-section formula shapes both and the pool joins the river without a
 * seam. OUTSIDE the disc it keeps growing at 1:1 rather than jumping to
 * infinity — that continuity is load-bearing, because
 * `harthmereRiverExcludesVegetation` measures its canopy margin on this same
 * scale. A discontinuity here would let a tree stand one voxel past the pool
 * edge and shade the water.
 */
function poolChannelDistance(authoredX: number, authoredZ: number): number {
  const d = Math.hypot(
    authoredX - HARTHMERE_RIVER_POOL_CENTRE[0],
    authoredZ - HARTHMERE_RIVER_POOL_CENTRE[1]
  );
  if (d > HARTHMERE_RIVER_POOL_RADIUS) {
    return HARTHMERE_RIVER_HALF_WIDTH + (d - HARTHMERE_RIVER_POOL_RADIUS);
  }
  return (d / HARTHMERE_RIVER_POOL_RADIUS) * HARTHMERE_RIVER_HALF_WIDTH;
}

function channelDistance(authoredX: number, authoredZ: number): number {
  return Math.min(
    harthmereRiverCentrelineDistance(authoredX, authoredZ),
    poolChannelDistance(authoredX, authoredZ)
  );
}

/**
 * Depth of the carve at this column, in voxels below the flat ground plane.
 *
 * Parabolic, so the bed rises toward the banks. Doc §5.4: the water mesher
 * averages levels per vertex and tapers to nothing where a neighbour is air,
 * so a shelving bed produces a shoreline that shelves rather than a wall of
 * water. 0 means "not in the channel".
 */
export function harthmereRiverCarveDepthAt(
  authoredX: number,
  authoredZ: number
): number {
  const d = channelDistance(authoredX, authoredZ);
  if (d > HARTHMERE_RIVER_HALF_WIDTH) return 0;
  const t = d / HARTHMERE_RIVER_HALF_WIDTH;
  // +1 for the bed voxel itself, so the centre holds
  // HARTHMERE_RIVER_CENTRE_WATER_DEPTH water voxels above its bed.
  const depth = Math.round(
    (HARTHMERE_RIVER_CENTRE_WATER_DEPTH + 1) * (1 - t * t)
  );
  return Math.max(0, depth);
}

/** True anywhere the river owns the column, banks included. */
export function harthmereRiverContains(
  authoredX: number,
  authoredZ: number
): boolean {
  return harthmereRiverCarveDepthAt(authoredX, authoredZ) > 0;
}

/**
 * True where a tree, undergrowth or ground-cover voxel must not be placed.
 *
 * Wider than the channel by HARTHMERE_RIVER_FOREST_MARGIN — see that constant
 * for why the sky above the water has to stay open.
 */
export function harthmereRiverExcludesVegetation(
  authoredX: number,
  authoredZ: number
): boolean {
  return (
    channelDistance(authoredX, authoredZ) <=
    HARTHMERE_RIVER_HALF_WIDTH + HARTHMERE_RIVER_FOREST_MARGIN
  );
}

// ---------------------------------------------------------------------------
// Crossings
// ---------------------------------------------------------------------------

function onTrailCrossing(authoredX: number, authoredZ: number): boolean {
  for (const { segment } of HARTHMERE_RIVER_TRAIL_CROSSINGS) {
    const [ax, az, bx, bz] = segment;
    if (
      distanceToSegment2D(authoredX, authoredZ, ax, az, bx, bz) <=
      HARTHMERE_RIVER_CROSSING_HALF_WIDTH
    ) {
      return true;
    }
  }
  return false;
}

function onEastBridgeDeck(authoredX: number, authoredZ: number): boolean {
  return (
    authoredX >= HARTHMERE_RIVER_EAST_BRIDGE_DECK.x0 &&
    authoredX <= HARTHMERE_RIVER_EAST_BRIDGE_DECK.x1 &&
    authoredZ >= HARTHMERE_RIVER_EAST_BRIDGE_DECK.z0 &&
    authoredZ <= HARTHMERE_RIVER_EAST_BRIDGE_DECK.z1
  );
}

/**
 * Plank deck for a wilds trail crossing the river, at ground level.
 *
 * The doc's own rule for the forest applies here too: a feature this size must
 * not sever a route across the map. The east bridge is already authored by the
 * shim, so this only decks the two trail crossings.
 */
export function harthmereRiverCrossingDeckAt(
  authoredX: number,
  relY: number,
  authoredZ: number
): HarthmereRiverMaterial | undefined {
  if (relY !== 0) return undefined;
  if (!harthmereRiverContains(authoredX, authoredZ)) return undefined;
  if (!onTrailCrossing(authoredX, authoredZ)) return undefined;
  // A plank run with stone abutments where it meets the bank.
  return harthmereRiverCarveDepthAt(authoredX, authoredZ) <= 2
    ? "stoneBrick"
    : "oakLumber";
}

// ---------------------------------------------------------------------------
// Voxels
// ---------------------------------------------------------------------------

/**
 * True where the seeder must leave AIR instead of ground.
 *
 * Covers relY 0 (so grass does not cap the river) down to one voxel above the
 * bed. The authored east bridge deck and this module's own plank crossings are
 * excluded — you walk over them, and the water still runs underneath.
 */
export function harthmereRiverCarvesAirAt(
  authoredX: number,
  relY: number,
  authoredZ: number
): boolean {
  const depth = harthmereRiverCarveDepthAt(authoredX, authoredZ);
  if (depth <= 0) return false;
  if (relY > 0 || relY <= -depth) return false;
  if (relY === 0) {
    if (onEastBridgeDeck(authoredX, authoredZ)) return false;
    if (onTrailCrossing(authoredX, authoredZ)) return false;
  }
  return true;
}

/**
 * Bed material at the bottom of the channel.
 *
 * Doc §1.6: surfaces are stratigraphic columns, not one skin block. Sand in
 * the shallows and along the shore, gravel in the scoured centre, with a
 * little moss where the current is slowest at the very edge.
 */
export function harthmereRiverBedMaterialAt(
  authoredX: number,
  relY: number,
  authoredZ: number
): HarthmereRiverMaterial | undefined {
  const depth = harthmereRiverCarveDepthAt(authoredX, authoredZ);
  if (depth <= 0 || relY !== -depth) return undefined;
  if (depth >= HARTHMERE_RIVER_CENTRE_WATER_DEPTH) return "gravel";
  return depth <= 1 ? "moss" : "sand";
}

/**
 * Water source level for a voxel, or 0.
 *
 * Doc §5.3: 15 is a source and never depletes, so an authored river stays a
 * river. Gaia's `WaterSimulation` still owns spread, falling water, and the
 * player's bucket; this only sets the at-rest body.
 *
 * The surface sits at relY = -1, one voxel below the bank top, which is what
 * makes the bank read as a bank rather than the water reading as a floor.
 */
export function harthmereRiverWaterLevelAt(
  authoredX: number,
  relY: number,
  authoredZ: number
): number {
  const depth = harthmereRiverCarveDepthAt(authoredX, authoredZ);
  if (depth <= 0) return 0;
  if (relY > -1 || relY <= -depth) return 0;
  return 15;
}

/** Water voxels above the bed at this column — what `marchWaterDepth` sees. */
export function harthmereRiverWaterDepthAt(
  authoredX: number,
  authoredZ: number
): number {
  const depth = harthmereRiverCarveDepthAt(authoredX, authoredZ);
  return depth <= 0 ? 0 : Math.max(0, depth - 1);
}

// ---------------------------------------------------------------------------
// Shard coverage
// ---------------------------------------------------------------------------

/** Authored bounding box of everything this module writes, plus a margin. */
export function harthmereRiverAuthoredBounds(margin = 0) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of HARTHMERE_RIVER_COURSE) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  minX = Math.min(minX, HARTHMERE_RIVER_POOL_CENTRE[0] - HARTHMERE_RIVER_POOL_RADIUS);
  maxX = Math.max(maxX, HARTHMERE_RIVER_POOL_CENTRE[0] + HARTHMERE_RIVER_POOL_RADIUS);
  minZ = Math.min(minZ, HARTHMERE_RIVER_POOL_CENTRE[1] - HARTHMERE_RIVER_POOL_RADIUS);
  maxZ = Math.max(maxZ, HARTHMERE_RIVER_POOL_CENTRE[1] + HARTHMERE_RIVER_POOL_RADIUS);
  const pad = HARTHMERE_RIVER_HALF_WIDTH + margin;
  return {
    minX: minX - pad,
    maxX: maxX + pad,
    minZ: minZ - pad,
    maxZ: maxZ + pad,
  };
}

/**
 * Cheap per-shard early-out for the seeder's water pass.
 *
 * Takes the shard's AUTHORED X/Z span so the caller does the world->authored
 * transform once per shard rather than once per voxel.
 */
export function harthmereRiverTouchesAuthoredSpan(
  authoredX0: number,
  authoredX1: number,
  authoredZ0: number,
  authoredZ1: number
): boolean {
  const b = harthmereRiverAuthoredBounds();
  return !(
    authoredX1 < b.minX ||
    authoredX0 > b.maxX ||
    authoredZ1 < b.minZ ||
    authoredZ0 > b.maxZ
  );
}
