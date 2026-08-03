import type { HarthmereMat } from "@/shared/harthmere/harthmere_town_buildings";

// HARTHMERE_TOWN_SURFACE_STYLE
//
// The first server-authored town pass represented whole districts as solid
// stone rectangles. In game those rectangles read as black, featureless slabs
// rather than streets and courtyards. Keep the same connected route graph, but
// grade it into cobbled cores, gravel shoulders, and open ground between roads.
// River/channel ownership deliberately remains in harthmere_river.ts.
export const HARTHMERE_TOWN_SURFACE_STYLE_VERSION =
  "harthmere-town-surface-style-v2-graded-cobbles" as const;

function hash2(x: number, z: number, salt: number) {
  let value = Math.imul(x | 0, 73_856_093) ^ Math.imul(z | 0, 19_349_663);
  value ^= Math.imul(salt | 0, 83_492_791);
  value ^= value >>> 13;
  return value >>> 0;
}

function cobbleAt(x: number, z: number, salt = 0): HarthmereMat {
  const variation = hash2(x, z, salt) % 13;
  if (variation === 0) return "stonePolished";
  if (variation <= 3) return "cobblestoneBrick";
  if (variation <= 7) return "cobblestone";
  return "stoneBrick";
}

function shoulderAt(x: number, z: number, rough = false): HarthmereMat {
  if (rough) return hash2(x, z, 71) % 4 === 0 ? "gravel" : "dirt";
  return hash2(x, z, 37) % 5 === 0 ? "cobblestone" : "gravel";
}

function horizontalRoadAt(
  x: number,
  z: number,
  x0: number,
  x1: number,
  centerZ: number,
  coreHalfWidth = 2,
  shoulderHalfWidth = 5,
  rough = false
): HarthmereMat | undefined {
  if (x < x0 || x > x1) return undefined;
  const distance = Math.abs(z - centerZ);
  if (distance > shoulderHalfWidth) return undefined;
  return distance <= coreHalfWidth
    ? rough
      ? shoulderAt(x, z, true)
      : cobbleAt(x, z, centerZ)
    : shoulderAt(x, z, rough);
}

function verticalRoadAt(
  x: number,
  z: number,
  centerX: number,
  z0: number,
  z1: number,
  coreHalfWidth = 2,
  shoulderHalfWidth = 5,
  rough = false
): HarthmereMat | undefined {
  if (z < z0 || z > z1) return undefined;
  const distance = Math.abs(x - centerX);
  if (distance > shoulderHalfWidth) return undefined;
  return distance <= coreHalfWidth
    ? rough
      ? shoulderAt(x, z, true)
      : cobbleAt(x, z, centerX)
    : shoulderAt(x, z, rough);
}

function firstMaterial(
  ...materials: Array<HarthmereMat | undefined>
): HarthmereMat | undefined {
  return materials.find((material) => material !== undefined);
}

export function harthmereTownSurfaceMaterialAt(
  authoredX: number,
  authoredZ: number
): HarthmereMat | undefined {
  const marketDistance = Math.hypot(authoredX - 486, authoredZ + 209);
  if (marketDistance <= 9) {
    return hash2(authoredX, authoredZ, 9) % 7 === 0
      ? "cobblestoneBrick"
      : "stonePolished";
  }
  if (marketDistance <= 34) {
    if (marketDistance >= 29) {
      return shoulderAt(authoredX, authoredZ);
    }
    return cobbleAt(authoredX, authoredZ, 486);
  }

  // The connector reaches the west gate without becoming another plaza-wide
  // slab. This remains clear of the authored Brell channel to the east.
  const connector = horizontalRoadAt(
    authoredX,
    authoredZ,
    192,
    414,
    -209,
    2,
    5
  );
  if (connector) return connector;

  const civicRoad = firstMaterial(
    verticalRoadAt(authoredX, authoredZ, 486, -292, -126, 3, 7),
    horizontalRoadAt(authoredX, authoredZ, 414, 612, -210, 3, 6),
    verticalRoadAt(authoredX, authoredZ, 599, -218, -176, 2, 5)
  );
  if (civicRoad) return civicRoad;

  // Residential, guard, craftsman, and Player Services streets. The old pass
  // filled these whole bounding rectangles; these centerlines retain access to
  // every district while leaving gardens and small courts between buildings.
  const districtRoad = firstMaterial(
    verticalRoadAt(authoredX, authoredZ, 457, -272, -218, 2, 4),
    horizontalRoadAt(authoredX, authoredZ, 444, 486, -245, 2, 4),
    horizontalRoadAt(authoredX, authoredZ, 498, 584, -250, 2, 5),
    verticalRoadAt(authoredX, authoredZ, 536, -280, -214, 2, 5),
    horizontalRoadAt(authoredX, authoredZ, 500, 570, -228, 2, 4),
    verticalRoadAt(authoredX, authoredZ, 558, -242, -202, 2, 4),
    horizontalRoadAt(authoredX, authoredZ, 444, 532, -171, 2, 5),
    verticalRoadAt(authoredX, authoredZ, 486, -198, -126, 2, 5),
    horizontalRoadAt(authoredX, authoredZ, 462, 504, -139, 2, 5),
    horizontalRoadAt(authoredX, authoredZ, 548, 624, -263, 2, 5)
  );
  if (districtRoad) return districtRoad;

  // Expanded housing has a real street grid but mostly green shared ground.
  if (
    authoredX >= 336 &&
    authoredX <= 476 &&
    authoredZ >= -366 &&
    authoredZ <= -306
  ) {
    const residential = firstMaterial(
      horizontalRoadAt(authoredX, authoredZ, 336, 476, -334, 2, 4),
      verticalRoadAt(authoredX, authoredZ, 364, -366, -306, 2, 4),
      verticalRoadAt(authoredX, authoredZ, 420, -366, -306, 2, 4),
      verticalRoadAt(authoredX, authoredZ, 468, -366, -306, 2, 4)
    );
    return residential;
  }

  // Mudden Ward and secret routes stay rough, narrow, and deliberately less
  // maintained than the civic center.
  const muddenRoad = firstMaterial(
    horizontalRoadAt(authoredX, authoredZ, 394, 434, -151, 3, 7, true),
    verticalRoadAt(authoredX, authoredZ, 402, -244, -160, 2, 5, true),
    horizontalRoadAt(authoredX, authoredZ, 408, 486, -148, 2, 5, true),
    horizontalRoadAt(authoredX, authoredZ, 388, 450, -244, 2, 5, true),
    verticalRoadAt(authoredX, authoredZ, 418, -278, -210, 2, 5, true)
  );
  if (muddenRoad) return muddenRoad;

  // Farm, orchard, and mill tracks are dirt with occasional gravel drainage.
  return firstMaterial(
    horizontalRoadAt(authoredX, authoredZ, 430, 466, -235, 2, 5, true),
    horizontalRoadAt(authoredX, authoredZ, 418, 478, -115, 2, 5, true)
  );
}
