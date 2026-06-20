// HARTHMERE_BUSINESS_TOOL_SHOP
//
// Each of the 19 outpost businesses sells ONE distinct tool the player can buy
// with their own gold (tools are NOT handed out for free). A job/quest that needs
// a tool the player does not already own redirects them — on every map surface —
// to the business that sells it, then back to the job once they own it. The two
// tool-gated job kinds map to the thematically-correct shops so the redirect is
// truthful:
//   - repair  -> Repair Mallet, sold by the repair shop (Hingehall / Fixer Tomas Hinge)
//   - cleanup -> Muck Rake,     sold by the cleanup shop (Clearbarrel / Boss Greta)
//
// This module is the single source of truth for "which business sells which tool".
// It is pure (string ids only) so it can be unit-tested and shared between the
// marker resolver, the map adapters, and the client purchase wiring. The client
// registers HARTHMERE_BUSINESS_TOOL_SHOP_NEW_TOOL_DEFS into its inventory item
// table so the newly-introduced tools are real, buyable, equippable items.

import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  type HarthmereBusinessOutpost,
} from "@/shared/harthmere/business_customer_simulator";
import { harthmereBusinessOwnerMarkerId } from "@/shared/harthmere/business_owner_npc_seed";
import type { HarthmereEconomyBusinessTypeId } from "@/shared/harthmere/mmo_economy_authority";

export const HARTHMERE_BUSINESS_TOOL_SHOP_VERSION =
  "harthmere-business-tool-shop" as const;

export interface HarthmereBusinessToolListing {
  businessType: HarthmereEconomyBusinessTypeId;
  toolItemId: string;
  toolName: string;
  priceGold: number;
}

// businessType -> the one tool that business sells. Every tool id is distinct, so
// each of the 19 businesses has its own product. repair/cleanup are pinned to the
// repair/cleanup shops (the redirect targets); the rest are themed to the trade.
const HARTHMERE_BUSINESS_TOOL_SHOP: Readonly<
  Record<
    HarthmereEconomyBusinessTypeId,
    { toolItemId: string; toolName: string; priceGold: number }
  >
> = {
  repair_maintenance_person: { toolItemId: "repair_mallet", toolName: "Repair Mallet", priceGold: 30 },
  waste_sanitation_cleanup: { toolItemId: "muck_rake", toolName: "Muck Rake", priceGold: 30 },
  weapons_tools: { toolItemId: "rusty_pickaxe", toolName: "Rusty Pickaxe", priceGold: 18 },
  general_trader: { toolItemId: "woodcutters_axe", toolName: "Woodcutter's Axe", priceGold: 18 },
  biome_farming_rare_foods: { toolItemId: "herbalist_sickle", toolName: "Herbalist Sickle", priceGold: 22 },
  exploration_guide: { toolItemId: "simple_fishing_rod", toolName: "Simple Fishing Rod", priceGold: 20 },
  hunter_wild_meat: { toolItemId: "skinning_knife", toolName: "Skinning Knife", priceGold: 22 },
  courier: { toolItemId: "scavenger_hook", toolName: "Scavenger Hook", priceGold: 18 },
  custom_home_property_development: { toolItemId: "clay_shovel", toolName: "Clay Shovel", priceGold: 20 },
  magic_goods: { toolItemId: "arcane_extractor", toolName: "Arcane Extractor", priceGold: 40 },
  // Newly-introduced tools (defined below) for the businesses that had no themed tool.
  exotic_matter_refinery: { toolItemId: "containment_tongs", toolName: "Containment Tongs", priceGold: 48 },
  biome_maintenance_repair: { toolItemId: "anchor_wrench", toolName: "Anchor Wrench", priceGold: 34 },
  biome_design_studio: { toolItemId: "drafting_compass", toolName: "Drafting Compass", priceGold: 26 },
  security_defense_contractor: { toolItemId: "ward_hammer", toolName: "Ward Hammer", priceGold: 36 },
  portal_transit_company: { toolItemId: "portal_calibrator", toolName: "Portal Calibrator", priceGold: 44 },
  medical_doctor: { toolItemId: "field_surgeon_kit", toolName: "Field Surgeon's Kit", priceGold: 38 },
  teleport_owner: { toolItemId: "beacon_attuner", toolName: "Beacon Attuner", priceGold: 42 },
  food_service_restaurant: { toolItemId: "carving_cleaver", toolName: "Carving Cleaver", priceGold: 24 },
  hospitality_inn_hotel_shelter: { toolItemId: "hearth_broom", toolName: "Hearth Broom", priceGold: 16 },
};

// The tools introduced by this shop that do not already exist in the LocalDev item
// table. The client builds full item defs from these seeds and registers them, so
// they are real buyable/equippable items. (The 10 reused ids above already exist.)
export interface HarthmereBusinessNewToolDef {
  itemId: string;
  name: string;
  subtype: string;
  icon: string;
  baseValue: number;
  description: string;
}

export const HARTHMERE_BUSINESS_TOOL_SHOP_NEW_TOOL_DEFS: readonly HarthmereBusinessNewToolDef[] =
  [
    { itemId: "containment_tongs", name: "Containment Tongs", subtype: "refinery_tool", icon: "🦾", baseValue: 48, description: "Refinery tongs for handling sealed exotic-matter stock safely." },
    { itemId: "anchor_wrench", name: "Anchor Wrench", subtype: "maintenance_tool", icon: "🔧", baseValue: 34, description: "Heavy wrench for tightening drifting biome anchors." },
    { itemId: "drafting_compass", name: "Drafting Compass", subtype: "design_tool", icon: "📐", baseValue: 26, description: "Precision compass for laying out biome planting plans." },
    { itemId: "ward_hammer", name: "Ward Hammer", subtype: "security_tool", icon: "🔨", baseValue: 36, description: "Drives ward stones and patrol stakes for site security." },
    { itemId: "portal_calibrator", name: "Portal Calibrator", subtype: "portal_tool", icon: "🛠", baseValue: 44, description: "Aligns transit rings and verifies fuel-seal tolerances." },
    { itemId: "field_surgeon_kit", name: "Field Surgeon's Kit", subtype: "medical_tool", icon: "🩺", baseValue: 38, description: "Clinic kit for field dressings and restocking remedies." },
    { itemId: "beacon_attuner", name: "Beacon Attuner", subtype: "teleport_tool", icon: "📡", baseValue: 42, description: "Attunes Returnstone pads and binds teleport anchors." },
    { itemId: "carving_cleaver", name: "Carving Cleaver", subtype: "kitchen_tool", icon: "🔪", baseValue: 24, description: "Service-line cleaver for prepping fast hot meals." },
    { itemId: "hearth_broom", name: "Hearth Broom", subtype: "hospitality_tool", icon: "🧹", baseValue: 16, description: "Readies inn rooms and keeps the hearth clean." },
  ];

const HARTHMERE_BUSINESS_OWNER_NPC_ID_BY_TYPE: Readonly<
  Record<string, string>
> = Object.fromEntries(
  HARTHMERE_BUSINESS_OUTPOSTS.map((outpost: HarthmereBusinessOutpost) => [
    outpost.businessType,
    outpost.ownerNpcId,
  ])
);

export function harthmereBusinessToolForType(
  businessType: string | undefined
): HarthmereBusinessToolListing | undefined {
  if (!businessType) {
    return undefined;
  }
  const entry =
    HARTHMERE_BUSINESS_TOOL_SHOP[
      businessType as HarthmereEconomyBusinessTypeId
    ];
  if (!entry) {
    return undefined;
  }
  return {
    businessType: businessType as HarthmereEconomyBusinessTypeId,
    ...entry,
  };
}

// Reverse lookup: which businessType sells this tool id (each tool is unique).
export function harthmereBusinessTypeSellingTool(
  toolItemId: string | undefined
): HarthmereEconomyBusinessTypeId | undefined {
  if (!toolItemId) {
    return undefined;
  }
  for (const [businessType, entry] of Object.entries(
    HARTHMERE_BUSINESS_TOOL_SHOP
  )) {
    if (entry.toolItemId === toolItemId) {
      return businessType as HarthmereEconomyBusinessTypeId;
    }
  }
  return undefined;
}

// The owner-marker id for the business that sells a given tool — the id the map
// surfaces resolve to a position to redirect the player to "buy it here".
export function harthmereBusinessToolVendorMarkerId(
  toolItemId: string | undefined
): string | undefined {
  const businessType = harthmereBusinessTypeSellingTool(toolItemId);
  if (!businessType) {
    return undefined;
  }
  const ownerNpcId = HARTHMERE_BUSINESS_OWNER_NPC_ID_BY_TYPE[businessType];
  return ownerNpcId ? harthmereBusinessOwnerMarkerId(ownerNpcId) : undefined;
}

// Pure decision core for buying a business's tool: given how much gold the player
// has and whether they already own the tool, decide whether the sale goes through
// and what the gold balance is afterward. Kept pure so the purchase rules are
// unit-tested independently of the client inventory store.
export interface HarthmereBusinessToolPurchaseOutcome {
  ok: boolean;
  reason?: "no_tool" | "already_owned" | "insufficient_gold";
  goldAfter: number;
  listing?: HarthmereBusinessToolListing;
}

export function harthmereBusinessToolPurchaseOutcome(input: {
  businessType: string | undefined;
  goldAvailable: number;
  alreadyOwned: boolean;
}): HarthmereBusinessToolPurchaseOutcome {
  const gold = Math.max(0, Math.floor(input.goldAvailable || 0));
  const listing = harthmereBusinessToolForType(input.businessType);
  if (!listing) {
    return { ok: false, reason: "no_tool", goldAfter: gold };
  }
  if (input.alreadyOwned) {
    return { ok: false, reason: "already_owned", goldAfter: gold, listing };
  }
  if (gold < listing.priceGold) {
    return { ok: false, reason: "insufficient_gold", goldAfter: gold, listing };
  }
  return { ok: true, goldAfter: gold - listing.priceGold, listing };
}

export function harthmereBusinessToolListings(): HarthmereBusinessToolListing[] {
  return Object.entries(HARTHMERE_BUSINESS_TOOL_SHOP).map(
    ([businessType, entry]) => ({
      businessType: businessType as HarthmereEconomyBusinessTypeId,
      ...entry,
    })
  );
}

export function validateHarthmereBusinessToolShop(): string[] {
  const errors: string[] = [];
  const listings = harthmereBusinessToolListings();
  // One listing per real outpost business type.
  const outpostTypes = new Set(
    HARTHMERE_BUSINESS_OUTPOSTS.map((outpost) => outpost.businessType)
  );
  for (const type of outpostTypes) {
    if (!HARTHMERE_BUSINESS_TOOL_SHOP[type]) {
      errors.push(`${type}:missing_tool_listing`);
    }
  }
  // Every tool must be distinct (each business a different tool).
  const toolIds = listings.map((listing) => listing.toolItemId);
  if (new Set(toolIds).size !== toolIds.length) {
    errors.push("duplicate_tool_assignment");
  }
  for (const listing of listings) {
    if (!listing.toolItemId.trim()) {
      errors.push(`${listing.businessType}:blank_tool`);
    }
    if (!(listing.priceGold > 0)) {
      errors.push(`${listing.businessType}:invalid_price`);
    }
  }
  // The new-tool defs must not collide and must be the ones referenced.
  const newIds = HARTHMERE_BUSINESS_TOOL_SHOP_NEW_TOOL_DEFS.map(
    (def) => def.itemId
  );
  if (new Set(newIds).size !== newIds.length) {
    errors.push("duplicate_new_tool_def");
  }
  return errors;
}
