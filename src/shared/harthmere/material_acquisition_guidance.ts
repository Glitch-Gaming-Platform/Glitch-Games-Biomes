import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  harthmereBusinessOutpostMapMarkerId,
} from "./business_customer_simulator";
import { HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS } from "./business_crafting_station_seed";
import { harthmereBusinessStorefrontListingsForType } from "./harthmere_business_storefront_goods";
import { HARTHMERE_GATHERING_AUTHORITY_NODES } from "./gathering_node_authority";
import { harthmereNativeItemIdForBiomesId } from "./harthmere_native_item_ids";
import {
  ensureHarthmereProductionVendorCatalog,
  HARTHMERE_VENDOR_CATALOG,
} from "./harthmere_vendor_catalog";
import {
  HARTHMERE_CRAFTING_STATIONS,
  ensureHarthmereProductionCraftingCatalogue,
  harthmereProductionCraftingRecipeIds,
} from "./mmo_crafting_catalogue";
import {
  getHarthmereCraftingStation,
  getHarthmereItemDefinition,
  getHarthmereVendorEntry,
  listHarthmereCraftingRecipes,
  listHarthmereItemDefinitions,
  type HarthmereCraftingRecipe,
} from "./mmo_inventory_authority";
import { harthmereJobsBoardQuestMarkerRuntimePositionForId } from "./jobs_board_quest_marker_positions";
import type { Vec3 } from "../math/types";

export type HarthmereMaterialAcquisitionKind = "buy" | "craft" | "gather";

export interface HarthmereMaterialAcquisitionInput {
  itemId: string;
  itemName: string;
  count: number;
}

export interface HarthmereMaterialAcquisitionRoute {
  id: string;
  kind: HarthmereMaterialAcquisitionKind;
  itemId: string;
  itemName: string;
  quantity: number;
  title: string;
  description: string;
  sourceName: string;
  markerId?: string;
  markerPosition?: Vec3;
  unitPriceGold?: number;
  requirements?: readonly string[];
  requiredToolItemIds?: readonly string[];
  inputs?: readonly HarthmereMaterialAcquisitionInput[];
  purpose?: string;
}

export interface HarthmereMaterialAcquisitionPlan {
  itemId: string;
  itemName: string;
  quantity: number;
  routes: readonly HarthmereMaterialAcquisitionRoute[];
}

function words(value: string | undefined) {
  return String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function normalizedLabel(value: string | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function itemName(itemId: string) {
  return getHarthmereItemDefinition(itemId)?.displayName ?? words(itemId);
}

export function normalizeHarthmereMaterialItemId(
  itemId: string | number | undefined,
  displayName?: string
): string | undefined {
  ensureHarthmereProductionCraftingCatalogue();
  ensureHarthmereProductionVendorCatalog();
  const raw = String(itemId ?? "").trim();
  const native = raw
    ? harthmereNativeItemIdForBiomesId(Number(raw))
    : undefined;
  if (native) return native;
  if (raw && getHarthmereItemDefinition(raw)) return raw;

  const wanted = normalizedLabel(displayName || raw);
  if (!wanted) return undefined;
  return listHarthmereItemDefinitions().find(
    (definition) =>
      normalizedLabel(definition.displayName) === wanted ||
      normalizedLabel(definition.itemId) === wanted
  )?.itemId;
}

function outpostPosition(
  outpost: (typeof HARTHMERE_BUSINESS_OUTPOSTS)[number]
): Vec3 {
  return [outpost.position.x, outpost.position.y + 1, outpost.position.z];
}

function buyRoutes(
  targetItemId: string,
  quantity: number,
  purpose?: string
): HarthmereMaterialAcquisitionRoute[] {
  const routes: HarthmereMaterialAcquisitionRoute[] = [];
  const name = itemName(targetItemId);

  for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
    const listing = harthmereBusinessStorefrontListingsForType(
      outpost.businessType
    ).find((candidate) => candidate.itemId === targetItemId);
    if (!listing) continue;
    routes.push({
      id: `buy:${targetItemId}:${outpost.outpostId}`,
      kind: "buy",
      itemId: targetItemId,
      itemName: name,
      quantity,
      title: `Buy ${name} at ${outpost.displayName}`,
      description: `Head to ${
        outpost.displayName
      }, then buy ${quantity} ${name}${quantity === 1 ? "" : "s"} for ${
        listing.buyPrice
      } gold each.`,
      sourceName: outpost.displayName,
      markerId: harthmereBusinessOutpostMapMarkerId(outpost.outpostId),
      markerPosition: outpostPosition(outpost),
      unitPriceGold: listing.buyPrice,
      purpose,
    });
  }

  for (const profile of Object.values(HARTHMERE_VENDOR_CATALOG)) {
    const stock = profile.stocks.find((line) => line.itemId === targetItemId);
    const outpost = profile.businessOutpostId
      ? HARTHMERE_BUSINESS_OUTPOSTS.find(
          (candidate) => candidate.outpostId === profile.businessOutpostId
        )
      : undefined;
    if (!stock || !outpost) continue;
    const vendorEntry = getHarthmereVendorEntry(profile.vendorId, targetItemId);
    const saleDescription = vendorEntry?.bundleQuantity
      ? `Head to ${profile.vendorName}, then buy a bundle of ${
          vendorEntry.bundleQuantity
        } ${name}${vendorEntry.bundleQuantity === 1 ? "" : "s"} for ${
          vendorEntry.bundlePrice ?? stock.price
        } gold.`
      : `Head to ${profile.vendorName}, then buy ${quantity} ${name}${
          quantity === 1 ? "" : "s"
        } for ${vendorEntry?.buyPrice ?? stock.price} gold each.`;
    routes.push({
      id: `buy:${targetItemId}:${outpost.outpostId}`,
      kind: "buy",
      itemId: targetItemId,
      itemName: name,
      quantity,
      title: `Buy ${name} at ${profile.vendorName}`,
      description: saleDescription,
      sourceName: profile.vendorName,
      markerId: harthmereBusinessOutpostMapMarkerId(outpost.outpostId),
      markerPosition: outpostPosition(outpost),
      unitPriceGold: vendorEntry?.buyPrice ?? stock.price,
      purpose,
    });
  }

  return routes;
}

function gatherRoutes(
  targetItemId: string,
  quantity: number,
  purpose?: string
): HarthmereMaterialAcquisitionRoute[] {
  const routes: HarthmereMaterialAcquisitionRoute[] = [];
  const name = itemName(targetItemId);
  for (const node of HARTHMERE_GATHERING_AUTHORITY_NODES) {
    const yieldLine = [...node.baseYield, ...node.rareYield].find(
      (line) => line.itemId === targetItemId
    );
    if (!yieldLine) continue;
    const requirements = [
      node.requiredTool ? `Bring ${itemName(node.requiredTool)}` : undefined,
      node.requiredSkill > 0
        ? `${words(node.profession)} level ${node.requiredSkill}`
        : undefined,
    ].filter((entry): entry is string => Boolean(entry));
    routes.push({
      id: `gather:${targetItemId}:${node.id}`,
      kind: "gather",
      itemId: targetItemId,
      itemName: name,
      quantity,
      title: `Gather ${name} at ${node.name}`,
      description: `Head to ${
        node.name
      }, then gather ${name} from this world resource.${
        requirements.length ? ` ${requirements.join("; ")}.` : ""
      }`,
      sourceName: node.name,
      markerId: node.id,
      markerPosition: [...node.position] as Vec3,
      requirements,
      requiredToolItemIds: node.requiredTool ? [node.requiredTool] : [],
      purpose,
    });
  }
  return routes;
}

interface CraftingDestination {
  id: string;
  name: string;
  markerId?: string;
  position?: Vec3;
}

function craftingDestinations(
  recipe: HarthmereCraftingRecipe
): CraftingDestination[] {
  if (!recipe.requiredStationId) {
    return [{ id: "handcraft", name: "your crafting menu" }];
  }
  const destinations: CraftingDestination[] = [];
  if (recipe.requiredStationId === HARTHMERE_CRAFTING_STATIONS.workbench) {
    const marker = harthmereJobsBoardQuestMarkerRuntimePositionForId(
      "grove_fountain_workbench"
    );
    if (marker) {
      destinations.push({
        id: marker.markerId,
        name: marker.label,
        markerId: marker.markerId,
        position: [...marker.position] as Vec3,
      });
    }
  }

  const preferredOutpost = recipe.businessTypeId
    ? HARTHMERE_BUSINESS_OUTPOSTS.find(
        (outpost) => outpost.businessType === recipe.businessTypeId
      )
    : undefined;
  const matchingSeeds = HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS.filter(
    (seed) => String(seed.stationItemId) === String(recipe.requiredStationId)
  ).sort((left, right) => {
    if (left.outpostId === preferredOutpost?.outpostId) return -1;
    if (right.outpostId === preferredOutpost?.outpostId) return 1;
    return left.outpostId.localeCompare(right.outpostId);
  });
  const seed = matchingSeeds[0];
  if (seed) {
    destinations.push({
      id: seed.stationSeedId,
      name: `${seed.businessName} ${seed.stationName}`,
      markerId: harthmereBusinessOutpostMapMarkerId(seed.outpostId),
      position: [...seed.position] as Vec3,
    });
  }

  if (destinations.length === 0) {
    destinations.push({
      id: `station:${recipe.requiredStationId}`,
      name:
        getHarthmereCraftingStation(recipe.requiredStationId)?.displayName ??
        "the required crafting station",
    });
  }
  return destinations;
}

function recipeInputs(
  recipe: HarthmereCraftingRecipe,
  quantity: number
): HarthmereMaterialAcquisitionInput[] {
  const batches = Math.max(1, Math.ceil(quantity / recipe.outputCount));
  return [...recipe.inputs, ...(recipe.fuelInputs ?? [])].map((input) => ({
    itemId: input.itemId,
    itemName: itemName(input.itemId),
    count: input.count * batches,
  }));
}

function craftRoutes(
  targetItemId: string,
  quantity: number
): HarthmereMaterialAcquisitionRoute[] {
  const name = itemName(targetItemId);
  const matchingRecipes = listHarthmereCraftingRecipes().filter(
      (recipe) =>
        recipe.outputItemId === targetItemId &&
        recipe.workflowKind !== "salvage" &&
        (recipe.inputs.length > 0 || (recipe.fuelInputs?.length ?? 0) > 0)
    );
  // Runtime/test recipes share the registry but are not guaranteed player
  // acquisition routes. Prefer the production catalogue whenever it owns a
  // recipe for this item; only fall back to extensions when no canonical route
  // exists.
  const productionRecipeIds = new Set(harthmereProductionCraftingRecipeIds());
  const productionRecipes = matchingRecipes.filter((recipe) =>
    productionRecipeIds.has(recipe.recipeId)
  );
  const recipes = (productionRecipes.length
    ? productionRecipes
    : matchingRecipes
  )
    .sort(
      (left, right) =>
        (left.recipeTier ?? 1) - (right.recipeTier ?? 1) ||
        left.recipeId.localeCompare(right.recipeId)
    );
  const routes: HarthmereMaterialAcquisitionRoute[] = [];
  for (const recipe of recipes) {
    const inputs = recipeInputs(recipe, quantity);
    const inputText = inputs
      .map((input) => `${input.count} ${input.itemName}`)
      .join(", ");
    for (const destination of craftingDestinations(recipe)) {
      routes.push({
        id: `craft:${targetItemId}:${recipe.recipeId}:${destination.id}`,
        kind: "craft",
        itemId: targetItemId,
        itemName: name,
        quantity,
        title: `Craft ${name} at ${destination.name}`,
        description: destination.position
          ? `Head to ${
              destination.name
            }, then craft enough for ${quantity} ${name}${
              quantity === 1 ? "" : "s"
            } using ${inputText}.`
          : `Use ${destination.name} to craft enough for ${quantity} ${name}${
              quantity === 1 ? "" : "s"
            } using ${inputText}.`,
        sourceName: destination.name,
        markerId: destination.markerId,
        markerPosition: destination.position,
        inputs,
        requirements: [
          recipe.requiredSkillId && recipe.requiredSkillLevel
            ? `${words(recipe.requiredSkillId)} level ${
                recipe.requiredSkillLevel
              }`
            : undefined,
        ].filter((entry): entry is string => Boolean(entry)),
      });
    }
  }
  return routes;
}

function dedupeRoutes(
  routes: readonly HarthmereMaterialAcquisitionRoute[]
): HarthmereMaterialAcquisitionRoute[] {
  const seen = new Set<string>();
  return routes.filter((route) => {
    if (seen.has(route.id)) return false;
    seen.add(route.id);
    return true;
  });
}

export function harthmereMaterialAcquisitionPlan(input: {
  itemId: string | number | undefined;
  itemName?: string;
  count?: number;
}): HarthmereMaterialAcquisitionPlan | undefined {
  ensureHarthmereProductionCraftingCatalogue();
  ensureHarthmereProductionVendorCatalog();
  const targetItemId = normalizeHarthmereMaterialItemId(
    input.itemId,
    input.itemName
  );
  if (!targetItemId) return undefined;
  const quantity = Math.max(1, Math.ceil(Number(input.count) || 1));
  const name = itemName(targetItemId);
  const directCraftRoutes = craftRoutes(targetItemId, quantity);
  const directGatherRoutes = gatherRoutes(targetItemId, quantity);
  const prerequisiteRoutes = directCraftRoutes.flatMap((route) =>
    (route.inputs ?? []).flatMap((recipeInput) => [
      ...buyRoutes(
        recipeInput.itemId,
        recipeInput.count,
        `Needed to craft ${name}`
      ),
      ...gatherRoutes(
        recipeInput.itemId,
        recipeInput.count,
        `Needed to craft ${name}`
      ),
    ])
  );
  const toolRoutes = [...directGatherRoutes, ...prerequisiteRoutes]
    .filter((route) => route.kind === "gather")
    .flatMap((route) =>
      (route.requiredToolItemIds ?? []).flatMap((toolItemId) =>
        // The item-definition registry is extensible and tests/mods may
        // replace display metadata. The acquisition relationship itself is
        // semantic, so keep the prerequisite explanation stable.
        buyRoutes(toolItemId, 1, `Needed to gather ${words(route.itemId)}`)
      )
    );
  return {
    itemId: targetItemId,
    itemName: name,
    quantity,
    routes: dedupeRoutes([
      ...buyRoutes(targetItemId, quantity),
      ...directCraftRoutes,
      ...directGatherRoutes,
      ...prerequisiteRoutes,
      ...toolRoutes,
    ]),
  };
}
