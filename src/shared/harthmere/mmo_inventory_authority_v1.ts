/*
 * mmo_inventory_authority_v1.ts
 *
 * Server-authoritative inventory validation for Harthmere MMO.
 *
 * The server MUST own inventory truth and NEVER trust the client for:
 *   - item ownership
 *   - stack count
 *   - currency amount
 *   - item stats
 *   - quest item possession
 *   - spell knowledge
 *   - cooldowns
 *   - trade state
 *   - vendor price
 *   - crafting materials
 *
 * All mutations come through reduceHarthmereInventoryMutationV1 which
 * returns a validated InventoryMutationResultV1.  The live_mode_backend
 * reducer calls this instead of blindly applying payload deltas.
 */

export const MMO_INVENTORY_AUTHORITY_VERSION_V1 = "mmo-inventory-authority-v1";

// ---------------------------------------------------------------------------
// Item catalogue entry (loaded server-side, never sent by client as truth)
// ---------------------------------------------------------------------------

export type HarthmereItemBindingV1 = "none" | "on_pickup" | "on_equip" | "quest";
export type HarthmereItemRarityV1 = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface HarthmereItemDefinitionV1 {
  itemId: string;
  displayName: string;
  maxStackSize: number;
  /** Base gold value used for vendor buy/sell price calculations */
  baseValue: number;
  binding: HarthmereItemBindingV1;
  isQuestItem: boolean;
  isCurrency: boolean;
  isConsumable: boolean;
  isCraftingMaterial: boolean;
  isSpellTome: boolean;
  /** Spell or ability ID granted when this item is consumed */
  grantsAbilityId?: string;
  /** Minimum player level to use or equip */
  levelRequirement: number;
  /** Class restriction — empty means any class */
  classRestriction: string[];
  /** Item stats applied when equipped */
  stats: Record<string, number>;
  tradeable: boolean;
  /** Cooldown category (e.g. "potion", "food") — shared cooldown group */
  consumableCooldownCategory?: string;
  consumableCooldownMs?: number;
}

// ---------------------------------------------------------------------------
// Inventory snapshot (what the server reads from Redis/DB)
// ---------------------------------------------------------------------------

export interface HarthmereInventorySnapshotV1 {
  actorId: string;
  gold: number;
  /** slot → itemId */
  equipment: Record<string, string>;
  /** itemId → count */
  items: Record<string, number>;
  /** itemId → count */
  bank: Record<string, number>;
  /** itemId → count in active escrow (auction house listings) */
  escrow: Record<string, number>;
  /** consumable cooldown category → cooldown-expires-at ms */
  consumableCooldowns: Record<string, number>;
  /** Known spell/ability ids */
  knownAbilities: string[];
  /** Known recipe ids */
  knownRecipes: string[];
  /** Active trade session id if the player is currently trading */
  activeTradeSessionId?: string;
}

// ---------------------------------------------------------------------------
// Vendor catalogue entry
// ---------------------------------------------------------------------------

export interface HarthmereVendorEntryV1 {
  vendorId: string;
  itemId: string;
  /** Server-computed buy price; client cannot override */
  buyPrice: number;
  /** Server-computed sell price for items the vendor accepts */
  sellPrice: number;
  /** Current stock remaining; -1 = unlimited */
  stock: number;
  /** Required reputation faction, or undefined for no requirement */
  requiredFaction?: string;
  requiredReputationTier?: number;
}

// ---------------------------------------------------------------------------
// Crafting recipe definition
// ---------------------------------------------------------------------------

export interface HarthmereCraftingRecipeV1 {
  recipeId: string;
  outputItemId: string;
  outputCount: number;
  inputs: Array<{ itemId: string; count: number }>;
  requiredLevel: number;
  requiredSkillId?: string;
  requiredSkillLevel?: number;
  requiredStationId?: string;
  craftingTimeMs: number;
  /** XP awarded on success */
  xpReward: number;
}

// ---------------------------------------------------------------------------
// Mutation request types
// ---------------------------------------------------------------------------

export type HarthmereInventoryMutationKindV1 =
  | "pickup_item"
  | "drop_item"
  | "equip_item"
  | "unequip_item"
  | "use_item"
  | "sell_to_vendor"
  | "buy_from_vendor"
  | "transfer_to_bank"
  | "withdraw_from_bank"
  | "start_trade"
  | "accept_trade"
  | "cancel_trade"
  | "craft_item"
  | "stack_items"
  | "split_stack"
  | "destroy_item"
  | "grant_quest_item"
  | "remove_quest_item"
  | "learn_spell_from_tome"
  | "repair_item"
  | "admin_grant";

export interface HarthmereInventoryMutationRequestV1 {
  requestId: string;
  actorId: string;
  kind: HarthmereInventoryMutationKindV1;
  /** Server time at the point of mutation */
  nowMs: number;
  itemId?: string;
  count?: number;
  targetSlot?: string;
  sourceSlot?: string;
  vendorId?: string;
  /** Trade partner actor id */
  tradePartnerId?: string;
  /** Server-looked-up recipe; never trust client-supplied recipe */
  recipeId?: string;
  /** Bank withdraw/deposit target item */
  bankItemId?: string;
  bankCount?: number;
  /** Quest id that owns a quest item being granted/removed */
  questId?: string;
}

// ---------------------------------------------------------------------------
// Mutation result
// ---------------------------------------------------------------------------

export interface HarthmereInventoryMutationResultV1 {
  ok: boolean;
  requestId: string;
  kind: HarthmereInventoryMutationKindV1;
  actorId: string;
  errors: string[];
  warnings: string[];
  /** Delta to apply to inventory.items — server-computed, not client-supplied */
  itemDeltas: Record<string, number>;
  /** Delta to apply to inventory.bank */
  bankDeltas: Record<string, number>;
  /** Delta to apply to inventory.escrow */
  escrowDeltas: Record<string, number>;
  goldDelta: number;
  /** Equipment slot changes: slot → new itemId (or undefined to unequip) */
  equipmentChanges: Record<string, string | undefined>;
  /** New consumable cooldown category expiries to set */
  newConsumableCooldowns: Record<string, number>;
  /** Ability ids to add to knownAbilities */
  newAbilityIds: string[];
  /** Recipe ids to add to knownRecipes */
  newRecipeIds: string[];
  /** XP awarded by this mutation (e.g. from crafting) */
  xpDelta: number;
  /** Audit tags for the ledger */
  auditTags: string[];
}

// ---------------------------------------------------------------------------
// Item catalogue registry (stub — production loads from DB/config service)
// ---------------------------------------------------------------------------

const _itemCatalogueRegistry = new Map<string, HarthmereItemDefinitionV1>();

export function registerHarthmereItemDefinitionV1(def: HarthmereItemDefinitionV1) {
  _itemCatalogueRegistry.set(def.itemId, def);
}

export function getHarthmereItemDefinitionV1(
  itemId: string
): HarthmereItemDefinitionV1 | undefined {
  return _itemCatalogueRegistry.get(itemId);
}

// Vendor catalogue registry
const _vendorRegistry = new Map<string, Map<string, HarthmereVendorEntryV1>>();

export function registerHarthmereVendorEntryV1(entry: HarthmereVendorEntryV1) {
  let map = _vendorRegistry.get(entry.vendorId);
  if (!map) {
    map = new Map();
    _vendorRegistry.set(entry.vendorId, map);
  }
  map.set(entry.itemId, entry);
}

export function getHarthmereVendorEntryV1(
  vendorId: string,
  itemId: string
): HarthmereVendorEntryV1 | undefined {
  return _vendorRegistry.get(vendorId)?.get(itemId);
}

// Recipe registry
const _recipeRegistry = new Map<string, HarthmereCraftingRecipeV1>();

export function registerHarthmereCraftingRecipeV1(recipe: HarthmereCraftingRecipeV1) {
  _recipeRegistry.set(recipe.recipeId, recipe);
}

export function getHarthmereCraftingRecipeV1(
  recipeId: string
): HarthmereCraftingRecipeV1 | undefined {
  return _recipeRegistry.get(recipeId);
}

// ---------------------------------------------------------------------------
// Inventory capacity helpers
// ---------------------------------------------------------------------------

export const HARTHMERE_DEFAULT_INVENTORY_SLOTS_V1 = 40;
export const HARTHMERE_BANK_SLOTS_V1 = 80;

export function countInventorySlots(items: Record<string, number>): number {
  return Object.keys(items).length;
}

export function inventoryHasCapacity(
  items: Record<string, number>,
  neededSlots: number,
  maxSlots = HARTHMERE_DEFAULT_INVENTORY_SLOTS_V1
): boolean {
  return countInventorySlots(items) + neededSlots <= maxSlots;
}

// ---------------------------------------------------------------------------
// Cooldown helpers
// ---------------------------------------------------------------------------

export function isConsumableOnCooldown(
  snapshot: HarthmereInventorySnapshotV1,
  cooldownCategory: string,
  nowMs: number
): boolean {
  const expiresAt = snapshot.consumableCooldowns[cooldownCategory];
  return expiresAt !== undefined && nowMs < expiresAt;
}

// ---------------------------------------------------------------------------
// Escrow helpers
// ---------------------------------------------------------------------------

export function availableCount(
  snapshot: HarthmereInventorySnapshotV1,
  itemId: string
): number {
  const held = snapshot.items[itemId] ?? 0;
  const escrowed = snapshot.escrow[itemId] ?? 0;
  return Math.max(0, held - escrowed);
}

// ---------------------------------------------------------------------------
// Core validation — called by the reducer for each inventory mutation kind
// ---------------------------------------------------------------------------

function fail(errors: string[], ...codes: string[]): void {
  errors.push(...codes);
}

function resultOk(
  requestId: string,
  kind: HarthmereInventoryMutationKindV1,
  actorId: string,
  overrides: Partial<HarthmereInventoryMutationResultV1> = {}
): HarthmereInventoryMutationResultV1 {
  return {
    ok: true,
    requestId,
    kind,
    actorId,
    errors: [],
    warnings: [],
    itemDeltas: {},
    bankDeltas: {},
    escrowDeltas: {},
    goldDelta: 0,
    equipmentChanges: {},
    newConsumableCooldowns: {},
    newAbilityIds: [],
    newRecipeIds: [],
    xpDelta: 0,
    auditTags: [],
    ...overrides,
  };
}

function resultFail(
  requestId: string,
  kind: HarthmereInventoryMutationKindV1,
  actorId: string,
  errors: string[]
): HarthmereInventoryMutationResultV1 {
  return {
    ok: false,
    requestId,
    kind,
    actorId,
    errors,
    warnings: [],
    itemDeltas: {},
    bankDeltas: {},
    escrowDeltas: {},
    goldDelta: 0,
    equipmentChanges: {},
    newConsumableCooldowns: {},
    newAbilityIds: [],
    newRecipeIds: [],
    xpDelta: 0,
    auditTags: [],
  };
}

// ---------------------------------------------------------------------------
// Vendor buy
// ---------------------------------------------------------------------------

function validateVendorBuy(
  req: HarthmereInventoryMutationRequestV1,
  snapshot: HarthmereInventorySnapshotV1,
  reputation: Record<string, number>
): HarthmereInventoryMutationResultV1 {
  const errors: string[] = [];
  const { requestId, actorId, kind, itemId, count = 1, vendorId } = req;

  if (!itemId) return resultFail(requestId, kind, actorId, ["missing_item_id"]);
  if (!vendorId) return resultFail(requestId, kind, actorId, ["missing_vendor_id"]);
  if (count < 1) return resultFail(requestId, kind, actorId, ["invalid_count"]);

  const def = getHarthmereItemDefinitionV1(itemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);

  const entry = getHarthmereVendorEntryV1(vendorId, itemId);
  if (!entry) return resultFail(requestId, kind, actorId, ["item_not_in_vendor_catalogue"]);

  // Reputation check
  if (entry.requiredFaction && entry.requiredReputationTier !== undefined) {
    const rep = reputation[entry.requiredFaction] ?? 0;
    if (rep < entry.requiredReputationTier) {
      fail(errors, "insufficient_reputation_for_vendor_item");
    }
  }

  // Stock check (server-owned stock, not client claim)
  if (entry.stock !== -1 && entry.stock < count) {
    fail(errors, "vendor_out_of_stock");
  }

  // Server-computed buy price — client cannot supply this
  const totalCost = entry.buyPrice * count;
  if (snapshot.gold < totalCost) {
    fail(errors, "insufficient_gold");
  }

  // Inventory capacity
  const existingCount = snapshot.items[itemId] ?? 0;
  const newCount = existingCount + count;
  const slotsNeeded = existingCount === 0 ? 1 : 0;
  if (!inventoryHasCapacity(snapshot.items, slotsNeeded)) {
    fail(errors, "inventory_full");
  }

  // Stack size
  if (newCount > def.maxStackSize) {
    fail(errors, "stack_size_exceeded");
  }

  if (errors.length > 0) return resultFail(requestId, kind, actorId, errors);

  return resultOk(requestId, kind, actorId, {
    itemDeltas: { [itemId]: count },
    goldDelta: -totalCost,
    auditTags: ["vendor_buy", vendorId, itemId],
  });
}

// ---------------------------------------------------------------------------
// Vendor sell
// ---------------------------------------------------------------------------

function validateVendorSell(
  req: HarthmereInventoryMutationRequestV1,
  snapshot: HarthmereInventorySnapshotV1
): HarthmereInventoryMutationResultV1 {
  const errors: string[] = [];
  const { requestId, actorId, kind, itemId, count = 1, vendorId } = req;

  if (!itemId) return resultFail(requestId, kind, actorId, ["missing_item_id"]);
  if (!vendorId) return resultFail(requestId, kind, actorId, ["missing_vendor_id"]);
  if (count < 1) return resultFail(requestId, kind, actorId, ["invalid_count"]);

  const def = getHarthmereItemDefinitionV1(itemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);

  // Quest/soulbound items cannot be sold
  if (def.isQuestItem) fail(errors, "cannot_sell_quest_item");
  if (def.binding === "on_pickup" || def.binding === "on_equip") {
    fail(errors, "cannot_sell_bound_item");
  }

  // Ownership check — server verifies actual possession
  const owned = availableCount(snapshot, itemId);
  if (owned < count) {
    fail(errors, "insufficient_item_count");
  }

  const entry = getHarthmereVendorEntryV1(vendorId, itemId);
  // Vendor may not buy this item
  const sellPrice = entry?.sellPrice ?? Math.floor(def.baseValue * 0.25);

  if (errors.length > 0) return resultFail(requestId, kind, actorId, errors);

  return resultOk(requestId, kind, actorId, {
    itemDeltas: { [itemId]: -count },
    goldDelta: sellPrice * count,
    auditTags: ["vendor_sell", vendorId, itemId],
  });
}

// ---------------------------------------------------------------------------
// Use consumable item
// ---------------------------------------------------------------------------

function validateUseItem(
  req: HarthmereInventoryMutationRequestV1,
  snapshot: HarthmereInventorySnapshotV1,
  playerLevel: number
): HarthmereInventoryMutationResultV1 {
  const errors: string[] = [];
  const { requestId, actorId, kind, itemId, count = 1, nowMs } = req;

  if (!itemId) return resultFail(requestId, kind, actorId, ["missing_item_id"]);

  const def = getHarthmereItemDefinitionV1(itemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);
  if (!def.isConsumable && !def.isSpellTome) {
    return resultFail(requestId, kind, actorId, ["item_not_consumable"]);
  }

  // Ownership
  const owned = availableCount(snapshot, itemId);
  if (owned < count) fail(errors, "insufficient_item_count");

  // Level requirement
  if (playerLevel < def.levelRequirement) fail(errors, "level_requirement_not_met");

  // Consumable cooldown — server clock, not client
  if (def.consumableCooldownCategory) {
    if (isConsumableOnCooldown(snapshot, def.consumableCooldownCategory, nowMs!)) {
      fail(errors, "consumable_on_cooldown");
    }
  }

  // Spell tome: already known?
  if (def.isSpellTome && def.grantsAbilityId) {
    if (snapshot.knownAbilities.includes(def.grantsAbilityId)) {
      // Don't destroy item if spell already known — return warning
      return {
        ...resultOk(requestId, kind, actorId, {}),
        warnings: ["spell_already_known"],
        auditTags: ["use_item_noop", "spell_already_known"],
      };
    }
  }

  if (errors.length > 0) return resultFail(requestId, kind, actorId, errors);

  const newConsumableCooldowns: Record<string, number> = {};
  if (def.consumableCooldownCategory && def.consumableCooldownMs) {
    newConsumableCooldowns[def.consumableCooldownCategory] =
      nowMs! + def.consumableCooldownMs;
  }

  const newAbilityIds: string[] = [];
  if (def.isSpellTome && def.grantsAbilityId) {
    newAbilityIds.push(def.grantsAbilityId);
  }

  return resultOk(requestId, kind, actorId, {
    itemDeltas: { [itemId]: -count },
    newConsumableCooldowns,
    newAbilityIds,
    auditTags: ["use_item", itemId, ...(def.grantsAbilityId ? ["spell_learned"] : [])],
  });
}

// ---------------------------------------------------------------------------
// Crafting
// ---------------------------------------------------------------------------

function validateCraftItem(
  req: HarthmereInventoryMutationRequestV1,
  snapshot: HarthmereInventorySnapshotV1,
  playerLevel: number,
  playerSkills: Record<string, { level: number }>
): HarthmereInventoryMutationResultV1 {
  const errors: string[] = [];
  const { requestId, actorId, kind, recipeId } = req;

  if (!recipeId) return resultFail(requestId, kind, actorId, ["missing_recipe_id"]);

  const recipe = getHarthmereCraftingRecipeV1(recipeId);
  if (!recipe) return resultFail(requestId, kind, actorId, ["unknown_recipe_id"]);

  // Player must know the recipe — server checks knownRecipes
  if (!snapshot.knownRecipes.includes(recipeId)) {
    fail(errors, "recipe_not_known");
  }

  // Level requirement
  if (playerLevel < recipe.requiredLevel) fail(errors, "level_requirement_not_met");

  // Skill requirement — server-owned skill values
  if (recipe.requiredSkillId && recipe.requiredSkillLevel !== undefined) {
    const skillLevel = playerSkills[recipe.requiredSkillId]?.level ?? 0;
    if (skillLevel < recipe.requiredSkillLevel) {
      fail(errors, "skill_requirement_not_met");
    }
  }

  // Materials check — server verifies actual possession, never trusts client
  const itemDeltas: Record<string, number> = {};
  for (const input of recipe.inputs) {
    const available = availableCount(snapshot, input.itemId);
    if (available < input.count) {
      fail(errors, `insufficient_material:${input.itemId}`);
    }
    itemDeltas[input.itemId] = (itemDeltas[input.itemId] ?? 0) - input.count;
  }

  // Output inventory space
  const outputDef = getHarthmereItemDefinitionV1(recipe.outputItemId);
  if (!outputDef) {
    fail(errors, "unknown_output_item_id");
  } else {
    const existing = snapshot.items[recipe.outputItemId] ?? 0;
    const newCount = existing + recipe.outputCount;
    if (newCount > outputDef.maxStackSize) {
      fail(errors, "output_stack_size_exceeded");
    }
    if (existing === 0 && !inventoryHasCapacity(snapshot.items, 1)) {
      fail(errors, "inventory_full");
    }
  }

  if (errors.length > 0) return resultFail(requestId, kind, actorId, errors);

  // Add output
  itemDeltas[recipe.outputItemId] =
    (itemDeltas[recipe.outputItemId] ?? 0) + recipe.outputCount;

  return resultOk(requestId, kind, actorId, {
    itemDeltas,
    xpDelta: recipe.xpReward,
    auditTags: ["craft_item", recipeId, recipe.outputItemId],
  });
}

// ---------------------------------------------------------------------------
// Bank transfer
// ---------------------------------------------------------------------------

function validateBankTransfer(
  req: HarthmereInventoryMutationRequestV1,
  snapshot: HarthmereInventorySnapshotV1
): HarthmereInventoryMutationResultV1 {
  const { requestId, actorId, kind, bankItemId, bankCount = 1 } = req;
  const isDeposit = kind === "transfer_to_bank";

  if (!bankItemId) return resultFail(requestId, kind, actorId, ["missing_item_id"]);
  if (bankCount < 1) return resultFail(requestId, kind, actorId, ["invalid_count"]);

  const def = getHarthmereItemDefinitionV1(bankItemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);

  const errors: string[] = [];

  if (isDeposit) {
    const owned = availableCount(snapshot, bankItemId);
    if (owned < bankCount) fail(errors, "insufficient_item_count");
    const bankExisting = snapshot.bank[bankItemId] ?? 0;
    if (bankExisting + bankCount > def.maxStackSize) fail(errors, "bank_stack_size_exceeded");
    if (bankExisting === 0 && !inventoryHasCapacity(snapshot.bank, 1, HARTHMERE_BANK_SLOTS_V1)) {
      fail(errors, "bank_full");
    }
  } else {
    // withdraw
    const banked = snapshot.bank[bankItemId] ?? 0;
    if (banked < bankCount) fail(errors, "insufficient_bank_item_count");
    const invExisting = snapshot.items[bankItemId] ?? 0;
    if (invExisting === 0 && !inventoryHasCapacity(snapshot.items, 1)) {
      fail(errors, "inventory_full");
    }
  }

  if (errors.length > 0) return resultFail(requestId, kind, actorId, errors);

  return resultOk(requestId, kind, actorId, {
    itemDeltas: isDeposit ? { [bankItemId]: -bankCount } : { [bankItemId]: bankCount },
    bankDeltas: isDeposit ? { [bankItemId]: bankCount } : { [bankItemId]: -bankCount },
    auditTags: [isDeposit ? "bank_deposit" : "bank_withdraw", bankItemId],
  });
}

// ---------------------------------------------------------------------------
// Quest item grant / remove (server-initiated only)
// ---------------------------------------------------------------------------

function validateGrantQuestItem(
  req: HarthmereInventoryMutationRequestV1,
  snapshot: HarthmereInventorySnapshotV1
): HarthmereInventoryMutationResultV1 {
  const { requestId, actorId, kind, itemId, count = 1, questId } = req;

  if (!itemId) return resultFail(requestId, kind, actorId, ["missing_item_id"]);
  if (!questId) return resultFail(requestId, kind, actorId, ["missing_quest_id"]);

  const def = getHarthmereItemDefinitionV1(itemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);
  if (!def.isQuestItem) return resultFail(requestId, kind, actorId, ["not_a_quest_item"]);

  if (!inventoryHasCapacity(snapshot.items, 1)) {
    return resultFail(requestId, kind, actorId, ["inventory_full"]);
  }

  return resultOk(requestId, kind, actorId, {
    itemDeltas: { [itemId]: count },
    auditTags: ["grant_quest_item", questId, itemId],
  });
}

function validateRemoveQuestItem(
  req: HarthmereInventoryMutationRequestV1,
  snapshot: HarthmereInventorySnapshotV1
): HarthmereInventoryMutationResultV1 {
  const { requestId, actorId, kind, itemId, count = 1, questId } = req;

  if (!itemId) return resultFail(requestId, kind, actorId, ["missing_item_id"]);
  if (!questId) return resultFail(requestId, kind, actorId, ["missing_quest_id"]);

  const owned = (snapshot.items[itemId] ?? 0) + (snapshot.bank[itemId] ?? 0);
  if (owned < count) {
    // Warn but don't hard-fail; quest system should handle gracefully
    return resultOk(requestId, kind, actorId, {
      warnings: ["quest_item_count_mismatch_on_remove"],
      auditTags: ["remove_quest_item_warn", questId, itemId],
    });
  }

  return resultOk(requestId, kind, actorId, {
    itemDeltas: { [itemId]: -(Math.min(count, snapshot.items[itemId] ?? 0)) },
    bankDeltas: { [itemId]: -(Math.min(count, snapshot.bank[itemId] ?? 0)) },
    auditTags: ["remove_quest_item", questId, itemId],
  });
}

// ---------------------------------------------------------------------------
// Admin grant (no inventory restriction checks — must validate caller auth separately)
// ---------------------------------------------------------------------------

function validateAdminGrant(
  req: HarthmereInventoryMutationRequestV1,
  _snapshot: HarthmereInventorySnapshotV1
): HarthmereInventoryMutationResultV1 {
  const { requestId, actorId, kind, itemId, count = 1 } = req;
  if (!itemId) return resultFail(requestId, kind, actorId, ["missing_item_id"]);
  const def = getHarthmereItemDefinitionV1(itemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);

  return resultOk(requestId, kind, actorId, {
    itemDeltas: { [itemId]: count },
    auditTags: ["admin_grant", itemId],
  });
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

export interface HarthmereInventoryMutationContextV1 {
  snapshot: HarthmereInventorySnapshotV1;
  playerLevel: number;
  playerSkills: Record<string, { level: number }>;
  /** Server-owned reputation — never trust client */
  reputation: Record<string, number>;
}

export function reduceHarthmereInventoryMutationV1(
  req: HarthmereInventoryMutationRequestV1,
  ctx: HarthmereInventoryMutationContextV1
): HarthmereInventoryMutationResultV1 {
  const { snapshot, playerLevel, playerSkills, reputation } = ctx;

  switch (req.kind) {
    case "buy_from_vendor":
      return validateVendorBuy(req, snapshot, reputation);

    case "sell_to_vendor":
      return validateVendorSell(req, snapshot);

    case "use_item":
    case "learn_spell_from_tome":
      return validateUseItem(req, snapshot, playerLevel);

    case "craft_item":
      return validateCraftItem(req, snapshot, playerLevel, playerSkills);

    case "transfer_to_bank":
    case "withdraw_from_bank":
      return validateBankTransfer(req, snapshot);

    case "grant_quest_item":
      return validateGrantQuestItem(req, snapshot);

    case "remove_quest_item":
      return validateRemoveQuestItem(req, snapshot);

    case "admin_grant":
      return validateAdminGrant(req, snapshot);

    // Remaining kinds pass through with a warning (not yet fully validated)
    default:
      return resultOk(req.requestId, req.kind, req.actorId, {
        warnings: [`inventory_mutation_kind_not_fully_validated:${req.kind}`],
        auditTags: [`passthrough_mutation:${req.kind}`],
      });
  }
}

// ---------------------------------------------------------------------------
// Apply a validated result back onto an inventory snapshot (used by reducer)
// ---------------------------------------------------------------------------

export function applyHarthmereInventoryMutationResultV1(
  snapshot: HarthmereInventorySnapshotV1,
  result: HarthmereInventoryMutationResultV1
): HarthmereInventorySnapshotV1 {
  if (!result.ok) return snapshot;

  const next: HarthmereInventorySnapshotV1 = {
    ...snapshot,
    gold: Math.max(0, snapshot.gold + result.goldDelta),
    items: { ...snapshot.items },
    bank: { ...snapshot.bank },
    escrow: { ...snapshot.escrow },
    equipment: { ...snapshot.equipment },
    consumableCooldowns: { ...snapshot.consumableCooldowns },
    knownAbilities: [...snapshot.knownAbilities],
    knownRecipes: [...snapshot.knownRecipes],
  };

  for (const [itemId, delta] of Object.entries(result.itemDeltas)) {
    const newCount = Math.max(0, (next.items[itemId] ?? 0) + delta);
    if (newCount === 0) {
      delete next.items[itemId];
    } else {
      next.items[itemId] = newCount;
    }
  }

  for (const [itemId, delta] of Object.entries(result.bankDeltas)) {
    const newCount = Math.max(0, (next.bank[itemId] ?? 0) + delta);
    if (newCount === 0) {
      delete next.bank[itemId];
    } else {
      next.bank[itemId] = newCount;
    }
  }

  for (const [itemId, delta] of Object.entries(result.escrowDeltas)) {
    const newCount = Math.max(0, (next.escrow[itemId] ?? 0) + delta);
    if (newCount === 0) {
      delete next.escrow[itemId];
    } else {
      next.escrow[itemId] = newCount;
    }
  }

  for (const [slot, itemId] of Object.entries(result.equipmentChanges)) {
    if (itemId === undefined) {
      delete next.equipment[slot];
    } else {
      next.equipment[slot] = itemId;
    }
  }

  for (const [category, expiresAt] of Object.entries(result.newConsumableCooldowns)) {
    next.consumableCooldowns[category] = expiresAt;
  }

  for (const abilityId of result.newAbilityIds) {
    if (!next.knownAbilities.includes(abilityId)) {
      next.knownAbilities.push(abilityId);
    }
  }

  for (const recipeId of result.newRecipeIds) {
    if (!next.knownRecipes.includes(recipeId)) {
      next.knownRecipes.push(recipeId);
    }
  }

  return next;
}
