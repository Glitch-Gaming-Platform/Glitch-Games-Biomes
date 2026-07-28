// CHAPTER_1_ELSEWHEN_REGION
//
// Dungeon interiors live in a reserved world band that a player CANNOT REACH
// BY WALKING, SWIMMING, FLYING, BUILDING, OR WARPSTONE. The only way in is a
// Fracture Gate warp, and the only way out is the far anchor.
//
// This follows the established additive-region recipe in
// docs/harthmere/bibles/README-SNAPSHOT-MAP-LANDSCAPE-GUIDE.md §11 and the
// Harthmere precedent in world_extension.ts:
//
//   snapshot production terrain : X 0    .. 1792
//   Harthmere additive town     : X 1792 .. 2560   (authored 192..768, +1600)
//   VOID GAP (no terrain, ever) : X 2560 .. 2624
//   Elsewhen dungeon band       : X 2624 .. 3648
//
// The 64-block void gap is deliberate and load-bearing: there is no terrain
// shard between Harthmere's east edge and the first Elsewhen shard, so there
// is no surface to walk, no block to place against, and no chunk to stand on.
// Even a client with movement cheats has nothing to collide with. Combined
// with the server-side reachability guard below, the band is warp-only.
//
// Each dungeon gets its own 512-wide slot so two runs can never see each
// other's terrain, and so a third dungeon can be added in Chapter 2 without
// another metadata migration.

import type { Vec3 } from "@/shared/math/types";
import {
  HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X,
  HARTHMERE_EXTENSION_SHARD_SIZE,
} from "@/shared/harthmere/world_extension";

export const CH1_ELSEWHEN_REGION_VERSION =
  "ch1-elsewhen-region-v1" as const;

// ---------------------------------------------------------------------------
// Band geometry
// ---------------------------------------------------------------------------

/** No terrain is ever generated between these two X values. */
export const CH1_ELSEWHEN_VOID_GAP_BLOCKS = 64;

export const CH1_ELSEWHEN_BAND_START_X =
  HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X + CH1_ELSEWHEN_VOID_GAP_BLOCKS; // 2624

export const CH1_ELSEWHEN_SLOT_WIDTH_X = 512;
export const CH1_ELSEWHEN_SLOT_COUNT = 2;

export const CH1_ELSEWHEN_BAND_END_X =
  CH1_ELSEWHEN_BAND_START_X +
  CH1_ELSEWHEN_SLOT_WIDTH_X * CH1_ELSEWHEN_SLOT_COUNT; // 3648

/** Z profile is shared by every slot; Y is a normal walkable ground band. */
export const CH1_ELSEWHEN_BAND_MIN_Z = -512;
export const CH1_ELSEWHEN_BAND_MAX_Z = 512;
export const CH1_ELSEWHEN_GROUND_Y = 64;
export const CH1_ELSEWHEN_FEET_Y = CH1_ELSEWHEN_GROUND_Y + 1;
export const CH1_ELSEWHEN_BAND_MIN_Y = -64;
export const CH1_ELSEWHEN_BAND_MAX_Y = 192;

/**
 * Stable ECS identity grid for Elsewhen terrain. Disjoint from:
 *   8_810_000_000_030_000 .. 040_000  (retired sequential Harthmere terrain)
 *   8_810_000_001_000_000 .. 010_000  (current Harthmere extension terrain)
 */
export const CH1_ELSEWHEN_TERRAIN_ENTITY_ID_BASE = 8_810_000_002_000_000;
export const CH1_ELSEWHEN_TERRAIN_ENTITY_ID_LIMIT = 8_810_000_002_040_000;

export const CH1_ELSEWHEN_TERRAIN_ID_GRID = {
  minShardX: CH1_ELSEWHEN_BAND_START_X / HARTHMERE_EXTENSION_SHARD_SIZE, // 82
  maxShardX: CH1_ELSEWHEN_BAND_END_X / HARTHMERE_EXTENSION_SHARD_SIZE - 1, // 113
  minShardY: -2,
  maxShardY: 5,
  minShardZ: CH1_ELSEWHEN_BAND_MIN_Z / HARTHMERE_EXTENSION_SHARD_SIZE, // -16
  maxShardZ: CH1_ELSEWHEN_BAND_MAX_Z / HARTHMERE_EXTENSION_SHARD_SIZE - 1, // 15
} as const;

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

export interface Ch1ElsewhenSlot {
  dungeonId: string;
  slotIndex: number;
  minX: number;
  maxX: number;
  /** Where the entry portal deposits the player. */
  arrival: Vec3;
  /** Where the exit portal stands. Reaching it is the only way home. */
  departure: Vec3;
}

function slotBounds(index: number): { minX: number; maxX: number } {
  const minX = CH1_ELSEWHEN_BAND_START_X + index * CH1_ELSEWHEN_SLOT_WIDTH_X;
  return { minX, maxX: minX + CH1_ELSEWHEN_SLOT_WIDTH_X };
}

export const CH1_ELSEWHEN_SLOTS: readonly Ch1ElsewhenSlot[] = Object.freeze([
  {
    dungeonId: "ch1_dungeon_desert",
    slotIndex: 0,
    ...slotBounds(0),
    // Dune Threshold: the player arrives on a dune crest looking down at the
    // city, which is the whole reason zone 1 has no enemies.
    arrival: [
      slotBounds(0).minX + 48,
      CH1_ELSEWHEN_FEET_Y + 18,
      -320,
    ] as Vec3,
    // The Long Walk ends four hundred metres out on open flat.
    departure: [slotBounds(0).minX + 448, CH1_ELSEWHEN_FEET_Y, -320] as Vec3,
  },
  {
    dungeonId: "ch1_dungeon_winter",
    slotIndex: 1,
    ...slotBounds(1),
    // Ice Shelf Landing.
    arrival: [slotBounds(1).minX + 40, CH1_ELSEWHEN_FEET_Y, -352] as Vec3,
    // The Breaking Year ends back across the Whale Road.
    departure: [slotBounds(1).minX + 72, CH1_ELSEWHEN_FEET_Y, -336] as Vec3,
  },
]);

const SLOTS_BY_DUNGEON = new Map(
  CH1_ELSEWHEN_SLOTS.map((s) => [s.dungeonId, s])
);

export function ch1ElsewhenSlot(
  dungeonId: string
): Ch1ElsewhenSlot | undefined {
  return SLOTS_BY_DUNGEON.get(dungeonId);
}

// ---------------------------------------------------------------------------
// Reachability
// ---------------------------------------------------------------------------

export function isInsideCh1ElsewhenBand(position: {
  readonly [0]: number;
  readonly [2]: number;
}): boolean {
  const x = position[0];
  const z = position[2];
  return (
    x >= CH1_ELSEWHEN_BAND_START_X &&
    x < CH1_ELSEWHEN_BAND_END_X &&
    z >= CH1_ELSEWHEN_BAND_MIN_Z &&
    z < CH1_ELSEWHEN_BAND_MAX_Z
  );
}

/** True for the deliberately empty strip between Harthmere and Elsewhen. */
export function isInsideCh1VoidGap(position: { readonly [0]: number }): boolean {
  const x = position[0];
  return (
    x >= HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X && x < CH1_ELSEWHEN_BAND_START_X
  );
}

/**
 * The void gap and detached dungeon band are both portal-only space. Generic
 * movement and warp paths must reject both; only the signed fracture-gate
 * event is allowed to cross the ordinary world boundary.
 */
export function isInsideCh1PortalOnlyRegion(position: {
  readonly [0]: number;
  readonly [2]: number;
}): boolean {
  return isInsideCh1VoidGap(position) || isInsideCh1ElsewhenBand(position);
}

/** Detached dungeon terrain is immutable encounter geometry, not Gaia land. */
export function ch1GaiaManagesTerrainAt(position: {
  readonly [0]: number;
  readonly [2]: number;
}): boolean {
  return !isInsideCh1ElsewhenBand(position);
}

/** Repairs the retired v2 metadata expansion without cropping other worlds. */
export function ch1NormalizeOrdinaryWorldEastEdge(
  currentEastEdge: number
): number {
  return currentEastEdge === CH1_ELSEWHEN_BAND_END_X
    ? HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X
    : currentEastEdge;
}

export function ch1ElsewhenSlotAt(position: {
  readonly [0]: number;
  readonly [2]: number;
}): Ch1ElsewhenSlot | undefined {
  if (!isInsideCh1ElsewhenBand(position)) {
    return undefined;
  }
  return CH1_ELSEWHEN_SLOTS.find(
    (s) => position[0] >= s.minX && position[0] < s.maxX
  );
}

/**
 * Elsewhen is deliberately outside the ordinary WorldMetadata AABB. Physics
 * still needs a finite local boundary after a signed portal warp, so collision
 * resolves against the occupied slot instead of treating the entire dungeon
 * as the main world's positive-X wall.
 */
export function ch1DetachedWorldBoundsAt(position: {
  readonly [0]: number;
  readonly [2]: number;
}): { v0: Vec3; v1: Vec3 } | undefined {
  const slot = ch1ElsewhenSlotAt(position);
  if (!slot) return undefined;
  return {
    v0: [slot.minX, CH1_ELSEWHEN_BAND_MIN_Y, CH1_ELSEWHEN_BAND_MIN_Z],
    v1: [slot.maxX, CH1_ELSEWHEN_BAND_MAX_Y, CH1_ELSEWHEN_BAND_MAX_Z],
  };
}

export type Ch1ElsewhenAdmission =
  | { allowed: true; slot: Ch1ElsewhenSlot }
  | { allowed: false; reason: string };

/**
 * The server-side gate. A player may only occupy the Elsewhen band when they
 * have an ACTIVE run for the dungeon whose slot they are standing in.
 *
 * Anything else — a warpstone, a teleport exploit, a stale saved position, a
 * spectator, a party member who never entered — is rejected and evicted to the
 * Grove-side gate mouth. There is no "close enough" branch here on purpose.
 */
export function ch1AdmitToElsewhen(args: {
  position: Vec3;
  activeDungeonRunId?: string;
  isAdmin?: boolean;
}): Ch1ElsewhenAdmission {
  const slot = ch1ElsewhenSlotAt(args.position);
  if (!slot) {
    return {
      allowed: false,
      reason: isInsideCh1VoidGap(args.position)
        ? "position is inside the Elsewhen void gap, which has no terrain"
        : "position is not inside any Elsewhen dungeon slot",
    };
  }
  if (args.isAdmin) {
    return { allowed: true, slot };
  }
  if (!args.activeDungeonRunId) {
    return {
      allowed: false,
      reason: "no active dungeon run; Elsewhen is reachable only through a gate",
    };
  }
  if (args.activeDungeonRunId !== slot.dungeonId) {
    return {
      allowed: false,
      reason:
        `active run is ${args.activeDungeonRunId} but this slot belongs to ` +
        `${slot.dungeonId}`,
    };
  }
  return { allowed: true, slot };
}

/** Where an illegally-placed player is sent back to. */
export const CH1_ELSEWHEN_EVICTION_ANCHOR: Vec3 = [496, 71, -126];

// ---------------------------------------------------------------------------
// Terrain generation guard
// ---------------------------------------------------------------------------

/**
 * Gaia and the terrain seeder must never generate a shard inside the void gap.
 * If a shard ever appears there, the band stops being unreachable and the
 * dungeons stop being dungeons.
 */
export function ch1ShardMayGenerate(shardX: number): boolean {
  const minBlockX = shardX * HARTHMERE_EXTENSION_SHARD_SIZE;
  const maxBlockX = minBlockX + HARTHMERE_EXTENSION_SHARD_SIZE;
  const overlapsGap =
    maxBlockX > HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X &&
    minBlockX < CH1_ELSEWHEN_BAND_START_X;
  return !overlapsGap;
}

export function ch1ElsewhenTerrainEntityIdForShard(
  shardX: number,
  shardY: number,
  shardZ: number
): number | undefined {
  const g = CH1_ELSEWHEN_TERRAIN_ID_GRID;
  if (
    !Number.isInteger(shardX) ||
    !Number.isInteger(shardY) ||
    !Number.isInteger(shardZ) ||
    shardX < g.minShardX ||
    shardX > g.maxShardX ||
    shardY < g.minShardY ||
    shardY > g.maxShardY ||
    shardZ < g.minShardZ ||
    shardZ > g.maxShardZ
  ) {
    return undefined;
  }
  const spanY = g.maxShardY - g.minShardY + 1;
  const spanZ = g.maxShardZ - g.minShardZ + 1;
  const index =
    (shardX - g.minShardX) * spanY * spanZ +
    (shardY - g.minShardY) * spanZ +
    (shardZ - g.minShardZ);
  const id = CH1_ELSEWHEN_TERRAIN_ENTITY_ID_BASE + index;
  return id < CH1_ELSEWHEN_TERRAIN_ENTITY_ID_LIMIT ? id : undefined;
}

/** Structural validation, run by test. */
export function ch1ValidateElsewhenRegion(): string[] {
  const errors: string[] = [];
  if (CH1_ELSEWHEN_BAND_START_X <= HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X) {
    errors.push("Elsewhen band must start east of the Harthmere world edge");
  }
  if (CH1_ELSEWHEN_VOID_GAP_BLOCKS < HARTHMERE_EXTENSION_SHARD_SIZE) {
    errors.push(
      "void gap must be at least one full shard so no shard can bridge it"
    );
  }
  if (CH1_ELSEWHEN_BAND_START_X % HARTHMERE_EXTENSION_SHARD_SIZE !== 0) {
    errors.push("Elsewhen band start must be shard-aligned");
  }
  if (CH1_ELSEWHEN_SLOTS.length !== CH1_ELSEWHEN_SLOT_COUNT) {
    errors.push("slot table disagrees with CH1_ELSEWHEN_SLOT_COUNT");
  }
  const g = CH1_ELSEWHEN_TERRAIN_ID_GRID;
  const capacity =
    (g.maxShardX - g.minShardX + 1) *
    (g.maxShardY - g.minShardY + 1) *
    (g.maxShardZ - g.minShardZ + 1);
  if (
    CH1_ELSEWHEN_TERRAIN_ENTITY_ID_BASE + capacity >
    CH1_ELSEWHEN_TERRAIN_ENTITY_ID_LIMIT
  ) {
    errors.push(
      `terrain id grid needs ${capacity} ids but the reserved band holds ` +
        `${
          CH1_ELSEWHEN_TERRAIN_ENTITY_ID_LIMIT -
          CH1_ELSEWHEN_TERRAIN_ENTITY_ID_BASE
        }`
    );
  }
  for (const slot of CH1_ELSEWHEN_SLOTS) {
    for (const [name, pos] of [
      ["arrival", slot.arrival],
      ["departure", slot.departure],
    ] as const) {
      if (!isInsideCh1ElsewhenBand(pos)) {
        errors.push(`${slot.dungeonId}: ${name} is outside the Elsewhen band`);
      }
      if (pos[0] < slot.minX || pos[0] >= slot.maxX) {
        errors.push(`${slot.dungeonId}: ${name} is outside its own slot`);
      }
    }
  }
  return errors;
}
