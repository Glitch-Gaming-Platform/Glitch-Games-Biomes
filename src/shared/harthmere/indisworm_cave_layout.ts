import type { HarthmereExoticMatterCaveId } from "@/shared/harthmere/exotic_matter_caves";

// Shared encounter anchors for the four original-map massive caverns. These
// coordinates are already production world coordinates: unlike the town and
// Underways caves, they must not receive the additive Harthmere +1600 offset.
// Both the Indisworm seed catalogue and the guarded Exotic Matter deposits use
// this table so a five-worm pack and its three-material cache cannot drift.
export const HARTHMERE_INDISWORM_CAVE_IDS = [
  "deep_spindle_massive_cave",
  "harthmere_core_massive_cave",
  "harthmere_far_hollow_massive_cave",
  "harthmere_high_vault_massive_cave",
] as const satisfies readonly HarthmereExoticMatterCaveId[];

export type HarthmereIndiswormCaveId =
  (typeof HARTHMERE_INDISWORM_CAVE_IDS)[number];

export const HARTHMERE_INDISWORM_CAVE_LAYOUTS = {
  deep_spindle_massive_cave: {
    progressionLevel: 4,
    packCenters: [
      [714, -379],
      [724, -369],
      [734, -359],
    ],
  },
  harthmere_core_massive_cave: {
    progressionLevel: 5,
    packCenters: [
      [924, -315],
      [956, -315],
      [939, -281],
    ],
  },
  harthmere_far_hollow_massive_cave: {
    progressionLevel: 6,
    packCenters: [
      [956, -690],
      [988, -690],
      [971, -656],
    ],
  },
  harthmere_high_vault_massive_cave: {
    progressionLevel: 7,
    packCenters: [
      [178, 293],
      [210, 293],
      [193, 327],
    ],
  },
} as const satisfies Record<
  HarthmereIndiswormCaveId,
  {
    progressionLevel: number;
    packCenters: readonly [
      readonly [number, number],
      readonly [number, number],
      readonly [number, number],
    ];
  }
>;
