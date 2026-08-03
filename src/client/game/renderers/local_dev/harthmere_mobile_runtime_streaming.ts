export interface HarthmereMobileRuntimePlacementCandidate {
  index: number;
  asset: string;
  x: number;
  z: number;
}

export interface HarthmereMobileRuntimePlacementSelection {
  indexes: number[];
  assetKeys: string[];
}

export interface HarthmereMobileRuntimePlacementLimits {
  radiusMeters: number;
  maxPlacements: number;
  maxAssets: number;
}

/**
 * Selects the closest authored runtime placements while bounding both the
 * number of cloned objects and the number of decoded model prototypes. The
 * latter is the important iPhone memory limit: one prototype can retain much
 * more CPU/GPU memory than its placement count suggests.
 */
export function selectHarthmereMobileRuntimePlacements(
  candidates: readonly HarthmereMobileRuntimePlacementCandidate[],
  origin: readonly [number, number],
  limits: HarthmereMobileRuntimePlacementLimits
): HarthmereMobileRuntimePlacementSelection {
  const radiusSq = limits.radiusMeters * limits.radiusMeters;
  const nearby = candidates
    .map((candidate) => {
      const dx = candidate.x - origin[0];
      const dz = candidate.z - origin[1];
      return { candidate, distanceSq: dx * dx + dz * dz };
    })
    .filter(({ distanceSq }) => distanceSq <= radiusSq)
    .sort(
      (a, b) =>
        a.distanceSq - b.distanceSq || a.candidate.index - b.candidate.index
    );

  const indexes: number[] = [];
  const assetKeys: string[] = [];
  const assets = new Set<string>();
  for (const { candidate } of nearby) {
    if (indexes.length >= limits.maxPlacements) {
      break;
    }
    if (!assets.has(candidate.asset)) {
      if (assets.size >= limits.maxAssets) {
        continue;
      }
      assets.add(candidate.asset);
      assetKeys.push(candidate.asset);
    }
    indexes.push(candidate.index);
  }

  return { indexes, assetKeys };
}
