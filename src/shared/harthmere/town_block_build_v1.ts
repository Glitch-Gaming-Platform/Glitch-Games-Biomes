// HARTHMERE_TOWN_BLOCK_BUILD_V1
// Shared, pure contract for block-built (Minecraft-style stone/ore block)
// town and dungeon buildings. The renderer consumes these rules; tests verify
// the renderer follows them. No THREE/runtime imports — keep this importable
// from server, client, and Node test scripts.
//
// MMO Rules referenced:
//   §7  Building Placement Rules (foundation, no float, no clip, no road block)
//   §8  Building Accessibility Rules (entrance reachable, interior valid)
//   §9  Building Categories (residential / commercial / crafting / defensive / utility)
//   §11 Building Construction Stages (foundation → frame → walls → roof → interior)
//   §55 Building and NPC Pathing
//   §56 Building and Player Movement (front door 2m clear, shop 4m, etc.)
//   §57 Building Placement Edge Cases
//
// Bible references: §III.1–III.10 NPC residences and §II quest spaces.

export const HARTHMERE_TOWN_BLOCK_BUILD_VERSION_V1 = "harthmere-town-block-build-v1" as const;

/** A wall block is 1 meter wide and ~storyHeight tall when stacked. */
export const HARTHMERE_BLOCK_TILE_METERS_V1 = 1.0 as const;

/** Tolerated drift between adjacent blocks. Beyond this is a "gap" (FAIL). */
export const HARTHMERE_BLOCK_MAX_GAP_METERS_V1 = 1.2 as const;

/** Default story height for ordinary buildings (per V43 service code). */
export const HARTHMERE_STORY_HEIGHT_DEFAULT_V1 = 2.7 as const;

/** Tall story for chapels / great halls (per V43 service code). */
export const HARTHMERE_STORY_HEIGHT_TALL_V1 = 3.05 as const;

/** Front-door clearance required by MMO Rules §56. */
export const HARTHMERE_FRONT_DOOR_CLEARANCE_METERS_V1 = 2.0 as const;

/** Public-building entrance clearance required by MMO Rules §56. */
export const HARTHMERE_PUBLIC_ENTRANCE_CLEARANCE_METERS_V1 = 3.0 as const;

/** Shop customer space required by MMO Rules §56. */
export const HARTHMERE_SHOP_CUSTOMER_SPACE_METERS_V1 = 4.0 as const;

/** Minimum free interior tile area to host an NPC stand-and-path slot. */
export const HARTHMERE_INTERIOR_FREE_TILES_MIN_V1 = 4 as const; // 2x2

export type HarthmereBlockBuildFace = "north" | "south" | "east" | "west";

export type HarthmereBlockOpening = {
  /** Which wall the opening is on, in building-local space. */
  face: HarthmereBlockBuildFace;
  /**
   * Center offset along the face, from the building center (meters, signed).
   * For north/south face, this is along x. For east/west, along z.
   */
  offset: number;
  /** Width of the opening in blocks (1 = a door, 1–2 = a window). */
  widthBlocks: number;
  /** Bottom height in meters from the floor. 0 for door, ~1.1 for window. */
  bottomMeters: number;
  /** Top height in meters from the floor. */
  topMeters: number;
  /** What the opening is for (used by the renderer to overlay a GLTF prop). */
  kind: "door" | "window" | "archway" | "shopCounter";
};

export type HarthmereBlockBuildShellSpec = {
  /** Building identifier (e.g. "copper_kettle_inn"). */
  id: string;
  /** Display label used in placement names. */
  label: string;
  /** District id from town_registry. */
  districtId: string;
  /** World-space center. */
  centerX: number;
  centerZ: number;
  /** Building footprint in meters. */
  widthMeters: number;
  depthMeters: number;
  /** Y rotation in radians. */
  rotationRadians: number;
  /** Number of stories (each story has its own wall ring + ceiling slab). */
  floors: number;
  /** Story height; defaults to HARTHMERE_STORY_HEIGHT_DEFAULT_V1. */
  storyHeightMeters?: number;
  /** Block tile asset names allowed for walls (first is the primary). */
  wallBlockAssets: ReadonlyArray<string>;
  /** Block tile asset for floor/ceiling slabs. */
  slabBlockAsset: string;
  /** Openings (door, windows) carved out of the block ring. */
  openings: ReadonlyArray<HarthmereBlockOpening>;
  /** GLTF roof asset overlaid on the top story. */
  roofAsset?: string;
  /** Optional chimney, banner overlays. */
  chimneyAsset?: string;
  bannerAsset?: string;
  /** True if this is a public service building (different clearance). */
  isPublicService?: boolean;
  /** True for shop fronts (need 4m customer space per §56). */
  isShop?: boolean;
};

export type HarthmereBlockBuildRules = {
  version: typeof HARTHMERE_TOWN_BLOCK_BUILD_VERSION_V1;
  tileMeters: number;
  maxGapMeters: number;
  storyHeightDefault: number;
  storyHeightTall: number;
  frontDoorClearance: number;
  publicEntranceClearance: number;
  shopCustomerSpace: number;
  interiorFreeTilesMin: number;
};

export const HARTHMERE_TOWN_BLOCK_BUILD_RULES_V1: HarthmereBlockBuildRules = {
  version: HARTHMERE_TOWN_BLOCK_BUILD_VERSION_V1,
  tileMeters: HARTHMERE_BLOCK_TILE_METERS_V1,
  maxGapMeters: HARTHMERE_BLOCK_MAX_GAP_METERS_V1,
  storyHeightDefault: HARTHMERE_STORY_HEIGHT_DEFAULT_V1,
  storyHeightTall: HARTHMERE_STORY_HEIGHT_TALL_V1,
  frontDoorClearance: HARTHMERE_FRONT_DOOR_CLEARANCE_METERS_V1,
  publicEntranceClearance: HARTHMERE_PUBLIC_ENTRANCE_CLEARANCE_METERS_V1,
  shopCustomerSpace: HARTHMERE_SHOP_CUSTOMER_SPACE_METERS_V1,
  interiorFreeTilesMin: HARTHMERE_INTERIOR_FREE_TILES_MIN_V1,
} as const;

/**
 * Generate the local-space block positions for one story of a building's
 * outer wall ring. Returns positions in BUILDING-LOCAL coordinates (the
 * caller rotates them into world space). Blocks are spaced 1m along each
 * face and rise from `floorY` to `floorY + storyHeight` in 1m steps.
 *
 * Openings (doors, windows) are skipped: blocks within the opening's
 * vertical span and horizontal width are omitted, so the GLTF door /
 * window overlay can be placed there without overlapping a block.
 *
 * Returned positions are deterministic and ordered N → E → S → W so tests
 * can reason about continuity per face.
 */
export type HarthmereLocalBlockPosition = {
  /** Local x (east-west) before rotation. */
  localX: number;
  /** Local z (north-south) before rotation. */
  localZ: number;
  /** Stack height from ground. */
  y: number;
  /** Which face this block belongs to. */
  face: HarthmereBlockBuildFace;
  /** Which 1m column along the face (signed). */
  columnIndex: number;
  /** Which row in the stack (0 = bottom). */
  rowIndex: number;
};

export function harthmereGenerateStoryWallBlocks(
  shell: HarthmereBlockBuildShellSpec,
  floor: number,
): HarthmereLocalBlockPosition[] {
  const storyHeight = shell.storyHeightMeters ?? HARTHMERE_STORY_HEIGHT_DEFAULT_V1;
  const floorBaseY = (floor - 1) * storyHeight;
  const tile = HARTHMERE_BLOCK_TILE_METERS_V1;
  const halfX = shell.widthMeters / 2;
  const halfZ = shell.depthMeters / 2;
  const rows = Math.max(1, Math.round(storyHeight / tile));
  const out: HarthmereLocalBlockPosition[] = [];

  const inOpening = (face: HarthmereBlockBuildFace, columnCenter: number, blockY: number) => {
    const rowMeters = blockY - floorBaseY;
    for (const op of shell.openings) {
      if (op.face !== face) continue;
      const half = (op.widthBlocks * tile) / 2;
      if (columnCenter < op.offset - half - 1e-3) continue;
      if (columnCenter > op.offset + half + 1e-3) continue;
      if (rowMeters + tile <= op.bottomMeters + 1e-3) continue;
      if (rowMeters >= op.topMeters - 1e-3) continue;
      return true;
    }
    return false;
  };

  const pushFace = (
    face: HarthmereBlockBuildFace,
    constantAxis: "z" | "x",
    constantValue: number,
    rangeMeters: number,
  ) => {
    const columns = Math.max(2, Math.round(rangeMeters / tile) + 1);
    const half = (columns - 1) * tile / 2;
    for (let c = 0; c < columns; c += 1) {
      const along = -half + c * tile;
      for (let r = 0; r < rows; r += 1) {
        const blockY = floorBaseY + r * tile;
        const columnIndex = c - Math.floor((columns - 1) / 2);
        if (constantAxis === "z") {
          if (inOpening(face, along, blockY)) continue;
          out.push({
            localX: along,
            localZ: constantValue,
            y: blockY,
            face,
            columnIndex,
            rowIndex: r,
          });
        } else {
          if (inOpening(face, along, blockY)) continue;
          out.push({
            localX: constantValue,
            localZ: along,
            y: blockY,
            face,
            columnIndex,
            rowIndex: r,
          });
        }
      }
    }
  };

  pushFace("north", "z", -halfZ, shell.widthMeters);
  pushFace("east", "x", halfX, shell.depthMeters);
  pushFace("south", "z", halfZ, shell.widthMeters);
  pushFace("west", "x", -halfX, shell.depthMeters);

  return out;
}

/**
 * Floor/ceiling slab positions for a story. The slab is a contiguous tile
 * grid spanning the building footprint at the given Y.
 */
export type HarthmereLocalSlabPosition = {
  localX: number;
  localZ: number;
  y: number;
};

export function harthmereGenerateStoryFloorSlab(
  shell: HarthmereBlockBuildShellSpec,
  floor: number,
  kind: "floor" | "ceiling",
): HarthmereLocalSlabPosition[] {
  const storyHeight = shell.storyHeightMeters ?? HARTHMERE_STORY_HEIGHT_DEFAULT_V1;
  const floorBaseY = (floor - 1) * storyHeight;
  const tile = HARTHMERE_BLOCK_TILE_METERS_V1;
  const halfX = shell.widthMeters / 2;
  const halfZ = shell.depthMeters / 2;
  const cols = Math.max(2, Math.round(shell.widthMeters / tile) + 1);
  const rows = Math.max(2, Math.round(shell.depthMeters / tile) + 1);
  const out: HarthmereLocalSlabPosition[] = [];
  const y = kind === "floor" ? floorBaseY - 0.05 : floorBaseY + storyHeight - 0.14;
  for (let cx = 0; cx < cols; cx += 1) {
    for (let cz = 0; cz < rows; cz += 1) {
      out.push({
        localX: -halfX + cx * tile,
        localZ: -halfZ + cz * tile,
        y,
      });
    }
  }
  return out;
}

/** Bible-required building manifest. Every name MUST exist in the renderer. */
export const HARTHMERE_BIBLE_REQUIRED_BUILDINGS_V1 = [
  // Town gate / road
  { name: "North Gate Gatehouse", district: "North Gate", profile: "barracks", floors: 2, bible: "§IV.1 SERGEANT BRAM HOLT (North Gate)" },
  { name: "Toll Booth", district: "North Gate", profile: "stable_office", floors: 1, bible: "§IV.1 gate ledger and toll" },
  { name: "Stable Yard Office", district: "North Gate", profile: "stable_office", floors: 1, bible: "§III.6 Old Jory the stable master" },
  // Market
  { name: "Mara Thistle Two-Story House", district: "Market Square", profile: "residential_cottage", floors: 2, bible: "§III.3 Mara Thistle two-story behind market" },
  { name: "fountain_square", district: "Market Square", profile: "plaza", floors: 0, bible: "§II town hub: market fountain" },
  // Craftsman Row
  { name: "Black Anvil Smithy", district: "Craftsman Row", profile: "smithy", floors: 2, bible: "§III.4 Master Osric Vale; apartment above smithy" },
  { name: "Carpenter and Tailor Workshop", district: "Craftsman Row", profile: "workshop", floors: 1, bible: "§III.4 Garrik Fen workshop-and-home complex" },
  // Apothecary / Magic
  { name: "Green Mortar Apothecary", district: "Apothecary", profile: "apothecary", floors: 1, bible: "§IV.8 Ysabet Fenlow" },
  { name: "Wyrm and Candle Magic Shop", district: "Magic Shop", profile: "magic_shop", floors: 1, bible: "§V.3 magic shop / Bellbinder lore shelf" },
  // Inn
  { name: "Copper Kettle Inn", district: "Copper Kettle", profile: "inn", floors: 2, bible: "§III.6 Elowen Pike, multi-room upstairs" },
  // Noble Rise
  { name: "Reeve Hall", district: "Noble Rise", profile: "reeve_hall", floors: 2, bible: "§III.3 Reeve Caldus Merrow" },
  { name: "Edrik Vane Estate", district: "Noble Rise", profile: "reeve_hall", floors: 2, bible: "§III.3 Edrik Vane large house on Noble Rise" },
  // Temple Green
  { name: "Chapel of Saint Verena", district: "Temple Green", profile: "chapel", floors: 2, bible: "§III.5 Father Aldren; bell tower" },
  { name: "Brother Vance Cottage", district: "Temple Green", profile: "residential_cottage", floors: 1, bible: "§II.4 small cottage on chapel grounds" },
  // Player Services
  { name: "Player Services Hall", district: "Player Services", profile: "player_services", floors: 2, bible: "§II town services hub: bank, mail, auction, storage" },
  { name: "Brass Scale Moneylender", district: "Player Services", profile: "player_services", floors: 1, bible: "§III.8 Banker Merl Voss" },
  // Mudden Ward
  { name: "Mudden Lean-To Home", district: "Mudden Ward", profile: "mudden_home", floors: 1, bible: "§III.7 Mudden Ward poor housing" },
  { name: "Mudden Wash House", district: "Mudden Ward", profile: "wash_house", floors: 1, bible: "§III.7 Mudden Ward shared services" },
  { name: "Mudden Tam Crowe Lean-To", district: "Mudden Ward", profile: "mudden_home", floors: 1, bible: "§III.7 Nessa Crowe family lean-to" },
  // River Docks
  { name: "Dock Ledger Warehouse", district: "River Docks", profile: "dock_warehouse", floors: 1, bible: "§III.10 Tovin Reed dockmaster ledger warehouse" },
  { name: "River Dock Supply", district: "River Docks", profile: "dock_warehouse", floors: 1, bible: "§III.10 dockside supply shop" },
  // Guard Yard
  { name: "Guard Barracks", district: "Guard Yard", profile: "barracks", floors: 2, bible: "§III.2 Bram Holt's quarters above the Guard Yard" },
  // Residential District
  { name: "Roadside Family Cottage", district: "Residential District", profile: "residential_cottage", floors: 1, bible: "§III generic residential cottage" },
  { name: "Dawn Loaf Bakery", district: "Market District", profile: "bakery", floors: 1, bible: "§III.3 marketgoer staple" },
  { name: "Brindle Provision House", district: "Market District", profile: "provision", floors: 1, bible: "§III.3 staple goods provision" },
] as const;

/** Bible-required dungeon rooms — every one must be enclosed and reachable. */
export const HARTHMERE_BIBLE_REQUIRED_DUNGEON_ROOMS_V1 = [
  { name: "Chapel Cellar Undercroft", quest: "Q5/Q6", bible: "§II.5 chapel cellar, low stone, single oil lamp" },
  { name: "Hidden Door Encounter", quest: "Q6", bible: "§II.5 brick wall behind wine rack" },
  { name: "Old Well Underways Landmark", quest: "Q2", bible: "§II.3 sealed well with iron bars" },
  { name: "Bellward Halls Central Pillar", quest: "Q7", bible: "§II.6 first underways ring central hub" },
  { name: "Chamber of Aevith", quest: "Q7", bible: "§II.6 prayer chamber: river-wyrm Aevith" },
  { name: "Chamber of Karag-Drath", quest: "Q7", bible: "§II.6 prayer chamber: mountain-wyrm" },
  { name: "Chamber of Vyrenia", quest: "Q7", bible: "§II.6 prayer chamber: sky-wyrm" },
  { name: "Chamber of Murvath", quest: "Q7", bible: "§II.6 prayer chamber: sea-wyrm" },
  { name: "Chamber of Sylenne", quest: "Q7", bible: "§II.6 prayer chamber: forest-wyrm" },
  { name: "Chamber of Korruthax", quest: "Q7", bible: "§II.6 prayer chamber: volcanic-wyrm" },
  { name: "Listening Chamber", quest: "Q7", bible: "§II.6 Bellward Halls inner listening sanctum" },
  { name: "Old Harth Antechamber Sarcophagus", quest: "Q10", bible: "§II.7 sealed tomb of the last Bellbinder" },
  { name: "Bellbinder Tomb Regalia Hall", quest: "Q10", bible: "§II.7 six Bellbinder regalia plinths" },
  { name: "Pulse Hall", quest: "Q9", bible: "§II.7 Veins of the Wyrm: dragon-vein glow" },
  { name: "Echo Hall", quest: "Q9", bible: "§II.7 Veins of the Wyrm: phase-safe essence pool" },
  { name: "Spine Hall", quest: "Q9", bible: "§II.7 Veins of the Wyrm: rib wall" },
  { name: "Bellward Chamber True Bell", quest: "Q11", bible: "§II.8 the True Bell hanging chamber" },
  { name: "Wyrm's Bed Thaedryn Arena", quest: "Q12", bible: "§II.8 Thaedryn's resting bed boss arena" },
] as const;

/**
 * The renderer must call `createHarthmereContinuousBlockWallsV44(shell)` to
 * build wall rings instead of placing sparse decorative panels. The tests
 * verify this function exists, accepts the shell shape above, loops over
 * each face in 1m steps, and skips opening positions.
 */
export const HARTHMERE_RENDERER_BLOCK_WALL_ENTRY_NAME_V1 = "createHarthmereContinuousBlockWallsV44" as const;

