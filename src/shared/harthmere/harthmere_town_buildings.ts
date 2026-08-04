// HARTHMERE_TOWN_BUILDINGS
//
// The authored building table for Harthmere: 57 structures, moved here from
// src/server/shim/main.ts unchanged.
//
// WHY IT MOVED
// Only the DATA moved; every generator function stayed in the shim. The table
// was buried in a ten-thousand-line server module that cannot be imported
// without booting a server, so nothing about the town could be tested — not
// "is every building enclosed", not "does every building have a reachable
// door", not "does the furniture block the stairs". Those are exactly the
// properties worth pinning, and they are cheap to check against plain data.
//
// Nothing here was redesigned. Same names, same footprints, same materials,
// same door sides, in the same order. `HarthmereMat` is spelled as a string
// union rather than `keyof ReturnType<typeof localDevMaterials>` because the
// materials table lives in the shim; the shim still resolves names through
// harthmereMat(), so a typo remains a compile error there.

export const HARTHMERE_TOWN_BUILDINGS_VERSION =
  "harthmere-town-buildings-shell-polish-v2" as const;

// HARTHMERE_TOWN_SHELL_REBUILD
//
// Editing this table is not enough to change a world that already exists.
//
// The shim seeds terrain additively: `terrainIdsToBuild` collects shards that
// are MISSING, that fail the unsolid-surface probe, or that carry authored
// water. Moving a building satisfies none of those — the shard is present and
// the ground is still solid — so an ordinary deploy would leave the old shells
// standing in `shard_seed` at their old coordinates. A moved building would
// appear TWICE: the new shell, and the ghost of the old one, because additive
// seeding creates and never erases.
//
// So the shell polish pass has to name the ground it changed and ask for a full
// authored rebuild of those shards, exactly as HARTHMERE_AUTHORED_WATER does
// for the Brell channel. The rebuild is a partial ECS update that rewrites only
// the seed identity, so `shard_diff` and every other player overlay survives —
// a player's own build on a moved street is not touched.
//
// Bump the version whenever a shell, a floor count, a door side or the street
// network changes. It rides in the seed fingerprint, so the deploy that carries
// the change is the deploy that repairs the ground, and the deploy after that
// does nothing.
export const HARTHMERE_TOWN_SHELL_REBUILD_VERSION =
  "harthmere-town-shell-and-street-rebuild-v2" as const;

/**
 * Structures that moved OUTSIDE the town-core span and therefore need their own
 * rebuild rectangle.
 *
 * The span below is derived from the town-core footprints, which is the right
 * default and misses anything in the Wilds. These two came east across the old
 * map's edge, and their new ground is on shards that already exist — the exact
 * case additive seeding cannot see. Their OLD positions need no repair: they
 * were west of the seam, where no shard was ever generated, so there is nothing
 * out there to erase.
 */
const HARTHMERE_EXTRA_SHELL_REBUILD_RECTS: ReadonlyArray<{
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}> = [
  { x0: 300, x1: 314, z0: -638, z1: -624 }, // northwest_ruined_watchtower
  { x0: 296, x1: 320, z0: 159, z1: 183 }, // southwest_orchard_windmill + arms
];

/** Voxels above the ground plane that authored town structure can occupy. */
export const HARTHMERE_TOWN_SHELL_MAX_REL_Y = 40;

/**
 * The authored span the shell polish pass rewrote, in authored coordinates.
 *
 * Derived from the town-core footprints rather than listed, so a future move
 * cannot fall outside it. The margin covers balconies, exterior stair landings
 * and the street network, all of which sit outside the footprints themselves.
 */
export function harthmereTownShellRebuildSpan(): {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
} {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const b of HARTHMERE_BUILDINGS) {
    if (b.district.startsWith("Harthmere Wilds")) {
      continue;
    }
    x0 = Math.min(x0, b.x0);
    x1 = Math.max(x1, b.x1);
    z0 = Math.min(z0, b.z0);
    z1 = Math.max(z1, b.z1);
  }
  const margin = 16;
  return { x0: x0 - margin, x1: x1 + margin, z0: z0 - margin, z1: z1 + margin };
}

/** Every rectangle whose ground the shell pass rewrote, in authored space. */
export function harthmereShellRebuildRects(): ReadonlyArray<{
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}> {
  const margin = 4;
  return [
    harthmereTownShellRebuildSpan(),
    ...HARTHMERE_EXTRA_SHELL_REBUILD_RECTS.map((r) => ({
      x0: r.x0 - margin,
      x1: r.x1 + margin,
      z0: r.z0 - margin,
      z1: r.z1 + margin,
    })),
  ];
}

/**
 * Material keys. Must stay a subset of the shim's localDevMaterials() keys —
 * harthmereMat() indexes that object with these strings.
 */
export type HarthmereMat =
  | "grass"
  | "dirt"
  | "stone"
  | "gravel"
  | "cobblestone"
  | "cobblestoneBrick"
  | "oakLog"
  | "oakLumber"
  | "oakLeaf"
  | "birchLog"
  | "birchLeaf"
  | "rubberLog"
  | "rubberLeaf"
  | "stoneBrick"
  | "stonePolished"
  | "stoneShingles"
  | "limestoneBrick"
  | "simpleGlass"
  | "hay"
  | "thatch"
  | "soil"
  | "wheat"
  | "carrot"
  | "rose"
  | "dandelion"
  | "sunflower"
  | "switchGrass"
  | "woodCrate"
  | "led"
  | "moss"
  | "muckwad"
  | "sand"
  | "whiteWool"
  | "yellowWool"
  | "redWool"
  | "blueWool"
  | "blackWool"
  | "greenWool"
  | "coal"
  | "copperOre"
  | "ironOre"
  | "silverOre"
  | "goldOre"
  | "diamondOre";

export type HarthmereDoorSide = "north" | "south" | "east" | "west";
export type HarthmereProfile =
  | "house"
  | "service"
  | "apartment"
  | "slum"
  | "gatehouse"
  | "tower"
  | "bridge"
  | "dungeon";

export type HarthmereStairs = {
  x0: number;
  z0: number;
  width: number;
  length: number;
  direction: "east" | "west" | "north" | "south";
};

export type HarthmereBalcony = {
  side: "north" | "south" | "east" | "west";
  start: number;
  end: number;
  depth: number;
  floor: number;
  material?: HarthmereMat;
};

export type HarthmereBuilding = {
  name: string;
  district: string;
  profile?: HarthmereProfile;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  wall: HarthmereMat;
  roof: HarthmereMat;
  floor: HarthmereMat;
  trim?: HarthmereMat;
  doorSide: HarthmereDoorSide;
  doorCenter: number;
  floors?: number;
  upper?: boolean;
  stairs?: HarthmereStairs;
  balcony?: HarthmereBalcony;
  chimney?: [number, number];
};

export function harthmereStairsFor(
  x0: number,
  z0: number,
  direction: HarthmereStairs["direction"] = "east",
  length = 5,
  width = 2
): HarthmereStairs {
  return { x0, z0, direction, length, width };
}

export const HARTHMERE_BUILDINGS: HarthmereBuilding[] = [
  // --- North Gate / walls / guard structures ---
  {
    name: "north_gate_west_gatehouse",
    district: "North Gate",
    profile: "gatehouse",
    x0: 462,
    x1: 476,
    z0: -288,
    z1: -270,
    wall: "stoneBrick",
    roof: "stoneShingles",
    floor: "stonePolished",
    trim: "coal",
    doorSide: "south",
    doorCenter: 469,
    floors: 2,
    stairs: harthmereStairsFor(465, -276, "east"),
    chimney: [464, -285],
  },
  {
    name: "north_gate_east_gatehouse",
    district: "North Gate",
    profile: "gatehouse",
    x0: 498,
    x1: 512,
    z0: -288,
    z1: -270,
    wall: "stoneBrick",
    roof: "stoneShingles",
    floor: "stonePolished",
    trim: "coal",
    doorSide: "south",
    doorCenter: 505,
    floors: 2,
    stairs: harthmereStairsFor(501, -276, "east"),
    chimney: [510, -285],
  },
  {
    name: "north_gate_toll_booth",
    district: "North Gate",
    profile: "service",
    x0: 478,
    x1: 492,
    z0: -272,
    z1: -258,
    wall: "stoneBrick",
    roof: "redWool",
    floor: "stonePolished",
    trim: "yellowWool",
    doorSide: "south",
    doorCenter: 485,
    floors: 1,
  },
  {
    name: "harthmere_stables",
    district: "North Gate",
    profile: "service",
    x0: 440,
    x1: 458,
    z0: -276,
    z1: -254,
    wall: "stoneBrick",
    roof: "hay",
    floor: "dirt",
    trim: "yellowWool",
    doorSide: "east",
    doorCenter: -265,
    // VERTICAL-PLAN FIX (harthmere-building-shell-polish-v1): the interior lore
    // audit records Old Jory's home as a "stable-yard loft", but the shell
    // declared one floor, so the loft had nowhere to exist. Second floor plus a
    // real stair run, placed clear of the animal aisle and the east door lane.
    floors: 2,
    stairs: harthmereStairsFor(443, -272, "east"),
  },
  {
    name: "guard_yard_office",
    district: "Guard District",
    profile: "service",
    // SHELL FIX (harthmere-building-shell-polish-v1): was z -278..-258, which
    // interpenetrated `north_gate_east_gatehouse` (498..512, -288..-270) by
    // 13x9 voxels AND sealed that gatehouse's south door — all four approach
    // voxels in front of it were inside this office. Moved 12 south so the
    // gate tower keeps its own doorstep and the two shells no longer share
    // volume. The office still faces the same yard as the barracks next door.
    x0: 500,
    x1: 524,
    z0: -266,
    z1: -246,
    wall: "stoneBrick",
    roof: "redWool",
    floor: "stonePolished",
    trim: "blackWool",
    doorSide: "south",
    doorCenter: 512,
    floors: 1,
    chimney: [522, -263],
  },
  {
    name: "guard_barracks_bunkhouse",
    district: "Guard District",
    profile: "service",
    x0: 526,
    x1: 548,
    z0: -278,
    z1: -258,
    wall: "stoneBrick",
    roof: "redWool",
    floor: "stonePolished",
    trim: "blackWool",
    doorSide: "south",
    doorCenter: 537,
    floors: 2,
    stairs: harthmereStairsFor(530, -272, "east"),
  },

  // --- Residential / player / noble rise ---
  {
    name: "traveler_hearth_player_house",
    district: "Residential District",
    profile: "house",
    // SHELL FIX (harthmere-building-shell-polish-v1): was z -266..-246, which
    // overlapped `harthmere_stables` (440..458, -276..-254) by 11x13 voxels and
    // blocked the stable's east door outright. Moved 14 south. The stables keep
    // their yard, their trough (455..459, -245..-241) and their hayrack; the
    // player house lands in the Residential District it is filed under instead
    // of straddling the gate approach. Stairs, balcony and chimney move with it.
    x0: 448,
    x1: 466,
    z0: -252,
    z1: -232,
    wall: "stoneBrick",
    roof: "blueWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "east",
    doorCenter: -242,
    floors: 2,
    upper: true,
    stairs: harthmereStairsFor(452, -246, "east"),
    balcony: {
      side: "east",
      start: -248,
      end: -238,
      depth: 3,
      floor: 2,
      material: "stonePolished",
    },
    chimney: [450, -249],
  },
  {
    name: "mara_thistle_two_story_house",
    district: "Residential District",
    profile: "house",
    x0: 470,
    x1: 490,
    z0: -246,
    z1: -226,
    wall: "stoneBrick",
    roof: "greenWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "south",
    doorCenter: 480,
    floors: 2,
    stairs: harthmereStairsFor(474, -240, "east"),
    balcony: {
      side: "south",
      start: 475,
      end: 486,
      depth: 3,
      floor: 2,
      material: "stonePolished",
    },
    chimney: [488, -242],
  },
  {
    name: "reeve_hall",
    district: "Noble Rise",
    profile: "service",
    x0: 550,
    x1: 582,
    z0: -272,
    z1: -250,
    wall: "stonePolished",
    roof: "redWool",
    floor: "stoneBrick",
    trim: "greenWool",
    doorSide: "south",
    doorCenter: 566,
    floors: 2,
    upper: true,
    stairs: harthmereStairsFor(554, -266, "east"),
    balcony: {
      side: "south",
      start: 558,
      end: 574,
      depth: 3,
      floor: 2,
      material: "stoneBrick",
    },
    chimney: [579, -269],
  },
  {
    name: "edrik_vane_noble_rise_estate",
    district: "Noble Rise",
    profile: "service",
    x0: 586,
    x1: 622,
    z0: -276,
    z1: -248,
    wall: "stonePolished",
    roof: "redWool",
    floor: "stoneBrick",
    trim: "goldOre",
    doorSide: "west",
    doorCenter: -262,
    floors: 2,
    stairs: harthmereStairsFor(592, -270, "east"),
    balcony: {
      side: "west",
      start: -270,
      end: -256,
      depth: 3,
      floor: 2,
      material: "stoneBrick",
    },
    chimney: [618, -272],
  },

  // --- Market / services / crafting ---
  {
    name: "dawn_loaf_bakery",
    district: "Market District",
    profile: "service",
    x0: 418,
    x1: 442,
    z0: -204,
    z1: -184,
    wall: "stoneBrick",
    roof: "yellowWool",
    floor: "stoneBrick",
    trim: "hay",
    doorSide: "east",
    doorCenter: -194,
    // VERTICAL-PLAN FIX (harthmere-building-shell-polish-v1): Dawn's residence
    // is written as a room above the bakery, but the shell declared one floor.
    // Second floor plus a stair run behind the oven line, clear of the east
    // door lane and of the chimney at (421, -201).
    floors: 2,
    stairs: harthmereStairsFor(432, -200, "east"),
    chimney: [421, -201],
  },
  {
    name: "brindle_provision_house",
    district: "Market District",
    profile: "service",
    x0: 444,
    x1: 464,
    z0: -226,
    z1: -208,
    wall: "stoneBrick",
    roof: "greenWool",
    floor: "stoneBrick",
    trim: "yellowWool",
    doorSide: "south",
    doorCenter: 454,
    floors: 1,
  },
  {
    name: "market_auction_office",
    district: "Player Services Plaza",
    profile: "service",
    // SHELL FIX (harthmere-building-shell-polish-v1): was x 500..518, which
    // interpenetrated `crafters_workshop` (494..514, -238..-220) by 15x7 and
    // stood directly in front of that workshop's south door. Moved 3 west and
    // 10 south so both shells clear each other and Craftsman Row keeps its
    // doorstep. The office stays on the Player Services Plaza frontage.
    x0: 497,
    x1: 515,
    z0: -216,
    z1: -198,
    wall: "stonePolished",
    roof: "greenWool",
    floor: "stoneBrick",
    trim: "yellowWool",
    doorSide: "west",
    doorCenter: -207,
    floors: 1,
  },
  {
    name: "brass_scale_bank",
    district: "Player Services Plaza",
    profile: "service",
    // SHELL FIX (harthmere-building-shell-polish-v1): was x 546..568. Its west
    // teller door opened onto a one-voxel slot against the Black Anvil Smithy's
    // east wall — three of the four approach voxels were inside the smithy.
    // Moved 3 east so the bank has a real doorstep on the plaza.
    x0: 549,
    x1: 571,
    z0: -236,
    z1: -214,
    wall: "stonePolished",
    roof: "greenWool",
    floor: "stoneBrick",
    trim: "goldOre",
    doorSide: "west",
    doorCenter: -225,
    floors: 1,
    chimney: [568, -233],
  },
  {
    name: "black_anvil_smithy",
    district: "Craftsman Row",
    profile: "service",
    x0: 520,
    x1: 544,
    z0: -242,
    z1: -220,
    wall: "stoneBrick",
    roof: "blackWool",
    floor: "stonePolished",
    trim: "coal",
    doorSide: "south",
    doorCenter: 532,
    // VERTICAL-PLAN FIX (harthmere-building-shell-polish-v1): the residence
    // lore puts Osric and Luth in an apartment above the forge, but the shell
    // declared one floor. Second floor plus a stair run on the east side, away
    // from the forge triangle at the chimney end and clear of the south door.
    floors: 2,
    stairs: harthmereStairsFor(536, -238, "east"),
    chimney: [523, -238],
  },
  {
    name: "crafters_workshop",
    district: "Craftsman Row",
    profile: "service",
    x0: 494,
    x1: 514,
    z0: -238,
    z1: -220,
    wall: "stoneBrick",
    roof: "thatch",
    floor: "stoneBrick",
    trim: "hay",
    doorSide: "south",
    doorCenter: 504,
    floors: 1,
    chimney: [512, -235],
  },
  {
    name: "green_mortar_apothecary",
    district: "Temple Market Edge",
    profile: "service",
    x0: 448,
    x1: 466,
    z0: -184,
    z1: -168,
    wall: "stoneBrick",
    roof: "greenWool",
    floor: "stoneBrick",
    trim: "whiteWool",
    doorSide: "east",
    doorCenter: -176,
    floors: 1,
  },
  {
    name: "wyrm_and_candle_magic_shop",
    district: "Temple Market Edge",
    profile: "service",
    x0: 508,
    x1: 528,
    z0: -178,
    z1: -158,
    wall: "stoneBrick",
    roof: "blueWool",
    floor: "stonePolished",
    trim: "diamondOre",
    doorSide: "south",
    doorCenter: 518,
    floors: 2,
    stairs: harthmereStairsFor(512, -172, "east"),
  },
  {
    name: "copper_kettle_inn",
    district: "Entertainment District",
    profile: "service",
    x0: 532,
    x1: 566,
    z0: -208,
    z1: -180,
    wall: "stoneBrick",
    roof: "redWool",
    floor: "stonePolished",
    trim: "yellowWool",
    doorSide: "west",
    doorCenter: -194,
    floors: 2,
    upper: true,
    stairs: harthmereStairsFor(536, -202, "east"),
    balcony: {
      side: "west",
      start: -202,
      end: -188,
      depth: 3,
      floor: 2,
      material: "stonePolished",
    },
    chimney: [562, -184],
  },

  // --- Temple / docks / outskirts ---
  {
    name: "saint_verena_chapel",
    district: "Temple Green",
    profile: "service",
    x0: 466,
    x1: 494,
    z0: -150,
    z1: -128,
    wall: "stonePolished",
    roof: "blueWool",
    floor: "stoneBrick",
    trim: "whiteWool",
    doorSide: "south",
    doorCenter: 480,
    // VERTICAL-PLAN FIX (harthmere-building-shell-polish-v1): the chapel is the
    // only 57-table building whose story requires an archive, an infirmary,
    // clergy rooms AND bell-tower access, and the renderer shell already builds
    // it two storeys tall. The authored table said one floor, so the two
    // disagreed. Second floor plus a stair run in the north-west corner, behind
    // the altar line and well clear of the nave's procession aisle.
    floors: 2,
    stairs: harthmereStairsFor(470, -146, "east"),
  },
  {
    name: "brother_vance_chapel_cottage",
    district: "Temple Green",
    profile: "house",
    // SHELL FIX (harthmere-building-shell-polish-v1): was x 438..458, whose
    // east column shared five voxels with `dripline_stack`. One voxel east is
    // the whole correction; the cottage keeps its position on chapel grounds.
    x0: 439,
    x1: 459,
    z0: -148,
    z1: -130,
    wall: "stoneBrick",
    roof: "blueWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "east",
    doorCenter: -139,
    floors: 1,
    chimney: [442, -145],
  },
  {
    name: "river_dock_supply",
    district: "River Docks",
    profile: "service",
    x0: 574,
    x1: 602,
    z0: -196,
    z1: -176,
    wall: "stoneBrick",
    roof: "blackWool",
    floor: "stonePolished",
    trim: "blueWool",
    doorSide: "west",
    doorCenter: -186,
    floors: 1,
  },
  {
    name: "dock_warehouse",
    district: "River Docks",
    profile: "service",
    // SHELL FIX (harthmere-building-shell-polish-v1): was x 574..600, z
    // -170..-150. Its west cargo door and `dockside_family_house`'s east door
    // faced each other across a single voxel, and that house's balcony
    // (573..575) hung through this wall. Moved 2 east and 1 south so the cargo
    // lane between the two is walkable and the balcony overhangs open ground.
    x0: 576,
    x1: 602,
    z0: -169,
    z1: -149,
    wall: "stoneBrick",
    roof: "blackWool",
    floor: "stonePolished",
    trim: "blueWool",
    doorSide: "west",
    doorCenter: -159,
    floors: 1,
  },
  {
    name: "harthmere_watermill",
    district: "Farm Outskirts",
    profile: "service",
    x0: 418,
    x1: 440,
    z0: -122,
    z1: -104,
    wall: "stoneBrick",
    roof: "thatch",
    floor: "stonePolished",
    trim: "hay",
    doorSide: "south",
    doorCenter: 429,
    floors: 1,
    chimney: [421, -119],
  },

  // --- Mudden Ward / poorer housing ---
  {
    name: "mudden_ward_shelter",
    district: "Mudden Ward",
    profile: "slum",
    x0: 398,
    x1: 426,
    z0: -170,
    z1: -148,
    wall: "stoneBrick",
    roof: "blackWool",
    floor: "stonePolished",
    trim: "coal",
    doorSide: "east",
    doorCenter: -158,
    floors: 2,
    stairs: harthmereStairsFor(402, -164, "east"),
    chimney: [401, -166],
  },
  {
    name: "mudden_laundry_house",
    district: "Mudden Ward",
    profile: "slum",
    x0: 398,
    x1: 418,
    z0: -144,
    z1: -130,
    wall: "stoneBrick",
    roof: "blackWool",
    floor: "stonePolished",
    trim: "coal",
    doorSide: "east",
    doorCenter: -137,
    floors: 2,
    stairs: harthmereStairsFor(402, -140, "east"),
  },

  // --- Expanded residential apartments outside the wall. These replace the
  // transparent/prop shells with real collision and walkable upper floors. ---
  {
    name: "rosewall_house",
    district: "Residential District",
    profile: "apartment",
    x0: 340,
    x1: 360,
    z0: -326,
    z1: -310,
    wall: "stoneBrick",
    roof: "blueWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "south",
    doorCenter: 350,
    floors: 2,
    stairs: harthmereStairsFor(344, -322, "east"),
    balcony: {
      side: "south",
      start: 344,
      end: 356,
      depth: 3,
      floor: 2,
      material: "stonePolished",
    },
  },
  {
    name: "sunbeam_house",
    district: "Residential District",
    profile: "apartment",
    x0: 368,
    x1: 388,
    z0: -326,
    z1: -310,
    wall: "stoneBrick",
    roof: "yellowWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "south",
    doorCenter: 378,
    floors: 2,
    stairs: harthmereStairsFor(372, -322, "east"),
    balcony: {
      side: "south",
      start: 372,
      end: 384,
      depth: 3,
      floor: 2,
      material: "stonePolished",
    },
  },
  {
    name: "blue_shutter_house",
    district: "Residential District",
    profile: "apartment",
    x0: 396,
    x1: 416,
    z0: -326,
    z1: -310,
    wall: "stoneBrick",
    roof: "blueWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "south",
    doorCenter: 406,
    floors: 2,
    stairs: harthmereStairsFor(400, -322, "east"),
    balcony: {
      side: "south",
      start: 400,
      end: 412,
      depth: 3,
      floor: 2,
      material: "stonePolished",
    },
  },
  {
    name: "chimneybend_house",
    district: "Residential District",
    profile: "apartment",
    x0: 424,
    x1: 444,
    z0: -326,
    z1: -310,
    wall: "stoneBrick",
    roof: "redWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "south",
    doorCenter: 434,
    floors: 2,
    stairs: harthmereStairsFor(428, -322, "east"),
    balcony: {
      side: "south",
      start: 428,
      end: 440,
      depth: 3,
      floor: 2,
      material: "stonePolished",
    },
  },
  {
    name: "lavender_lane_house",
    district: "Residential District",
    profile: "apartment",
    // SHELL FIX (harthmere-building-shell-polish-v1): was x 452..472, whose
    // east end interpenetrated `last_watch_post_bunkhouse` (470..490) by 3x7.
    // Moved 3 west; the row of ten apartment houses keeps its 28-voxel rhythm
    // to the west and now clears the watch post to the east.
    x0: 449,
    x1: 469,
    z0: -326,
    z1: -310,
    wall: "stoneBrick",
    roof: "greenWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "south",
    doorCenter: 459,
    floors: 2,
    stairs: harthmereStairsFor(453, -322, "east"),
    balcony: {
      side: "south",
      start: 453,
      end: 465,
      depth: 3,
      floor: 2,
      material: "stonePolished",
    },
  },
  {
    name: "brass_knocker_house",
    district: "Residential District",
    profile: "apartment",
    x0: 340,
    x1: 360,
    z0: -362,
    z1: -346,
    wall: "stoneBrick",
    roof: "blueWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "north",
    doorCenter: 350,
    floors: 2,
    stairs: harthmereStairsFor(344, -358, "east"),
    balcony: {
      side: "north",
      start: 344,
      end: 356,
      depth: 3,
      floor: 2,
      material: "stonePolished",
    },
  },
  {
    name: "appleblossom_house",
    district: "Residential District",
    profile: "apartment",
    x0: 368,
    x1: 388,
    z0: -362,
    z1: -346,
    wall: "stoneBrick",
    roof: "greenWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "north",
    doorCenter: 378,
    floors: 2,
    stairs: harthmereStairsFor(372, -358, "east"),
    balcony: {
      side: "north",
      start: 372,
      end: 384,
      depth: 3,
      floor: 2,
      material: "stonePolished",
    },
  },
  {
    name: "wheatgold_house",
    district: "Residential District",
    profile: "apartment",
    x0: 396,
    x1: 416,
    z0: -362,
    z1: -346,
    wall: "stoneBrick",
    roof: "yellowWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "north",
    doorCenter: 406,
    floors: 2,
    stairs: harthmereStairsFor(400, -358, "east"),
    balcony: {
      side: "north",
      start: 400,
      end: 412,
      depth: 3,
      floor: 2,
      material: "stonePolished",
    },
  },
  {
    name: "canalview_house",
    district: "Residential District",
    profile: "apartment",
    x0: 424,
    x1: 444,
    z0: -362,
    z1: -346,
    wall: "stoneBrick",
    roof: "blueWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "north",
    doorCenter: 434,
    floors: 2,
    stairs: harthmereStairsFor(428, -358, "east"),
    balcony: {
      side: "north",
      start: 428,
      end: 440,
      depth: 3,
      floor: 2,
      material: "stonePolished",
    },
  },
  {
    name: "millers_rest_house",
    district: "Residential District",
    profile: "apartment",
    x0: 452,
    x1: 472,
    z0: -362,
    z1: -346,
    wall: "stoneBrick",
    roof: "redWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "north",
    doorCenter: 462,
    floors: 2,
    stairs: harthmereStairsFor(456, -358, "east"),
    balcony: {
      side: "north",
      start: 456,
      end: 468,
      depth: 3,
      floor: 2,
      material: "stonePolished",
    },
  },

  // --- Four/five story Mudden Ward stacks; stairs and slabs are real terrain. ---
  {
    name: "tangle_stairs_stack",
    district: "Mudden Ward",
    profile: "slum",
    x0: 366,
    x1: 382,
    z0: -134,
    z1: -118,
    wall: "stoneBrick",
    roof: "blackWool",
    floor: "stonePolished",
    trim: "coal",
    doorSide: "east",
    doorCenter: -126,
    floors: 5,
    stairs: harthmereStairsFor(369, -130, "east"),
    balcony: {
      side: "east",
      start: -131,
      end: -122,
      depth: 3,
      floor: 3,
      material: "stonePolished",
    },
  },
  {
    name: "soot_ladder_stack",
    district: "Mudden Ward",
    profile: "slum",
    x0: 394,
    x1: 410,
    z0: -112,
    z1: -96,
    wall: "stoneBrick",
    roof: "blackWool",
    floor: "stonePolished",
    trim: "coal",
    doorSide: "south",
    doorCenter: 402,
    floors: 5,
    stairs: harthmereStairsFor(397, -108, "east"),
    balcony: {
      side: "south",
      start: 397,
      end: 407,
      depth: 3,
      floor: 3,
      material: "stonePolished",
    },
  },
  {
    name: "dripline_stack",
    district: "Mudden Ward",
    profile: "slum",
    // SHELL FIX (harthmere-building-shell-polish-v1): was z -134..-118, which
    // put the stack's south half inside `harthmere_watermill` (418..440,
    // -122..-104) — 17x5 voxels of shared volume — and hung its third-floor
    // balcony through the mill wall. It also clipped
    // `brother_vance_chapel_cottage` on the west. Moved 5 north, and the door
    // moved from west to north: the west face is where the balcony hangs and
    // where the cottage stands, while the north face opens onto the Mudden
    // lane the four stacks share.
    x0: 422,
    x1: 438,
    z0: -139,
    z1: -123,
    wall: "stoneBrick",
    roof: "blackWool",
    floor: "stonePolished",
    trim: "coal",
    doorSide: "north",
    doorCenter: 430,
    floors: 4,
    stairs: harthmereStairsFor(425, -135, "east"),
    balcony: {
      side: "west",
      start: -136,
      end: -127,
      depth: 3,
      floor: 3,
      material: "stonePolished",
    },
  },
  {
    name: "washline_stack",
    district: "Mudden Ward",
    profile: "slum",
    x0: 450,
    x1: 466,
    z0: -112,
    z1: -96,
    wall: "stoneBrick",
    roof: "blackWool",
    floor: "stonePolished",
    trim: "coal",
    doorSide: "north",
    doorCenter: 458,
    floors: 4,
    stairs: harthmereStairsFor(453, -108, "east"),
    balcony: {
      side: "north",
      start: 453,
      end: 463,
      depth: 3,
      floor: 3,
      material: "stonePolished",
    },
  },

  // --- Surface-accessible dungeon buildings; below-ground rooms are carved by
  // HARTHMERE_DUNGEON_AREAS and harthmereShouldCarveDungeonAirBlockAt(). ---
  {
    name: "old_well_underways_entry_house",
    district: "Old Well Underways",
    profile: "dungeon",
    x0: 394,
    x1: 408,
    z0: -242,
    z1: -228,
    wall: "stoneBrick",
    roof: "blackWool",
    floor: "stonePolished",
    trim: "coal",
    // SHELL FIX (harthmere-building-shell-polish-v1): the entry house's east
    // door and the drain house's west door faced each other across a single
    // voxel of alley, so neither had a usable doorstep. The two doors now face
    // apart — north for the well head, east for the drain house — which also
    // suits the lore: the Old Well entry is a disguised maintenance front on
    // the lane, and the drain house looks away from it.
    doorSide: "north",
    doorCenter: 401,
    floors: 1,
  },
  {
    name: "rat_crown_drain_house",
    district: "Old Well Underways",
    profile: "dungeon",
    x0: 410,
    x1: 426,
    z0: -244,
    z1: -230,
    wall: "stoneBrick",
    roof: "blackWool",
    floor: "stonePolished",
    trim: "coal",
    doorSide: "east",
    doorCenter: -237,
    floors: 1,
  },
];

export const HARTHMERE_ADDITIONAL_SERVER_STRUCTURES: HarthmereBuilding[] = [
  {
    name: "last_watch_post_bunkhouse",
    district: "Harthmere Wilds - Last Watch Post",
    profile: "tower",
    x0: 470,
    x1: 490,
    z0: -340,
    z1: -320,
    wall: "stoneBrick",
    roof: "redWool",
    floor: "stonePolished",
    trim: "coal",
    doorSide: "south",
    doorCenter: 480,
    floors: 2,
    stairs: harthmereStairsFor(474, -334, "east"),
    chimney: [488, -337],
  },
  {
    name: "miller_rest_watermill",
    district: "Harthmere Wilds - Mill Road",
    profile: "service",
    x0: 374,
    x1: 394,
    z0: -414,
    z1: -394,
    wall: "stoneBrick",
    roof: "thatch",
    floor: "stonePolished",
    trim: "oakLog",
    doorSide: "east",
    doorCenter: -404,
    floors: 2,
    stairs: harthmereStairsFor(378, -408, "east"),
    chimney: [377, -411],
  },
  {
    name: "mill_worker_cottage",
    district: "Harthmere Wilds - Mill Road",
    profile: "house",
    x0: 398,
    x1: 414,
    z0: -402,
    z1: -386,
    wall: "stoneBrick",
    roof: "yellowWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "south",
    doorCenter: 406,
    floors: 1,
    chimney: [401, -399],
  },
  {
    name: "northwest_ruined_watchtower",
    district: "Harthmere Wilds - Northwest Watchtower Ridge",
    profile: "tower",
    // MOVED +146 X (harthmere-extension-authored-content-band-v1): was
    // x 154..168, which maps to world 1754..1768 — WEST of the old map's east
    // edge at 1792. The additive seeder is fail-closed there by design, because
    // generating those shards would overwrite imported production terrain, so
    // Rusk's camp had no ground under it and was never written. Unlike the
    // structures that only fell outside the Z band, this one cannot be fixed by
    // widening: it has to come east of the seam. It stays on the same northwest
    // ridge line, clear of the new west seam ridge (which ends at authored 280).
    x0: 300,
    x1: 314,
    z0: -638,
    z1: -624,
    wall: "stoneBrick",
    roof: "blackWool",
    floor: "stonePolished",
    trim: "coal",
    doorSide: "south",
    doorCenter: 307,
    floors: 3,
    stairs: harthmereStairsFor(303, -634, "east"),
  },
  {
    name: "southwest_orchard_windmill",
    district: "Harthmere Wilds - Southwest Orchardwood",
    profile: "tower",
    // MOVED +146 X (harthmere-extension-authored-content-band-v1): same reason
    // as the watchtower — x 154..170 is world 1754..1770, west of the seam,
    // where the seeder must not generate. The windmill's cross arms are
    // authored separately in the shim and move by the same +146 so the sails
    // stay on the tower instead of turning over empty ground.
    x0: 300,
    x1: 316,
    z0: 162,
    z1: 180,
    wall: "stoneBrick",
    roof: "yellowWool",
    floor: "stonePolished",
    trim: "oakLog",
    doorSide: "south",
    doorCenter: 308,
    floors: 3,
    stairs: harthmereStairsFor(304, 166, "east"),
  },
  {
    name: "greenmere_edge_cabin",
    district: "Harthmere Wilds - Greenmere Edge",
    profile: "house",
    x0: 540,
    x1: 558,
    z0: -438,
    z1: -420,
    wall: "stoneBrick",
    roof: "greenWool",
    floor: "stonePolished",
    trim: "oakLog",
    doorSide: "south",
    doorCenter: 549,
    floors: 1,
    chimney: [555, -435],
  },
  {
    name: "charcoal_burners_camp",
    district: "Harthmere Wilds - Charcoal Camp",
    profile: "house",
    x0: 236,
    x1: 254,
    z0: -650,
    z1: -632,
    wall: "stoneBrick",
    roof: "blackWool",
    floor: "stonePolished",
    trim: "coal",
    doorSide: "south",
    doorCenter: 245,
    floors: 1,
    chimney: [239, -647],
  },
  {
    name: "briarfen_stilt_hut",
    district: "Harthmere Wilds - Briarfen",
    profile: "house",
    x0: 648,
    x1: 668,
    z0: -286,
    z1: -266,
    wall: "stoneBrick",
    roof: "greenWool",
    floor: "stonePolished",
    trim: "oakLog",
    doorSide: "west",
    doorCenter: -276,
    floors: 1,
    chimney: [665, -283],
  },
  {
    name: "grave_tender_caretaker_house",
    district: "Harthmere Wilds - Southeast Gravewood",
    profile: "house",
    x0: 748,
    x1: 768,
    z0: 202,
    z1: 222,
    wall: "stoneBrick",
    roof: "blackWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "north",
    doorCenter: 758,
    floors: 1,
    chimney: [765, 205],
  },
  {
    name: "deep_old_wood_glade_lodge",
    district: "Harthmere Wilds - Deep Old Wood",
    profile: "house",
    x0: 700,
    x1: 720,
    z0: -692,
    z1: -672,
    wall: "stoneBrick",
    roof: "greenWool",
    floor: "stonePolished",
    trim: "oakLog",
    doorSide: "south",
    doorCenter: 710,
    floors: 1,
    chimney: [717, -689],
  },
  {
    name: "thornbridge_crossing_shelter",
    district: "Harthmere Wilds - Thornbridge Crossing",
    profile: "service",
    x0: 342,
    x1: 356,
    z0: -506,
    z1: -490,
    wall: "stoneBrick",
    roof: "greenWool",
    floor: "stonePolished",
    trim: "oakLog",
    doorSide: "west",
    doorCenter: -498,
    floors: 1,
  },
  {
    name: "mail_post_house",
    district: "Player Services Plaza",
    profile: "service",
    // SHELL FIX (harthmere-building-shell-polish-v1): was x 520..534, z
    // -224..-210, whose north strip sat inside `black_anvil_smithy` (520..544,
    // -242..-220) and sealed the smithy's south door. Moved 4 west and 5 south
    // onto the plaza frontage proper. Courier Anwen's bunk on the upper floor
    // keeps its stair run, shifted with the shell.
    x0: 516,
    x1: 530,
    z0: -219,
    z1: -205,
    wall: "stoneBrick",
    roof: "blueWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "south",
    doorCenter: 523,
    floors: 2,
    stairs: harthmereStairsFor(519, -215, "east"),
  },
  {
    name: "tailor_loft_house",
    district: "Market District",
    profile: "service",
    // SHELL FIX (harthmere-building-shell-polish-v1): was x 468..486. The
    // apothecary's east door opened into a one-voxel slot against this wall.
    // Moved 2 east so Green Mortar has a doorstep and the two shopfronts read
    // as neighbours rather than as one merged block.
    x0: 470,
    x1: 488,
    z0: -184,
    z1: -168,
    wall: "stoneBrick",
    roof: "yellowWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "south",
    doorCenter: 479,
    floors: 2,
    stairs: harthmereStairsFor(474, -180, "east"),
  },
  {
    name: "tannery_court_house",
    district: "Farm Outskirts",
    profile: "service",
    x0: 472,
    x1: 490,
    z0: -124,
    z1: -106,
    wall: "stoneBrick",
    roof: "thatch",
    floor: "stonePolished",
    trim: "oakLog",
    doorSide: "north",
    doorCenter: 481,
    floors: 1,
    chimney: [487, -121],
  },
  {
    name: "dockside_family_house",
    district: "River Docks",
    profile: "apartment",
    x0: 552,
    x1: 572,
    z0: -174,
    z1: -154,
    wall: "stoneBrick",
    roof: "blueWool",
    floor: "stonePolished",
    trim: "whiteWool",
    doorSide: "east",
    doorCenter: -164,
    floors: 2,
    stairs: harthmereStairsFor(556, -168, "east"),
    balcony: {
      side: "east",
      start: -170,
      end: -160,
      depth: 3,
      floor: 2,
      material: "stonePolished",
    },
    chimney: [555, -171],
  },
];

HARTHMERE_BUILDINGS.push(...HARTHMERE_ADDITIONAL_SERVER_STRUCTURES);
