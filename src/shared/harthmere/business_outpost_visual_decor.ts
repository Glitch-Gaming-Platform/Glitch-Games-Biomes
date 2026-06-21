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
  return specs;
}
