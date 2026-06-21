import type { HarthmereEconomyBusinessTypeId } from "./mmo_economy_authority";
import type {
  HarthmereJobsBoardJobKind,
  HarthmereJobsBoardRequirement,
} from "./mmo_jobs_board_authority";

export interface HarthmereJobsBoardBusinessTemplate {
  templateId: string;
  businessType: HarthmereEconomyBusinessTypeId;
  label: string;
  title: string;
  description: string;
  kind: HarthmereJobsBoardJobKind;
  requirements: HarthmereJobsBoardRequirement[];
  targetId: string;
  mapMarkerId: string;
  defaultRewardGold: number;
  defaultDeadlineDays: number;
  requiresFieldWork: true;
}

export const HARTHMERE_JOBS_BOARD_EXECUTABLE_ITEM_IDS = new Set([
  "anchor_core",
  "antiboron_block",
  "antihelium_block",
  "antihydrogen_block",
  "bandage",
  "clean_water",
  "cleaning_reagent",
  "cloth_scrap",
  "coal",
  "compost",
  "coolant",
  "crop_bundle",
  "destination_crystal",
  "field_medkit",
  "field_wheat",
  "fresh_carrot",
  "herb_bundle",
  "iron_ingot",
  "iron_ore",
  "linen_bundle",
  "lockbox",
  "minor_healing_salve",
  "mixed_waste",
  "oak_branch",
  "portal_fuel",
  "raw_exotic_matter",
  "raw_meat",
  "relic_fragment",
  "repair_part",
  "repair_tool",
  "road_ration",
  "rough_stone",
  "scrap_metal",
  "sealed_package",
  "softwood_log",
  "stabilized_exotic_matter",
  "stabilizing_crystal",
  "tree_resin",
  "venison",
  "wild_meat",
  "wild_berries",
  "wood_plank",
]);

export const HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES: HarthmereJobsBoardBusinessTemplate[] =
  [
    {
      templateId: "refinery_raw_exotic_supply",
      businessType: "exotic_matter_refinery",
      label: "Raw matter run",
      title: "Deliver Raw Exotic Matter to the Refinery",
      description:
        "Bring sealed raw Exotic Matter to the refinery intake so it can be stabilized into fuel and anchor parts.",
      kind: "delivery",
      requirements: [
        {
          itemId: "raw_exotic_matter",
          count: 2,
          targetId: "refinery_intake",
          targetName: "Refinery intake",
          mapMarkerId: "refinery_intake_marker",
        },
      ],
      targetId: "refinery_intake",
      mapMarkerId: "refinery_intake_marker",
      defaultRewardGold: 180,
      defaultDeadlineDays: 3,
      requiresFieldWork: true,
    },
    {
      templateId: "biome_repair_anchor_patch",
      businessType: "biome_maintenance_repair",
      label: "Anchor repair",
      title: "Patch a Failing Biome Anchor",
      description:
        "Use repair parts at the marked anchor leak and confirm the habitat is safe before returning to the board.",
      kind: "repair",
      requirements: [
        {
          itemId: "repair_part",
          count: 2,
          targetId: "biome_anchor_leak",
          targetName: "Biome anchor leak",
          mapMarkerId: "biome_anchor_leak_marker",
        },
      ],
      targetId: "biome_anchor_leak",
      mapMarkerId: "biome_anchor_leak_marker",
      defaultRewardGold: 145,
      defaultDeadlineDays: 5,
      requiresFieldWork: true,
    },
    {
      templateId: "design_studio_decor_materials",
      businessType: "biome_design_studio",
      label: "Decor materials",
      title: "Gather Decor Materials for a Design Package",
      description:
        "Collect resin and branches for a seasonal habitat redesign package.",
      kind: "gather",
      requirements: [
        {
          itemId: "tree_resin",
          count: 1,
          targetId: "design_studio_workbench",
          targetName: "Design studio workbench",
          mapMarkerId: "design_studio_marker",
        },
      ],
      targetId: "design_studio_workbench",
      mapMarkerId: "design_studio_marker",
      defaultRewardGold: 95,
      defaultDeadlineDays: 4,
      requiresFieldWork: true,
    },
    {
      templateId: "security_clear_safe_route",
      businessType: "security_defense_contractor",
      label: "Route security",
      title: "Secure the Marked Trade Route",
      description:
        "Patrol the marked road segment and clear the safety threat so couriers can pass.",
      kind: "security",
      requirements: [
        {
          serviceKind: "security_patrol",
          serviceUnits: 1,
          targetId: "trade_route_watch",
          targetName: "Trade route watch",
          mapMarkerId: "trade_route_watch_marker",
        },
      ],
      targetId: "trade_route_watch",
      mapMarkerId: "trade_route_watch_marker",
      defaultRewardGold: 220,
      defaultDeadlineDays: 2,
      requiresFieldWork: true,
    },
    {
      templateId: "portal_transit_fuel_delivery",
      businessType: "portal_transit_company",
      label: "Portal fuel",
      title: "Deliver Portal Fuel to the Gate Office",
      description:
        "Carry certified portal fuel to the gate office before the route destabilizes.",
      kind: "delivery",
      requirements: [
        {
          itemId: "portal_fuel",
          count: 2,
          targetId: "portal_gate_office",
          targetName: "Portal gate office",
          mapMarkerId: "portal_gate_office_marker",
        },
      ],
      targetId: "portal_gate_office",
      mapMarkerId: "portal_gate_office_marker",
      defaultRewardGold: 260,
      defaultDeadlineDays: 3,
      requiresFieldWork: true,
    },
    {
      templateId: "farm_crop_harvest",
      businessType: "biome_farming_rare_foods",
      label: "Crop harvest",
      title: "Harvest Crop Bundles from the Farm Plot",
      description:
        "Harvest crop bundles from the marked plot and deliver them to the farm crate.",
      kind: "gather",
      requirements: [
        {
          itemId: "crop_bundle",
          count: 3,
          targetId: "farm_supply_crate",
          targetName: "Farm supply crate",
          mapMarkerId: "farm_supply_crate_marker",
        },
      ],
      targetId: "farm_supply_crate",
      mapMarkerId: "farm_supply_crate_marker",
      defaultRewardGold: 80,
      defaultDeadlineDays: 3,
      requiresFieldWork: true,
    },
    {
      templateId: "weapons_tools_iron_supply",
      businessType: "weapons_tools",
      label: "Forge materials",
      title: "Deliver Iron Ore for Tool Orders",
      description:
        "Bring iron ore to the forge so repair tools and farm gear can be made.",
      kind: "delivery",
      requirements: [
        {
          itemId: "iron_ore",
          count: 3,
          targetId: "forge_material_bin",
          targetName: "Forge material bin",
          mapMarkerId: "forge_marker",
        },
      ],
      targetId: "forge_material_bin",
      mapMarkerId: "forge_marker",
      defaultRewardGold: 120,
      defaultDeadlineDays: 4,
      requiresFieldWork: true,
    },
    {
      templateId: "magic_goods_relic_components",
      businessType: "magic_goods",
      label: "Relic components",
      title: "Recover Relic Fragments for Wards",
      description:
        "Recover relic fragments from the marked safe ruin cache for ward crafting.",
      kind: "exploration",
      requirements: [
        {
          itemId: "relic_fragment",
          count: 1,
          targetId: "safe_ruin_cache",
          targetName: "Safe ruin cache",
          mapMarkerId: "safe_ruin_cache_marker",
        },
      ],
      targetId: "safe_ruin_cache",
      mapMarkerId: "safe_ruin_cache_marker",
      defaultRewardGold: 160,
      defaultDeadlineDays: 5,
      requiresFieldWork: true,
    },
    {
      templateId: "exploration_route_survey",
      businessType: "exploration_guide",
      label: "Route survey",
      title: "Survey the Old Route Marker",
      description:
        "Travel to the marked route stone and record whether the path is safe enough for guided trips.",
      kind: "exploration",
      requirements: [
        {
          serviceKind: "route_survey",
          serviceUnits: 1,
          targetId: "old_route_marker",
          targetName: "Old route marker",
          mapMarkerId: "old_route_marker_pin",
        },
      ],
      targetId: "old_route_marker",
      mapMarkerId: "old_route_marker_pin",
      defaultRewardGold: 110,
      defaultDeadlineDays: 4,
      requiresFieldWork: true,
    },
    {
      templateId: "property_building_materials",
      businessType: "custom_home_property_development",
      label: "Build materials",
      title: "Deliver Building Materials to the Plot",
      description:
        "Bring planks and stone to the marked property crate for a small build order.",
      kind: "construction",
      requirements: [
        {
          itemId: "wood_plank",
          count: 3,
          targetId: "property_material_crate",
          targetName: "Property material crate",
          mapMarkerId: "property_material_marker",
        },
      ],
      targetId: "property_material_crate",
      mapMarkerId: "property_material_marker",
      defaultRewardGold: 150,
      defaultDeadlineDays: 6,
      requiresFieldWork: true,
    },
    {
      templateId: "general_trader_stock_rations",
      businessType: "general_trader",
      label: "Stock rations",
      title: "Stock Road Rations at the Trader Crate",
      description:
        "Deliver road rations so the market has basic travel food in stock.",
      kind: "delivery",
      requirements: [
        {
          itemId: "road_ration",
          count: 3,
          targetId: "trader_ration_crate",
          targetName: "Trader ration crate",
          mapMarkerId: "trader_ration_crate_marker",
        },
      ],
      targetId: "trader_ration_crate",
      mapMarkerId: "trader_ration_crate_marker",
      defaultRewardGold: 70,
      defaultDeadlineDays: 2,
      requiresFieldWork: true,
    },
    {
      templateId: "hunter_wild_meat_supply",
      businessType: "hunter_wild_meat",
      label: "Wild meat",
      title: "Bring Wild Meat from the Hunting Grounds",
      description:
        "Hunt or gather wild meat from the marked grounds and deliver it cold.",
      kind: "hunt",
      requirements: [
        {
          itemId: "wild_meat",
          count: 2,
          targetId: "hunter_larder",
          targetName: "Hunter larder",
          mapMarkerId: "hunter_larder_marker",
        },
      ],
      targetId: "hunter_larder",
      mapMarkerId: "hunter_larder_marker",
      defaultRewardGold: 130,
      defaultDeadlineDays: 3,
      requiresFieldWork: true,
    },
    {
      templateId: "medical_herb_run",
      businessType: "medical_doctor",
      label: "Clinic herbs",
      title: "Deliver Herb Bundles to the Clinic",
      description:
        "Bring fresh herb bundles to the clinic for field medkits and antidotes.",
      kind: "medical",
      requirements: [
        {
          itemId: "herb_bundle",
          count: 2,
          targetId: "clinic_supply_shelf",
          targetName: "Clinic supply shelf",
          mapMarkerId: "clinic_supply_marker",
        },
      ],
      targetId: "clinic_supply_shelf",
      mapMarkerId: "clinic_supply_marker",
      defaultRewardGold: 115,
      defaultDeadlineDays: 3,
      requiresFieldWork: true,
    },
    {
      templateId: "teleport_pad_crystal_delivery",
      businessType: "teleport_owner",
      label: "Pad crystals",
      title: "Deliver Destination Crystals to the Teleport Pad",
      description:
        "Carry destination crystals to the pad terminal so local fast travel stays online.",
      kind: "delivery",
      requirements: [
        {
          itemId: "destination_crystal",
          count: 1,
          targetId: "teleport_pad_terminal",
          targetName: "Teleport pad terminal",
          mapMarkerId: "teleport_pad_marker",
        },
      ],
      targetId: "teleport_pad_terminal",
      mapMarkerId: "teleport_pad_marker",
      defaultRewardGold: 200,
      defaultDeadlineDays: 4,
      requiresFieldWork: true,
    },
    {
      templateId: "sanitation_cleanup_waste",
      businessType: "waste_sanitation_cleanup",
      label: "Cleanup run",
      title: "Clear the Marked Waste Spill",
      description:
        "Collect mixed waste from the marked spill and return it to the sanitation barrels.",
      kind: "cleanup",
      requirements: [
        {
          itemId: "mixed_waste",
          count: 3,
          targetId: "sanitation_barrels",
          targetName: "Sanitation barrels",
          mapMarkerId: "sanitation_barrels_marker",
        },
      ],
      targetId: "sanitation_barrels",
      mapMarkerId: "sanitation_barrels_marker",
      defaultRewardGold: 105,
      defaultDeadlineDays: 2,
      requiresFieldWork: true,
    },
    {
      templateId: "repair_person_fixture_fix",
      businessType: "repair_maintenance_person",
      label: "Fixture repair",
      title: "Repair the Broken Market Fixture",
      description:
        "Use repair parts at the marked fixture and verify it is usable again.",
      kind: "repair",
      requirements: [
        {
          itemId: "repair_part",
          count: 1,
          targetId: "market_fixture",
          targetName: "Market fixture",
          mapMarkerId: "market_fixture_marker",
        },
      ],
      targetId: "market_fixture",
      mapMarkerId: "market_fixture_marker",
      defaultRewardGold: 75,
      defaultDeadlineDays: 3,
      requiresFieldWork: true,
    },
    {
      templateId: "restaurant_food_supply",
      businessType: "food_service_restaurant",
      label: "Kitchen supply",
      title: "Deliver Ingredients to the Kitchen",
      description:
        "Bring crop bundles and clean water for worker meals and travel rations.",
      kind: "delivery",
      requirements: [
        {
          itemId: "clean_water",
          count: 2,
          targetId: "restaurant_kitchen",
          targetName: "Restaurant kitchen",
          mapMarkerId: "restaurant_kitchen_marker",
        },
      ],
      targetId: "restaurant_kitchen",
      mapMarkerId: "restaurant_kitchen_marker",
      defaultRewardGold: 85,
      defaultDeadlineDays: 2,
      requiresFieldWork: true,
    },
    {
      templateId: "courier_medicine_delivery",
      businessType: "courier",
      label: "Medicine delivery",
      title: "Deliver Medicine to the Clinic Lockbox",
      description:
        "Carry the sealed package to the clinic lockbox before the delivery window closes.",
      kind: "delivery",
      requirements: [
        {
          itemId: "sealed_package",
          count: 1,
          targetId: "clinic_lockbox",
          targetName: "Clinic lockbox",
          mapMarkerId: "clinic_lockbox_marker",
        },
      ],
      targetId: "clinic_lockbox",
      mapMarkerId: "clinic_lockbox_marker",
      defaultRewardGold: 60,
      defaultDeadlineDays: 1,
      requiresFieldWork: true,
    },
    {
      templateId: "hospitality_room_reset",
      businessType: "hospitality_inn_hotel_shelter",
      label: "Room reset",
      title: "Reset Shelter Rooms for Incoming Guests",
      description:
        "Deliver clean water and linen bundles so rooms can be reopened for travelers.",
      kind: "service",
      requirements: [
        {
          itemId: "linen_bundle",
          count: 2,
          targetId: "inn_linen_shelf",
          targetName: "Inn linen shelf",
          mapMarkerId: "inn_linen_marker",
        },
      ],
      targetId: "inn_linen_shelf",
      mapMarkerId: "inn_linen_marker",
      defaultRewardGold: 90,
      defaultDeadlineDays: 3,
      requiresFieldWork: true,
    },
  ];

export function harthmereJobsBoardBusinessTemplatesForType(
  businessType: HarthmereEconomyBusinessTypeId | undefined
) {
  return HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES.filter(
    (template) => !businessType || template.businessType === businessType
  );
}

export function harthmereJobsBoardBusinessTemplateById(
  templateId: string | undefined
) {
  return HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES.find(
    (template) => template.templateId === templateId
  );
}

export function isKnownHarthmereJobsBoardExecutableItemId(itemId: string) {
  return HARTHMERE_JOBS_BOARD_EXECUTABLE_ITEM_IDS.has(itemId);
}
