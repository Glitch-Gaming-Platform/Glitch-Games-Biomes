import type {
  HarthmereBusinessOutpostInteriorFixture,
  HarthmereBusinessOutpostProceduralBuildingRecord,
} from "@/shared/harthmere/business_customer_simulator";
import type {
  HarthmereCollisionConfig,
  HarthmerePlacementMetadata,
} from "@/shared/harthmere/town_registry";

export const HARTHMERE_BUSINESS_OUTPOST_VISUAL_DECOR_VERSION =
  "harthmere-business-outpost-visual-prop-interiors" as const;
export const HARTHMERE_BUSINESS_OUTPOST_ENHANCED_FURNISHING_VERSION =
  "harthmere-business-outpost-additive-furnishing-v2" as const;

export const HARTHMERE_BUSINESS_OUTPOST_VISUAL_DECOR_COLLISION: HarthmereCollisionConfig =
  {
    category: "none",
    blocksNpc: false,
    blocksPlayer: false,
    blocksCamera: false,
    reason:
      "visual-only passable business outpost interior decor; server voxel shell owns collision",
  };

type HarthmereBusinessOutpostInteriorDecorAssetChoice = {
  asset: string;
  scale?: number;
  yOffset?: number;
  accentAsset?: string;
  accentScale?: number;
  accentYOffset?: number;
};

export type HarthmereBusinessOutpostInteriorDecorSpec = {
  fixture: HarthmereBusinessOutpostInteriorFixture;
  asset: string;
  scale: number;
  yOffset?: number;
  support: HarthmerePlacementMetadata["physicalSupport"];
  nameSuffix?: string;
  dx?: number;
  dz?: number;
  drot?: number;
};

const HARTHMERE_BUSINESS_OUTPOST_DECOR_DEFAULT_SCALES: Record<string, number> =
  {
    anvil_fp: 0.74,
    barrel_apples: 0.72,
    barrel_fp: 0.74,
    barrel_holder_fp: 0.76,
    bed_twin1: 0.76,
    bed_twin2: 0.76,
    bench_fp: 0.78,
    book_group_1: 0.3,
    book_group_2: 0.3,
    book_stack_1: 0.3,
    book_stack_2: 0.3,
    bookcase_2: 0.72,
    bookstand_fp: 0.58,
    bucket_wood: 0.7,
    cabinet: 0.72,
    cauldron_fp: 0.7,
    crate_wooden_fp: 0.72,
    farmcrate_carrot: 0.72,
    lantern_wall_fp: 0.68,
    mug_fp: 0.28,
    potion_2_fp: 0.28,
    shelf_small_bottles: 0.72,
    stool_fp: 0.72,
    table_large_fp: 0.68,
    weaponstand_fp: 0.74,
    whetstone_fp: 0.32,
    workbench_drawers_fp: 0.72,
  };

type HarthmereBusinessFurnishingChoice = {
  asset: string;
  scale: number;
  support: HarthmerePlacementMetadata["physicalSupport"];
  yOffset?: number;
};

const HARTHMERE_BUSINESS_SIGNATURE_FURNISHINGS: Record<
  HarthmereBusinessOutpostProceduralBuildingRecord["businessType"],
  HarthmereBusinessFurnishingChoice
> = {
  exotic_matter_refinery: {
    asset: "potion_2_fp",
    scale: 0.3,
    support: "table",
    yOffset: 0.86,
  },
  biome_maintenance_repair: {
    asset: "whetstone_fp",
    scale: 0.34,
    support: "table",
    yOffset: 0.82,
  },
  biome_design_studio: {
    asset: "book_group_2",
    scale: 0.34,
    support: "table",
    yOffset: 0.84,
  },
  security_defense_contractor: {
    asset: "weaponstand_fp",
    scale: 0.7,
    support: "floor",
  },
  portal_transit_company: {
    asset: "lantern_wall_fp",
    scale: 0.66,
    support: "wall",
    yOffset: 1.16,
  },
  biome_farming_rare_foods: {
    asset: "farmcrate_carrot",
    scale: 0.68,
    support: "floor",
  },
  weapons_tools: {
    asset: "anvil_fp",
    scale: 0.68,
    support: "floor",
  },
  magic_goods: {
    asset: "shelf_small_bottles",
    scale: 0.68,
    support: "floor",
  },
  exploration_guide: {
    asset: "bookstand_fp",
    scale: 0.56,
    support: "table",
    yOffset: 0.06,
  },
  custom_home_property_development: {
    asset: "book_group_1",
    scale: 0.34,
    support: "table",
    yOffset: 0.84,
  },
  general_trader: {
    asset: "barrel_apples",
    scale: 0.68,
    support: "floor",
  },
  hunter_wild_meat: {
    asset: "barrel_fp",
    scale: 0.7,
    support: "floor",
  },
  medical_doctor: {
    asset: "potion_2_fp",
    scale: 0.3,
    support: "table",
    yOffset: 0.88,
  },
  teleport_owner: {
    asset: "lantern_wall_fp",
    scale: 0.66,
    support: "wall",
    yOffset: 1.16,
  },
  waste_sanitation_cleanup: {
    asset: "bucket_wood",
    scale: 0.68,
    support: "floor",
  },
  repair_maintenance_person: {
    asset: "workbench_drawers_fp",
    scale: 0.66,
    support: "floor",
  },
  food_service_restaurant: {
    asset: "mug_fp",
    scale: 0.3,
    support: "table",
    yOffset: 0.8,
  },
  courier: {
    asset: "book_stack_2",
    scale: 0.32,
    support: "table",
    yOffset: 0.78,
  },
  hospitality_inn_hotel_shelter: {
    asset: "mug_fp",
    scale: 0.3,
    support: "table",
    yOffset: 0.8,
  },
};

function fixtureForRole(
  record: HarthmereBusinessOutpostProceduralBuildingRecord,
  role: HarthmereBusinessOutpostInteriorFixture["role"]
) {
  return record.interiorFixtures.find((fixture) => fixture.role === role);
}

function inwardOffset(
  record: HarthmereBusinessOutpostProceduralBuildingRecord,
  fixture: HarthmereBusinessOutpostInteriorFixture,
  distance: number
) {
  const midX = record.origin.x + record.blueprint.footprint.width / 2;
  const midZ = record.origin.z + record.blueprint.footprint.depth / 2;
  const vx = midX - fixture.position.x;
  const vz = midZ - fixture.position.z;
  const length = Math.hypot(vx, vz) || 1;
  return { dx: (vx / length) * distance, dz: (vz / length) * distance };
}

export function createHarthmereBusinessOutpostEnhancedFurnishingSpecs(
  record: HarthmereBusinessOutpostProceduralBuildingRecord
): HarthmereBusinessOutpostInteriorDecorSpec[] {
  const specs: HarthmereBusinessOutpostInteriorDecorSpec[] = [];
  const serviceCounter = fixtureForRole(record, "service_counter");
  const dashboard = fixtureForRole(record, "dashboard_access");
  const primaryStation = fixtureForRole(record, "primary_station");
  const stockStorage = fixtureForRole(record, "stock_storage");

  // This pass only appends detail around the existing fixture plan. Anchoring
  // every addition to a known interior fixture keeps doors/queues untouched and
  // makes the enhancement safe for all 19 already-materialized businesses.
  if (serviceCounter) {
    const inward = inwardOffset(record, serviceCounter, 1.15);
    specs.push(
      {
        fixture: serviceCounter,
        asset: "stool_fp",
        scale: 0.66,
        support: "floor",
        nameSuffix: " enhanced staff stool",
        ...inward,
      },
      {
        fixture: serviceCounter,
        asset: "mug_fp",
        scale: 0.28,
        support: "table",
        yOffset: 0.8,
        nameSuffix: " enhanced counter service item",
        dx: -inward.dz * 0.28,
        dz: inward.dx * 0.28,
        drot: Math.PI / 8,
      }
    );
  }

  if (stockStorage) {
    specs.push({
      fixture: stockStorage,
      asset: "crate_wooden_fp",
      scale: 0.64,
      support: "floor",
      nameSuffix: " enhanced floor stock crate",
      ...inwardOffset(record, stockStorage, 0.72),
      drot: -Math.PI / 12,
    });
  }

  if (dashboard) {
    const inward = inwardOffset(record, dashboard, 1.25);
    specs.push(
      {
        fixture: dashboard,
        asset: "lantern_wall_fp",
        scale: 0.62,
        support: "wall",
        yOffset: 1.12,
        nameSuffix: " enhanced wall lantern",
      },
      {
        fixture: dashboard,
        asset: "bench_fp",
        scale: 0.68,
        support: "floor",
        nameSuffix: " enhanced customer bench",
        ...inward,
      }
    );
  }

  if (primaryStation) {
    const signature =
      HARTHMERE_BUSINESS_SIGNATURE_FURNISHINGS[record.businessType];
    specs.push({
      fixture: primaryStation,
      ...signature,
      nameSuffix: ` enhanced ${record.businessType} signature furnishing`,
      ...inwardOffset(
        record,
        primaryStation,
        signature.support === "floor" ? 0.56 : 0.16
      ),
      drot: Math.PI / 10,
    });
  }

  return specs;
}

function harthmereBusinessOutpostInteriorFixtureAssetChoice(
  record: HarthmereBusinessOutpostProceduralBuildingRecord,
  fixture: HarthmereBusinessOutpostInteriorFixture
): HarthmereBusinessOutpostInteriorDecorAssetChoice | undefined {
  if (fixture.role === "customer_queue_space") return undefined;

  const label =
    `${record.businessType} ${fixture.role} ${fixture.label}`.toLowerCase();
  if (fixture.role === "service_counter") {
    return {
      asset: "table_large_fp",
      scale: 0.72,
      accentAsset: "book_stack_1",
      accentScale: 0.34,
      accentYOffset: 0.82,
    };
  }
  if (fixture.role === "dashboard_access") {
    return { asset: "bookstand_fp", scale: 0.58, yOffset: 0.04 };
  }
  if (fixture.role === "seating") {
    if (/bed|cot/.test(label)) return { asset: "bed_twin1", scale: 0.76 };
    if (/stool|chair/.test(label)) return { asset: "stool_fp", scale: 0.72 };
    return { asset: "bench_fp", scale: 0.78 };
  }
  if (/anvil|forge anvil|blade/.test(label))
    return { asset: "anvil_fp", scale: 0.74 };
  if (/weapon|armor|patrol|blade|security|shield/.test(label)) {
    return { asset: "weaponstand_fp", scale: 0.74 };
  }
  if (
    /workbench|vise|repair|calibration|tool|maintenance|refinery|inspection/.test(
      label
    )
  ) {
    return {
      asset: "workbench_drawers_fp",
      scale: 0.72,
      accentAsset: "whetstone_fp",
      accentScale: 0.32,
      accentYOffset: 0.82,
    };
  }
  if (
    /cauldron|brew|cooking|hearth|kitchen|meal|buff|prep|spice|steam/.test(
      label
    )
  ) {
    return {
      asset: "cauldron_fp",
      scale: 0.7,
      accentAsset: /spice|prep|meal|buff|service/.test(label)
        ? "mug_fp"
        : undefined,
      accentScale: 0.28,
      accentYOffset: 0.76,
    };
  }
  if (/clinic|medical|doctor|recovery|treatment|cot|bed/.test(label)) {
    return /cabinet|medicine|apothecary|bottle/.test(label)
      ? { asset: "shelf_small_bottles", scale: 0.72 }
      : { asset: "bed_twin2", scale: 0.76 };
  }
  if (/potion|apothecary|medicine|bottle|charm|magic|arcane/.test(label)) {
    return {
      asset: "shelf_small_bottles",
      scale: 0.72,
      accentAsset: "potion_2_fp",
      accentScale: 0.28,
      accentYOffset: 0.94,
    };
  }
  if (
    /lantern|lamp|candle|warning|light|signal|stability|rune|ward/.test(label)
  ) {
    return { asset: "lantern_wall_fp", scale: 0.68, yOffset: 1.1 };
  }
  if (/bucket|wash|trough|decon|cleanup|sanitation|quench/.test(label)) {
    return { asset: "bucket_wood", scale: 0.7 };
  }
  if (/barrel|canister|tank|coolant|fuel|reserve|drum|vat|larder/.test(label)) {
    return { asset: "barrel_holder_fp", scale: 0.76 };
  }
  if (
    /food|rare|farming|harvest|ingredient|pantry|seed|plant|herb|apple|carrot|dry goods/.test(
      label
    )
  ) {
    return /carrot|seed|herb|plant/.test(label)
      ? { asset: "farmcrate_carrot", scale: 0.72 }
      : { asset: "barrel_apples", scale: 0.72 };
  }
  if (/hunter|meat|hide|cold|ice/.test(label))
    return { asset: "barrel_fp", scale: 0.74 };
  if (/parcel|package|courier|dispatch|route|letter|ticket/.test(label)) {
    return {
      asset: "crate_wooden_fp",
      scale: 0.72,
      accentAsset: "book_stack_2",
      accentScale: 0.3,
      accentYOffset: 0.72,
    };
  }
  if (
    /book|ledger|notice|deed|permit|map|blueprint|record|contract|price|swatch|wall|panel|pegboard|cabinet|shelf|rack/.test(
      label
    )
  ) {
    return /book|ledger|notice|route|map|blueprint|record|contract|price/.test(
      label
    )
      ? {
          asset: "bookcase_2",
          scale: 0.72,
          accentAsset: "book_group_1",
          accentScale: 0.3,
          accentYOffset: 0.92,
        }
      : { asset: "cabinet", scale: 0.72 };
  }
  if (
    /home|property|design|display|plinth|stand|model|drafting|easel/.test(label)
  ) {
    return {
      asset: "table_large_fp",
      scale: 0.68,
      accentAsset: "book_group_2",
      accentScale: 0.3,
      accentYOffset: 0.82,
    };
  }
  if (fixture.role === "stock_storage")
    return { asset: "cabinet", scale: 0.72 };
  if (fixture.role === "service_table" || fixture.role === "workstation") {
    return {
      asset: "table_large_fp",
      scale: 0.68,
      accentAsset: "book_stack_1",
      accentScale: 0.3,
      accentYOffset: 0.82,
    };
  }
  return { asset: "table_large_fp", scale: 0.66 };
}

function harthmereBusinessOutpostDecorScale(
  asset: string,
  fixture: HarthmereBusinessOutpostInteriorFixture,
  explicitScale?: number
) {
  if (explicitScale !== undefined) return explicitScale;
  const footprint = Math.max(fixture.size[0], fixture.size[2]);
  if (/table_large|workbench/.test(asset)) {
    return Math.max(0.58, Math.min(0.78, footprint * 0.34));
  }
  if (/bench|bed/.test(asset)) {
    return Math.max(0.66, Math.min(0.82, footprint * 0.36));
  }
  if (/cabinet|bookcase|shelf/.test(asset)) return 0.72;
  if (/lantern|candle|potion|mug|book|whetstone/.test(asset)) return 0.32;
  return HARTHMERE_BUSINESS_OUTPOST_DECOR_DEFAULT_SCALES[asset] ?? 0.72;
}

function harthmereBusinessOutpostDecorSupport(
  asset: string,
  fixture: HarthmereBusinessOutpostInteriorFixture
): HarthmerePlacementMetadata["physicalSupport"] {
  const label = `${asset} ${fixture.label}`.toLowerCase();
  if (/lantern_wall|wall|map|board|pegboard|rack/.test(label)) return "wall";
  if (/book_|bookstand|potion|mug|whetstone|coin|key|chalice/.test(label)) {
    return "table";
  }
  return "floor";
}

export function createHarthmereBusinessOutpostInteriorDecorSpecs(
  record: HarthmereBusinessOutpostProceduralBuildingRecord
): HarthmereBusinessOutpostInteriorDecorSpec[] {
  const specs: HarthmereBusinessOutpostInteriorDecorSpec[] = [];
  for (const fixture of record.interiorFixtures) {
    const choice = harthmereBusinessOutpostInteriorFixtureAssetChoice(
      record,
      fixture
    );
    if (!choice) continue;
    specs.push({
      fixture,
      asset: choice.asset,
      scale: harthmereBusinessOutpostDecorScale(
        choice.asset,
        fixture,
        choice.scale
      ),
      yOffset: choice.yOffset,
      support: harthmereBusinessOutpostDecorSupport(choice.asset, fixture),
    });
    if (choice.accentAsset) {
      specs.push({
        fixture,
        asset: choice.accentAsset,
        nameSuffix: " accent",
        scale: harthmereBusinessOutpostDecorScale(
          choice.accentAsset,
          fixture,
          choice.accentScale
        ),
        yOffset: choice.accentYOffset,
        support: "table",
        dx: 0.18,
        dz: -0.12,
        drot: Math.PI / 6,
      });
    }
  }
  specs.push(...createHarthmereBusinessOutpostEnhancedFurnishingSpecs(record));
  return specs;
}
