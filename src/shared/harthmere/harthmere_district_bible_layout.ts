// HARTHMERE_DISTRICT_BIBLE_LAYOUT
//
// Canonical, bible-driven layout of Harthmere. Source documents:
//   - Harthmere_Medieval_MMO_Town_Design_Bible_Complete.pdf  (sections 4, 6, 7, 8)
//   - Harthmere_Bellbound_Dragon_Story_Bible.md
//   - snapshot_grove_harthmere_lore_bible.pdf
//   - README-SNAPSHOT-MAP-LANDSCAPE-GUIDE.md  (rules 1-3)
//
// What this file is and is not:
//   - It IS the single source of truth for which district each canonical NPC
//     belongs to, where each district lives in authored snapshot coordinates,
//     and what services/landmarks anchor each district.
//   - It IS the connectivity contract: Harthmere is reached through a single
//     authored connector road from the Grove (see town_map.ts
//     HARTHMERE_CONNECTED_MAP_PRESENTATION) and shares the same ground Y
//     as the Grove, so a player can walk continuously between them.
//   - It IS what tests should assert against (see
//     `snapshot_npc_positions.test.ts` and `harthmere_layout.test.ts`).
//   - It is NOT terrain generation. Per the snapshot map/landscape guide, the
//     terrain shard data itself must be authored in canonical world data
//     ("build the world as real Biomes world data; do not fake the world with
//     client-only meshes"). This file describes where the bible says the
//     districts go; the terrain seeding/shifting (e.g. town_block_build
//     and the additive X offset documented in town_routes.ts) consume this layout.
//
// Coordinates are in authored snapshot world space.  The Grove sits roughly
// in x≈[300,650], z≈[-360,-40] at ground y=52.  Harthmere is laid out east
// of the Grove and uses the additive runtime offset documented in
// HARTHMERE_CONNECTED_MAP_ROUTE_ANCHORS.  This means: every coordinate
// here is the "authored" position; the runtime applies the offset uniformly
// to NPCs, routes, quests, landmarks, and map markers together so the town
// moves as one unit.

import type { Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_GROVE_NPC_FEET_Y,
  SNAPSHOT_GROVE_WORLD_GROUND_Y,
} from "@/shared/harthmere/snapshot_grove_content";

export const HARTHMERE_DISTRICT_BIBLE_LAYOUT_VERSION =
  "harthmere-district-bible-layout" as const;

/**
 * Ground Y shared with the Grove. Critical: Harthmere is a CONNECTED settlement
 * on the same world surface, not a detached town. This invariant is asserted
 * by the layout tests.
 */
export const HARTHMERE_LAYOUT_GROUND_Y = SNAPSHOT_GROVE_WORLD_GROUND_Y;
export const HARTHMERE_LAYOUT_FEET_Y = SNAPSHOT_GROVE_NPC_FEET_Y;
export const HARTHMERE_LAYOUT_MARKER_Y =
  SNAPSHOT_GROVE_WORLD_GROUND_Y + 2;

/**
 * District identifiers — match the existing town_registry HarthmereDistrictId
 * union so router/HUD/map code can use one consistent vocabulary.
 */
export type HarthmereBibleDistrictId =
  | "north_gate"
  | "market_square"
  | "player_services"
  | "copper_kettle"
  | "craftsman_row"
  | "temple_green"
  | "noble_rise"
  | "river_docks"
  | "mudden_ward"
  | "guard_yard"
  | "old_well_underways"
  | "residential";

export interface HarthmereBibleDistrict {
  id: HarthmereBibleDistrictId;
  label: string;
  bibleSection: string; // e.g. "7.1 North Gate"
  // Authored, ground-axis-aligned XZ rectangle for the district. (Min/max
  // are inclusive at the floor and exclusive at the ceiling, like world map
  // tiles.)  Bounds intentionally do not overlap.
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  // The single "compass point" of the district. Map labels and minimap
  // chevrons sit here.
  anchor: Vec3;
  // Player-facing role — drives map filter chips ("services", "combat", etc).
  primaryRole:
    | "gate"
    | "market"
    | "services"
    | "crafting"
    | "faith"
    | "politics"
    | "docks"
    | "underclass"
    | "mystery"
    | "housing";
  // Mood from bible §4 and §7: drives ambient audio + lighting choices.
  mood: string;
  // The named bible NPCs that have their PRIMARY workplace anchor here.
  // (Their homes may be elsewhere — see HARTHMERE_BIBLE_NPC_RESIDENCES.)
  primaryWorkplaceNpcIds: string[];
  // Service interactables this district hosts (used by the UI map filters).
  services: ReadonlyArray<
    | "bind_point"
    | "bank"
    | "auction_house"
    | "storage"
    | "mail"
    | "repair"
    | "vendor"
    | "trainer"
    | "stable"
    | "guild_board"
    | "event_board"
    | "rumor"
    | "chapel_healing"
    | "council_office"
  >;
  // Decorated wayfinding landmarks (signs/banners/fountains) anchored in this
  // district. Each landmark id should be globally unique across districts.
  landmarks: ReadonlyArray<{
    id: string;
    label: string;
    position: Vec3;
    icon?: string;
  }>;
}

/**
 * Per-NPC residence anchor. Every named bible NPC has a SPECIFIC living
 * quarters address: where they sleep, where their schedule's "home" waypoint
 * resolves to, and where their patrol/walking route ends each night.
 *
 * The promise to the player: every NPC in Harthmere has a home you can find,
 * and you will see them walk to it (the existing
 * `route.goesHomeDaily = true` schedules in npc_compendium already
 * guarantee this — this map ties the human-readable "home" prose to a
 * concrete world coordinate that tests can assert against).
 */
export interface HarthmereBibleResidence {
  npcId: string;
  npcDisplayName: string;
  // Which district their home is in. (Often the same as their workplace
  // district but not always — Mara Thistle works the Market but lives in
  // a Mudden Ward terrace, per bible §7.8.)
  districtId: HarthmereBibleDistrictId;
  // Authored XZ position of their doorstep. Schedule waypoints with
  // `location: "home"` should match within ±2 blocks.
  doorstep: Vec3;
  // Bible building label (e.g. "Holt family terrace, Mudden Ward").
  buildingLabel: string;
  // Resident pattern — most NPCs return at night; gate guards rotate shifts.
  homePattern: "sleeps_at_home" | "night_shift_rotates" | "communal_quarters";
}

/**
 * Harthmere bounds for the entire connected town, suitable for testing that
 * district rectangles and NPC home doorsteps stay inside the settlement.
 *
 * These match SNAPSHOT_HARTHMERE_LIVE_BOUNDS (snapshot_live_debug.ts)
 * — they MUST match, and the tests enforce equality.
 */
export const HARTHMERE_TOWN_LAYOUT_BOUNDS = {
  minX: 192,
  maxX: 768,
  minZ: -512,
  maxZ: 192,
  groundY: HARTHMERE_LAYOUT_GROUND_Y,
} as const;

/**
 * Districts — laid out per bible §6 (Layout, District Roles, Player Flow):
 *
 *   N (negative Z is north)
 *   ▲
 *   │  North Gate (entry threshold)
 *   │  Guard Yard (adjacent to gate)
 *   │  Noble Rise (visually above market)
 *   │  ───────────────────────────────────
 *   │  Market Square (compass center)
 *   │  Copper Kettle / Player Services (NE of market, social hub)
 *   │  Craftsman Row (E of market, working district)
 *   │  Temple Green (W of market, faith/quiet)
 *   │  ───────────────────────────────────
 *   │  Mudden Ward (S/SW of market, underclass)
 *   │  River Docks (E along river, docks/water)
 *   │  Old Well & Underways (under market, mystery)
 *   │  Residential (S of market, NPC homes)
 *   ▼
 *
 * Bounds are deliberately wider than the visible building footprints so NPC
 * walking and visiting players have circulation room.  The bible's "1,200
 * within the walls" population fantasy translates to roughly 9 districts at
 * ~80x80 each plus residential overflow.
 */
export const HARTHMERE_BIBLE_DISTRICTS: ReadonlyArray<HarthmereBibleDistrict> = [
  {
    id: "north_gate",
    label: "North Gate",
    bibleSection: "7.1 North Gate",
    bounds: { minX: 460, maxX: 500, minZ: -300, maxZ: -270 },
    anchor: [500, HARTHMERE_LAYOUT_MARKER_Y, -270],
    primaryRole: "gate",
    mood: "Authoritative but not hostile; players should feel they are entering a protected place.",
    primaryWorkplaceNpcIds: ["sergeant_bram_holt", "toll_clerk"],
    services: ["guild_board", "event_board", "stable"],
    landmarks: [
      {
        id: "harthmere_north_gate_stone",
        label: "North Gate",
        position: [500, HARTHMERE_LAYOUT_MARKER_Y, -284],
        icon: "gate",
      },
      {
        id: "harthmere_toll_desk",
        label: "Toll Desk",
        position: [488, HARTHMERE_LAYOUT_MARKER_Y, -276],
      },
      {
        id: "harthmere_caravan_queue",
        label: "Caravan Queue",
        position: [512, HARTHMERE_LAYOUT_MARKER_Y, -292],
      },
    ],
  },
  {
    id: "guard_yard",
    label: "Guard Yard",
    bibleSection: "7.1 North Gate (Guard Yard annex)",
    bounds: { minX: 500, maxX: 540, minZ: -270, maxZ: -240 },
    anchor: [510, HARTHMERE_LAYOUT_MARKER_Y, -252],
    primaryRole: "gate",
    mood: "Working watch yard; tabards, drills, and the smell of oil.",
    primaryWorkplaceNpcIds: [
      "north_gate_day_guard",
      "north_gate_night_guard",
      "private_guard",
    ],
    services: [],
    landmarks: [
      {
        id: "harthmere_guard_barracks",
        label: "Guard Barracks",
        position: [512, HARTHMERE_LAYOUT_MARKER_Y, -252],
      },
    ],
  },
  {
    id: "noble_rise",
    label: "Noble Rise",
    bibleSection: "7.6 Noble Rise",
    bounds: { minX: 540, maxX: 620, minZ: -280, maxZ: -240 },
    anchor: [570, HARTHMERE_LAYOUT_MARKER_Y, -250],
    primaryRole: "politics",
    mood: "Controlled, elevated, observant; social distance is part of the look.",
    primaryWorkplaceNpcIds: [
      "reeve_caldus_merrow",
      "noble_clerk",
      "house_servant",
      "noble_widow_avelina",
      "crown_auditor_selwyn",
    ],
    services: ["council_office"],
    landmarks: [
      {
        id: "harthmere_reeve_hall",
        label: "Reeve's Hall",
        position: [566, HARTHMERE_LAYOUT_MARKER_Y, -250],
        icon: "council",
      },
      {
        id: "harthmere_noble_gardens",
        label: "Noble Gardens",
        position: [582, HARTHMERE_LAYOUT_MARKER_Y, -242],
      },
    ],
  },
  {
    id: "market_square",
    label: "Market Square",
    bibleSection: "7.2 Market Square",
    bounds: { minX: 440, maxX: 500, minZ: -260, maxZ: -200 },
    anchor: [490, HARTHMERE_LAYOUT_MARKER_Y, -210],
    primaryRole: "market",
    mood: "Lively, noisy, crowded, communal; this is where players naturally idle.",
    primaryWorkplaceNpcIds: [
      "mara_thistle",
      "harlo_grain_merchant",
      "rinna_fishmonger",
      "food_seller",
      "cloth_trader",
      "spice_trader",
      "market_clerk",
      "market_performer",
      "stock_keeper",
      "auction_clerk_pell",
      "merrit_apprentice_pell",
    ],
    services: ["vendor", "auction_house", "rumor", "event_board"],
    landmarks: [
      {
        id: "harthmere_market_fountain",
        label: "Market Fountain",
        position: [490, HARTHMERE_LAYOUT_MARKER_Y, -210],
        icon: "fountain",
      },
      {
        id: "harthmere_market_posting_board",
        label: "Posting Board",
        position: [482, HARTHMERE_LAYOUT_MARKER_Y, -198],
        icon: "board",
      },
      {
        id: "harthmere_auction_house",
        label: "Auction House",
        position: [518, HARTHMERE_LAYOUT_MARKER_Y, -202],
        icon: "auction",
      },
    ],
  },
  {
    id: "copper_kettle",
    label: "Copper Kettle Inn",
    bibleSection: "7.3 Player Services Plaza / Copper Kettle Cluster",
    bounds: { minX: 540, maxX: 580, minZ: -210, maxZ: -180 },
    anchor: [560, HARTHMERE_LAYOUT_MARKER_Y, -200],
    primaryRole: "services",
    mood: "Comfort, relief, conversation, and useful downtime.",
    primaryWorkplaceNpcIds: [
      "elowen_pike",
      "inn_cook",
      "room_attendant",
      "courier_anwen",
      "mail_runner",
      "traveler_patron",
      "roleplay_patron",
    ],
    services: ["bind_point", "mail", "rumor", "stable"],
    landmarks: [
      {
        id: "harthmere_copper_kettle_hearth",
        label: "Copper Kettle Hearth",
        position: [560, HARTHMERE_LAYOUT_MARKER_Y, -200],
        icon: "inn",
      },
      {
        id: "harthmere_mail_post",
        label: "Mail Post",
        position: [572, HARTHMERE_LAYOUT_MARKER_Y, -208],
        icon: "mail",
      },
    ],
  },
  {
    id: "player_services",
    label: "Player Services Plaza",
    bibleSection: "7.3 Player Services Plaza / Copper Kettle Cluster",
    bounds: { minX: 540, maxX: 580, minZ: -240, maxZ: -220 },
    anchor: [560, HARTHMERE_LAYOUT_MARKER_Y, -228],
    primaryRole: "services",
    mood: "Utility-first plaza wrapped around the inn.",
    primaryWorkplaceNpcIds: ["edrik_vane", "auction_clerk_pell"],
    services: ["bank", "storage", "auction_house"],
    landmarks: [
      {
        id: "harthmere_bank_office",
        label: "Vault Office",
        position: [552, HARTHMERE_LAYOUT_MARKER_Y, -228],
        icon: "bank",
      },
      {
        id: "harthmere_storage_lockers",
        label: "Storage Lockers",
        position: [568, HARTHMERE_LAYOUT_MARKER_Y, -232],
        icon: "storage",
      },
    ],
  },
  {
    id: "craftsman_row",
    label: "Craftsman Row",
    bibleSection: "7.4 Craftsman Row",
    bounds: { minX: 500, maxX: 540, minZ: -240, maxZ: -220 },
    anchor: [528, HARTHMERE_LAYOUT_MARKER_Y, -240],
    primaryRole: "crafting",
    mood: "Industrious, hot, useful, a little dangerous.",
    primaryWorkplaceNpcIds: [
      "master_osric_vale",
      "forge_apprentice",
      "carpenter_apprentice",
      "tanner",
      "porter",
    ],
    services: ["repair", "trainer", "vendor"],
    landmarks: [
      {
        id: "harthmere_osric_forge",
        label: "Vale Forge",
        position: [528, HARTHMERE_LAYOUT_MARKER_Y, -240],
        icon: "forge",
      },
      {
        id: "harthmere_carpenter_yard",
        label: "Carpenter Yard",
        position: [544, HARTHMERE_LAYOUT_MARKER_Y, -244],
      },
      {
        id: "harthmere_tannery",
        label: "Tannery",
        position: [510, HARTHMERE_LAYOUT_MARKER_Y, -252],
      },
    ],
  },
  {
    id: "temple_green",
    label: "Temple Green",
    bibleSection: "7.5 Temple Green and the Chapel of Saint Verena",
    bounds: { minX: 440, maxX: 500, minZ: -180, maxZ: -120 },
    anchor: [470, HARTHMERE_LAYOUT_MARKER_Y, -150],
    primaryRole: "faith",
    mood: "Peaceful and solemn, with a faint undertone of mystery.",
    primaryWorkplaceNpcIds: [
      "father_aldren_mell",
      "chapel_pilgrim",
      "mourner",
      "candle_server",
      "charity_worker",
    ],
    services: ["chapel_healing", "rumor"],
    landmarks: [
      {
        id: "harthmere_chapel_saint_verena",
        label: "Chapel of Saint Verena",
        position: [470, HARTHMERE_LAYOUT_MARKER_Y, -150],
        icon: "chapel",
      },
      {
        id: "harthmere_memorial_garden",
        label: "Memorial Garden",
        position: [486, HARTHMERE_LAYOUT_MARKER_Y, -140],
      },
    ],
  },
  {
    id: "river_docks",
    label: "River Docks",
    bibleSection: "7.7 River Docks",
    bounds: { minX: 580, maxX: 660, minZ: -220, maxZ: -160 },
    anchor: [610, HARTHMERE_LAYOUT_MARKER_Y, -190],
    primaryRole: "docks",
    mood: "Wet, working, watchful; risk and opportunity live on the river.",
    primaryWorkplaceNpcIds: [
      "tovin_reed",
      "ferryman",
      "fishmonger",
      "docker",
      "bargeman",
      "dock_inspector",
      "barge_captain_orren",
    ],
    services: ["vendor"],
    landmarks: [
      {
        id: "harthmere_dockmaster_office",
        label: "Dockmaster Office",
        position: [610, HARTHMERE_LAYOUT_MARKER_Y, -190],
        icon: "dock",
      },
      {
        id: "harthmere_river_warehouse",
        label: "River Warehouse",
        position: [628, HARTHMERE_LAYOUT_MARKER_Y, -198],
      },
      {
        id: "harthmere_river_pier",
        label: "River Pier",
        position: [646, HARTHMERE_LAYOUT_MARKER_Y, -184],
      },
    ],
  },
  {
    id: "mudden_ward",
    label: "Mudden Ward",
    bibleSection: "7.8 Mudden Ward",
    bounds: { minX: 380, maxX: 440, minZ: -180, maxZ: -120 },
    anchor: [420, HARTHMERE_LAYOUT_MARKER_Y, -150],
    primaryRole: "underclass",
    mood: "Mud, smoke, clutter; the underclass and informal economy.",
    primaryWorkplaceNpcIds: [
      "nessa_crowe",
      "mudden_laborer",
      "mudden_widow",
      "mudden_child",
      "rat_catcher",
      "informal_trader",
      "mudden_lookout",
      "ysabet_fenlow",
    ],
    services: ["vendor", "rumor"],
    landmarks: [
      {
        id: "harthmere_mudden_lookout_post",
        label: "Mudden Lookout",
        position: [420, HARTHMERE_LAYOUT_MARKER_Y, -134],
      },
      {
        id: "harthmere_apothecary_fenlow",
        label: "Fenlow Apothecary",
        position: [440, HARTHMERE_LAYOUT_MARKER_Y, -148],
        icon: "alchemy",
      },
    ],
  },
  {
    id: "old_well_underways",
    label: "Old Well & Underways",
    bibleSection: "7.9 Old Well and Underways",
    bounds: { minX: 500, maxX: 560, minZ: -160, maxZ: -100 },
    anchor: [510, HARTHMERE_LAYOUT_MARKER_Y, -130],
    primaryRole: "mystery",
    mood: "Cool, breathing, hollow; the bell that was buried still hums.",
    primaryWorkplaceNpcIds: ["old_well_scavenger", "secretive_figure"],
    services: [],
    landmarks: [
      {
        id: "harthmere_old_well",
        label: "Old Well",
        position: [490, HARTHMERE_LAYOUT_MARKER_Y, -130],
        icon: "well",
      },
      {
        id: "harthmere_underways_grate",
        label: "Underways Grate",
        position: [504, HARTHMERE_LAYOUT_MARKER_Y, -140],
      },
    ],
  },
  {
    id: "residential",
    label: "Harthmere Residential",
    bibleSection: "8.1 Ambient Population (housing overflow)",
    bounds: { minX: 380, maxX: 580, minZ: -380, maxZ: -300 },
    anchor: [480, HARTHMERE_LAYOUT_MARKER_Y, -340],
    primaryRole: "housing",
    mood: "Modest terraces, smoke from chimneys, washing on lines.",
    // Residential is where most NPCs *sleep* but where no named NPC works.
    // It is the housing overflow district called for by bible §8.1's
    // ambient population budgets.
    primaryWorkplaceNpcIds: [],
    services: [],
    landmarks: [
      {
        id: "harthmere_residential_well_north",
        label: "Residential Well (North)",
        position: [410, HARTHMERE_LAYOUT_MARKER_Y, -320],
      },
      {
        id: "harthmere_residential_well_south",
        label: "Residential Well (South)",
        position: [510, HARTHMERE_LAYOUT_MARKER_Y, -360],
      },
    ],
  },
];

/**
 * Every named bible NPC has a registered residence. The list intentionally
 * mirrors HARTHMERE_NAMED_NPCS's `id`s; the layout tests will fail with
 * a clear diagnostic if a named NPC is added without a residence anchor.
 *
 * Bible refs for the canonical residences:
 *   - Bram Holt: "Guard barracks, room above the Guard Yard" (NPC compendium current)
 *   - Mara Thistle: Bible §8 (market guide, Mudden-adjacent terrace)
 *   - Elowen Pike: Bible §7.3 — lives above the Copper Kettle
 *   - Master Osric Vale: Bible §7.4 — back room of the Vale Forge
 *   - Father Aldren Mell: Bible §7.5 — chapel side rooms
 *   - Nessa Crowe: Bible §7.8 — Mudden Ward, "rat-spear" terrace
 *   - Tovin Reed: Bible §7.7 — small house behind the dockmaster office
 *   - Reeve Caldus Merrow: Bible §7.6 — Reeve's Hall residential wing
 *   - Ysabet Fenlow: Bible §7.8 — apothecary back rooms
 *   - Edrik Vane: Bible §7.3 — apartments above the Vault Office
 *   - Courier Anwen: Bible §7.3 — Copper Kettle attic room (rotating shift)
 *   - Auction Clerk Pell: Bible §7.3 — small room behind the Auction House
 */
export const HARTHMERE_BIBLE_NPC_RESIDENCES: ReadonlyArray<HarthmereBibleResidence> = [
  {
    npcId: "sergeant_bram_holt",
    npcDisplayName: "Sergeant Bramwell Holt",
    districtId: "guard_yard",
    doorstep: [512, 53.05, -264],
    buildingLabel: "Guard barracks, upper room",
    homePattern: "communal_quarters",
  },
  {
    npcId: "mara_thistle",
    npcDisplayName: "Mara Thistle",
    districtId: "market_square",
    doorstep: [456, 53.05, -256],
    buildingLabel: "Thistle terrace, Mudden Ward east row",
    homePattern: "sleeps_at_home",
  },
  {
    npcId: "elowen_pike",
    npcDisplayName: "Elowen Pike",
    districtId: "copper_kettle",
    doorstep: [552, 53.05, -194],
    buildingLabel: "Copper Kettle innkeeper's quarters",
    homePattern: "sleeps_at_home",
  },
  {
    npcId: "master_osric_vale",
    npcDisplayName: "Master Osric Vale",
    districtId: "craftsman_row",
    doorstep: [530, 53.05, -232],
    buildingLabel: "Vale Forge back room",
    homePattern: "sleeps_at_home",
  },
  {
    npcId: "father_aldren_mell",
    npcDisplayName: "Father Aldren Mell",
    districtId: "temple_green",
    doorstep: [480, 53.05, -137],
    buildingLabel: "Chapel of Saint Verena, clergy wing",
    homePattern: "sleeps_at_home",
  },
  {
    npcId: "nessa_crowe",
    npcDisplayName: "Nessa Crowe",
    districtId: "mudden_ward",
    doorstep: [414, HARTHMERE_LAYOUT_FEET_Y, -158],
    buildingLabel: "Crowe rookery, Mudden Ward south row",
    homePattern: "sleeps_at_home",
  },
  {
    npcId: "tovin_reed",
    npcDisplayName: "Tovin Reed",
    districtId: "river_docks",
    doorstep: [596, 53.05, -172],
    buildingLabel: "Dockmaster's cottage",
    homePattern: "sleeps_at_home",
  },
  {
    npcId: "reeve_caldus_merrow",
    npcDisplayName: "Reeve Caldus Merrow",
    districtId: "noble_rise",
    doorstep: [562, 53.05, -262],
    buildingLabel: "Reeve's Hall residential wing",
    homePattern: "sleeps_at_home",
  },
  {
    npcId: "ysabet_fenlow",
    npcDisplayName: "Ysabet Fenlow",
    districtId: "temple_green",
    doorstep: [455, 53.05, -176],
    buildingLabel: "Fenlow Apothecary back rooms",
    homePattern: "sleeps_at_home",
  },
  {
    npcId: "edrik_vane",
    npcDisplayName: "Edrik Vane",
    districtId: "noble_rise",
    doorstep: [562, 53.05, -262],
    buildingLabel: "Apartments above the Vault Office",
    homePattern: "sleeps_at_home",
  },
];

/** Lookup helpers. */
export function harthmereDistrictById(id: HarthmereBibleDistrictId) {
  return HARTHMERE_BIBLE_DISTRICTS.find((d) => d.id === id);
}

export function harthmereResidenceByNpcId(npcId: string) {
  return HARTHMERE_BIBLE_NPC_RESIDENCES.find((r) => r.npcId === npcId);
}

/** Returns the district whose bounds contain the given authored XZ. */
export function harthmereDistrictForPoint(
  x: number,
  z: number,
): HarthmereBibleDistrict | undefined {
  return HARTHMERE_BIBLE_DISTRICTS.find(
    (d) =>
      x >= d.bounds.minX &&
      x <= d.bounds.maxX &&
      z >= d.bounds.minZ &&
      z <= d.bounds.maxZ,
  );
}

/**
 * Walk every district and report layout health.  Useful for the local-dev
 * diagnostics panel and for CI.
 */
export function validateHarthmereLayout() {
  const failures: string[] = [];

  // 1. Districts must not overlap.
  for (let i = 0; i < HARTHMERE_BIBLE_DISTRICTS.length; i++) {
    for (let j = i + 1; j < HARTHMERE_BIBLE_DISTRICTS.length; j++) {
      const a = HARTHMERE_BIBLE_DISTRICTS[i];
      const b = HARTHMERE_BIBLE_DISTRICTS[j];
      const overlapX = a.bounds.minX < b.bounds.maxX && b.bounds.minX < a.bounds.maxX;
      const overlapZ = a.bounds.minZ < b.bounds.maxZ && b.bounds.minZ < a.bounds.maxZ;
      if (overlapX && overlapZ) {
        failures.push(`district overlap: ${a.id} and ${b.id}`);
      }
    }
  }

  // 2. Each district anchor must sit inside the district bounds.
  for (const d of HARTHMERE_BIBLE_DISTRICTS) {
    const [ax, , az] = d.anchor;
    if (
      ax < d.bounds.minX ||
      ax > d.bounds.maxX ||
      az < d.bounds.minZ ||
      az > d.bounds.maxZ
    ) {
      failures.push(`district anchor outside its own bounds: ${d.id}`);
    }
  }

  // 3. Every district must sit inside the town bounds.
  for (const d of HARTHMERE_BIBLE_DISTRICTS) {
    if (
      d.bounds.minX < HARTHMERE_TOWN_LAYOUT_BOUNDS.minX ||
      d.bounds.maxX > HARTHMERE_TOWN_LAYOUT_BOUNDS.maxX ||
      d.bounds.minZ < HARTHMERE_TOWN_LAYOUT_BOUNDS.minZ ||
      d.bounds.maxZ > HARTHMERE_TOWN_LAYOUT_BOUNDS.maxZ
    ) {
      failures.push(`district escapes town bounds: ${d.id}`);
    }
  }

  // 4. Every NPC residence must point at a real district AND the doorstep
  //    must be inside that district's bounds.
  for (const r of HARTHMERE_BIBLE_NPC_RESIDENCES) {
    const district = harthmereDistrictById(r.districtId);
    if (!district) {
      failures.push(`residence references missing district: ${r.npcId} -> ${r.districtId}`);
      continue;
    }
    const [x, , z] = r.doorstep;
    if (
      x < district.bounds.minX ||
      x > district.bounds.maxX ||
      z < district.bounds.minZ ||
      z > district.bounds.maxZ
    ) {
      failures.push(
        `residence doorstep is outside its declared district: ${r.npcId} doorstep=${JSON.stringify(r.doorstep)} district=${district.id}`,
      );
    }
  }

  // 5. Landmark IDs must be globally unique across districts.
  const landmarkIds = new Map<string, string>();
  for (const d of HARTHMERE_BIBLE_DISTRICTS) {
    for (const landmark of d.landmarks) {
      const prior = landmarkIds.get(landmark.id);
      if (prior) {
        failures.push(`landmark id collision: ${landmark.id} in ${prior} and ${d.id}`);
      } else {
        landmarkIds.set(landmark.id, d.id);
      }
    }
  }

  return { ok: failures.length === 0, failures };
}
