// CHAPTER_1_DUNGEON_INTERIOR_DECOR
//
// Runtime visual props for both dungeons.
//
// LAYER RULE (docs/harthmere/HARTHMERE_BUILDING_AND_DECORATION_DESIGN_GUIDE.md,
// "Interior furniture rules"):
//
//   "voxel terrain owns only the shell, floor, roof, stairs, doors, windows,
//    safe-ground pad, and tiny access anchors. Interior furniture and decor
//    should be runtime visual props using the shared GLTF/OBJ/FBX furniture
//    library, with non-blocking collision... Do not build counters, shelves,
//    beds, benches, workbenches, racks, storage, stock piles, or NPC
//    silhouettes out of terrain voxels; they read as raw blocks in play and
//    can trap customers or players."
//
// So: ch1_dungeon_terrain.ts builds the box; this file dresses it.
//
// EVERY ASSET BELOW ALREADY EXISTS in public/assets/harthmere/obj. Nothing here
// requires a new download. The packs were chosen for era fit:
//   church_cemetery -> catacomb walls, pillars, crypts, coffins, candelabra,
//                      skulls, bells. Reads as a Bronze Age temple undercroft
//                      and as a Norse grave-hall without modification.
//   tavern          -> kegs, shelves, tables, stools, torches, fireplace,
//                      tudor walls. Reads as a longhouse interior.
//   itch_voxel      -> barrels, crates, braziers, banners, torches, gravestones.
//   medieval_voxel  -> lamps, banners, carts, bridges.
//
// Support rule: every prop declares what holds it up. Nothing floats. A bottle
// belongs on a shelf, a crate on the floor, a lantern on a wall or beam.

import {
  CH1_DUNGEON_LOCAL_Z_ORIGIN,
  ch1DungeonTerrain,
  type Ch1AuthoredPos,
  type Ch1DungeonTerrainDef,
} from "@/shared/harthmere/ch1_dungeon_terrain";

export const CH1_DUNGEON_DECOR_VERSION = "ch1-dungeon-decor-v1" as const;

// ---------------------------------------------------------------------------
// MEMORY BUDGET
//
// Audited 2026-07-24: the 28 unique assets referenced below total ~968 KB on
// disk (obj+png / vox). The budget leaves headroom but keeps the ceiling low,
// because the correct memory strategy for dungeon interiors is:
//
//   * AUTHORING DATA (this file, terrain, quests) is plain data in the shared
//     bundle — a few tens of KB, negligible.
//   * MODEL FILES stay on disk/CDN and are fetched lazily by the client ONLY
//     when the player is inside the owning dungeon's Elsewhen slot. Nobody
//     pays for dungeon props while walking the Grove.
//   * MESHES ARE DISPOSED ON EXIT. A one-way dungeon has a hard exit event
//     (the far anchor warp) — that is the dispose hook. The renderer must not
//     keep desert geometry resident while the player is in the fjord.
//   * DUPLICATE PROPS SHARE GEOMETRY. Two `Torch_Long`s are one BufferGeometry
//     and two instances. The per-asset budget below counts unique assets.
//   * THE SERVER LOADS NONE OF THIS. Voxel terrain is the server's only
//     physical truth; props are client presentation (see collision config).
//
// ch1_dungeon_terrain adds zero asset memory: it seeds standard terrain
// blocks through the existing shard pipeline, which is already budgeted.
// ---------------------------------------------------------------------------

export const CH1_DUNGEON_DECOR_UNIQUE_ASSET_BUDGET_BYTES = 1_500_000;
export const CH1_DUNGEON_DECOR_MAX_UNIQUE_ASSETS = 40;

/**
 * Dungeon decor never blocks. The voxel shell owns collision; a prop that
 * blocks can trap an escorted NPC in a one-way space with no merchant, no rest
 * node, and no way back out.
 */
export const CH1_DUNGEON_DECOR_COLLISION = {
  category: "none",
  blocksNpc: false,
  blocksPlayer: false,
  blocksCamera: false,
  reason:
    "visual-only dungeon interior decor; the server voxel shell owns collision. " +
    "A blocking prop in a one-way dungeon with an escort is a soft-lock.",
} as const;

/** What physically holds a prop up. Enforced by test — nothing floats. */
export type Ch1DecorSupport =
  | "floor"
  | "wall"
  | "ceiling"
  | "on_furniture"
  | "water_surface";

export interface Ch1DecorProp {
  id: string;
  dungeonId: string;
  zoneId: string;
  /** Volume from ch1_dungeon_terrain that this prop stands in. */
  volume: string;
  asset: string;
  /** Asset pack directory under public/assets/harthmere/obj. */
  pack:
    | "church_cemetery"
    | "tavern"
    | "medieval_voxel"
    | "itch_voxel_asset_pack"
    | "town_sample";
  /**
   * Legacy slot-local position. X and Y already match terrain authored space,
   * but Z is the old 0..511 slot index (256 == centred Z 0). This registry
   * predates the centred terrain contract; convert it exactly once with
   * ch1DecorPositionToTerrainAuthored() before any world-space transform.
   */
  at: Ch1AuthoredPos;
  scale: number;
  rotationY?: number;
  support: Ch1DecorSupport;
  /** Emits light. Dungeons are dark and this is the only lighting they get. */
  light?: { intensity: number; colour: string };
  note?: string;
}

/**
 * Convert the decor registry's legacy slot-index Z into the canonical centred
 * dungeon coordinate used by terrain, quests, cutscenes, and portals.
 *
 * This helper is intentionally unconditional. Guessing from the sign would
 * allow a bad negative value to be silently double-shifted and would make the
 * same prop render differently as data crosses zero. Validation below keeps
 * every registry Z inside 0..511 instead.
 */
export function ch1DecorPositionToTerrainAuthored(
  at: Ch1AuthoredPos
): Ch1AuthoredPos {
  return {
    x: at.x,
    y: at.y,
    z: CH1_DUNGEON_LOCAL_Z_ORIGIN + at.z,
  };
}

// ---------------------------------------------------------------------------
// Dungeon 1 — The Sand That Remembers
// ---------------------------------------------------------------------------

const DESERT_DECOR: readonly Ch1DecorProp[] = [
  // --- Salt Market: a bazaar abandoned mid-trade -------------------------
  {
    id: "d1_market_stall_a",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z2_salt_market",
    volume: "salt_market",
    asset: "Market Stall",
    pack: "itch_voxel_asset_pack",
    at: { x: 154, y: 3, z: 200 },
    scale: 0.9,
    support: "floor",
    note: "Meals still on tables. The city left six weeks ago and took nothing.",
  },
  {
    id: "d1_market_stall_b",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z2_salt_market",
    volume: "salt_market",
    asset: "Market_Stall_2x_L",
    pack: "itch_voxel_asset_pack",
    at: { x: 196, y: 3, z: 214 },
    scale: 0.9,
    rotationY: Math.PI / 2,
    support: "floor",
  },
  {
    id: "d1_market_crates",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z2_salt_market",
    volume: "salt_market",
    asset: "Crates_Multiple",
    pack: "itch_voxel_asset_pack",
    at: { x: 156, y: 3, z: 186 },
    scale: 0.85,
    support: "floor",
  },
  {
    id: "d1_market_brazier",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z2_salt_market",
    volume: "salt_market",
    asset: "Fire",
    pack: "itch_voxel_asset_pack",
    at: { x: 176, y: 3, z: 212 },
    scale: 0.8,
    support: "floor",
    light: { intensity: 0.9, colour: "#ffb066" },
    note: "Still burning. Nobody has been here to put it out.",
  },

  // --- Cistern: wet stone, failing light ---------------------------------
  {
    id: "d1_cistern_pillar_a",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z3_cistern_stair",
    volume: "cistern_main",
    asset: "church-6-cata_pilalrs",
    pack: "church_cemetery",
    at: { x: 240, y: -21, z: 188 },
    scale: 1.0,
    support: "floor",
  },
  {
    id: "d1_cistern_pillar_b",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z3_cistern_stair",
    volume: "cistern_main",
    asset: "church-5-catac_pillarsbroken",
    pack: "church_cemetery",
    at: { x: 260, y: -21, z: 200 },
    scale: 1.0,
    support: "floor",
    note: "Broken. The cistern has been failing for a long time.",
  },
  {
    id: "d1_cistern_torch",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z3_cistern_stair",
    volume: "cistern_main",
    asset: "Torch_Long",
    pack: "itch_voxel_asset_pack",
    at: { x: 226, y: -19, z: 194 },
    scale: 0.75,
    support: "wall",
    light: { intensity: 0.7, colour: "#ffa54f" },
  },

  // --- Hall of Weights: the metrology room -------------------------------
  {
    id: "d1_weights_table",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z4_hall_of_weights",
    volume: "hall_of_weights",
    asset: "tavern-48-table",
    pack: "tavern",
    at: { x: 296, y: -21, z: 200 },
    scale: 0.9,
    support: "floor",
    note: "The balance beam sits on this. The puzzle's interaction anchor.",
  },
  {
    id: "d1_weights_shelf",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z4_hall_of_weights",
    volume: "hall_of_weights",
    asset: "tavern-32-shelf_empty",
    pack: "tavern",
    at: { x: 296, y: -21, z: 190 },
    scale: 0.85,
    support: "wall",
  },
  {
    id: "d1_weights_reference_masses",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z4_hall_of_weights",
    volume: "hall_of_weights",
    asset: "tavern-7-plate",
    pack: "tavern",
    at: { x: 296, y: -20, z: 200 },
    scale: 0.4,
    support: "on_furniture",
    note: "Sits ON the table. Reference weights, laid out in order.",
  },
  {
    id: "d1_weights_candelabra",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z4_hall_of_weights",
    volume: "hall_of_weights",
    asset: "church-38-candelabrawhite",
    pack: "church_cemetery",
    at: { x: 310, y: -21, z: 204 },
    scale: 0.9,
    support: "floor",
    light: { intensity: 0.6, colour: "#ffd9a0" },
  },

  // --- Sun Court: the guardian's arena -----------------------------------
  {
    id: "d1_sun_court_pillar_a",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z5_sun_court",
    volume: "sun_court",
    asset: "church-77-gargoylepillar",
    pack: "church_cemetery",
    at: { x: 328, y: -21, z: 188 },
    scale: 1.1,
    support: "floor",
    note: "Charge-breaking cover. The Bull's horns come off on these.",
  },
  {
    id: "d1_sun_court_pillar_b",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z5_sun_court",
    volume: "sun_court",
    asset: "church-77-gargoylepillar",
    pack: "church_cemetery",
    at: { x: 328, y: -21, z: 212 },
    scale: 1.1,
    support: "floor",
  },
  {
    id: "d1_sun_court_brazier",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z5_sun_court",
    volume: "sun_court",
    asset: "Fire",
    pack: "itch_voxel_asset_pack",
    at: { x: 340, y: -21, z: 188 },
    scale: 0.85,
    support: "floor",
    light: { intensity: 0.75, colour: "#ffb066" },
    note: "The Bull patrols around this. It is the only thing lighting the arena.",
  },
  {
    id: "d1_exit_stair_lantern",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z7_the_long_walk",
    volume: "vault_exit_stair",
    asset: "church-59-lantern",
    pack: "church_cemetery",
    at: { x: 410, y: -19, z: 200 },
    scale: 0.7,
    support: "wall",
    light: { intensity: 0.6, colour: "#ffe8b0" },
    note: "The climb out. Twenty-two blocks of stair in the dark otherwise.",
  },
  {
    id: "d1_sun_court_pillar_c",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z5_sun_court",
    volume: "sun_court",
    asset: "church-78-stonepillarfallen",
    pack: "church_cemetery",
    at: { x: 352, y: -21, z: 200 },
    scale: 1.1,
    support: "floor",
  },

  // --- Seed Vault: full, because they left without their future ----------
  {
    id: "d1_vault_shelf_a",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z6_seed_vault",
    volume: "seed_vault",
    asset: "tavern-34-bookshelf_misc",
    pack: "tavern",
    at: { x: 372, y: -21, z: 192 },
    scale: 0.9,
    support: "wall",
    note: "The seed library. Catalogued and indexed by a civilisation that ran.",
  },
  {
    id: "d1_vault_grain_sacks",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z6_seed_vault",
    volume: "seed_vault",
    asset: "Crates_Multiple",
    pack: "itch_voxel_asset_pack",
    at: { x: 388, y: -21, z: 200 },
    scale: 0.9,
    support: "floor",
    note: "Iris's nest is against these. Keep a clear 3-voxel approach.",
  },
  {
    id: "d1_vault_lantern",
    dungeonId: "ch1_dungeon_desert",
    zoneId: "d1_z6_seed_vault",
    volume: "seed_vault",
    asset: "church-35-lanternglass",
    pack: "church_cemetery",
    at: { x: 384, y: -21, z: 196 },
    scale: 0.7,
    support: "floor",
    light: { intensity: 0.8, colour: "#fff0c0" },
    note: "The only warm light in the dungeon. She has been keeping it lit.",
  },
];

// ---------------------------------------------------------------------------
// Dungeon 2 — The Long Winter Mouth
// ---------------------------------------------------------------------------

const WINTER_DECOR: readonly Ch1DecorProp[] = [
  {
    id: "d2_descent_shaft_lantern",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z1_ice_shelf_landing",
    volume: "landing_descent_shaft",
    asset: "Torch_Long",
    pack: "itch_voxel_asset_pack",
    at: { x: 72, y: -8, z: 168 },
    scale: 0.75,
    support: "wall",
    light: { intensity: 0.6, colour: "#ffa54f" },
    note: "Somebody lit this on the way down. Nine years ago.",
  },
  {
    id: "d2_climb_shaft_lantern",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z3_hanged_wood",
    volume: "underice_climb_shaft",
    asset: "Torch_Long",
    pack: "itch_voxel_asset_pack",
    at: { x: 140, y: -8, z: 168 },
    scale: 0.75,
    support: "wall",
    light: { intensity: 0.6, colour: "#ffa54f" },
  },

  // --- Drowned Longhouse: flooded and frozen mid-meal ---------------------
  {
    id: "d2_longhouse_table",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z2_drowned_longhouse",
    volume: "drowned_longhouse",
    asset: "tavern-48-table",
    pack: "tavern",
    at: { x: 96, y: -11, z: 168 },
    scale: 0.95,
    support: "floor",
    note: "Navigated from below, so this reads as the CEILING on the way in.",
  },
  {
    id: "d2_longhouse_stool",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z2_drowned_longhouse",
    volume: "drowned_longhouse",
    asset: "tavern-47-stool",
    pack: "tavern",
    at: { x: 100, y: -11, z: 164 },
    scale: 0.9,
    support: "floor",
  },
  {
    id: "d2_longhouse_keg",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z2_drowned_longhouse",
    volume: "drowned_longhouse",
    asset: "tavern-18-keg",
    pack: "tavern",
    at: { x: 112, y: -11, z: 176 },
    scale: 0.85,
    support: "floor",
  },
  {
    id: "d2_longhouse_hnefatafl",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z2_drowned_longhouse",
    volume: "drowned_longhouse",
    asset: "tavern-7-plate",
    pack: "tavern",
    at: { x: 96, y: -10, z: 168 },
    scale: 0.35,
    support: "on_furniture",
    note: "The board with a piece missing. Carry the piece to Sorrel and she smiles once.",
  },

  {
    id: "d2_longhouse_lantern",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z2_drowned_longhouse",
    volume: "drowned_longhouse",
    asset: "church-35-lanternglass",
    pack: "church_cemetery",
    at: { x: 120, y: -9, z: 160 },
    scale: 0.7,
    support: "wall",
    light: { intensity: 0.5, colour: "#9fc8e8" },
    note: "Frozen mid-burn. Cold blue, not warm — this hall is not a refuge.",
  },

  // --- Hanged Wood: the horror zone. Nothing is explained. ---------------
  {
    id: "d2_wood_gravestone_a",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z3_hanged_wood",
    volume: "hanged_wood",
    asset: "Gravestone_1Weathered",
    pack: "itch_voxel_asset_pack",
    at: { x: 148, y: 1, z: 148 },
    scale: 0.9,
    support: "floor",
    note: "Not Norse. Not Muck. No era at all. Never explained in Chapter 1.",
  },
  {
    id: "d2_wood_gravestone_b",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z3_hanged_wood",
    volume: "hanged_wood",
    asset: "Gravestone_3Weathered",
    pack: "itch_voxel_asset_pack",
    at: { x: 180, y: 1, z: 180 },
    scale: 0.9,
    support: "floor",
  },
  {
    id: "d2_wood_skullpile",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z3_hanged_wood",
    volume: "hanged_wood",
    asset: "church-51-skullpile",
    pack: "church_cemetery",
    at: { x: 164, y: 1, z: 164 },
    scale: 0.8,
    support: "floor",
  },

  // --- Sorrel's Camp: four months of survival engineering ----------------
  {
    id: "d2_camp_fire",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z5_sorrels_camp",
    volume: "sorrels_camp",
    asset: "Fire",
    pack: "itch_voxel_asset_pack",
    at: { x: 306, y: 1, z: 168 },
    scale: 0.8,
    support: "floor",
    light: { intensity: 1.0, colour: "#ffb066" },
    note: "The first warmth in ninety minutes of play. Make it count.",
  },
  {
    id: "d2_camp_workbench",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z5_sorrels_camp",
    volume: "sorrels_camp",
    asset: "tavern-25-bar",
    pack: "tavern",
    at: { x: 300, y: 1, z: 162 },
    scale: 0.85,
    support: "floor",
    note: "Her charcoal notation wall runs above this. Most beautiful set dressing in the chapter.",
  },
  {
    id: "d2_camp_shelf",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z5_sorrels_camp",
    volume: "sorrels_camp",
    asset: "tavern-33-shelf_meat",
    pack: "tavern",
    at: { x: 316, y: 1, z: 162 },
    scale: 0.85,
    support: "wall",
    note: "Four months of dried fish. She is not glad to see the last of it.",
  },
  {
    id: "d2_camp_lantern",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z5_sorrels_camp",
    volume: "sorrels_camp",
    asset: "Lamp_Wall",
    pack: "medieval_voxel",
    at: { x: 310, y: 3, z: 158 },
    scale: 0.7,
    support: "wall",
    light: { intensity: 0.7, colour: "#ffe0a0" },
  },

  // --- Ash Hall: nine years of the same evening --------------------------
  {
    id: "d2_ash_hall_fireplace",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z6_ash_hall",
    volume: "ash_hall",
    asset: "tavern-61-fireplace",
    pack: "tavern",
    at: { x: 400, y: 1, z: 168 },
    scale: 1.1,
    support: "floor",
    light: { intensity: 0.45, colour: "#c86a3c" },
    note: "Phase 1 is fought around this. The player feeds it their own carried fuel.",
  },
  {
    id: "d2_ash_hall_long_table",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z6_ash_hall",
    volume: "ash_hall",
    asset: "tavern-48-table",
    pack: "tavern",
    at: { x: 380, y: 1, z: 168 },
    scale: 1.2,
    support: "floor",
    note: "Set for a meal that has been about to happen for nine years.",
  },
  {
    id: "d2_ash_hall_bench_a",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z6_ash_hall",
    volume: "ash_hall",
    asset: "church-65-ch_bench",
    pack: "church_cemetery",
    at: { x: 380, y: 1, z: 160 },
    scale: 1.0,
    support: "floor",
  },
  {
    id: "d2_ash_hall_bench_b",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z6_ash_hall",
    volume: "ash_hall",
    asset: "church-65-ch_bench",
    pack: "church_cemetery",
    at: { x: 380, y: 1, z: 176 },
    scale: 1.0,
    support: "floor",
  },
  {
    id: "d2_ash_hall_banner",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z6_ash_hall",
    volume: "ash_hall",
    asset: "Simple_Banner_Red",
    pack: "medieval_voxel",
    at: { x: 372, y: 6, z: 150 },
    scale: 1.0,
    support: "wall",
  },
  {
    id: "d2_ash_hall_bell",
    dungeonId: "ch1_dungeon_winter",
    zoneId: "d2_z6_ash_hall",
    volume: "ash_hall",
    asset: "church-80-churchbells",
    pack: "church_cemetery",
    at: { x: 408, y: 10, z: 168 },
    scale: 0.9,
    support: "ceiling",
    note: "Rings on its own at the start of phase 2, when the day resets.",
  },
];

export const CH1_DUNGEON_DECOR: readonly Ch1DecorProp[] = Object.freeze([
  ...DESERT_DECOR,
  ...WINTER_DECOR,
]);

export function ch1DecorForDungeon(
  dungeonId: string
): readonly Ch1DecorProp[] {
  return CH1_DUNGEON_DECOR.filter((p) => p.dungeonId === dungeonId);
}

export function ch1DecorForZone(zoneId: string): readonly Ch1DecorProp[] {
  return CH1_DUNGEON_DECOR.filter((p) => p.zoneId === zoneId);
}

/** Public URL for a prop's model, matching the existing asset layout. */
export function ch1DecorAssetUrl(prop: Ch1DecorProp): string {
  const ext = prop.pack === "itch_voxel_asset_pack" ? "vox" : "obj";
  const root =
    prop.pack === "itch_voxel_asset_pack"
      ? "/assets/harthmere/vox/props/itch_voxel_asset_pack"
      : `/assets/harthmere/obj/${prop.pack}`;
  return `${root}/${prop.asset}.${ext}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Props that would be a soft-lock or a visual bug in a one-way dungeon:
 *   * floating (no support)
 *   * outside the volume they claim to be in
 *   * standing in a doorway
 *   * a merchant or rest node, which dungeons do not have
 */
const FORBIDDEN_PROP_PATTERNS = [
  /\bshop\b/i,
  /\bstall_vendor\b/i,
  /\bbed\b/i,
  /\bcampfire_rest\b/i,
  /\banvil\b/i,
];

export function ch1ValidateDungeonDecor(): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const prop of CH1_DUNGEON_DECOR) {
    if (seenIds.has(prop.id)) {
      errors.push(`${prop.id}: duplicate prop id`);
    }
    seenIds.add(prop.id);

    const terrain = ch1DungeonTerrain(prop.dungeonId);
    if (!terrain) {
      errors.push(`${prop.id}: unknown dungeon "${prop.dungeonId}"`);
      continue;
    }
    const volume = terrain.volumes.find((v) => v.name === prop.volume);
    if (!volume) {
      errors.push(`${prop.id}: unknown volume "${prop.volume}"`);
      continue;
    }
    if (volume.zoneId !== prop.zoneId) {
      errors.push(
        `${prop.id}: zone "${prop.zoneId}" disagrees with volume "${prop.volume}" ` +
          `(zone ${volume.zoneId})`
      );
    }

    // Decor Z is a legacy slot index by contract. Reject centred/negative or
    // overflowing values here rather than guessing and risking a double
    // transform at runtime.
    if (!Number.isFinite(prop.at.z) || prop.at.z < 0 || prop.at.z > 511) {
      errors.push(
        `${prop.id}: decor z=${prop.at.z} must be a legacy slot index in 0..511`
      );
    }

    // Inside the volume, and off the walls so it does not clip the shell.
    const localZ = ch1DecorPositionToTerrainAuthored(prop.at).z;
    if (
      prop.at.x <= volume.x0 ||
      prop.at.x >= volume.x1 ||
      localZ <= volume.z0 ||
      localZ >= volume.z1
    ) {
      errors.push(
        `${prop.id}: at (${prop.at.x}, ${localZ}) is outside or inside the wall ` +
          `of "${volume.name}" (${volume.x0}..${volume.x1}, ${volume.z0}..${volume.z1})`
      );
    }

    // Vertical: nothing below the floor or above the ceiling.
    if (prop.at.y <= volume.y0) {
      errors.push(
        `${prop.id}: y=${prop.at.y} is at or below the floor slab of ` +
          `"${volume.name}" (floor ${volume.y0}) — it would sink into terrain`
      );
    }
    if (prop.at.y > volume.y1) {
      errors.push(
        `${prop.id}: y=${prop.at.y} is above the ceiling of "${volume.name}"`
      );
    }

    // Support: nothing floats.
    if (prop.support === "floor" && prop.at.y !== volume.y0 + 1) {
      errors.push(
        `${prop.id}: declares floor support but sits at y=${prop.at.y}; the ` +
          `floor of "${volume.name}" is walkable at y=${volume.y0 + 1}`
      );
    }
    if (prop.support === "ceiling" && prop.at.y < volume.y1 - 8) {
      errors.push(
        `${prop.id}: declares ceiling support but hangs ${
          volume.y1 - prop.at.y
        } below it`
      );
    }
    if (prop.support === "on_furniture") {
      const hasHost = CH1_DUNGEON_DECOR.some(
        (other) =>
          other.id !== prop.id &&
          other.volume === prop.volume &&
          other.support === "floor" &&
          Math.abs(other.at.x - prop.at.x) <= 2 &&
          Math.abs(other.at.z - prop.at.z) <= 2 &&
          other.at.y < prop.at.y
      );
      if (!hasHost) {
        errors.push(
          `${prop.id}: declares on_furniture support but there is no ` +
            `floor-standing prop beneath it — it would float`
        );
      }
    }

    // Doorways stay clear.
    for (const cut of terrain.cuts) {
      const clearance = Math.max(3, Math.floor(cut.width / 2) + 2);
      const near =
        Math.abs(prop.at.x - cut.x) <= clearance &&
        Math.abs(localZ - cut.z) <= clearance;
      if (near) {
        errors.push(
          `${prop.id}: stands within ${clearance} voxels of doorway ` +
            `"${cut.name}" — it blocks the only route through a one-way dungeon`
        );
      }
    }

    // No merchants, no rest.
    for (const pattern of FORBIDDEN_PROP_PATTERNS) {
      if (pattern.test(prop.asset)) {
        errors.push(
          `${prop.id}: asset "${prop.asset}" reads as a merchant or rest node; ` +
            `dungeons have neither`
        );
      }
    }

    if (prop.scale <= 0 || prop.scale > 2) {
      errors.push(`${prop.id}: implausible scale ${prop.scale}`);
    }
  }

  // Every zone with an interior should have at least one light, or the player
  // is navigating a black box on carried torches alone.
  const litZones = new Set(
    CH1_DUNGEON_DECOR.filter((p) => p.light).map((p) => p.zoneId)
  );
  for (const terrain of [
    ch1DungeonTerrain("ch1_dungeon_desert"),
    ch1DungeonTerrain("ch1_dungeon_winter"),
  ].filter(Boolean) as Ch1DungeonTerrainDef[]) {
    const enclosedZones = new Set(
      terrain.volumes.filter((v) => !v.openAir).map((v) => v.zoneId)
    );
    for (const zoneId of enclosedZones) {
      if (!litZones.has(zoneId)) {
        errors.push(
          `${terrain.dungeonId}/${zoneId}: enclosed zone has no light source prop`
        );
      }
    }
  }

  return errors;
}
