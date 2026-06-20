// Pure proximity helper for the "Property For Sale" world hint. Kept React-free
// so the in/out-of-range + nearest-plot logic can be unit-tested without the 3D
// world or client context.

import type { HarthmerePurchasablePlotMapLandmark } from "@/client/components/biomes_ui/adapters/propertyMapMarkers";

export interface PropertyForSaleProximityPoint {
  x: number;
  z: number;
}

export interface NearestPropertyForSale {
  landmark: HarthmerePurchasablePlotMapLandmark;
  distance: number;
}

// Nearest for-sale plot within `radius` of the player (XZ distance), or
// undefined when none are in range.
export function nearestPropertyForSaleLandmark(
  landmarks: readonly HarthmerePurchasablePlotMapLandmark[],
  player: PropertyForSaleProximityPoint | undefined,
  radius: number
): NearestPropertyForSale | undefined {
  if (!player) {
    return undefined;
  }
  let best: NearestPropertyForSale | undefined;
  for (const landmark of landmarks) {
    const distance = Math.hypot(
      landmark.position[0] - player.x,
      landmark.position[2] - player.z
    );
    if (distance <= radius && (!best || distance < best.distance)) {
      best = { landmark, distance };
    }
  }
  return best;
}
