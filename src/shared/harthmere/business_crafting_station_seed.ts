import { BikkieIds } from "@/shared/bikkie/ids";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES,
} from "@/shared/harthmere/business_customer_simulator";
import type { HarthmereEconomyBusinessTypeId } from "@/shared/harthmere/mmo_economy_authority";
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE } from "@/shared/harthmere/snapshot_grove_content";
import type { BiomesId } from "@/shared/ids";
import type { Vec2, Vec3 } from "@/shared/math/types";

// HARTHMERE_BUSINESS_CRAFTING_STATION_SEED
//
// Every one of the 19 outpost businesses had an owner NPC and standing customers,
// but no in-shop crafting table — so a shop themed around tool-smithing, cooking,
// refining, etc. had nothing the player could actually craft at. This module is
// the canonical data for ONE appropriate crafting station placed inside each
// business interior. It mirrors the business owner NPC seed pattern (deterministic
// id, footprint-anchored position) but produces a *placeable crafting station*
// rather than an NPC. The server seed builder
// (`buildHarthmereBusinessCraftingStationSeedChanges`) turns these into ECS
// placeable entities carrying a `crafting_station_component`, so the existing
// placeable inspection path shows the native "F – craft" prompt and opens the
// crafting UI. Detection by the prompt is purely by identity
// (placeable + item.isCraftingStation); see harthmere_crafting_table_proximity.

export const HARTHMERE_BUSINESS_CRAFTING_STATION_SEED_VERSION =
  "harthmere-business-crafting-station-seed" as const;

// Offset band reserved for the 19 business crafting stations. Grove NPCs use
// 9301+, robots 9401+, muck monsters 9451–9550, wildlife 9551–9574, business
// owners 9601–9619, and customers 9701+. 9651–9669 is a clear, non-overlapping
// band that sits between owners and customers.
export const HARTHMERE_BUSINESS_CRAFTING_STATION_ID_OFFSET_BASE = 9651;

// One station kind: the bikkie placeable item id (so `anItem(itemId)` resolves the
// real crafting station, its mesh, and `isCraftingStation`) plus a readable name.
interface CraftingStationKind {
  itemId: BiomesId;
  displayName: string;
}

const STATION_KINDS = {
  thermoblaster: { itemId: BikkieIds.thermoblaster, displayName: "Thermoblaster" },
  thermolite: { itemId: BikkieIds.thermolite, displayName: "Thermolite" },
  workbench: { itemId: BikkieIds.workbench, displayName: "Workbench" },
  kitchen: { itemId: BikkieIds.kitchen, displayName: "Kitchen" },
  seedMill: { itemId: BikkieIds.seedMill, displayName: "Seed Mill" },
  composter: { itemId: BikkieIds.composter, displayName: "Composter" },
  anglersTable: { itemId: BikkieIds.anglersTable, displayName: "Angler's Table" },
  dyeOMatic: { itemId: BikkieIds.dyeOMatic, displayName: "Dye-O-Matic" },
} as const satisfies Record<string, CraftingStationKind>;

type StationKindKey = keyof typeof STATION_KINDS;

// The crafting station that best fits each business. Every one of the 19 business
// types maps to exactly one station, chosen for the work the shop actually does:
//  - furnaces/smelters for refining and smithing,
//  - a Workbench for the generalist trades (repair, building, trading, courier,
//    security) that assemble and fix a bit of everything,
//  - growing/soil stations for farming, design, and cleanup,
//  - kitchens for food + hospitality, an Angler's Table for the outdoors trades,
//    and a Dye-O-Matic for the brewing trades (medicine + magic).
const HARTHMERE_BUSINESS_TYPE_STATION: Readonly<
  Record<HarthmereEconomyBusinessTypeId, StationKindKey>
> = {
  exotic_matter_refinery: "thermoblaster",
  weapons_tools: "thermolite",
  portal_transit_company: "thermolite",
  teleport_owner: "thermolite",
  biome_maintenance_repair: "workbench",
  repair_maintenance_person: "workbench",
  custom_home_property_development: "workbench",
  general_trader: "workbench",
  courier: "workbench",
  security_defense_contractor: "workbench",
  biome_design_studio: "seedMill",
  biome_farming_rare_foods: "composter",
  waste_sanitation_cleanup: "composter",
  food_service_restaurant: "kitchen",
  hospitality_inn_hotel_shelter: "kitchen",
  hunter_wild_meat: "anglersTable",
  exploration_guide: "anglersTable",
  medical_doctor: "dyeOMatic",
  magic_goods: "dyeOMatic",
};

export interface HarthmereBusinessCraftingStationSeed {
  stationSeedId: string;
  outpostId: string;
  businessType: HarthmereEconomyBusinessTypeId;
  businessName: string;
  stationKind: StationKindKey;
  stationItemId: BiomesId;
  stationName: string;
  idOffset: number;
  entityId: BiomesId;
  position: Vec3;
  orientation: Vec2;
}

function entityIdFromOffset(idOffset: number): BiomesId {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + idOffset) as BiomesId;
}

// Anchor the station in a back interior corner of the building footprint, inset
// from the walls, so it sits clearly inside the shop and never on top of the
// owner (who stands at the footprint center). Grounded at the building floor Y,
// the same height the owner uses.
function stationPositionForSafeSite(site: {
  groundY: number;
  footprint: { xMin: number; xMax: number; zMin: number; zMax: number };
}): Vec3 {
  const halfWidth = (site.footprint.xMax - site.footprint.xMin) / 2;
  const halfDepth = (site.footprint.zMax - site.footprint.zMin) / 2;
  const insetX = Math.max(1, Math.min(2.5, halfWidth - 1));
  const insetZ = Math.max(1, Math.min(2.5, halfDepth - 1));
  return [
    site.footprint.xMin + insetX,
    site.groundY,
    site.footprint.zMin + insetZ,
  ];
}

export const HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS: readonly HarthmereBusinessCraftingStationSeed[] =
  HARTHMERE_BUSINESS_OUTPOSTS.map((outpost, index) => {
    const site = HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES.find(
      (candidate) => candidate.outpostId === outpost.outpostId
    );
    if (!site) {
      throw new Error(
        `Missing business outpost safe site for ${outpost.outpostId}`
      );
    }
    const stationKind = HARTHMERE_BUSINESS_TYPE_STATION[outpost.businessType];
    if (!stationKind) {
      throw new Error(
        `Missing crafting station mapping for business type ${outpost.businessType} (${outpost.outpostId})`
      );
    }
    const kind = STATION_KINDS[stationKind];
    const idOffset =
      HARTHMERE_BUSINESS_CRAFTING_STATION_ID_OFFSET_BASE + index;
    return {
      stationSeedId: `station_${outpost.outpostId}`,
      outpostId: outpost.outpostId,
      businessType: outpost.businessType,
      businessName: outpost.displayName,
      stationKind,
      stationItemId: kind.itemId,
      stationName: kind.displayName,
      idOffset,
      entityId: entityIdFromOffset(idOffset),
      position: stationPositionForSafeSite(site),
      orientation: [0, Number(outpost.position.rot) || 0] as Vec2,
    } satisfies HarthmereBusinessCraftingStationSeed;
  });

export function harthmereBusinessCraftingStationSeedIds(): BiomesId[] {
  return HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS.map(
    (seed) => seed.entityId
  );
}

export function harthmereBusinessCraftingStationSeedByOutpost(
  outpostId: string
): HarthmereBusinessCraftingStationSeed | undefined {
  return HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS.find(
    (seed) => seed.outpostId === outpostId
  );
}

const HARTHMERE_BUSINESS_CRAFTING_STATION_ENTITY_ID_SET = new Set<number>(
  HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS.map((seed) =>
    Number(seed.entityId)
  )
);

export function isHarthmereBusinessCraftingStationEntityId(
  id: BiomesId | number | undefined
): boolean {
  return (
    id !== undefined &&
    HARTHMERE_BUSINESS_CRAFTING_STATION_ENTITY_ID_SET.has(Number(id))
  );
}

export function validateHarthmereBusinessCraftingStationSeeds(): string[] {
  const errors: string[] = [];
  const ids = new Set<BiomesId>();
  const offsets = new Set<number>();
  const outposts = new Set<string>();
  for (const seed of HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS) {
    if (ids.has(seed.entityId)) {
      errors.push(`${seed.outpostId}:duplicate_entity_id`);
    }
    ids.add(seed.entityId);
    if (offsets.has(seed.idOffset)) {
      errors.push(`${seed.outpostId}:duplicate_id_offset`);
    }
    offsets.add(seed.idOffset);
    if (outposts.has(seed.outpostId)) {
      errors.push(`${seed.outpostId}:duplicate_outpost`);
    }
    outposts.add(seed.outpostId);
    if (!seed.stationName.trim()) {
      errors.push(`${seed.outpostId}:missing_station_name`);
    }
    if (!Number.isFinite(Number(seed.stationItemId))) {
      errors.push(`${seed.outpostId}:invalid_station_item_id`);
    }
    if (!seed.position.every((value) => Number.isFinite(value))) {
      errors.push(`${seed.outpostId}:invalid_position`);
    }
  }
  return errors;
}
