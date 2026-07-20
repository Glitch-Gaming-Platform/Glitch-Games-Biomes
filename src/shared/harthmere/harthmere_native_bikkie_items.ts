import type { BakedBiscuitTray } from "@/server/shared/bikkie/registry";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import {
  HARTHMERE_GATHERING_AUTHORITY_NODES,
  type HarthmereGatheringAuthorityNode,
} from "@/shared/harthmere/gathering_node_authority";
import { ensureHarthmereProductionVendorCatalog } from "@/shared/harthmere/harthmere_vendor_catalog";
import { LIVE_ENTITY_HELPER_QUEST_ITEM_COPY } from "@/shared/harthmere/live_entity_helper_quests";
import {
  HARTHMERE_FOOD_DEFINITIONS,
  HARTHMERE_SEED_DEFINITIONS,
} from "@/shared/harthmere/mmo_farming_food_stamina";
import {
  getHarthmereItemDefinition,
  harthmereAllowedEquipmentSlots,
  listHarthmereItemDefinitions,
  registerHarthmereItemDefinition,
  type HarthmereEquipmentSlot,
  type HarthmereItemDefinition,
} from "@/shared/harthmere/mmo_inventory_authority";
import type { BiomesId } from "@/shared/ids";
import { safeParseBiomesId } from "@/shared/ids";
import {
  HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION,
  harthmereNativeBiomesIdForItemId,
} from "@/shared/harthmere/harthmere_native_item_ids";

/**
 * Existing snapshot biscuits may donate presentation data to an exact
 * Harthmere biscuit, but never donate identity.  Copying only mesh/icon/vox
 * attributes keeps `iron_ore` distinct from `goldOre` for inventory, recipes,
 * collect triggers, and quests while still letting exact tools and clothing
 * render with the best authored asset currently available.
 */
const HARTHMERE_NATIVE_PRESENTATION_SOURCE_IDS: Readonly<
  Record<string, BiomesId>
> = {
  baker_apron: BikkieIds.grassyTop,
  field_trousers: BikkieIds.bellBottoms,
  patched_cloak: BikkieIds.poncho,
  travel_cloak: BikkieIds.poncho,
  leather_armor: BikkieIds.grassyTop,
  woodsman_axe: BikkieIds.axe,
  woodcutters_axe: BikkieIds.axe,
  rusty_pickaxe: BikkieIds.pickaxe,
  muck_rake: BikkieIds.muckBuster,
  repair_mallet: BikkieIds.axe,
  training_dagger: BikkieIds.muckBuster,
  iron_longsword: BikkieIds.muckBuster,
  two_handed_sword: BikkieIds.muckBuster,
  wooden_shield: BikkieIds.woodenFencer,
  rough_stone: BikkieIds.cobblestone,
  river_clay: BikkieIds.clay,
  softwood_log: BikkieIds.log,
  oak_branch: BikkieIds.oakLog,
  tree_resin: BikkieIds.oakLeaf,
  cloth_scrap: BikkieIds.tatteredTop,
  clean_water: BikkieIds.bucket,
  old_coin: BikkieIds.goldNugget,
  iron_ore: BikkieIds.goldOre,
  scrap_metal: BikkieIds.silverNugget,
  mana_essence: BikkieIds.powerCell,
  wild_berries: BikkieIds.fruit,
  raw_meat: BikkieIds.muckerMeat,
};

const HARTHMERE_NATIVE_PRESENTATION_ATTRIBUTES = [
  "attachmentTransform",
  "galoisPath",
  "icon",
  "iconSettings",
  "mesh",
  "meshGaloisPath",
  "paletteColor",
  "vox",
  "voxWithHatVariant",
  "worldMesh",
] as const satisfies readonly (keyof Biscuit)[];

export {
  HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION,
  harthmereNativeBiomesIdForItemId,
} from "@/shared/harthmere/harthmere_native_item_ids";

function humanizeHarthmereItemId(itemId: string) {
  return itemId
    .replace(/^b:/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function harthmereBiscuitNameForItemId(itemId: string) {
  return `harthmere_${itemId.replace(/[^a-zA-Z0-9]+/g, "_")}`;
}

function defaultHarthmereItemDefinition(input: {
  itemId: string;
  displayName?: string;
  category?: string;
  maxStackSize?: number;
  isConsumable?: boolean;
  isCraftingMaterial?: boolean;
  isQuestItem?: boolean;
  tradeable?: boolean;
  equipmentSlots?: HarthmereEquipmentSlot[];
}): HarthmereItemDefinition {
  return {
    itemId: input.itemId,
    displayName:
      input.displayName?.trim() || humanizeHarthmereItemId(input.itemId),
    maxStackSize: Math.max(1, Math.trunc(input.maxStackSize ?? 999)),
    baseValue: 0,
    binding: input.isQuestItem ? "quest" : "none",
    isQuestItem: input.isQuestItem ?? false,
    isCurrency: false,
    isConsumable: input.isConsumable ?? false,
    isCraftingMaterial: input.isCraftingMaterial ?? true,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: {},
    equipmentSlots: input.equipmentSlots,
    tradeable: input.tradeable ?? !input.isQuestItem,
    category: input.category ?? "materials",
  };
}

function ensureDefinition(definition: HarthmereItemDefinition) {
  if (!getHarthmereItemDefinition(definition.itemId)) {
    registerHarthmereItemDefinition(definition);
  }
}

function registerGatheringDefinitions(
  nodes: readonly HarthmereGatheringAuthorityNode[]
) {
  for (const node of nodes) {
    if (node.requiredTool) {
      ensureDefinition(
        defaultHarthmereItemDefinition({
          itemId: node.requiredTool,
          category: "tool",
          maxStackSize: 1,
          isCraftingMaterial: false,
          equipmentSlots: ["main_hand"],
        })
      );
    }
    for (const yieldRow of [...node.baseYield, ...node.rareYield]) {
      ensureDefinition(
        defaultHarthmereItemDefinition({ itemId: yieldRow.itemId })
      );
    }
  }
}

/**
 * Populate the canonical item registry before deriving native Bikkie biscuits.
 * This is data authoring, not a visual alias table: every string item id gets
 * its own BiomesId and therefore its own recipe/quest/collect identity.
 */
export function ensureHarthmereNativeItemCatalogue() {
  ensureHarthmereProductionVendorCatalog();

  for (const food of Object.values(HARTHMERE_FOOD_DEFINITIONS)) {
    ensureDefinition(
      defaultHarthmereItemDefinition({
        itemId: food.itemId,
        displayName: food.displayName,
        category: "food",
        maxStackSize: 200,
        isConsumable: food.edible !== false,
        isCraftingMaterial: false,
      })
    );
  }
  for (const seed of Object.values(HARTHMERE_SEED_DEFINITIONS)) {
    ensureDefinition(
      defaultHarthmereItemDefinition({
        itemId: seed.seedItemId,
        displayName: seed.displayName,
        category: "seed",
        maxStackSize: 200,
      })
    );
    ensureDefinition(
      defaultHarthmereItemDefinition({
        itemId: seed.yieldItemId,
        displayName: seed.cropDisplayName,
        category: "food",
        maxStackSize: 200,
        isConsumable: true,
        isCraftingMaterial: false,
      })
    );
  }
  for (const copy of Object.values(LIVE_ENTITY_HELPER_QUEST_ITEM_COPY)) {
    ensureDefinition({
      ...defaultHarthmereItemDefinition({
        itemId: copy.itemId,
        displayName: copy.displayName,
        maxStackSize: copy.maxStackSize,
        isConsumable: copy.isConsumable,
        isCraftingMaterial: copy.isCraftingMaterial,
        isQuestItem: copy.isQuestItem,
        tradeable: copy.tradeable,
      }),
      description: copy.description,
      baseValue: copy.baseValue,
      binding: copy.binding,
    });
  }
  registerGatheringDefinitions(HARTHMERE_GATHERING_AUTHORITY_NODES);

  return listHarthmereItemDefinitions();
}

function wearableAttributes(definition: HarthmereItemDefinition) {
  const slots = new Set(harthmereAllowedEquipmentSlots(definition));
  const attributes: Record<string, true> = {};
  if (slots.has("head")) attributes.wearAsHat = true;
  if (slots.has("chest")) attributes.wearAsTop = true;
  if (slots.has("legs")) attributes.wearAsBottoms = true;
  if (slots.has("feet")) attributes.wearOnFeet = true;
  if (slots.has("hands")) attributes.wearOnHands = true;
  if (slots.has("back")) attributes.wearAsOuterwear = true;
  if (slots.has("neck")) attributes.wearOnNeck = true;
  if (Object.keys(attributes).length > 0) attributes.isWearable = true;
  return attributes as Partial<Biscuit>;
}

export function harthmereBiscuitForItemDefinition(
  definition: HarthmereItemDefinition,
  presentationSource?: Biscuit
): Biscuit {
  const id = harthmereNativeBiomesIdForItemId(definition.itemId)!;
  const category = definition.category?.trim() || "Harthmere";
  const presentation = Object.fromEntries(
    HARTHMERE_NATIVE_PRESENTATION_ATTRIBUTES.flatMap((attribute) => {
      const value = presentationSource?.[attribute];
      return value === undefined ? [] : [[attribute, value]];
    })
  ) as Partial<Biscuit>;
  return {
    ...presentation,
    id,
    name: harthmereBiscuitNameForItemId(definition.itemId),
    displayName: definition.displayName,
    displayDescription: definition.description,
    craftingCategory: category,
    stackable: BigInt(Math.max(1, Math.trunc(definition.maxStackSize))),
    isDroppable: true,
    tooltipTypeName: category,
    ...(definition.isConsumable ? { isConsumable: true } : {}),
    ...(definition.category === "tool" ||
    harthmereAllowedEquipmentSlots(definition).some((slot) =>
      ["main_hand", "off_hand"].includes(slot)
    )
      ? { isTool: true }
      : {}),
    ...wearableAttributes(definition),
  } as Biscuit;
}

/**
 * Overlay code-authored Harthmere biscuits onto the immutable baked snapshot.
 * Existing numeric Bikkie ids are preserved; string ids receive one exact,
 * collision-checked biscuit shared by every server and browser process.
 */
export function withHarthmereNativeBikkieItems(
  tray: BakedBiscuitTray
): BakedBiscuitTray {
  const contents = new Map(tray.contents);
  const hashes = new Map(tray.hashes);
  const claimedIds = new Map<BiomesId, string>();

  for (const definition of ensureHarthmereNativeItemCatalogue()) {
    const id = harthmereNativeBiomesIdForItemId(definition.itemId)!;
    const overlayHash = `${HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION}:${definition.itemId}:${definition.maxStackSize}`;
    const priorItemId = claimedIds.get(id);
    if (priorItemId && priorItemId !== definition.itemId) {
      throw new Error(
        `Harthmere Bikkie id collision ${id}: ${priorItemId} vs ${definition.itemId}`
      );
    }
    claimedIds.set(id, definition.itemId);

    const existing = contents.get(id);
    const expectedName = harthmereBiscuitNameForItemId(definition.itemId);
    if (existing) {
      // Numeric/b:<id> definitions intentionally bind to an authored snapshot
      // biscuit. Reapplying our own overlay is expected because Redis storage
      // may return the prior augmented tray when the baked tray id is unchanged.
      // A generated string id must never overwrite unrelated snapshot data.
      if (safeParseBiomesId(definition.itemId) !== undefined) {
        continue;
      }
      if (
        existing.name !== expectedName &&
        !hashes
          .get(id)
          ?.startsWith(
            `${HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION}:${definition.itemId}:`
          )
      ) {
        throw new Error(
          `Generated Harthmere Bikkie id ${id} for ${definition.itemId} collides with ${existing.name}`
        );
      }
    }
    const presentationSourceId =
      HARTHMERE_NATIVE_PRESENTATION_SOURCE_IDS[definition.itemId];
    const presentationSource =
      existing?.name === expectedName
        ? existing
        : presentationSourceId
        ? contents.get(presentationSourceId)
        : undefined;
    const biscuit = harthmereBiscuitForItemDefinition(
      definition,
      presentationSource
    );
    contents.set(id, biscuit);
    hashes.set(id, overlayHash);
  }
  return { ...tray, contents, hashes };
}
