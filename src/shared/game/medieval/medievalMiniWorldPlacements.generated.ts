import type { MedievalAsset } from "./medievalAssetManifest.generated";
import { MEDIEVAL_ALL_ASSETS } from "./medievalAssetManifest.generated";

export type MedievalWorldPlacement = {
  id: string;
  role:
    | "forest"
    | "farm"
    | "market"
    | "tavern"
    | "blacksmith"
    | "alchemy"
    | "library"
    | "treasure"
    | "decoration"
    | "food"
    | "animal"
    | "icon";
  assetKeyHint: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  notes?: string;
};

function findAssetByHint(hint: string): MedievalAsset | undefined {
  const normalized = hint.toLowerCase();

  return MEDIEVAL_ALL_ASSETS.find((asset) =>
    asset.key.toLowerCase().includes(normalized) ||
    asset.path.toLowerCase().includes(normalized)
  );
}

export const MEDIEVAL_MINI_WORLD_PLACEMENTS: MedievalWorldPlacement[] = [
  {
    id: "forest-tree-cluster-01",
    role: "forest",
    assetKeyHint: "tree",
    position: [-18, 0, -10],
    scale: 1.4,
    notes: "Primary tree cluster near player spawn edge.",
  },
  {
    id: "forest-rocks-01",
    role: "forest",
    assetKeyHint: "rock",
    position: [-12, 0, -8],
    scale: 1.0,
  },
  {
    id: "farm-animal-pen-01",
    role: "animal",
    assetKeyHint: "cow",
    position: [14, 0, -6],
    scale: 0.9,
    notes: "Use FBX loader for Quaternius animals.",
  },
  {
    id: "farm-animal-pen-02",
    role: "animal",
    assetKeyHint: "chicken",
    position: [16, 0, -4],
    scale: 0.65,
    notes: "Use FBX loader for Quaternius animals.",
  },
  {
    id: "market-food-stall-01",
    role: "food",
    assetKeyHint: "apple",
    position: [4, 0, 4],
    scale: 0.8,
  },
  {
    id: "market-food-stall-02",
    role: "food",
    assetKeyHint: "bread",
    position: [6, 0, 4],
    scale: 0.8,
  },
  {
    id: "blacksmith-props-01",
    role: "blacksmith",
    assetKeyHint: "anvil",
    position: [-5, 0, 7],
    scale: 1.0,
  },
  {
    id: "blacksmith-props-02",
    role: "blacksmith",
    assetKeyHint: "sword",
    position: [-6, 0, 8],
    rotationY: 0.7,
    scale: 1.0,
  },
  {
    id: "alchemy-table-01",
    role: "alchemy",
    assetKeyHint: "potion",
    position: [9, 0, 9],
    scale: 0.8,
  },
  {
    id: "library-table-01",
    role: "library",
    assetKeyHint: "book",
    position: [10, 0, 11],
    scale: 0.8,
  },
  {
    id: "treasure-cache-01",
    role: "treasure",
    assetKeyHint: "chest",
    position: [-10, 0, 12],
    scale: 1.0,
  },
  {
    id: "treasure-cache-02",
    role: "treasure",
    assetKeyHint: "coin",
    position: [-9, 0, 12],
    scale: 0.8,
  },
];

export const MEDIEVAL_RESOLVED_MINI_WORLD_PLACEMENTS = MEDIEVAL_MINI_WORLD_PLACEMENTS.map(
  (placement) => ({
    ...placement,
    asset: findAssetByHint(placement.assetKeyHint),
  })
);
