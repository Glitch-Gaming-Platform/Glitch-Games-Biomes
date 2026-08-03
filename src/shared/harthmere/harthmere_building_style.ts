import type {
  HarthmereBuilding,
  HarthmereMat,
} from "@/shared/harthmere/harthmere_town_buildings";

export const HARTHMERE_BUILDING_STYLE_VERSION =
  "harthmere-building-style-v2-timber-plaster-gables" as const;

function isDefensive(building: HarthmereBuilding) {
  return (
    building.profile === "gatehouse" ||
    building.profile === "tower" ||
    building.profile === "bridge" ||
    building.profile === "dungeon"
  );
}

export function harthmereBuildingRoofRise(building: HarthmereBuilding) {
  if (building.profile === "bridge") return 1;
  const width = building.x1 - building.x0 + 1;
  const depth = building.z1 - building.z0 + 1;
  return Math.max(2, Math.min(5, Math.ceil(Math.min(width, depth) / 5)));
}

export function harthmereBuildingTopRelY(
  building: HarthmereBuilding,
  floorCount: number,
  storyHeight: number
) {
  return floorCount * storyHeight + harthmereBuildingRoofRise(building);
}

function stoneFoundationMaterial(building: HarthmereBuilding): HarthmereMat {
  return building.wall === "limestoneBrick" ? "limestoneBrick" : "stoneBrick";
}

export function harthmereBuildingFacadeMaterialAt(
  building: HarthmereBuilding,
  authoredX: number,
  relY: number,
  authoredZ: number,
  storyHeight: number
): HarthmereMat {
  const corner =
    (authoredX === building.x0 || authoredX === building.x1) &&
    (authoredZ === building.z0 || authoredZ === building.z1);
  if (isDefensive(building)) {
    return corner && building.trim ? building.trim : building.wall;
  }

  const floor = Math.max(0, Math.floor((relY - 1) / storyHeight));
  const relInStory = ((relY - 1) % storyHeight) + 1;
  if (floor === 0 && relInStory <= 2 && building.profile !== "slum") {
    return stoneFoundationMaterial(building);
  }

  const verticalPost =
    corner ||
    (authoredX === building.x0 || authoredX === building.x1
      ? Math.abs(authoredZ - building.z0) % 6 === 0
      : Math.abs(authoredX - building.x0) % 6 === 0);
  const horizontalBeam = relInStory === 1 || relInStory === storyHeight - 1;
  if (verticalPost || horizontalBeam) return "oakLog";
  return building.profile === "slum" ? "oakLumber" : "limestoneBrick";
}

export function harthmereBuildingRoofMaterial(
  building: HarthmereBuilding
): HarthmereMat {
  if (
    building.profile === "slum" ||
    building.roof === "hay" ||
    building.roof === "thatch"
  ) {
    return "thatch";
  }
  return "stoneShingles";
}

export function harthmereBuildingRoofBlockAt(
  building: HarthmereBuilding,
  authoredX: number,
  relY: number,
  authoredZ: number,
  shellTopRelY: number
): HarthmereMat | undefined {
  const x0 = building.x0 - 1;
  const x1 = building.x1 + 1;
  const z0 = building.z0 - 1;
  const z1 = building.z1 + 1;
  if (authoredX < x0 || authoredX > x1 || authoredZ < z0 || authoredZ > z1) {
    return undefined;
  }

  if (building.profile === "bridge") {
    return relY === shellTopRelY + 1
      ? harthmereBuildingRoofMaterial(building)
      : undefined;
  }

  const width = x1 - x0 + 1;
  const depth = z1 - z0 + 1;
  const slopeDistance =
    width >= depth
      ? Math.min(authoredZ - z0, z1 - authoredZ)
      : Math.min(authoredX - x0, x1 - authoredX);
  const roofRise = harthmereBuildingRoofRise(building);
  const targetY = shellTopRelY + Math.min(roofRise, slopeDistance + 1);
  return relY === targetY ? harthmereBuildingRoofMaterial(building) : undefined;
}
