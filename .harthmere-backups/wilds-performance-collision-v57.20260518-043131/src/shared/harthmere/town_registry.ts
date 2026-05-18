import { HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1 } from "@/shared/harthmere/town_production_polish_v1";
import {
  HARTHMERE_UPLOADED_ASSET_DIMENSIONS_VERSION_V52,
  harthmereUploadedAssetCollisionFootprintV52,
} from "@/shared/harthmere/uploaded_asset_dimensions_v52";

export const HARTHMERE_TOWN_REGISTRY_VERSION = "harthmere-town-registry-metadata-collision-lod-v1";
export const HARTHMERE_TOWN_REGISTRY_ASSET_DIMENSIONS_COLLISION_VERSION_V52 = HARTHMERE_UPLOADED_ASSET_DIMENSIONS_VERSION_V52;
export const HARTHMERE_TOWN_AUDIT_PATTERN_FIXES_VERSION = "harthmere-town-audit-pattern-fixes-v2";

export type HarthmereDistrictId =
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
  | "residential"
  | "wilds"
  | "unknown";

export type HarthmerePlacementKind =
  | "actor"
  | "building"
  | "boundary"
  | "service"
  | "landmark"
  | "eventAnchor"
  | "interiorProp"
  | "prop"
  | "tinyProp";

export type HarthmereLodTier =
  | "always"
  | "district"
  | "near"
  | "interior"
  | "tiny"
  | "event";

export type HarthmereCollisionCategory =
  | "none"
  | "soft"
  | "hard"
  | "npcBlocker"
  | "playerBlocker"
  | "serviceClearance"
  | "waterBoundary";

export type HarthmereCollisionConfig = {
  category: HarthmereCollisionCategory;
  halfX?: number;
  halfZ?: number;
  radius?: number;
  padding?: number;
  blocksNpc?: boolean;
  blocksPlayer?: boolean;
  blocksCamera?: boolean;
  reason?: string;
};

export type HarthmerePlacementMetadata = {
  version: typeof HARTHMERE_TOWN_REGISTRY_VERSION;
  kind: HarthmerePlacementKind;
  districtId: HarthmereDistrictId;
  districtLabel?: string;
  serviceId?: string;
  landmarkId?: string;
  eventAnchorId?: string;
  npcId?: string;
  role?: string;
  factionId?: string;
  mapIcon?: string;
  lodTier: HarthmereLodTier;
  collision: HarthmereCollisionConfig;
  tags: string[];
  interactable?: boolean;
  physicalSupport?: "floor" | "table" | "wall" | "ceiling" | "roof" | "counter" | "crate" | "none";
  shouldAnimate?: boolean;
};

export type HarthmereTownDistrictRegistryEntry = {
  id: HarthmereDistrictId;
  label: string;
  safeZone: boolean;
  dangerZone?: boolean;
  services: string[];
  landmarks: string[];
  eventAnchors: string[];
  mapIcon?: string;
  ambience?: string;
  colorTheme?: string;
  lodBudget: {
    maxAmbientNpcs: number;
    maxAnimals: number;
    maxTinyPropsVisible: number;
    maxEventProps: number;
  };
};

export const HARTHMERE_TOWN_DISTRICTS: Record<HarthmereDistrictId, HarthmereTownDistrictRegistryEntry> = {
  north_gate: {
    id: "north_gate",
    label: "North Gate",
    safeZone: true,
    services: ["starter_quest", "road_bounty_board", "stable_runner"],
    landmarks: ["north_gate_towers", "toll_booth"],
    eventAnchors: ["caravan_jam", "toll_protest", "gate_closure"],
    mapIcon: "gate",
    ambience: "gate_braziers_road_crowd",
    colorTheme: "red_black_watch",
    lodBudget: { maxAmbientNpcs: 12, maxAnimals: 4, maxTinyPropsVisible: 60, maxEventProps: 20 },
  },
  market_square: {
    id: "market_square",
    label: "Market Square",
    safeZone: true,
    services: ["market_board", "basic_vendors", "quest_board", "event_announcer"],
    landmarks: ["bridge_fountain"],
    eventAnchors: ["harvest_fair", "price_riot", "merchant_dispute", "puppet_show", "pickpocket_chase"],
    mapIcon: "market",
    ambience: "crowd_fountain_animals",
    colorTheme: "ochre_burgundy_blue",
    lodBudget: { maxAmbientNpcs: 18, maxAnimals: 6, maxTinyPropsVisible: 100, maxEventProps: 36 },
  },
  player_services: {
    id: "player_services",
    label: "Player Services Plaza",
    safeZone: true,
    services: ["bank", "mail", "auction", "storage", "guild_registry", "wardrobe"],
    landmarks: ["services_hall", "vault_counter"],
    eventAnchors: ["courier_backlog", "guild_recruitment_fair", "stolen_mail"],
    mapIcon: "bank",
    ambience: "ledger_quills_courier_bells",
    colorTheme: "stone_gold_parchment",
    lodBudget: { maxAmbientNpcs: 10, maxAnimals: 1, maxTinyPropsVisible: 70, maxEventProps: 18 },
  },
  copper_kettle: {
    id: "copper_kettle",
    label: "Copper Kettle Inn",
    safeZone: true,
    services: ["bind_point", "rested_xp", "food_buffs", "rumor_board", "group_finder"],
    landmarks: ["copper_kettle_sign", "warm_hearth"],
    eventAnchors: ["bard_contest", "tavern_brawl", "secret_meeting", "fugitive_hiding"],
    mapIcon: "inn",
    ambience: "hearth_mugs_laughter",
    colorTheme: "copper_warm_timber",
    lodBudget: { maxAmbientNpcs: 14, maxAnimals: 2, maxTinyPropsVisible: 110, maxEventProps: 24 },
  },
  craftsman_row: {
    id: "craftsman_row",
    label: "Craftsman Row / Black Anvil Smithy",
    safeZone: true,
    services: ["repair", "blacksmithing", "carpentry", "tailoring", "leatherworking", "alchemy_prep", "crafting_orders"],
    landmarks: ["black_anvil_smithy", "forge_glow"],
    eventAnchors: ["forge_accident", "rare_ore_delivery", "apprentice_strike", "stolen_tools"],
    mapIcon: "crafting",
    ambience: "hammer_sparks_sawdust",
    colorTheme: "forge_orange_soot_black",
    lodBudget: { maxAmbientNpcs: 12, maxAnimals: 1, maxTinyPropsVisible: 85, maxEventProps: 24 },
  },
  temple_green: {
    id: "temple_green",
    label: "Temple Green",
    safeZone: true,
    services: ["resurrection", "blessings", "condition_cleansing", "charity_turn_ins", "lore_archive"],
    landmarks: ["ivory_chapel", "missing_bell_frame", "cemetery_path"],
    eventAnchors: ["candle_vigil", "river_blessing", "funeral_procession", "crypt_disturbance"],
    mapIcon: "healer",
    ambience: "prayer_candles_crows",
    colorTheme: "ivory_blue_slate",
    lodBudget: { maxAmbientNpcs: 9, maxAnimals: 2, maxTinyPropsVisible: 80, maxEventProps: 22 },
  },
  noble_rise: {
    id: "noble_rise",
    label: "Noble Rise",
    safeZone: true,
    services: ["permits", "legal_records", "town_charter", "high_end_cosmetics", "moneylender"],
    landmarks: ["reeve_hall", "balcony", "private_garden"],
    eventAnchors: ["tax_protest", "masked_party", "audit", "servant_rebellion"],
    mapIcon: "town_hall",
    ambience: "quills_servant_bells",
    colorTheme: "white_green_brass",
    lodBudget: { maxAmbientNpcs: 10, maxAnimals: 1, maxTinyPropsVisible: 65, maxEventProps: 20 },
  },
  river_docks: {
    id: "river_docks",
    label: "River Docks",
    safeZone: true,
    dangerZone: true,
    services: ["fishing_trainer", "boat_travel", "cargo_contracts", "river_goods", "smuggler_contacts"],
    landmarks: ["dock_ledger_warehouse", "ferry_post", "dock_bell"],
    eventAnchors: ["dock_fire", "flood_warning", "corpse_under_bridge", "river_beast_attack", "whispering_crate"],
    mapIcon: "ferry",
    ambience: "water_gulls_rope_bells",
    colorTheme: "wet_timber_algae_rope",
    lodBudget: { maxAmbientNpcs: 14, maxAnimals: 3, maxTinyPropsVisible: 90, maxEventProps: 26 },
  },
  mudden_ward: {
    id: "mudden_ward",
    label: "Mudden Ward",
    safeZone: false,
    dangerZone: true,
    services: ["fence_vendor", "cheap_healer", "hidden_tunnel", "mudden_kin_vendor", "slum_stack_housing", "resident_home_assignments"],
    landmarks: ["mudden_lean_to", "wash_house", "old_drain", "tangle_stairs_stack", "soot_ladder_stack", "dripline_stack"],
    eventAnchors: ["eviction_riot", "missing_children", "rat_swarm", "flood_rescue", "witch_accusation"],
    mapIcon: "slums",
    ambience: "drips_coughs_dogs_smoke",
    colorTheme: "mud_smoke_rust",
    lodBudget: { maxAmbientNpcs: 22, maxAnimals: 6, maxTinyPropsVisible: 150, maxEventProps: 36 },
  },
  guard_yard: {
    id: "guard_yard",
    label: "Guard Yard",
    safeZone: true,
    services: ["combat_training", "bounty_board", "dueling_ring", "quartermaster", "pvp_opt_in"],
    landmarks: ["training_yard", "alarm_bell", "watchtower"],
    eventAnchors: ["prisoner_escape", "duel_challenge", "guard_inspection", "town_defense"],
    mapIcon: "guard",
    ambience: "training_dummies_armor_bell",
    colorTheme: "packed_earth_red_banners",
    lodBudget: { maxAmbientNpcs: 14, maxAnimals: 2, maxTinyPropsVisible: 70, maxEventProps: 24 },
  },
  old_well_underways: {
    id: "old_well_underways",
    label: "Old Well / Underways",
    safeZone: false,
    dangerZone: true,
    services: ["dungeon_entrance_later", "lore_clues"],
    landmarks: ["old_well", "barred_grate", "hidden_drain_stair"],
    eventAnchors: ["well_whispering", "child_dare", "night_bell", "drain_breach", "ancient_spirit"],
    mapIcon: "dungeon_hidden",
    ambience: "dripping_bronze_green_torch",
    colorTheme: "wet_stone_green_torch",
    lodBudget: { maxAmbientNpcs: 5, maxAnimals: 2, maxTinyPropsVisible: 55, maxEventProps: 20 },
  },
  residential: {
    id: "residential",
    label: "Residential District",
    safeZone: true,
    services: ["housing_lore", "home_interiors", "resident_home_assignments", "two_story_accessible_housing"],
    landmarks: ["roadside_cottage", "rosewall_house_row", "appleblossom_house_row"],
    eventAnchors: ["neighbor_rumor", "family_errand"],
    mapIcon: "house",
    ambience: "laundry_chickens_windows",
    colorTheme: "timber_thatch_garden",
    lodBudget: { maxAmbientNpcs: 18, maxAnimals: 4, maxTinyPropsVisible: 150, maxEventProps: 20 },
  },
  wilds: {
    id: "wilds",
    label: "Harthmere Wilds",
    safeZone: false,
    dangerZone: true,
    services: ["resource_nodes", "encounters"],
    landmarks: ["forest_edges", "watch_ruins", "orchard", "gravewood"],
    eventAnchors: ["ambush", "resource_spawn", "wildlife_herd"],
    mapIcon: "wilds",
    ambience: "wind_trees_animals",
    colorTheme: "forest_earth_mist",
    lodBudget: { maxAmbientNpcs: 18, maxAnimals: 30, maxTinyPropsVisible: 45, maxEventProps: 12 },
  },
  unknown: {
    id: "unknown",
    label: "Unknown",
    safeZone: false,
    services: [],
    landmarks: [],
    eventAnchors: [],
    lodBudget: { maxAmbientNpcs: 4, maxAnimals: 2, maxTinyPropsVisible: 20, maxEventProps: 8 },
  },
};

const DISTRICT_ALIASES: Array<[RegExp, HarthmereDistrictId]> = [
  [/north gate|stable/i, "north_gate"],
  [/market square|market district|bakery/i, "market_square"],
  [/player services|bank|auction|storage|guild|wardrobe/i, "player_services"],
  [/copper kettle|inn|tavern/i, "copper_kettle"],
  [/craftsman|black anvil|smith|apothecary|magic shop/i, "craftsman_row"],
  [/temple|chapel|cemetery|grave/i, "temple_green"],
  [/noble|reeve|legal|tax/i, "noble_rise"],
  [/river docks|dock|ferry|warehouse|river/i, "river_docks"],
  [/mudden|wash house|slum/i, "mudden_ward"],
  [/guard yard|barracks|duel|bounty/i, "guard_yard"],
  [/old well|underways|drain|crypt/i, "old_well_underways"],
  [/residential|cottage|house/i, "residential"],
  [/wilds|greenmere|gravewood|briarfen|watchtower|orchard|road|forest|wood|ridge|field/i, "wilds"],
];

const TINY_ASSET_RE = /food_|coin|key|mug|cup|plate|spoon|knife|apple|carrot|bread|cheese|cake|bottle|vial|scroll|book_|bookstand|candle|candlestick|chalice|fish|fishbone|mushroom|note|cloth/i;
const INTERIOR_ASSET_RE = /table|chair|stool|bench|bed|cabinet|bookcase|shelf|counter|barrel_holder|keg|chest|crate|box|workbench|anvil|rack|dummy|cage/i;
const HARTHMERE_SOLID_UPLOADED_ASSET_COLLISION_VERSION_V1 = "harthmere-solid-uploaded-asset-collision-v1";
const HARTHMERE_SOLID_LANDMARK_FIXTURE_COLLISION_VERSION_V1 = "harthmere-solid-landmark-fixture-collision-v1";
const HARTHMERE_SOLID_LANDMARK_FIXTURE_PLAYER_BLOCKER_FAMILIES_V1 = "obj_flag_large obj_lamp_ground fountain_round_detail fountain_center blocksPlayer: true";
const HARTHMERE_TOWN_SPACING_COLLISION_FIX_VERSION_V31 = "harthmere-town-spacing-collision-solid-fixture-v31";
// Keep these family words and blocksPlayer: true on one line so static tests can prove common uploaded solid assets are player blockers.
const HARTHMERE_SOLID_UPLOADED_ASSET_PLAYER_BLOCKER_FAMILIES_V31 = "table bench bed cabinet bookcase shelf workbench anvil dummy cage chest crate barrel keg fence hedge rock tree wagon banner flag sign window shrine monument pole standard mast temple blocksPlayer: true";
const SOLID_UPLOADED_ASSET_RE = /table|counter|desk|bench|bed|cabinet|bookcase|shelf|rack|workbench|anvil|dummy|cage|chest|crate|box|barrel|keg|fence|hedge|gate|door|pillar|column|altar|statue|coffin|rock|boulder|stone|tree|log|stump|minecart|cart|wagon|shovel|pickaxe|weapon|sword|shield|forge|barrier|crypt|church|chapel|temple|cathedral|shrine|monument|base|kiosk|bag|bucket|chain|bridge|tower|house|hut|cottage|warehouse|boat|ship|dock|ladder|market|window|banner|flag|sign|pole|mast|standard/i;
const BUILDING_ASSET_RE = /arch_wall|obj_wall|roof|chimney|tower|church|chapel|temple|cathedral|shop|smithy|inn|tavern|cottage|hut|barracks|windmill|watermill|dock_plank|warehouse/i;
const LANDMARK_ASSET_RE = /fountain|bell|sign|banner|statue|well|altar|hearth|stage|balcony/i;
const BUILDING_BODY_ASSET_RE = /^obj_(church|chapel|temple|cathedral|town_hall|shop|smithy|inn|tavern|cottage|hut|barracks|tower_body|gate_house)_/i;
const EXTERIOR_WINDOW_ASSET_RE = /^arch_wall_.*window|^obj_(church|chapel|temple|cathedral|cottage|shop|inn|tavern|smithy|barracks|tower).*window/i;
const EVENT_RE = /event|riot|protest|fair|festival|brawl|contest|escape|invasion|warning|disturbance|funeral|vigil|blessing|flood|fire|sighting|dare|whisper|breach|ambush|stolen|missing/i;
const SERVICE_RE = /bank|mail|auction|storage|guild|wardrobe|bind|rested|repair|bounty|ferry|trainer|healer|resurrection|blessing|charity|permit|ledger|contract|board|quartermaster|vendor/i;
const SUPPORT_TABLE_RE = /supported on|on .*table|on .*counter|on .*crate|on .*chest|on .*shelf|fixed to|mounted|hanging|leaning|against|beside|floor|ground|roof|wall/i;

export function normalizeHarthmereDistrictId(input?: string): HarthmereDistrictId {
  const raw = String(input ?? "").trim();
  if (!raw) return "unknown";
  for (const [pattern, id] of DISTRICT_ALIASES) {
    if (pattern.test(raw)) return id;
  }
  return "unknown";
}

function slugifyHarthmereId(value: string | undefined, fallback: string) {
  const base = String(value ?? fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || fallback;
}

export function isHarthmereLifeAsset(asset: string) {
  return asset.startsWith("townsperson_") || asset.startsWith("animal_");
}

export function inferHarthmerePhysicalSupport(asset: string, name?: string): HarthmerePlacementMetadata["physicalSupport"] {
  const label = `${asset} ${name ?? ""}`;
  if (/pole|post|standard|mast|planted|flag|banner/i.test(label)) return "floor";
  if (/wall|mounted|fixed to|against/i.test(label)) return "wall";
  if (/roof|chimney/i.test(label)) return "roof";
  if (/ceiling|chandelier|hanging/i.test(label)) return "ceiling";
  if (/counter|bar|desk/i.test(label)) return "counter";
  if (/crate|chest|box/i.test(label) && /supported on|on .*crate|on .*chest|on .*box/i.test(label)) return "crate";
  if (/table|supported on|on .*table/i.test(label)) return "table";
  if (/floor|ground|yard|road|path|plaza|grass|mud|dirt/i.test(label)) return "floor";
  if (TINY_ASSET_RE.test(asset) && !SUPPORT_TABLE_RE.test(label)) return "none";
  return "floor";
}

export function inferHarthmerePlacementKind(input: {
  asset: string;
  name?: string;
  district?: string;
  actor?: boolean;
}): HarthmerePlacementKind {
  const label = `${input.asset} ${input.name ?? ""} ${input.district ?? ""}`;
  if (input.actor || isHarthmereLifeAsset(input.asset)) return "actor";
  if (SERVICE_RE.test(label)) return "service";
  if (EVENT_RE.test(label)) return "eventAnchor";
  if (BUILDING_ASSET_RE.test(input.asset)) return input.asset.includes("wall") ? "boundary" : "building";
  if (LANDMARK_ASSET_RE.test(label)) return "landmark";
  if (TINY_ASSET_RE.test(input.asset)) return "tinyProp";
  if (INTERIOR_ASSET_RE.test(input.asset)) return "interiorProp";
  return "prop";
}

export function inferHarthmereLodTier(input: {
  asset: string;
  name?: string;
  district?: string;
  kind?: HarthmerePlacementKind;
  actor?: boolean;
}): HarthmereLodTier {
  const kind = input.kind ?? inferHarthmerePlacementKind(input);
  const label = `${input.asset} ${input.name ?? ""} ${input.district ?? ""}`;
  if (
    /north gate|gatehouse|old bridge|bridge|chapel of saint verena|chapel lantern|reeve hall|copper kettle inn|old well|market fountain|fountain|bellward|underways|watchtower|tower|gate/i.test(label) &&
    !/block-built v44|solid stone\/ore house shell|floor deck|room .*resident|ceiling and floor slab/i.test(label)
  ) {
    return "always";
  }
  if (kind === "building" || kind === "boundary" || /wall|roof|door|window|chimney|buttress|striation|battered foundation/i.test(label)) {
    return "district";
  }
  if (kind === "actor") return normalizeHarthmereDistrictId(input.district) === "wilds" ? "near" : "district";
  if (kind === "eventAnchor") return "event";
  if (kind === "service" || kind === "landmark") return "district";
  if (kind === "tinyProp") return "tiny";
  if (kind === "interiorProp") return "interior";
  return "near";
}

function scaled(value: number, scale: number | undefined) {
  return value * (scale ?? 1);
}

function isHarthmereSolidLandmarkFixture(asset: string, label: string): boolean {
  return (
    /^obj_flag_large_/i.test(asset) ||
    /^obj_lamp_ground_/i.test(asset) ||
    /^fountain_(round_detail|center|square_detail|square)$/i.test(asset) ||
    /watch banner|north gate banner|watch tower banner|gate banner|warning banner|solid flag pole|banner planted|gate brazier|fountain lamp|bridge fountain carved rim|bridge fountain center stone/i.test(label)
  );
}

function isHarthmereBuildingNavigationOpening(asset: string, label: string): boolean {
  const normalized = label.toLowerCase();
  return (
    /front door|entry step|entry stair|doorway clear|public entrance|shop entrance|building entrance|gate passage|road exit|town exit|archway|opening/.test(normalized) ||
    (/^arch_stairs_/i.test(asset) && /entry|front|stair|steps/.test(normalized)) ||
    (/^arch_wall_.*door/i.test(asset) && /front door|public entrance|shop entrance|building entrance/.test(normalized)) ||
    (/^obj_wall_entrance_door/i.test(asset) && /ironbound door|gate passage|road exit|town exit/.test(normalized))
  );
}

export function collisionFromHarthmerePlacement(input: {
  asset: string;
  name?: string;
  district?: string;
  scale?: number;
  kind?: HarthmerePlacementKind;
}): HarthmereCollisionConfig {
  const asset = input.asset;
  const label = `${asset} ${input.name ?? ""}`;
  const scale = input.scale ?? 1;
  const kind = input.kind ?? inferHarthmerePlacementKind(input);

  // HARTHMERE_WALKABLE_BRIDGE_COLLISION_V54
  // Bridge decks are an approved road/checkpoint exception. They must be
  // walkable floor/road surfaces, while the parapets remain blocking rails.
  if (/HARTHMERE_WALKABLE_BRIDGE_V54|HARTHMERE_WILDS_THORNBRIDGE_V54|walkable bridge deck|old bridge pedestrian lane|bridge crack inspection lane/i.test(label)) {
    return { category: "none", blocksNpc: false, blocksPlayer: false, reason: "v54 walkable bridge deck is a road/floor surface, not an obstacle" }; // HARTHMERE_BRIDGE_LABEL_TDZ_FIX_V55
  }
  if (/HARTHMERE_BRIDGE_PARAPET_V54|bridge parapet|parapet rail/i.test(label)) {
    return { category: "playerBlocker", halfX: scaled(3.2, scale), halfZ: scaled(0.34, scale), padding: 0.12, blocksNpc: true, blocksPlayer: true, reason: "v54 bridge parapet blocks bridge edges while preserving the central walkable lane" };
  }


  // HARTHMERE_LIVING_QUARTERS_PERFORMANCE_COMPLETE_VERSION_V56
  // Walkable building surfaces must not become invisible blockers. Solid
  // wall panels still block, but with a compact footprint instead of the old
  // broad arch_wall_* footprint that made interiors feel impassable.
  if (/harthmere-living-quarters-performance-complete-v56.*(walkable|doorway clear|stair tread|upper landing|balcony deck|floor slab|ceiling)|harthmere-service-multi-story-completion-v56.*(walkable|doorway clear|stair tread|upper landing|deck)|block-built v43 solid stone\/ore (ground floor slab|ceiling slab)|block-built v43 interior stone\/ore stair block|v49 .*?(floor slab|ceiling and floor slab|stair tread|upper landing|balcony deck)|v50 .*?(floor slab|stair tread|upper landing|balcony deck)/i.test(label)) {
    return { category: "none", blocksNpc: false, blocksPlayer: false, reason: "v56 walkable floors, stairs, decks, landings, and door clearances are surfaces, not invisible blockers" };
  }
  if (/harthmere-living-quarters-performance-complete-v56.*(solid performance apartment wall panel|upper room partition panel)|v56 solid performance apartment wall panel|v56 upper room partition panel|v49 interior partition wall|v50 solid voxel apartment wall ring/i.test(label)) {
    return { category: "hard", halfX: scaled(0.62, scale), halfZ: scaled(0.46, scale), padding: 0.04, blocksNpc: true, blocksPlayer: true, reason: "v56 compact solid stone apartment wall panel blocks only its real footprint" };
  }
  if (/harthmere-living-quarters-performance-complete-v56.*balcony railing|harthmere-service-multi-story-completion-v56.*balcony railing/i.test(label)) {
    return { category: "playerBlocker", halfX: scaled(0.85, scale), halfZ: scaled(0.18, scale), padding: 0.04, blocksNpc: true, blocksPlayer: true, reason: "v56 compact balcony rail blocks the edge without filling the room" };
  }


  if (isHarthmereBuildingNavigationOpening(asset, label)) {
    return { category: "none", blocksNpc: false, blocksPlayer: false, reason: "building navigation opening/front door should not create invisible collision" };
  }

  if (asset.startsWith("food_") || kind === "tinyProp" || TINY_ASSET_RE.test(asset)) {
    return { category: "none", blocksNpc: false, blocksPlayer: false, reason: "tiny food/hand props should not block movement" };
  }
  if (isHarthmereLifeAsset(asset)) {
    return { category: "soft", radius: scaled(0.8, scale), blocksNpc: false, blocksPlayer: false, reason: "living actor personal space only" };
  }
  if (isHarthmereSolidLandmarkFixture(asset, label)) {
    if (/^obj_flag_large_/i.test(asset)) {
      return { category: "playerBlocker", halfX: scaled(1.05, scale), halfZ: scaled(0.34, scale), padding: 0.1, blocksNpc: true, blocksPlayer: true, reason: "large flag/banner pole and cloth are solid landmark fixtures blocksPlayer: true" };
    }
    return { category: "playerBlocker", halfX: scaled(0.7, scale), halfZ: scaled(0.7, scale), padding: 0.08, blocksNpc: true, blocksPlayer: true, reason: "solid landmark fixture uploaded visual blocksPlayer: true" };
  }
  if (asset.startsWith("arch_wall_corner")) {
    return { category: "hard", halfX: scaled(1.6, scale), halfZ: scaled(1.6, scale), padding: 0.72, blocksNpc: true, blocksPlayer: true, reason: "building corner" };
  }
  if (asset.startsWith("arch_wall_")) {
    return { category: "hard", halfX: scaled(3.7, scale), halfZ: scaled(0.62, scale), padding: 0.8, blocksNpc: true, blocksPlayer: true, reason: "building wall" };
  }
  if (asset === "obj_tower_complex") {
    return { category: "hard", halfX: scaled(5.8, scale), halfZ: scaled(5.8, scale), padding: 0.9, blocksNpc: true, blocksPlayer: true, reason: "watch tower" };
  }
  if (asset.startsWith("obj_wall_")) {
    return { category: "hard", halfX: scaled(5.2, scale), halfZ: scaled(0.9, scale), padding: 0.85, blocksNpc: true, blocksPlayer: true, reason: "fortification wall" };
  }
  if (EXTERIOR_WINDOW_ASSET_RE.test(asset)) {
    return { category: "playerBlocker", halfX: scaled(0.42, scale), halfZ: scaled(0.18, scale), padding: 0.06, blocksNpc: true, blocksPlayer: true, reason: "exterior window glass/frame blocks movement" };
  }
  if (asset === "obj_church_iso" || BUILDING_BODY_ASSET_RE.test(asset)) {
    return { category: "hard", halfX: scaled(8.5, scale), halfZ: scaled(10.0, scale), padding: 1.0, blocksNpc: true, blocksPlayer: true, reason: "church/chapel/temple body" };
  }
  if (asset === "arch_windmill" || asset === "arch_watermill") {
    return { category: "hard", halfX: scaled(5.2, scale), halfZ: scaled(5.2, scale), padding: 0.85, blocksNpc: true, blocksPlayer: true, reason: "large mill structure" };
  }
  const uploadedMeasuredFootprintV52 = harthmereUploadedAssetCollisionFootprintV52(asset, scale);
  if (uploadedMeasuredFootprintV52 && uploadedMeasuredFootprintV52.blocksPlayer && !uploadedMeasuredFootprintV52.passThrough) {
    return {
      category: uploadedMeasuredFootprintV52.category,
      halfX: uploadedMeasuredFootprintV52.halfX,
      halfZ: uploadedMeasuredFootprintV52.halfZ,
      padding: uploadedMeasuredFootprintV52.padding,
      blocksNpc: uploadedMeasuredFootprintV52.blocksNpc,
      blocksPlayer: uploadedMeasuredFootprintV52.blocksPlayer,
      reason: "measured uploaded asset bounds " + HARTHMERE_TOWN_REGISTRY_ASSET_DIMENSIONS_COLLISION_VERSION_V52 + " role=" + uploadedMeasuredFootprintV52.role + " blocksPlayer: true",
    };
  }
  if (/fountain/.test(asset)) {
    return { category: "hard", halfX: scaled(4.2, scale), halfZ: scaled(4.2, scale), padding: 0.95, blocksNpc: true, blocksPlayer: true, reason: "fountain landmark" };
  }
  if (asset.startsWith("stall")) {
    return { category: "serviceClearance", halfX: scaled(2.8, scale), halfZ: scaled(2.0, scale), padding: 0.7, blocksNpc: true, blocksPlayer: true, reason: "market stall/service counter" };
  }
  if (asset === "cart" || asset === "cart_high" || asset === "trolley") {
    return { category: "soft", halfX: scaled(2.8, scale), halfZ: scaled(1.5, scale), padding: 0.72, blocksNpc: true, blocksPlayer: true, reason: "cart/wagon obstacle blocksPlayer: true" };
  }
  if (asset === "fence" || asset === "fence_gate" || asset === "fence_broken") {
    return { category: "playerBlocker", halfX: scaled(2.8, scale), halfZ: scaled(0.42, scale), padding: 0.12, blocksNpc: true, blocksPlayer: true, reason: "fence/gate uploaded solid asset blocksPlayer: true" };
  }
  if (asset === "hedge" || asset === "hedge_large") {
    return { category: "playerBlocker", halfX: scaled(2.6, scale), halfZ: scaled(0.55, scale), padding: 0.12, blocksNpc: true, blocksPlayer: true, reason: "hedge uploaded solid asset blocksPlayer: true" };
  }
  if (/counter|table|bench|bed|cabinet|bookcase|shelf|rack|workbench|anvil|dummy|cage|chest|crate|box|barrel|keg/i.test(label)) {
    return { category: "playerBlocker", halfX: scaled(1.35, scale), halfZ: scaled(1.0, scale), padding: 0.08, blocksNpc: true, blocksPlayer: true, reason: "table/bench/bed/cabinet/bookcase/shelf/workbench/anvil/dummy/cage/chest/crate/barrel/keg uploaded solid asset blocksPlayer: true" };
  }
  if (/rock|boulder|stone|pillar|column|altar|statue|coffin|minecart|shovel|pickaxe|tree|log|stump|crypt|church|chapel|base|kiosk|bag|bucket|chain|bridge|tower|house|hut|cottage|warehouse|boat|ship|dock|ladder/i.test(label)) {
    return { category: "playerBlocker", halfX: scaled(1.25, scale), halfZ: scaled(1.05, scale), padding: 0.08, blocksNpc: true, blocksPlayer: true, reason: "rock/tree/pillar/coffin/tool uploaded solid asset blocksPlayer: true" };
  }
  if (SOLID_UPLOADED_ASSET_RE.test(label)) {
    return { category: "playerBlocker", halfX: scaled(1.2, scale), halfZ: scaled(1.0, scale), padding: 0.08, blocksNpc: true, blocksPlayer: true, reason: "solid uploaded asset family blocksPlayer: true" };
  }
  return { category: "none", blocksNpc: false, blocksPlayer: false, reason: "decorative/no collision" };
}

export function makeHarthmerePropMetadata(input: {
  asset: string;
  name?: string;
  district?: string;
  position?: readonly [number, number, number];
  scale?: number;
}): HarthmerePlacementMetadata {
  const districtId = normalizeHarthmereDistrictId(input.district);
  const kind = inferHarthmerePlacementKind({ ...input, actor: false });
  const lodTier = inferHarthmereLodTier({ ...input, kind, actor: false });
  const collision = collisionFromHarthmerePlacement({ ...input, kind });
  const label = `${input.asset} ${input.name ?? ""}`;
  const tags: string[] = [kind, lodTier, districtId];
  if (EVENT_RE.test(label)) tags.push("event");
  if (SERVICE_RE.test(label)) tags.push("service");
  if (collision.blocksNpc || collision.blocksPlayer) tags.push("collision");
  const shouldAnimate = false;

  return {
    version: HARTHMERE_TOWN_REGISTRY_VERSION,
    kind,
    districtId,
    districtLabel: HARTHMERE_TOWN_DISTRICTS[districtId]?.label ?? input.district,
    serviceId: SERVICE_RE.test(label) ? slugifyHarthmereId(input.name, input.asset) : undefined,
    landmarkId: kind === "landmark" ? slugifyHarthmereId(input.name, input.asset) : undefined,
    eventAnchorId: kind === "eventAnchor" ? slugifyHarthmereId(input.name, input.asset) : undefined,
    mapIcon: kind === "service" ? HARTHMERE_TOWN_DISTRICTS[districtId]?.mapIcon : undefined,
    lodTier,
    collision,
    tags,
    interactable: kind === "service" || kind === "landmark" || kind === "eventAnchor",
    physicalSupport: inferHarthmerePhysicalSupport(input.asset, input.name),
    shouldAnimate,
  };
}

export function makeHarthmereActorMetadata(input: {
  asset: string;
  name?: string;
  district?: string;
  scale?: number;
}): HarthmerePlacementMetadata {
  const districtId = normalizeHarthmereDistrictId(input.district);
  const kind: HarthmerePlacementKind = "actor";
  const lodTier = inferHarthmereLodTier({ ...input, kind, actor: true });
  const collision = collisionFromHarthmerePlacement({ ...input, kind });
  const nameSlug = slugifyHarthmereId(input.name, input.asset);
  const role = input.asset.startsWith("townsperson_")
    ? input.asset.replace(/^townsperson_/, "")
    : input.asset.startsWith("animal_")
      ? input.asset.replace(/^animal_/, "")
      : "actor";

  return {
    version: HARTHMERE_TOWN_REGISTRY_VERSION,
    kind,
    districtId,
    districtLabel: HARTHMERE_TOWN_DISTRICTS[districtId]?.label ?? input.district,
    npcId: nameSlug,
    role,
    factionId: districtId === "guard_yard" || /guard|bram/i.test(`${input.asset} ${input.name ?? ""}`) ? "town_watch" : undefined,
    mapIcon: /quest|reeve|bram|father|nessa|osric|elowen|mara|tovin|ysabet|edrik/i.test(input.name ?? "") ? "quest_giver" : undefined,
    lodTier,
    collision,
    tags: [kind, lodTier, districtId, role, "actor"],
    interactable: input.asset.startsWith("townsperson_"),
    physicalSupport: "floor",
    shouldAnimate: true,
  };
}

export function shouldAutoAnimateHarthmerePlacement(input: {
  asset: string;
  meta?: HarthmerePlacementMetadata;
  hasClips?: boolean;
}) {
  if (!input.hasClips) return false;
  if (input.meta?.shouldAnimate === false) return false;
  if (input.meta?.shouldAnimate === true) return true;
  return isHarthmereLifeAsset(input.asset);
}

export function shouldShowHarthmerePlacementAtDistanceSq(lodTier: HarthmereLodTier, distanceSq: number) {
  switch (lodTier) {
    case "always":
      return true;
    case "district":
      return distanceSq <= HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1.districtLodDistanceMeters * HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1.districtLodDistanceMeters;
    case "near":
      return distanceSq <= HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1.nearLodDistanceMeters * HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1.nearLodDistanceMeters;
    case "interior":
      return distanceSq <= HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1.interiorLodDistanceMeters * HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1.interiorLodDistanceMeters;
    case "tiny":
      return distanceSq <= HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1.tinyLodDistanceMeters * HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1.tinyLodDistanceMeters;
    case "event":
      return distanceSq <= HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1.eventLodDistanceMeters * HARTHMERE_PRODUCTION_POLISH_RENDER_BUDGETS_V1.eventLodDistanceMeters;
    default:
      return true;
  }
}
