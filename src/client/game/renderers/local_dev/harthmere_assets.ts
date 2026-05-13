import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScenes } from "@/client/game/renderers/scenes";
import { log } from "@/shared/logging";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils";

type AssetFormat = "gltf" | "fbx" | "obj";

type RuntimeAsset = {
  key: string;
  format: AssetFormat;
  path: string;
  defaultScale?: number;
};

type RuntimePlacement = {
  asset: string;
  at: [number, number, number];
  rot?: number;
  scale?: number;
  name?: string;
  district?: string;
  bob?: number;
  spin?: number;
  wander?: {
    radius: number;
    speed: number;
    phase?: number;
  };
};

type RuntimePrototype = {
  object: THREE.Object3D;
  clips: THREE.AnimationClip[];
};

type AnimatedInstance = {
  object: THREE.Object3D;
  mixer?: THREE.AnimationMixer;
  base: [number, number, number];
  rot: number;
  bob?: number;
  spin?: number;
  wander?: {
    radius: number;
    speed: number;
    phase?: number;
  };
};

const ROOT = "/assets/harthmere";
const GROUND_Y = 53.05;

function assetUrl(path: string) {
  return path
    .split("/")
    .map((part, index) => (index === 0 && part === "" ? "" : encodeURIComponent(part)))
    .join("/");
}

function gltf(key: string, path: string, defaultScale = 1): RuntimeAsset {
  return { key, format: "gltf", path: `${ROOT}/${path}`, defaultScale };
}

function fbx(key: string, path: string, defaultScale = 1): RuntimeAsset {
  return { key, format: "fbx", path: `${ROOT}/${path}`, defaultScale };
}

function obj(key: string, folder: string, file: string, defaultScale = 1): RuntimeAsset {
  return {
    key,
    format: "obj",
    path: `${ROOT}/obj/${folder}/${file}`,
    defaultScale,
  };
}

// Curated from public/assets/harthmere/manifest/harthmere-selected-assets.json
// plus the best older OBJ props. Do not load the whole asset library; the full
// library is too noisy for a playable town pass.
const ASSETS: RuntimeAsset[] = [
  // Market, exterior, and district readability.
  gltf("stall", "glb/props/market/stall.glb", 0.95),
  gltf("stall_red", "glb/props/market/stall-red.glb", 0.95),
  gltf("stall_green", "glb/props/market/stall-green.glb", 0.95),
  gltf("stall_bench", "glb/props/market/stall-bench.glb", 0.95),
  gltf("cart", "glb/props/market/cart.glb", 0.9),
  gltf("cart_high", "glb/props/market/cart-high.glb", 0.85),
  gltf("fountain_round", "glb/props/market/fountain-round.glb", 1.1),
  gltf("fountain_square", "glb/props/market/fountain-square.glb", 1.0),
  gltf("banner_red", "glb/props/town/banner-red.glb", 0.9),
  gltf("banner_green", "glb/props/town/banner-green.glb", 0.9),
  gltf("lantern", "glb/props/town/lantern.glb", 0.8),
  gltf("tree", "glb/environment/trees/tree.glb", 1.0),
  gltf("tree_high", "glb/environment/trees/tree-high.glb", 1.0),
  gltf("tree_crooked", "glb/environment/trees/tree-crooked.glb", 1.0),
  gltf("hedge", "glb/environment/shrubbery/hedge.glb", 0.95),
  gltf("hedge_large", "glb/environment/shrubbery/hedge-large.glb", 0.95),
  gltf("fence", "glb/environment/fences/fence.glb", 0.95),
  gltf("fence_gate", "glb/environment/fences/fence-gate.glb", 0.95),
  gltf("fence_broken", "glb/environment/fences/fence-broken.glb", 0.95),
  gltf("road", "glb/environment/roads/road.glb", 1.0),
  gltf("rock_small", "glb/environment/rocks/rock-small.glb", 0.8),
  gltf("rock_wide", "glb/environment/rocks/rock-wide.glb", 0.8),

  // Interior kit: all visual-only props, placed away from doorway lanes.
  gltf("table_small", "glb/props/dungeon/table_small.gltf.glb", 0.78),
  gltf("table_medium", "glb/props/dungeon/table_medium.gltf.glb", 0.82),
  gltf("table_long", "glb/props/dungeon/table_long.gltf.glb", 0.82),
  gltf("table_long_decorated", "glb/props/dungeon/table_long_decorated_A.gltf.glb", 0.82),
  gltf("table_tablecloth", "glb/props/dungeon/table_medium_tablecloth.gltf.glb", 0.82),
  gltf("chair", "glb/props/dungeon/chair.gltf.glb", 0.72),
  gltf("shelf_small", "glb/props/dungeon/shelf_small.gltf.glb", 0.78),
  gltf("shelf_large", "glb/props/dungeon/shelf_large.gltf.glb", 0.78),
  gltf("shelf_candles", "glb/props/dungeon/shelf_small_candles.gltf.glb", 0.78),
  gltf("barrel_small", "glb/props/dungeon/barrel_small.gltf.glb", 0.74),
  gltf("barrel_stack", "glb/props/dungeon/barrel_small_stack.gltf.glb", 0.74),
  gltf("barrel_large", "glb/props/dungeon/barrel_large.gltf.glb", 0.74),
  gltf("crates_stacked", "glb/props/dungeon/crates_stacked.gltf.glb", 0.76),
  gltf("box_decorated", "glb/props/dungeon/box_small_decorated.gltf.glb", 0.76),
  gltf("box_stacked", "glb/props/dungeon/box_stacked.gltf.glb", 0.76),
  gltf("chest", "glb/props/dungeon/chest.glb", 0.76),
  gltf("chest_gold", "glb/props/dungeon/chest_gold.glb", 0.76),
  gltf("torch_lit", "glb/props/dungeon/torch_lit.gltf.glb", 0.72),
  gltf("torch_mounted", "glb/props/dungeon/torch_mounted.gltf.glb", 0.72),
  gltf("wall_shelves", "glb/props/dungeon/wall_shelves.gltf.glb", 0.8),
  gltf("pillar", "glb/props/dungeon/pillar.gltf.glb", 0.8),
  gltf("key", "glb/props/dungeon/key.gltf.glb", 0.55),

  // Magic/apothecary and color identity.
  gltf("candle", "glb/props/magic/candle.gltf.glb", 0.65),
  gltf("candle_lit", "glb/props/magic/candle_lit.gltf.glb", 0.65),
  gltf("candle_thin_lit", "glb/props/magic/candle_thin_lit.gltf.glb", 0.65),
  gltf("candle_triple", "glb/props/magic/candle_triple.gltf.glb", 0.65),
  gltf("bottle_brown", "glb/props/magic/bottle_A_labeled_brown.gltf.glb", 0.62),
  gltf("bottle_green", "glb/props/magic/bottle_A_labeled_green.gltf.glb", 0.62),
  gltf("bottle_b", "glb/props/magic/bottle_B_brown.gltf.glb", 0.62),
  gltf("banner_blue", "glb/props/magic/banner_patternA_blue.gltf.glb", 0.82),
  gltf("banner_yellow", "glb/props/magic/banner_patternB_yellow.gltf.glb", 0.82),
  gltf("banner_white", "glb/props/magic/banner_white.gltf.glb", 0.82),
  gltf("banner_brown", "glb/props/magic/banner_brown.gltf.glb", 0.82),

  // Wieldable/display equipment. These remain visual-only in town until a hand
  // socket/equipment attachment system consumes them.
  gltf("sword_1h", "glb/equipment/weapons/sword_1handed.gltf", 0.7),
  gltf("sword_2h", "glb/equipment/weapons/sword_2handed.gltf", 0.72),
  gltf("axe_1h", "glb/equipment/weapons/axe_1handed.gltf", 0.72),
  gltf("dagger", "glb/equipment/weapons/dagger.gltf", 0.65),
  gltf("shield_round", "glb/equipment/shields/shield_round.gltf", 0.7),
  gltf("shield_round_color", "glb/equipment/shields/shield_round_color.gltf", 0.7),
  gltf("shield_square_color", "glb/equipment/shields/shield_square_color.gltf", 0.7),
  gltf("bow", "glb/equipment/ranged/bow.gltf", 0.72),
  gltf("crossbow", "glb/equipment/ranged/crossbow_2handed.gltf", 0.72),
  gltf("quiver", "glb/equipment/ranged/quiver.gltf", 0.72),
  gltf("staff", "glb/equipment/magic/staff.gltf", 0.75),
  gltf("wand", "glb/equipment/magic/wand.gltf", 0.7),
  gltf("spellbook_closed", "glb/equipment/magic/spellbook_closed.gltf", 0.7),
  gltf("spellbook_open", "glb/equipment/magic/spellbook_open.gltf", 0.7),
  gltf("mug_empty", "glb/equipment/items/mug_empty.gltf", 0.65),
  gltf("mug_full", "glb/equipment/items/mug_full.gltf", 0.65),

  // Older OBJ packs still have useful bespoke medieval props.
  obj("bread_loaf", "tavern", "tavern-58-bread_loaf", 1.05),
  obj("bread_slice", "tavern", "tavern-57-bread_slice", 1.05),
  obj("cake", "tavern", "tavern-56-cake", 1.0),
  obj("keg_iso", "tavern", "tavern-76-keg_iso", 1.0),
  obj("keg_metal", "tavern", "tavern-17-keg_metalbinding", 1.0),
  obj("tavern_bar", "tavern", "tavern-25-bar", 0.95),
  obj("tavern_bar_corner", "tavern", "tavern-24-barcorner", 0.95),
  obj("tavern_table", "tavern", "tavern-48-table", 1.0),
  obj("tavern_chair", "tavern", "tavern-46-chair", 0.9),
  obj("tavern_stool", "tavern", "tavern-47-stool", 0.9),
  obj("tavern_bookshelf", "tavern", "tavern-35-bookshelf_books", 0.92),
  obj("church_bench", "church_cemetery", "church-27-ch_bench2", 0.95),
  obj("church_pulpit", "church_cemetery", "church-29-ch_pulpit2", 0.95),
  obj("church_candelabra", "church_cemetery", "church-38-candelabrawhite", 0.9),
  obj("church_lantern", "church_cemetery", "church-59-lantern", 0.85),
  obj("tombstone", "church_cemetery", "church-58-gy_tombstone1", 0.85),
  obj("coffin", "church_cemetery", "church-55-coffin", 0.9),
  obj("shovel", "church_cemetery", "church-72-shovel", 0.85),
  obj("crate_a", "town_sample", "Medieval Town - Free Sample-0-Crate-0", 1.45),
  obj("crate_b", "town_sample", "Medieval Town - Free Sample-1-Crate-1", 1.45),
  obj("crate_c", "town_sample", "Medieval Town - Free Sample-5-Crate-2", 1.45),
  obj("trolley", "town_sample", "Medieval Town - Free Sample-3-Trolley", 0.95),
  obj("rack", "town_sample", "Medieval Town - Free Sample-8-Rack", 0.95),
  obj("logs", "town_sample", "Medieval Town - Free Sample-9-Logs", 0.95),

  // Animals only. No monster placements in town.
];

const assetByKey = new Map(ASSETS.map((asset) => [asset.key, asset]));

const P = (
  asset: string,
  x: number,
  z: number,
  rot = 0,
  scale?: number,
  name?: string,
  districtOrY?: string | number,
  y = GROUND_Y
): RuntimePlacement => {
  const district = typeof districtOrY === "string" ? districtOrY : undefined;
  const placementY = typeof districtOrY === "number" ? districtOrY : y;
  return { asset, at: [x, placementY, z], rot, scale, name, district };
};

const A = (
  asset: string,
  x: number,
  z: number,
  rot = 0,
  scale?: number,
  name?: string,
  district?: string,
  wander?: RuntimePlacement["wander"]
): RuntimePlacement => ({
  asset,
  at: [x, GROUND_Y, z],
  rot,
  scale,
  name,
  district,
  bob: 0.015,
  wander,
});

const SHOP_COUNTER_Y = GROUND_Y + 0.03;

const PLACEMENTS: RuntimePlacement[] = [
  // North Gate and arrival path: make the first route obvious.
  P("banner_red", 481, -270, 0, 1.1, "Red Watch banner", "North Gate"),
  P("banner_red", 493, -270, 0, 1.1, "Red Watch banner", "North Gate"),
  P("lantern", 480, -263, 0, 0.85, "Gate lantern", "North Gate"),
  P("lantern", 494, -263, 0, 0.85, "Gate lantern", "North Gate"),
  P("cart", 474, -260, Math.PI / 2, 0.82, "Traveler cart", "North Gate"),
  P("crate_a", 472, -257, 0, 1.2, "Traveler crate", "North Gate"),
  P("fence", 499, -260, Math.PI / 2, 0.9, "Gate crowd rail", "North Gate"),
  P("fence", 501, -260, Math.PI / 2, 0.9, "Gate crowd rail", "North Gate"),

  // Market Square: open center, bright fountain, stalls on edges, no blocked main road.
  P("fountain_round", 486, -210, 0, 1.35, "Bridge Fountain", "Market Square"),
  P("stall_red", 439, -201, Math.PI / 2, 1.05, "Red produce stall", "Market Square"),
  P("stall_green", 529, -202, -Math.PI / 2, 1.05, "Green cloth stall", "Market Square"),
  P("stall", 529, -191, -Math.PI / 2, 1.05, "General goods stall", "Market Square"),
  P("stall_bench", 468, -218, Math.PI, 0.95, "Market bench display", "Market Square"),
  P("cart_high", 470, -207, Math.PI / 2, 0.8, "Market handcart", "Market Square"),
  P("cart", 503, -219, -Math.PI / 2, 0.82, "Market board cart", "Market Square"),
  P("crate_b", 444, -207, 0, 1.18, "Stacked apples crate", "Market Square"),
  P("crate_c", 532, -207, 0, 1.18, "Trade crate", "Market Square"),
  P("barrel_small", 524, -186, 0, 0.9, "Market barrel", "Market Square"),
  P("banner_green", 475, -197, 0, 1.0, "Guild board banner", "Market Square"),
  P("banner_yellow", 497, -198, 0, 0.9, "Auction overflow banner", "Market Square"),
  A("animal_pigeon", 483, -207, 0.2, 0.013, "Pigeon at the fountain", "Market Square", {
    radius: 1.1,
    speed: 0.45,
    phase: 0.2,
  }),
  A("animal_pigeon", 491, -213, -0.6, 0.012, "Pigeon near quest board", "Market Square", {
    radius: 0.8,
    speed: 0.5,
    phase: 2.1,
  }),

  // Player Services Plaza: bank, mail, auction, guild registrar flavor.
  P("table_long_decorated", 551, -218, Math.PI / 2, 0.82, "Ledger table", "Player Services", SHOP_COUNTER_Y),
  P("table_long", 547, -224, Math.PI / 2, 0.82, "Bank counter", "Player Services", SHOP_COUNTER_Y),
  P("chest", 556, -228, 0, 0.8, "Bank lockbox", "Player Services"),
  P("chest_gold", 558, -226, 0, 0.75, "Vault strongbox", "Player Services"),
  P("shelf_large", 560, -220, -Math.PI / 2, 0.82, "Bank ledger shelf", "Player Services"),
  P("key", 553, -218, 0.4, 0.5, "Vault key", "Player Services", SHOP_COUNTER_Y + 0.45),
  P("banner_green", 544, -216, Math.PI / 2, 0.85, "Guild registrar marker", "Player Services"),
  P("cart", 540, -216, Math.PI, 0.7, "Courier cart", "Player Services"),

  // Dawn Loaf Bakery: warm, food-heavy, with a clear customer lane from the door.
  P("table_medium", 428, -188, 0, 0.8, "Kneading table", "Bakery", SHOP_COUNTER_Y),
  P("shelf_large", 421.2, -190, Math.PI / 2, 0.8, "Bread rack", "Bakery"),
  P("shelf_small", 421.2, -195, Math.PI / 2, 0.8, "Flour shelf", "Bakery"),
  P("bread_loaf", 426.5, -188.2, 0.3, 1.0, "Bread loaves", "Bakery", SHOP_COUNTER_Y + 0.35),
  P("bread_slice", 429.5, -188.2, -0.2, 1.0, "Bread slices", "Bakery", SHOP_COUNTER_Y + 0.35),
  P("cake", 435, -193, 0, 0.95, "Display cake", "Bakery", SHOP_COUNTER_Y + 0.3),
  P("barrel_small", 430, -196, 0, 0.75, "Flour barrel", "Bakery"),
  P("box_decorated", 432, -196, 0, 0.76, "Seed cake box", "Bakery"),
  P("torch_lit", 423.3, -197, Math.PI / 2, 0.72, "Oven glow", "Bakery"),
  P("lantern", 438, -188, 0, 0.7, "Bakery sign lantern", "Bakery"),

  // Craftsman Row / Black Anvil: forge visible from market, weapon displays along walls only.
  P("torch_lit", 524, -235, Math.PI / 2, 0.82, "Forge glow", "Craftsman Row"),
  P("table_medium", 531, -223, 0, 0.82, "Repair bench", "Craftsman Row", SHOP_COUNTER_Y),
  P("rack", 538, -232, -Math.PI / 2, 0.95, "Weapon rack", "Craftsman Row"),
  P("rack", 538, -226, -Math.PI / 2, 0.95, "Weapon rack", "Craftsman Row"),
  P("sword_1h", 536, -226, -Math.PI / 2, 0.68, "Training sword", "Craftsman Row", SHOP_COUNTER_Y + 0.55),
  P("sword_2h", 536, -232, -Math.PI / 2, 0.68, "Two handed sword", "Craftsman Row", SHOP_COUNTER_Y + 0.55),
  P("axe_1h", 533, -224, 0.1, 0.68, "Hand axe", "Craftsman Row", SHOP_COUNTER_Y + 0.45),
  P("dagger", 530, -224, 0.5, 0.68, "Dagger", "Craftsman Row", SHOP_COUNTER_Y + 0.45),
  P("shield_round_color", 535, -236, Math.PI, 0.72, "Round shield", "Craftsman Row"),
  P("shield_square_color", 532, -236, Math.PI, 0.72, "Square shield", "Craftsman Row"),
  P("logs", 525, -222, 0, 0.92, "Forge fuel logs", "Craftsman Row"),
  P("barrel_large", 526.5, -222.2, 0, 0.72, "Quench barrel", "Craftsman Row"),

  // Green Mortar Healing Shop: safe, green, organized, and readable.
  P("table_medium", 452, -180, 0, 0.78, "Treatment table", "Healing Shop", SHOP_COUNTER_Y),
  P("chair", 454, -180.5, -Math.PI / 2, 0.72, "Treatment chair", "Healing Shop"),
  P("shelf_candles", 461.2, -174, -Math.PI / 2, 0.78, "Remedy shelf", "Healing Shop"),
  P("bottle_green", 458, -172.2, 0, 0.62, "Green remedy", "Healing Shop", SHOP_COUNTER_Y + 0.5),
  P("bottle_brown", 456.8, -172.2, 0, 0.62, "Brown remedy", "Healing Shop", SHOP_COUNTER_Y + 0.5),
  P("candle_lit", 455.7, -172.2, 0, 0.62, "Healing candle", "Healing Shop", SHOP_COUNTER_Y + 0.45),
  P("banner_green", 463, -178, -Math.PI / 2, 0.85, "Green Mortar banner", "Healing Shop"),
  P("lantern", 451, -174, 0, 0.7, "Healing shop lantern", "Healing Shop"),

  // Wyrm & Candle Magic Supply: books, candles, blue/yellow magic identity.
  P("tavern_bookshelf", 509, -168, Math.PI / 2, 0.9, "Book wall", "Magic Shop"),
  P("tavern_bookshelf", 509, -172, Math.PI / 2, 0.9, "Book wall", "Magic Shop"),
  P("shelf_large", 521, -168, -Math.PI / 2, 0.78, "Scroll shelves", "Magic Shop"),
  P("table_medium", 515, -170, 0, 0.78, "Arcane desk", "Magic Shop", SHOP_COUNTER_Y),
  P("spellbook_open", 515, -170.2, 0, 0.68, "Open spellbook", "Magic Shop", SHOP_COUNTER_Y + 0.45),
  P("spellbook_closed", 512.7, -170.2, -0.3, 0.65, "Closed spellbook", "Magic Shop", SHOP_COUNTER_Y + 0.45),
  P("staff", 519, -173, -Math.PI / 2, 0.72, "Staff display", "Magic Shop"),
  P("wand", 517, -166.5, 0.2, 0.68, "Wand display", "Magic Shop", SHOP_COUNTER_Y + 0.38),
  P("candle_triple", 515, -166, 0, 0.68, "Candle circle", "Magic Shop"),
  P("candle_thin_lit", 512, -166, 0, 0.62, "Thin candle", "Magic Shop"),
  P("candle_thin_lit", 518, -166, 0, 0.62, "Thin candle", "Magic Shop"),
  P("banner_blue", 522, -173, -Math.PI / 2, 0.85, "Blue arcane banner", "Magic Shop"),
  P("lantern", 515, -160, 0, 0.75, "Exterior magic beacon", "Magic Shop"),

  // Copper Kettle Tavern: social space with furniture grouped along edges.
  P("tavern_bar_corner", 536, -202, Math.PI, 0.92, "Bar corner", "Copper Kettle"),
  P("tavern_bar", 536, -197, Math.PI / 2, 0.92, "Bar", "Copper Kettle"),
  P("tavern_bar", 536, -192, Math.PI / 2, 0.92, "Bar", "Copper Kettle"),
  P("keg_iso", 538, -184, 0, 0.95, "Keg", "Copper Kettle"),
  P("keg_metal", 540, -184, 0, 0.95, "Bound keg", "Copper Kettle"),
  P("mug_full", 538.2, -194, 0, 0.62, "Full mug", "Copper Kettle", SHOP_COUNTER_Y + 0.45),
  P("mug_empty", 538.3, -198, 0.2, 0.62, "Empty mug", "Copper Kettle", SHOP_COUNTER_Y + 0.45),
  P("torch_lit", 556.5, -184.5, Math.PI, 0.8, "Hearth glow", "Copper Kettle"),
  P("table_tablecloth", 543, -198, 0, 0.78, "Tavern table", "Copper Kettle", SHOP_COUNTER_Y),
  P("chair", 541.7, -198, Math.PI / 2, 0.68, "Tavern chair", "Copper Kettle"),
  P("chair", 544.3, -198, -Math.PI / 2, 0.68, "Tavern chair", "Copper Kettle"),
  P("table_medium", 551, -198, 0, 0.78, "Tavern table", "Copper Kettle", SHOP_COUNTER_Y),
  P("chair", 549.7, -198, Math.PI / 2, 0.68, "Tavern chair", "Copper Kettle"),
  P("chair", 552.3, -198, -Math.PI / 2, 0.68, "Tavern chair", "Copper Kettle"),
  P("table_small", 543, -190, 0, 0.78, "Dice table", "Copper Kettle", SHOP_COUNTER_Y),
  P("chair", 541.7, -190, Math.PI / 2, 0.68, "Dice chair", "Copper Kettle"),
  P("chair", 544.3, -190, -Math.PI / 2, 0.68, "Dice chair", "Copper Kettle"),
  P("banner_brown", 558, -202, -Math.PI / 2, 0.85, "Tavern stage banner", "Copper Kettle"),

  // Chapel and graveyard: safety, ivory/blue-gold, Missing Bell clue.
  P("church_bench", 469, -141, 0, 0.92, "Chapel pew", "Temple Green"),
  P("church_bench", 477, -141, 0, 0.92, "Chapel pew", "Temple Green"),
  P("church_bench", 485, -141, 0, 0.92, "Chapel pew", "Temple Green"),
  P("church_bench", 469, -136, 0, 0.92, "Chapel pew", "Temple Green"),
  P("church_bench", 477, -136, 0, 0.92, "Chapel pew", "Temple Green"),
  P("church_bench", 485, -136, 0, 0.92, "Chapel pew", "Temple Green"),
  P("church_pulpit", 477, -130.8, Math.PI, 0.9, "Pulpit", "Temple Green"),
  P("church_candelabra", 472, -131, 0, 0.88, "Candelabra", "Temple Green"),
  P("church_candelabra", 482, -131, 0, 0.88, "Candelabra", "Temple Green"),
  P("church_lantern", 467, -148, 0, 0.8, "Chapel lantern", "Temple Green"),
  P("banner_white", 480, -150, Math.PI, 0.85, "Missing bell vigil cloth", "Temple Green"),
  P("tombstone", 506, -145, 0.1, 0.8, "Grave marker", "Temple Green"),
  P("tombstone", 516, -139, -0.1, 0.8, "Grave marker", "Temple Green"),
  P("tombstone", 528, -147, 0.2, 0.8, "Grave marker", "Temple Green"),
  P("shovel", 522, -134, 0.8, 0.75, "Gravedigger shovel", "Temple Green"),

  // Guard Yard and Reeve Hall: authority, training, red banners.
  P("banner_red", 552, -253, Math.PI, 0.9, "Reeve Hall banner", "Noble Rise"),
  P("banner_red", 570, -253, Math.PI, 0.9, "Reeve Hall banner", "Noble Rise"),
  P("table_long", 555, -260, 0, 0.78, "Tax clerk desk", "Noble Rise", SHOP_COUNTER_Y),
  P("table_long_decorated", 566, -260, 0, 0.78, "Compact ledger desk", "Noble Rise", SHOP_COUNTER_Y),
  P("chest", 575, -263, 0, 0.75, "Tax chest", "Noble Rise"),
  P("hedge", 548, -248, 0, 0.85, "Noble hedge", "Noble Rise"),
  P("hedge", 558, -248, 0, 0.85, "Noble hedge", "Noble Rise"),
  P("shield_round", 508, -266, 0, 0.68, "Training shield", "Guard Yard"),
  P("sword_1h", 512, -266, Math.PI / 2, 0.68, "Training blade", "Guard Yard"),
  P("bow", 516, -266, Math.PI / 2, 0.68, "Training bow", "Guard Yard"),
  P("table_medium", 510, -260, 0, 0.78, "Bounty table", "Guard Yard", SHOP_COUNTER_Y),
  P("banner_red", 522, -260, -Math.PI / 2, 0.85, "Guard notice banner", "Guard Yard"),

  // River Docks: cargo, ferry, smuggling clues, but main pier kept clear.
  P("barrel_stack", 580, -184, 0, 0.82, "Dock barrels", "River Docks"),
  P("crates_stacked", 584, -181, 0, 0.82, "Cargo stack", "River Docks"),
  P("crate_a", 594, -188, 0, 1.2, "Cargo crate", "River Docks"),
  P("crate_b", 599, -177, 0, 1.2, "Cargo crate", "River Docks"),
  P("box_decorated", 597, -180, 0, 0.82, "Whispering crate", "River Docks"),
  P("cart", 586, -191, -Math.PI / 2, 0.8, "Dock cart", "River Docks"),
  P("table_long", 600, -165, Math.PI / 2, 0.78, "Fish sorting table", "River Docks", SHOP_COUNTER_Y),
  P("lantern", 592, -190, 0, 0.75, "Dock lantern", "River Docks"),
  P("lantern", 604, -165, 0, 0.75, "Ferry lantern", "River Docks"),
  A("animal_pigeon", 592, -183, Math.PI, 0.012, "Dock pigeon", "River Docks", {
    radius: 0.9,
    speed: 0.65,
    phase: 1.3,
  }),

  // Mudden Ward: darker and cluttered at edges, but alley lanes stay readable.
  P("fence_broken", 402, -162, Math.PI / 2, 0.9, "Broken fence", "Mudden Ward"),
  P("barrel_small", 405, -166, 0, 0.78, "Rain barrel", "Mudden Ward"),
  P("box_stacked", 424, -156, 0, 0.78, "Wash tubs and boxes", "Mudden Ward"),
  P("crate_c", 417, -149, 0, 1.1, "Patched home crate", "Mudden Ward"),
  P("candle_lit", 410, -155, 0, 0.62, "Window candle", "Mudden Ward"),
  P("banner_brown", 429, -154, -Math.PI / 2, 0.82, "Laundry cloth", "Mudden Ward"),
  P("torch_lit", 402, -235, Math.PI / 2, 0.76, "Underways warning torch", "Old Well"),
  P("pillar", 398, -235, 0, 0.78, "Old drain marker", "Old Well"),

  // Farm and orchard: animals and useful clutter around the fence, not in the gate.
  P("fence", 432, -247, 0, 0.9, "Chicken yard fence", "Farm"),
  P("fence", 442, -247, 0, 0.9, "Chicken yard fence", "Farm"),
  P("fence_gate", 450, -247, 0, 0.9, "Chicken yard gate", "Farm"),
  P("fence", 458, -247, 0, 0.9, "Chicken yard fence", "Farm"),
  P("barrel_small", 434, -224, 0, 0.76, "Water trough", "Farm"),
  P("logs", 438, -224, 0, 0.85, "Fence repair logs", "Farm"),
  P("crate_a", 454, -224, 0, 1.1, "Egg crate", "Farm"),
  P("tree", 446, -112, 0, 1.0, "Apple tree", "Orchard"),
  P("tree_high", 460, -114, 0, 1.0, "Apple tree", "Orchard"),
  P("tree_crooked", 472, -116, 0, 1.0, "Old apple tree", "Orchard"),
  P("crate_b", 462, -110, 0, 1.15, "Apple basket", "Orchard"),
  A("animal_chicken", 440, -235, 0.3, 0.017, "Chicken", "Farm", {
    radius: 1.8,
    speed: 0.7,
    phase: 0.1,
  }),
  A("animal_chicken", 448, -238, -0.5, 0.017, "Chicken", "Farm", {
    radius: 1.5,
    speed: 0.8,
    phase: 2.4,
  }),
  A("animal_chicken", 454, -232, 1.2, 0.017, "Chicken", "Farm", {
    radius: 1.4,
    speed: 0.65,
    phase: 3.7,
  }),
  A("animal_bunny", 462, -121, 0, 0.016, "Orchard bunny", "Orchard", {
    radius: 1.7,
    speed: 0.55,
    phase: 1.2,
  }),
  A("animal_bunny", 448, -105, 0, 0.016, "Orchard bunny", "Orchard", {
    radius: 1.4,
    speed: 0.6,
    phase: 2.8,
  }),
  A("animal_cat", 536, -203, Math.PI / 2, 0.015, "Tavern cat", "Copper Kettle", {
    radius: 0.9,
    speed: 0.35,
    phase: 0.9,
  }),
];

function shouldRenderHarthmereAssets() {
  if (typeof window === "undefined") {
    return false;
  }
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    window.localStorage.getItem("biomes.harthmereAssets") === "1"
  );
}

function prepareLoadedObject(object: THREE.Object3D) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (Number.isFinite(box.min.x) && Number.isFinite(box.max.x)) {
    const center = new THREE.Vector3();
    box.getCenter(center);
    object.position.x -= center.x;
    object.position.z -= center.z;
    object.position.y -= box.min.y;
  }

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    child.castShadow = false;
    child.receiveShadow = true;
    child.frustumCulled = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      material.side = THREE.DoubleSide;
      const maybeMapped = material as THREE.MeshStandardMaterial & {
        map?: THREE.Texture;
        alphaTest?: number;
      };
      if (maybeMapped.map) {
        maybeMapped.map.magFilter = THREE.NearestFilter;
        maybeMapped.map.minFilter = THREE.NearestMipmapNearestFilter;
        maybeMapped.map.needsUpdate = true;
      }
      if ("alphaTest" in maybeMapped) {
        maybeMapped.alphaTest = Math.max(maybeMapped.alphaTest ?? 0, 0.02);
      }
    }
  });
  return object;
}

function startBestClip(mixer: THREE.AnimationMixer, clips: THREE.AnimationClip[]) {
  if (clips.length === 0) {
    return;
  }
  const preferred = clips.find((clip) => /walk|run|idle/i.test(clip.name)) ?? clips[0];
  const action = mixer.clipAction(preferred);
  action.enabled = true;
  action.play();
}


function isProceduralAnimalKey(key: string) {
  return (
    key === "animal_chicken" ||
    key === "animal_bunny" ||
    key === "animal_pigeon" ||
    key === "animal_cat"
  );
}

function animalMaterial(color: number) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.95,
    metalness: 0,
  });
}

function boxMesh(
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  color: number
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), animalMaterial(color));
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function createProceduralAnimal(placement: RuntimePlacement): THREE.Object3D | undefined {
  if (!isProceduralAnimalKey(placement.asset)) {
    return undefined;
  }

  const root = new THREE.Group();
  root.name = placement.name ?? placement.asset;
  root.position.set(...placement.at);
  root.rotation.y = placement.rot ?? 0;

  if (placement.asset === "animal_chicken") {
    root.add(
      boxMesh("chicken-body", [0.36, 0.28, 0.30], [0, 0.19, 0], 0xf2efe3),
      boxMesh("chicken-head", [0.18, 0.18, 0.18], [0, 0.37, -0.22], 0xf7f2dc),
      boxMesh("chicken-beak", [0.08, 0.05, 0.08], [0, 0.36, -0.34], 0xe6a23c),
      boxMesh("chicken-comb", [0.12, 0.05, 0.08], [0, 0.49, -0.22], 0xc9332e),
      boxMesh("chicken-leg-left", [0.045, 0.14, 0.045], [-0.09, 0.02, 0.02], 0xd49035),
      boxMesh("chicken-leg-right", [0.045, 0.14, 0.045], [0.09, 0.02, 0.02], 0xd49035)
    );
  } else if (placement.asset === "animal_bunny") {
    root.add(
      boxMesh("bunny-body", [0.34, 0.24, 0.30], [0, 0.16, 0], 0xc9b8a3),
      boxMesh("bunny-head", [0.22, 0.20, 0.20], [0, 0.30, -0.22], 0xd6c4ae),
      boxMesh("bunny-ear-left", [0.06, 0.26, 0.05], [-0.07, 0.52, -0.22], 0xd6c4ae),
      boxMesh("bunny-ear-right", [0.06, 0.26, 0.05], [0.07, 0.52, -0.22], 0xd6c4ae),
      boxMesh("bunny-tail", [0.12, 0.12, 0.12], [0, 0.21, 0.20], 0xe8dfd0)
    );
  } else if (placement.asset === "animal_pigeon") {
    root.add(
      boxMesh("pigeon-body", [0.28, 0.20, 0.24], [0, 0.18, 0], 0x6d7785),
      boxMesh("pigeon-head", [0.14, 0.14, 0.14], [0, 0.31, -0.16], 0x8790a0),
      boxMesh("pigeon-beak", [0.055, 0.035, 0.06], [0, 0.30, -0.25], 0xd9a33a),
      boxMesh("pigeon-wing-left", [0.045, 0.14, 0.20], [-0.17, 0.18, 0], 0x586272),
      boxMesh("pigeon-wing-right", [0.045, 0.14, 0.20], [0.17, 0.18, 0], 0x586272)
    );
  } else if (placement.asset === "animal_cat") {
    root.add(
      boxMesh("cat-body", [0.44, 0.22, 0.24], [0, 0.16, 0], 0x4f4640),
      boxMesh("cat-head", [0.22, 0.20, 0.20], [0, 0.31, -0.25], 0x5f554e),
      boxMesh("cat-ear-left", [0.08, 0.10, 0.06], [-0.08, 0.45, -0.25], 0x5f554e),
      boxMesh("cat-ear-right", [0.08, 0.10, 0.06], [0.08, 0.45, -0.25], 0x5f554e),
      boxMesh("cat-tail", [0.08, 0.08, 0.34], [0, 0.23, 0.32], 0x4f4640)
    );
  }

  return root;
}

function addProceduralAnimalInstance(
  placement: RuntimePlacement,
  object: THREE.Object3D,
  animated: AnimatedInstance[]
) {
  if (placement.wander || placement.bob) {
    animated.push({
      object,
      base: [...placement.at] as [number, number, number],
      rot: placement.rot ?? 0,
      bob: placement.bob,
      // Keep animals calm. Do not spin them, and do not apply FBX bone clips.
      spin: undefined,
      wander: placement.wander,
    });
  }
}

export class HarthmereRuntimeAssetsRenderer implements Renderer {
  readonly name = "harthmereRuntimeAssets";
  private readonly gltfLoader = new GLTFLoader();
  private readonly fbxLoader = new FBXLoader();
  private readonly prototypes = new Map<string, RuntimePrototype>();
  private readonly failed = new Set<string>();
  private readonly root = new THREE.Group();
  private readonly animated: AnimatedInstance[] = [];
  private elapsed = 0;
  private ready = false;

  constructor() {
    this.root.name = "harthmere-curated-town-dressup-root";
    if (shouldRenderHarthmereAssets()) {
      void this.loadAll();
    }
  }

  draw(scenes: Scenes, dt: number) {
    if (!this.ready || this.root.children.length === 0) {
      return;
    }
    this.elapsed += Math.min(dt, 0.05);
    for (const instance of this.animated) {
      instance.mixer?.update(dt);
      if (instance.wander) {
        const angle = this.elapsed * instance.wander.speed + (instance.wander.phase ?? 0);
        const dx = Math.cos(angle) * instance.wander.radius;
        const dz = Math.sin(angle) * instance.wander.radius;
        instance.object.position.set(
          instance.base[0] + dx,
          instance.base[1] + (instance.bob ? Math.sin(angle * 2) * instance.bob : 0),
          instance.base[2] + dz
        );
        instance.object.rotation.y = instance.rot - angle + Math.PI / 2;
      } else if (instance.bob) {
        instance.object.position.y = instance.base[1] + Math.sin(this.elapsed * 2) * instance.bob;
      }
      if (instance.spin) {
        instance.object.rotation.y += instance.spin * dt;
      }
    }
    addToScenes(scenes, this.root);
  }

  private async loadAll() {
    const requiredAssets = [
      ...new Set(
        PLACEMENTS.map((placement) => placement.asset).filter(
          (key) => !isProceduralAnimalKey(key)
        )
      ),
    ];
    await Promise.all(requiredAssets.map((key) => this.loadPrototype(key)));
    for (const placement of PLACEMENTS) {
      const proceduralAnimal = createProceduralAnimal(placement);
      if (proceduralAnimal) {
        this.root.add(proceduralAnimal);
        addProceduralAnimalInstance(placement, proceduralAnimal, this.animated);
        continue;
      }

      const prototype = this.prototypes.get(placement.asset);
      if (!prototype) {
        continue;
      }
      const asset = assetByKey.get(placement.asset);
      const clone =
        asset?.format === "fbx" ? cloneSkeleton(prototype.object) : prototype.object.clone(true);
      clone.name = placement.name ?? placement.asset;
      clone.position.set(...placement.at);
      clone.rotation.y = placement.rot ?? 0;
      const scale = placement.scale ?? asset?.defaultScale ?? 1;
      clone.scale.setScalar(scale);
      this.root.add(clone);

      const animated =
        placement.wander || placement.bob || placement.spin || prototype.clips.length > 0
          ? {
              object: clone,
              base: [...placement.at] as [number, number, number],
              rot: placement.rot ?? 0,
              bob: placement.bob,
              spin: placement.spin,
              wander: placement.wander,
              mixer: prototype.clips.length > 0 ? new THREE.AnimationMixer(clone) : undefined,
            }
          : undefined;
      if (animated) {
        if (animated.mixer) {
          startBestClip(animated.mixer, prototype.clips);
        }
        this.animated.push(animated);
      }
    }
    this.ready = true;
    log.info("Loaded curated Harthmere town assets", {
      assets: this.prototypes.size,
      failed: this.failed.size,
      placements: this.root.children.length,
      animated: this.animated.length,
      districts: [...new Set(PLACEMENTS.map((placement) => placement.district).filter(Boolean))],
    });
  }

  private async loadPrototype(key: string) {
    if (this.prototypes.has(key) || this.failed.has(key)) {
      return;
    }
    const asset = assetByKey.get(key);
    if (!asset) {
      this.failed.add(key);
      return;
    }

    try {
      let object: THREE.Object3D;
      let clips: THREE.AnimationClip[] = [];
      if (asset.format === "gltf") {
        const gltfAsset = await this.gltfLoader.loadAsync(assetUrl(asset.path));
        object = gltfAsset.scene ?? gltfAsset.scenes[0] ?? new THREE.Group();
        clips = gltfAsset.animations ?? [];
      } else if (asset.format === "fbx") {
        object = await this.fbxLoader.loadAsync(assetUrl(asset.path));
        clips = (object as THREE.Object3D & { animations?: THREE.AnimationClip[] }).animations ?? [];
      } else {
        const mtlLoader = new MTLLoader();
        const objLoader = new OBJLoader();
        const basePath = asset.path.replace(/\/[^/]+$/, "");
        const materials = await mtlLoader.loadAsync(assetUrl(`${asset.path}.mtl`));
        materials.setResourcePath(assetUrl(`${basePath}/`));
        materials.preload();
        objLoader.setMaterials(materials);
        object = await objLoader.loadAsync(assetUrl(`${asset.path}.obj`));
      }
      this.prototypes.set(key, {
        object: prepareLoadedObject(object),
        clips,
      });
    } catch (error) {
      this.failed.add(key);
      log.warn("Skipping missing or unreadable Harthmere asset", {
        key,
        path: asset.path,
        error,
      });
    }
  }
}

export function makeHarthmereRuntimeAssetsRenderer() {
  return new HarthmereRuntimeAssetsRenderer();
}
