export type MedievalAssetFormat = "gltf" | "fbx" | "png";

export type MedievalAssetUse =
  | "world_prop"
  | "forest"
  | "farm"
  | "market"
  | "blacksmith"
  | "tavern"
  | "alchemy"
  | "library"
  | "treasure"
  | "npc_marker"
  | "inventory_icon"
  | "hud_icon";

export type MedievalAssetDefinition = {
  id: string;
  label: string;
  format: MedievalAssetFormat;
  path: string;
  use: MedievalAssetUse[];
  defaultScale?: number;
  yOffset?: number;
  notes?: string;
};

export const MEDIEVAL_ASSET_ROOT = "/buckets/biomes-static/asset_data";

const kaykit = (file: string) => `vendor/kaykit/forest_nature/gltf/${file}.gltf`;
const fantasy = (file: string) => `vendor/quaternius/fantasy_props/gltf/${file}.gltf`;
const animal = (file: string) => `vendor/quaternius/farm_animals/fbx/${file}.fbx`;
const food = (file: string) => `vendor/quaternius/ultimate_food/fbx/${file}.fbx`;
const rpg = (file: string) => `vendor/quaternius/ultimate_rpg_items/fbx/${file}.fbx`;
const rpgIcon = (file: string) => `vendor/quaternius/ultimate_rpg_items/icons/${file}.png`;
const kenneyWhite = (file: string) => `vendor/kenney/game_icons/white_2x/${file}.png`;
const kenneyBlack = (file: string) => `vendor/kenney/game_icons/black_2x/${file}.png`;

export const MEDIEVAL_FINAL_ASSETS: Record<string, MedievalAssetDefinition> = {
  // Forest / outskirts. These are safe GLTF assets.
  treeOakA: {
    id: "treeOakA",
    label: "Broad oak tree A",
    format: "gltf",
    path: kaykit("Tree_1_A_Color1"),
    use: ["forest"],
    defaultScale: 1.8,
  },
  treeOakB: {
    id: "treeOakB",
    label: "Broad oak tree B",
    format: "gltf",
    path: kaykit("Tree_1_B_Color1"),
    use: ["forest"],
    defaultScale: 1.7,
  },
  treePineA: {
    id: "treePineA",
    label: "Pine tree A",
    format: "gltf",
    path: kaykit("Tree_2_A_Color1"),
    use: ["forest"],
    defaultScale: 1.9,
  },
  treePineB: {
    id: "treePineB",
    label: "Pine tree B",
    format: "gltf",
    path: kaykit("Tree_2_D_Color1"),
    use: ["forest"],
    defaultScale: 1.8,
  },
  bareTree: {
    id: "bareTree",
    label: "Bare dead tree",
    format: "gltf",
    path: kaykit("Tree_Bare_1_A_Color1"),
    use: ["forest"],
    defaultScale: 1.5,
  },
  bushLarge: {
    id: "bushLarge",
    label: "Large bush",
    format: "gltf",
    path: kaykit("Bush_1_G_Color1"),
    use: ["forest"],
    defaultScale: 1.15,
  },
  bushSmall: {
    id: "bushSmall",
    label: "Small bush",
    format: "gltf",
    path: kaykit("Bush_2_C_Color1"),
    use: ["forest"],
    defaultScale: 1.0,
  },
  tallGrass: {
    id: "tallGrass",
    label: "Tall grass clump",
    format: "gltf",
    path: kaykit("Grass_1_C_Color1"),
    use: ["forest", "farm"],
    defaultScale: 0.95,
  },
  shortGrass: {
    id: "shortGrass",
    label: "Short grass clump",
    format: "gltf",
    path: kaykit("Grass_2_B_Color1"),
    use: ["forest", "farm"],
    defaultScale: 0.9,
  },
  rockSmall: {
    id: "rockSmall",
    label: "Small grey rock",
    format: "gltf",
    path: kaykit("Rock_1_C_Color1"),
    use: ["forest", "world_prop"],
    defaultScale: 1.0,
  },
  rockLarge: {
    id: "rockLarge",
    label: "Large grey rock",
    format: "gltf",
    path: kaykit("Rock_3_Q_Color1"),
    use: ["forest", "world_prop"],
    defaultScale: 1.25,
  },

  // Medieval/fantasy town props. These are safe GLTF assets.
  marketStall: {
    id: "marketStall",
    label: "Empty market stall",
    format: "gltf",
    path: fantasy("Stall_Empty"),
    use: ["market", "world_prop"],
    defaultScale: 1.0,
  },
  marketCart: {
    id: "marketCart",
    label: "Market cart",
    format: "gltf",
    path: fantasy("Stall_Cart_Empty"),
    use: ["market", "farm", "world_prop"],
    defaultScale: 1.0,
  },
  appleBarrel: {
    id: "appleBarrel",
    label: "Apple barrel",
    format: "gltf",
    path: fantasy("Barrel_Apples"),
    use: ["market", "farm", "tavern"],
    defaultScale: 1.0,
  },
  appleCrate: {
    id: "appleCrate",
    label: "Apple farm crate",
    format: "gltf",
    path: fantasy("FarmCrate_Apple"),
    use: ["market", "farm"],
    defaultScale: 1.0,
  },
  carrotCrate: {
    id: "carrotCrate",
    label: "Carrot farm crate",
    format: "gltf",
    path: fantasy("FarmCrate_Carrot"),
    use: ["market", "farm"],
    defaultScale: 1.0,
  },
  emptyCrate: {
    id: "emptyCrate",
    label: "Empty farm crate",
    format: "gltf",
    path: fantasy("FarmCrate_Empty"),
    use: ["market", "farm", "world_prop"],
    defaultScale: 1.0,
  },
  woodenBarrel: {
    id: "woodenBarrel",
    label: "Wooden barrel",
    format: "gltf",
    path: fantasy("Barrel"),
    use: ["market", "tavern", "world_prop"],
    defaultScale: 1.0,
  },
  woodenBench: {
    id: "woodenBench",
    label: "Wooden bench",
    format: "gltf",
    path: fantasy("Bench"),
    use: ["market", "tavern", "world_prop"],
    defaultScale: 1.0,
  },
  tavernTable: {
    id: "tavernTable",
    label: "Large tavern table",
    format: "gltf",
    path: fantasy("Table_Large"),
    use: ["tavern"],
    defaultScale: 1.0,
  },
  tavernMug: {
    id: "tavernMug",
    label: "Tavern mug",
    format: "gltf",
    path: fantasy("Mug"),
    use: ["tavern"],
    defaultScale: 0.8,
  },
  tavernPlate: {
    id: "tavernPlate",
    label: "Table plate",
    format: "gltf",
    path: fantasy("Table_Plate"),
    use: ["tavern", "market"],
    defaultScale: 0.85,
  },
  wallLantern: {
    id: "wallLantern",
    label: "Wall lantern",
    format: "gltf",
    path: fantasy("Lantern_Wall"),
    use: ["world_prop", "tavern", "blacksmith"],
    defaultScale: 1.0,
  },
  metalTorch: {
    id: "metalTorch",
    label: "Metal torch",
    format: "gltf",
    path: fantasy("Torch_Metal"),
    use: ["world_prop"],
    defaultScale: 1.0,
  },
  blacksmithAnvil: {
    id: "blacksmithAnvil",
    label: "Blacksmith anvil",
    format: "gltf",
    path: fantasy("Anvil"),
    use: ["blacksmith"],
    defaultScale: 1.0,
  },
  blacksmithWorkbench: {
    id: "blacksmithWorkbench",
    label: "Blacksmith workbench",
    format: "gltf",
    path: fantasy("Workbench"),
    use: ["blacksmith"],
    defaultScale: 1.0,
  },
  bronzeAxe: {
    id: "bronzeAxe",
    label: "Bronze axe",
    format: "gltf",
    path: fantasy("Axe_Bronze"),
    use: ["blacksmith", "inventory_icon"],
    defaultScale: 1.0,
  },
  bronzeSword: {
    id: "bronzeSword",
    label: "Bronze sword",
    format: "gltf",
    path: fantasy("Sword_Bronze"),
    use: ["blacksmith", "inventory_icon"],
    defaultScale: 1.0,
  },
  weaponStand: {
    id: "weaponStand",
    label: "Weapon stand",
    format: "gltf",
    path: fantasy("WeaponStand"),
    use: ["blacksmith"],
    defaultScale: 1.0,
  },
  woodenShield: {
    id: "woodenShield",
    label: "Wooden shield",
    format: "gltf",
    path: fantasy("Shield_Wooden"),
    use: ["blacksmith", "inventory_icon"],
    defaultScale: 1.0,
  },
  alchemyCauldron: {
    id: "alchemyCauldron",
    label: "Cauldron",
    format: "gltf",
    path: fantasy("Cauldron"),
    use: ["alchemy"],
    defaultScale: 1.0,
  },
  potionBlue: {
    id: "potionBlue",
    label: "Potion bottle 1",
    format: "gltf",
    path: fantasy("Potion_1"),
    use: ["alchemy", "inventory_icon"],
    defaultScale: 0.85,
  },
  potionRed: {
    id: "potionRed",
    label: "Potion bottle 2",
    format: "gltf",
    path: fantasy("Potion_2"),
    use: ["alchemy", "inventory_icon"],
    defaultScale: 0.85,
  },
  bookshelf: {
    id: "bookshelf",
    label: "Bookcase",
    format: "gltf",
    path: fantasy("Bookcase_2"),
    use: ["library"],
    defaultScale: 1.0,
  },
  bookStand: {
    id: "bookStand",
    label: "Book stand",
    format: "gltf",
    path: fantasy("BookStand"),
    use: ["library", "alchemy"],
    defaultScale: 1.0,
  },
  scrollRolled: {
    id: "scrollRolled",
    label: "Rolled scroll",
    format: "gltf",
    path: fantasy("Scroll_1"),
    use: ["library", "inventory_icon"],
    defaultScale: 0.8,
  },
  chestWood: {
    id: "chestWood",
    label: "Wooden chest",
    format: "gltf",
    path: fantasy("Chest_Wood"),
    use: ["treasure", "world_prop"],
    defaultScale: 1.0,
  },
  coinPile: {
    id: "coinPile",
    label: "Coin pile",
    format: "gltf",
    path: fantasy("Coin_Pile"),
    use: ["treasure"],
    defaultScale: 0.9,
  },
  goldKey: {
    id: "goldKey",
    label: "Gold key",
    format: "gltf",
    path: fantasy("Key_Gold"),
    use: ["treasure", "inventory_icon"],
    defaultScale: 0.8,
  },
  bannerRed: {
    id: "bannerRed",
    label: "Town banner 1",
    format: "gltf",
    path: fantasy("Banner_1"),
    use: ["world_prop", "market"],
    defaultScale: 1.0,
  },
  bannerBlue: {
    id: "bannerBlue",
    label: "Town banner 2",
    format: "gltf",
    path: fantasy("Banner_2"),
    use: ["world_prop", "market"],
    defaultScale: 1.0,
  },

  // Living creatures. FBX, not GLB. Use FBXLoader or convert before a GLTF-only pipeline.
  cow: {
    id: "cow",
    label: "Cow",
    format: "fbx",
    path: animal("Cow"),
    use: ["farm", "npc_marker"],
    defaultScale: 0.018,
    notes: "FBX asset. Do not feed this to a GLTF-only loader.",
  },
  sheep: {
    id: "sheep",
    label: "Sheep",
    format: "fbx",
    path: animal("Sheep"),
    use: ["farm", "npc_marker"],
    defaultScale: 0.018,
    notes: "FBX asset. Do not feed this to a GLTF-only loader.",
  },
  pig: {
    id: "pig",
    label: "Pig",
    format: "fbx",
    path: animal("Pig"),
    use: ["farm", "npc_marker"],
    defaultScale: 0.018,
    notes: "FBX asset. Do not feed this to a GLTF-only loader.",
  },
  horse: {
    id: "horse",
    label: "Horse",
    format: "fbx",
    path: animal("Horse"),
    use: ["farm", "npc_marker"],
    defaultScale: 0.018,
    notes: "FBX asset. Do not feed this to a GLTF-only loader.",
  },

  // Food market/tavern items. FBX, not GLB.
  bread: {
    id: "bread",
    label: "Bread loaf",
    format: "fbx",
    path: food("Bread"),
    use: ["market", "tavern", "inventory_icon"],
    defaultScale: 0.018,
    notes: "FBX asset. Use FBXLoader or convert.",
  },
  apple: {
    id: "apple",
    label: "Apple",
    format: "fbx",
    path: food("Apple"),
    use: ["market", "farm", "inventory_icon"],
    defaultScale: 0.018,
    notes: "FBX asset. Use FBXLoader or convert.",
  },
  pumpkin: {
    id: "pumpkin",
    label: "Pumpkin",
    format: "fbx",
    path: food("Pumpkin"),
    use: ["market", "farm"],
    defaultScale: 0.018,
    notes: "FBX asset. Use FBXLoader or convert.",
  },
  fish: {
    id: "fish",
    label: "Fish",
    format: "fbx",
    path: food("Fish"),
    use: ["market", "tavern", "inventory_icon"],
    defaultScale: 0.018,
    notes: "FBX asset. Use FBXLoader or convert.",
  },
  chickenLegFood: {
    id: "chickenLegFood",
    label: "Cooked chicken leg",
    format: "fbx",
    path: food("ChickenLeg"),
    use: ["market", "tavern", "inventory_icon"],
    defaultScale: 0.018,
    notes: "FBX asset. Use FBXLoader or convert.",
  },

  // RPG inventory models/icons. Models are FBX. Icons are PNG and safe for UI now.
  rpgChestOpen: {
    id: "rpgChestOpen",
    label: "Open RPG chest",
    format: "fbx",
    path: rpg("Chest_Open"),
    use: ["treasure"],
    defaultScale: 0.018,
    notes: "FBX asset. Use FBXLoader or convert.",
  },
  rpgSwordIcon: {
    id: "rpgSwordIcon",
    label: "Sword inventory icon",
    format: "png",
    path: rpgIcon("Sword"),
    use: ["inventory_icon"],
  },
  rpgPotionIcon: {
    id: "rpgPotionIcon",
    label: "Potion inventory icon",
    format: "png",
    path: rpgIcon("Potion1_Filled"),
    use: ["inventory_icon"],
  },
  rpgCoinIcon: {
    id: "rpgCoinIcon",
    label: "Coin inventory icon",
    format: "png",
    path: rpgIcon("Coin"),
    use: ["inventory_icon"],
  },
  rpgBagIcon: {
    id: "rpgBagIcon",
    label: "Bag inventory icon",
    format: "png",
    path: rpgIcon("Bag"),
    use: ["inventory_icon"],
  },

  // HUD/control icons.
  hudGamepad: {
    id: "hudGamepad",
    label: "Gamepad HUD icon",
    format: "png",
    path: kenneyWhite("gamepad"),
    use: ["hud_icon"],
  },
  hudInventory: {
    id: "hudInventory",
    label: "Inventory/basket HUD icon",
    format: "png",
    path: kenneyWhite("basket"),
    use: ["hud_icon"],
  },
  hudMap: {
    id: "hudMap",
    label: "Map/menu HUD icon",
    format: "png",
    path: kenneyWhite("menuGrid"),
    use: ["hud_icon"],
  },
  hudLockedBlack: {
    id: "hudLockedBlack",
    label: "Locked black HUD icon",
    format: "png",
    path: kenneyBlack("locked"),
    use: ["hud_icon"],
  },
};

export const MEDIEVAL_WORLD_ASSET_IDS = Object.keys(MEDIEVAL_FINAL_ASSETS).filter((id) => {
  const asset = MEDIEVAL_FINAL_ASSETS[id];
  return asset.format === "gltf" || asset.format === "fbx";
});

export const MEDIEVAL_SAFE_GLTF_ASSET_IDS = Object.keys(MEDIEVAL_FINAL_ASSETS).filter(
  (id) => MEDIEVAL_FINAL_ASSETS[id].format === "gltf",
);

export function resolveMedievalAssetUrl(assetOrPath: MedievalAssetDefinition | string): string {
  const path = typeof assetOrPath === "string" ? assetOrPath : assetOrPath.path;
  if (/^https?:\/\//i.test(path) || path.startsWith("/")) {
    return path;
  }
  return `${MEDIEVAL_ASSET_ROOT}/${path}`;
}

export function getMedievalAssetsByUse(use: MedievalAssetUse): MedievalAssetDefinition[] {
  return Object.values(MEDIEVAL_FINAL_ASSETS).filter((asset) => asset.use.includes(use));
}
