export type MedievalPlacement = {
  assetId: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  zone:
    | "spawn"
    | "market"
    | "blacksmith"
    | "tavern"
    | "farm"
    | "forest"
    | "library"
    | "alchemy"
    | "treasure";
  collision?: "none" | "small" | "medium" | "large";
};

const deg = (value: number) => (value * Math.PI) / 180;

export const MEDIEVAL_MINI_WORLD_FINAL_PLACEMENTS: MedievalPlacement[] = [
  // Spawn square readability: visible props, but enough space for players to move.
  { assetId: "bannerRed", position: [-5.5, 0, -5.5], rotationY: deg(25), zone: "spawn", collision: "small" },
  { assetId: "bannerBlue", position: [5.5, 0, -5.5], rotationY: deg(-25), zone: "spawn", collision: "small" },
  { assetId: "woodenBench", position: [-4.25, 0, 3.25], rotationY: deg(90), zone: "spawn", collision: "medium" },
  { assetId: "woodenBench", position: [4.25, 0, 3.25], rotationY: deg(-90), zone: "spawn", collision: "medium" },
  { assetId: "metalTorch", position: [-7.25, 0, -1.25], rotationY: deg(0), zone: "spawn", collision: "small" },
  { assetId: "metalTorch", position: [7.25, 0, -1.25], rotationY: deg(0), zone: "spawn", collision: "small" },

  // Market lane.
  { assetId: "marketStall", position: [-12, 0, -9], rotationY: deg(15), zone: "market", collision: "large" },
  { assetId: "marketStall", position: [-7.5, 0, -10.5], rotationY: deg(-12), zone: "market", collision: "large" },
  { assetId: "marketCart", position: [-15.5, 0, -5.25], rotationY: deg(70), zone: "market", collision: "medium" },
  { assetId: "appleCrate", position: [-11.25, 0, -6.75], rotationY: deg(20), zone: "market", collision: "small" },
  { assetId: "carrotCrate", position: [-9.75, 0, -6.15], rotationY: deg(-15), zone: "market", collision: "small" },
  { assetId: "appleBarrel", position: [-6.25, 0, -7.2], rotationY: deg(10), zone: "market", collision: "small" },
  { assetId: "woodenBarrel", position: [-16.5, 0, -7.25], rotationY: deg(0), zone: "market", collision: "small" },
  { assetId: "pumpkin", position: [-10.5, 0.05, -5.2], rotationY: deg(0), scale: 1.1, zone: "market", collision: "small" },
  { assetId: "bread", position: [-8.0, 0.9, -10.45], rotationY: deg(20), scale: 1.0, zone: "market", collision: "none" },
  { assetId: "apple", position: [-7.45, 0.9, -10.1], rotationY: deg(0), scale: 1.0, zone: "market", collision: "none" },

  // Blacksmith corner.
  { assetId: "blacksmithAnvil", position: [13.25, 0, -9.75], rotationY: deg(-20), zone: "blacksmith", collision: "medium" },
  { assetId: "blacksmithWorkbench", position: [16.75, 0, -8.25], rotationY: deg(-90), zone: "blacksmith", collision: "large" },
  { assetId: "weaponStand", position: [11.25, 0, -12.25], rotationY: deg(35), zone: "blacksmith", collision: "medium" },
  { assetId: "bronzeSword", position: [10.75, 1.1, -12.1], rotationY: deg(55), scale: 0.75, zone: "blacksmith", collision: "none" },
  { assetId: "bronzeAxe", position: [12.0, 1.1, -11.95], rotationY: deg(-30), scale: 0.75, zone: "blacksmith", collision: "none" },
  { assetId: "woodenShield", position: [13.85, 0.65, -11.3], rotationY: deg(12), scale: 0.9, zone: "blacksmith", collision: "small" },
  { assetId: "wallLantern", position: [17.75, 1.9, -10.25], rotationY: deg(180), zone: "blacksmith", collision: "none" },

  // Tavern/food area.
  { assetId: "tavernTable", position: [9.5, 0, 7.25], rotationY: deg(8), zone: "tavern", collision: "large" },
  { assetId: "woodenBench", position: [9.5, 0, 5.75], rotationY: deg(0), zone: "tavern", collision: "medium" },
  { assetId: "woodenBench", position: [9.5, 0, 8.75], rotationY: deg(180), zone: "tavern", collision: "medium" },
  { assetId: "tavernMug", position: [8.65, 1.05, 7.25], rotationY: deg(25), zone: "tavern", collision: "none" },
  { assetId: "tavernPlate", position: [10.1, 1.05, 7.2], rotationY: deg(-12), zone: "tavern", collision: "none" },
  { assetId: "fish", position: [10.1, 1.14, 7.2], rotationY: deg(75), scale: 0.9, zone: "tavern", collision: "none" },
  { assetId: "chickenLegFood", position: [8.95, 1.1, 7.75], rotationY: deg(-25), scale: 0.9, zone: "tavern", collision: "none" },
  { assetId: "woodenBarrel", position: [13.4, 0, 8.8], rotationY: deg(0), zone: "tavern", collision: "small" },

  // Farm/pasture.
  { assetId: "marketCart", position: [-18.5, 0, 12.5], rotationY: deg(-45), zone: "farm", collision: "medium" },
  { assetId: "emptyCrate", position: [-15.75, 0, 11.75], rotationY: deg(15), zone: "farm", collision: "small" },
  { assetId: "appleCrate", position: [-14.5, 0, 13.1], rotationY: deg(-10), zone: "farm", collision: "small" },
  { assetId: "cow", position: [-21.5, 0, 17.25], rotationY: deg(30), scale: 1.0, zone: "farm", collision: "medium" },
  { assetId: "sheep", position: [-17.5, 0, 18.5], rotationY: deg(-60), scale: 1.0, zone: "farm", collision: "small" },
  { assetId: "pig", position: [-20.75, 0, 13.95], rotationY: deg(105), scale: 1.0, zone: "farm", collision: "small" },
  { assetId: "horse", position: [-24.5, 0, 11.5], rotationY: deg(25), scale: 1.0, zone: "farm", collision: "medium" },
  { assetId: "shortGrass", position: [-23.5, 0, 15.5], rotationY: deg(12), scale: 1.2, zone: "farm", collision: "none" },
  { assetId: "tallGrass", position: [-18.0, 0, 15.0], rotationY: deg(-20), scale: 1.3, zone: "farm", collision: "none" },

  // Forest boundary. Keep these outside the main walking lanes.
  { assetId: "treeOakA", position: [-25.0, 0, -18.0], rotationY: deg(0), scale: 1.1, zone: "forest", collision: "large" },
  { assetId: "treeOakB", position: [-19.5, 0, -22.0], rotationY: deg(30), scale: 1.0, zone: "forest", collision: "large" },
  { assetId: "treePineA", position: [-12.0, 0, -24.5], rotationY: deg(-20), scale: 1.0, zone: "forest", collision: "large" },
  { assetId: "treePineB", position: [18.0, 0, -22.0], rotationY: deg(60), scale: 1.1, zone: "forest", collision: "large" },
  { assetId: "treeOakA", position: [24.0, 0, -16.0], rotationY: deg(110), scale: 1.0, zone: "forest", collision: "large" },
  { assetId: "bareTree", position: [23.25, 0, 18.5], rotationY: deg(25), scale: 1.0, zone: "forest", collision: "large" },
  { assetId: "bushLarge", position: [-22.0, 0, -14.0], rotationY: deg(10), scale: 1.15, zone: "forest", collision: "small" },
  { assetId: "bushSmall", position: [20.5, 0, -14.75], rotationY: deg(-30), scale: 1.1, zone: "forest", collision: "small" },
  { assetId: "rockLarge", position: [17.5, 0, 18.0], rotationY: deg(25), scale: 1.1, zone: "forest", collision: "medium" },
  { assetId: "rockSmall", position: [-16.5, 0, 22.0], rotationY: deg(-15), scale: 1.0, zone: "forest", collision: "small" },

  // Library / alchemy / quest props.
  { assetId: "bookshelf", position: [2.75, 0, 14.5], rotationY: deg(180), zone: "library", collision: "large" },
  { assetId: "bookStand", position: [0.25, 0, 13.25], rotationY: deg(-25), zone: "library", collision: "medium" },
  { assetId: "scrollRolled", position: [0.15, 1.0, 13.2], rotationY: deg(40), scale: 0.9, zone: "library", collision: "none" },
  { assetId: "alchemyCauldron", position: [4.75, 0, 13.0], rotationY: deg(10), zone: "alchemy", collision: "medium" },
  { assetId: "potionBlue", position: [5.75, 0.95, 12.4], rotationY: deg(15), zone: "alchemy", collision: "none" },
  { assetId: "potionRed", position: [6.2, 0.95, 12.7], rotationY: deg(-20), zone: "alchemy", collision: "none" },

  // Reward/treasure area.
  { assetId: "chestWood", position: [0, 0, -17.5], rotationY: deg(180), zone: "treasure", collision: "medium" },
  { assetId: "coinPile", position: [-1.15, 0.08, -16.35], rotationY: deg(0), scale: 1.1, zone: "treasure", collision: "small" },
  { assetId: "goldKey", position: [1.15, 0.2, -16.35], rotationY: deg(65), scale: 1.1, zone: "treasure", collision: "small" },
  { assetId: "rpgChestOpen", position: [2.75, 0, -18.25], rotationY: deg(-135), scale: 1.0, zone: "treasure", collision: "medium" },
];

export function getPlacementsForZone(zone: MedievalPlacement["zone"]) {
  return MEDIEVAL_MINI_WORLD_FINAL_PLACEMENTS.filter((placement) => placement.zone === zone);
}
