export const HARTHMERE_SERVICE_BUILDING_VISUAL_DECOR_VERSION =
  "harthmere-service-building-snapshot-interiors-v1" as const;

export type HarthmereServiceBuildingProfile =
  | "bakery"
  | "provision"
  | "player_services"
  | "smithy"
  | "workshop"
  | "apothecary"
  | "magic_shop"
  | "inn"
  | "reeve_hall"
  | "dock_warehouse"
  | "mudden_home"
  | "wash_house"
  | "residential_cottage"
  | "barracks"
  | "stable_office"
  | "chapel";

export type HarthmereServiceBuildingVisualDecorSpec = {
  asset: string;
  dx: number;
  dz: number;
  rotAdd: number;
  scale: number;
  label: string;
  yOffset?: number;
  floor?: number;
};

const PROFILE_ACCENTS: Record<
  HarthmereServiceBuildingProfile,
  { stock: string; tabletop: string; seating: string }
> = {
  bakery: {
    stock: "barrel_apples",
    tabletop: "bread_loaf",
    seating: "stool_fp",
  },
  provision: { stock: "barrel_fp", tabletop: "bag_fp", seating: "bench_fp" },
  player_services: {
    stock: "chest_wood_fp",
    tabletop: "scroll_1_fp",
    seating: "chair",
  },
  smithy: {
    stock: "crate_metal_fp",
    tabletop: "whetstone_fp",
    seating: "stool_fp",
  },
  workshop: {
    stock: "crate_wooden_fp",
    tabletop: "book_stack_1",
    seating: "stool_fp",
  },
  apothecary: {
    stock: "cabinet",
    tabletop: "potion_2_fp",
    seating: "bench_fp",
  },
  magic_shop: {
    stock: "bookcase_2",
    tabletop: "book_group_2",
    seating: "chair",
  },
  inn: { stock: "barrel_holder_fp", tabletop: "mug_fp", seating: "bench_fp" },
  reeve_hall: { stock: "cabinet", tabletop: "scroll_2_fp", seating: "chair" },
  dock_warehouse: {
    stock: "barrel_large",
    tabletop: "book_stack_2",
    seating: "bench_fp",
  },
  mudden_home: {
    stock: "crate_wooden_fp",
    tabletop: "mug_fp",
    seating: "stool_fp",
  },
  wash_house: {
    stock: "barrel_large",
    tabletop: "bucket_wood",
    seating: "bench_fp",
  },
  residential_cottage: {
    stock: "chest_wood_fp",
    tabletop: "book_stack_1",
    seating: "chair",
  },
  barracks: {
    stock: "chest_wood_fp",
    tabletop: "shield_wooden_fp",
    seating: "bench_fp",
  },
  stable_office: {
    stock: "barrel_fp",
    tabletop: "book_stack_1",
    seating: "stool_fp",
  },
  chapel: {
    stock: "cabinet",
    tabletop: "book_group_1",
    seating: "church_bench",
  },
};

/**
 * Additive furnishing pass modeled on the May 16 snapshot interiors:
 * perimeter seating, wall storage, supported tabletop clutter, warm light, and
 * a clear center line from the front door to the back of the room.
 */
export function createHarthmereServiceBuildingVisualDecorSpecs(input: {
  profile: HarthmereServiceBuildingProfile;
  width: number;
  depth: number;
  floors: number;
}): HarthmereServiceBuildingVisualDecorSpec[] {
  const accent = PROFILE_ACCENTS[input.profile];
  const sideX = Math.max(
    2,
    Math.min(input.width * 0.32, input.width / 2 - 1.25)
  );
  const rearZ = -Math.max(
    2,
    Math.min(input.depth * 0.32, input.depth / 2 - 1.25)
  );
  const sideZ = -Math.min(1.4, input.depth * 0.1);

  const specs: HarthmereServiceBuildingVisualDecorSpec[] = [
    {
      asset: accent.seating,
      dx: -sideX,
      dz: sideZ,
      rotAdd: Math.PI / 2,
      scale: 0.34,
      label: "snapshot-reference perimeter seating beside clear center aisle",
    },
    {
      asset: accent.stock,
      dx: sideX,
      dz: rearZ,
      rotAdd: -Math.PI / 2,
      scale: 0.38,
      label: "snapshot-reference back-of-house stock against wall",
    },
    {
      asset: "table_small",
      dx: -sideX,
      dz: rearZ,
      rotAdd: 0,
      scale: 0.34,
      label: "snapshot-reference supported side display table",
    },
    {
      asset: accent.tabletop,
      dx: -sideX,
      dz: rearZ,
      rotAdd: 0,
      scale: 0.2,
      yOffset: 0.56,
      label: "snapshot-reference small stock supported on side table",
    },
    {
      asset: "lantern_wall_fp",
      dx: sideX,
      dz: sideZ,
      rotAdd: -Math.PI / 2,
      scale: 0.38,
      yOffset: 1.08,
      label: "snapshot-reference wall-mounted interior light",
    },
    {
      asset: "crate_wooden_fp",
      dx: sideX,
      dz: Math.min(1.2, input.depth * 0.08),
      rotAdd: 0,
      scale: 0.36,
      label: "snapshot-reference floor storage outside doorway line",
    },
  ];

  if (input.floors > 1) {
    specs.push(
      {
        asset: "bed_twin2",
        dx: -sideX,
        dz: rearZ,
        rotAdd: Math.PI / 2,
        scale: 0.36,
        floor: 2,
        label: "snapshot-reference upper-floor room bed against wall",
      },
      {
        asset: "nightstand",
        dx: -sideX + 1.4,
        dz: rearZ,
        rotAdd: 0,
        scale: 0.3,
        floor: 2,
        label: "snapshot-reference upper-floor bedside table",
      },
      {
        asset: "candle_1_fp",
        dx: -sideX + 1.4,
        dz: rearZ,
        rotAdd: 0,
        scale: 0.18,
        yOffset: 0.52,
        floor: 2,
        label: "snapshot-reference upper-floor candle supported on nightstand",
      },
      {
        asset: "chest_wood_fp",
        dx: sideX,
        dz: rearZ,
        rotAdd: -Math.PI / 2,
        scale: 0.34,
        floor: 2,
        label: "snapshot-reference upper-floor personal storage against wall",
      },
      {
        asset: "chair",
        dx: sideX,
        dz: sideZ,
        rotAdd: -Math.PI / 2,
        scale: 0.3,
        floor: 2,
        label:
          "snapshot-reference upper-floor room chair outside stair landing",
      }
    );
  }

  return specs;
}
