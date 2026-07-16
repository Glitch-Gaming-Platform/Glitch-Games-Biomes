/*
 * mmo_inventory_authority.ts
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
 * All mutations come through reduceHarthmereInventoryMutation which
 * returns a validated InventoryMutationResult.  The live_mode_backend
 * reducer calls this instead of blindly applying payload deltas.
 */

export const MMO_INVENTORY_AUTHORITY_VERSION = "mmo-inventory-authority";

// ---------------------------------------------------------------------------
// Item catalogue entry (loaded server-side, never sent by client as truth)
// ---------------------------------------------------------------------------

export type HarthmereItemBinding = "none" | "on_pickup" | "on_equip" | "quest";
export const HARTHMERE_EQUIPMENT_SLOTS = [
  "main_hand",
  "off_hand",
  "head",
  "chest",
  "legs",
  "feet",
  "hands",
  "back",
  "neck",
] as const;
export type HarthmereEquipmentSlot = (typeof HARTHMERE_EQUIPMENT_SLOTS)[number];
export type HarthmereItemRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";
export type HarthmereCraftingQualityTier =
  | "rough"
  | "standard"
  | "fine"
  | "excellent"
  | "masterwork";
export type HarthmereCraftingWorkflowKind =
  | "craft"
  | "repair"
  | "salvage"
  | "upgrade"
  | "enchant"
  | "quest_forge";
export type HarthmereCraftingPhase = "instant" | "start" | "complete";
export type HarthmereItemPhysicalForm =
  | "block"
  | "particle_capsule"
  | "canister"
  | "filter"
  | "crystal"
  | "fuel_cell"
  | "power_cell"
  | "core"
  | "device"
  | "document"
  | "crafting_station"
  | "furniture"
  | "storage"
  | "garden_bed"
  | "light"
  | "counter"
  | "utility_fixture";

export interface HarthmereItemObjectMetadata {
  objectKind:
    | "material"
    | "component"
    | "fuel"
    | "device"
    | "paperwork"
    | "station"
    | "furniture"
    | "garden"
    | "fixture";
  physicalForm: HarthmereItemPhysicalForm;
  sizeVoxels?: { width: number; depth: number; height: number };
  sizeLabel?: string;
  colors?: string[];
  visualDescription?: string;
  materialComposition?: string[];
  craftingRoles?: string[];
  source?: string[];
  businessUse?: string[];
  handling?: string[];
  hazardClass?: string;
  containmentRating?: number;
  powerMegawattsPerUnit?: number;
  energySource?: boolean;
  lore?: {
    discoveredYear?: number;
    discoveredBy?: string;
    origin?: string;
    societyUses?: string[];
  };
  procedural?: {
    canGenerateWithVoxels: boolean;
    suggestedShape?: string;
    palette?: string[];
    emission?: string;
  };
  bikkieGraphicHints?: string[];
}

export interface HarthmereItemDefinition {
  itemId: string;
  displayName: string;
  description?: string;
  maxStackSize: number;
  /** Base gold value used for vendor buy/sell price calculations */
  baseValue: number;
  binding: HarthmereItemBinding;
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
  /** Two-handed weapon: occupies the main hand and forbids an off-hand item at the same time. */
  twoHanded?: boolean;
  /** Canonical slots this item may occupy. The server, never the client, owns this rule. */
  equipmentSlots?: HarthmereEquipmentSlot[];
  tradeable: boolean;
  /** Optional category used by crafting/economy affordances. */
  category?: string;
  /** Per-unit carry weight in pounds. Omitted items use the shared fallback table. */
  weight?: number;
  /** Durable item support for repair/upgrade/enchant workflows. */
  durabilityMax?: number;
  repairable?: boolean;
  salvageOutputs?: Array<{ itemId: string; count: number }>;
  qualityFloor?: number;
  materialTier?: number;
  /** Rich world/object metadata for UI, placement, crafting, and audits. */
  objectMetadata?: HarthmereItemObjectMetadata;
  /** Cooldown category (e.g. "potion", "food") — shared cooldown group */
  consumableCooldownCategory?: string;
  consumableCooldownMs?: number;
}

// ---------------------------------------------------------------------------
// Inventory snapshot (what the server reads from Redis/DB)
// ---------------------------------------------------------------------------

export interface HarthmereInventorySnapshot {
  actorId: string;
  gold: number;
  /** slot → itemId */
  equipment: Record<string, string>;
  /** itemId → count */
  items: Record<string, number>;
  /** itemId → count */
  bank: Record<string, number>;
  /** itemId → count in material storage; crafting can consume from here */
  materialStorage?: Record<string, number>;
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
  /**
   * Remaining durability per crafting tool itemId. Optional: when omitted (or a
   * tool is absent), the tool is treated as full, so callers that don't track
   * durability are unaffected. A tool whose remaining durability is below the
   * craft's cost is BROKEN and blocks the craft (HARTHMERE_TOOL_DURABILITY).
   */
  toolDurability?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Vendor catalogue entry
// ---------------------------------------------------------------------------

export interface HarthmereVendorEntry {
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

export interface HarthmereCraftingRecipe {
  recipeId: string;
  outputItemId: string;
  outputCount: number;
  inputs: Array<{ itemId: string; count: number }>;
  requiredLevel: number;
  requiredSkillId?: string;
  requiredSkillLevel?: number;
  professionId?: string;
  requiredProfessionLevel?: number;
  recipeTier?: number;
  materialTier?: number;
  requiredStationId?: string;
  /** Optional station type gate for station families such as general/cooking/dying. */
  requiredStationType?: string;
  requiredToolIds?: string[];
  requiredToolActions?: string[];
  minToolTier?: number;
  toolDurabilityCost?: number;
  fuelInputs?: Array<{ itemId: string; count: number }>;
  optionalReagents?: Array<{
    itemId: string;
    count: number;
    qualityBonus?: number;
    successBonus?: number;
    materialEfficiencyBonus?: number;
  }>;
  goldCost?: number;
  successChance?: number;
  failureMaterialRefundPercent?: number;
  qualityFloor?: number;
  qualityCeiling?: number;
  qualitySkillScale?: number;
  qualityReagentScale?: number;
  workflowKind?: HarthmereCraftingWorkflowKind;
  targetItemIds?: string[];
  consumeTargetOnSuccess?: boolean;
  outputBinding?: HarthmereItemBinding;
  questId?: string;
  questStepIds?: string[];
  teachesRecipesOnSuccess?: string[];
  businessTypeId?: string;
  workOrderTag?: string;
  durabilityMax?: number;
  craftingTimeMs: number;
  /** XP awarded on success */
  xpReward: number;
}

export interface HarthmereCraftingStationDefinition {
  stationId: string;
  displayName: string;
  stationType?: string;
  size?: string;
  buildingRequirements?: string;
  supportsHandcraft?: boolean;
}

export interface HarthmereCraftingToolDefinition {
  itemId: string;
  displayName: string;
  action?: string;
  tier?: number;
  durabilityMax?: number;
  // HARTHMERE_TOOL_POWER: per-tool effect strength. `damage` is how hard the
  // tool hits — combat damage and how fast it mines/destroys a block; `repairPower`
  // is how many broken blocks a repair tool restores per use; `cleanupPower` is how
  // many muck voxels a cleanup tool converts back to dirt per use (the same tool
  // also plants seeds for gardening). All only take effect while the tool is
  // EQUIPPED (see harthmereEquippedToolPower). Greater-impact tools cost more
  // (see harthmereToolBaseValueForTier).
  damage?: number;
  repairPower?: number;
  cleanupPower?: number;
}

export interface HarthmereCraftingOutcome {
  recipeId: string;
  phase: HarthmereCraftingPhase;
  success: boolean;
  outputItemId: string;
  outputCount: number;
  quality: number;
  qualityTier: HarthmereCraftingQualityTier;
  craftedByActorId: string;
  stationId?: string;
  stationType?: string;
  toolItemIds: string[];
  optionalReagentItemIds: string[];
  targetItemId?: string;
  professionId?: string;
  recipeTier?: number;
  materialTier?: number;
  durabilityMax?: number;
  binding?: HarthmereItemBinding;
  questId?: string;
  businessTypeId?: string;
  workOrderTag?: string;
  toolDurabilityCosts: Record<string, number>;
  economyTags: string[];
  readyAtMs?: number;
  failureReason?: string;
}

// ---------------------------------------------------------------------------
// Mutation request types
// ---------------------------------------------------------------------------

export type HarthmereInventoryMutationKind =
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

export interface HarthmereInventoryMutationRequest {
  requestId: string;
  actorId: string;
  kind: HarthmereInventoryMutationKind;
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
  /** Server-verified crafting station/tool context. */
  stationId?: string | number;
  stationType?: string;
  toolItemIds?: string[];
  optionalReagentItemIds?: string[];
  targetItemId?: string;
  workflowStepIds?: string[];
  craftingPhase?: HarthmereCraftingPhase;
  craftingJobId?: string;
  qualitySeed?: number;
  /** Used only by live-mode job completion after inputs were reserved at start. */
  prepaidCraftingInputs?: boolean;
  /** Bank withdraw/deposit target item */
  bankItemId?: string;
  bankCount?: number;
  /** Quest id that owns a quest item being granted/removed */
  questId?: string;
}

// ---------------------------------------------------------------------------
// Mutation result
// ---------------------------------------------------------------------------

export interface HarthmereInventoryMutationResult {
  ok: boolean;
  requestId: string;
  kind: HarthmereInventoryMutationKind;
  actorId: string;
  errors: string[];
  warnings: string[];
  /** Delta to apply to inventory.items — server-computed, not client-supplied */
  itemDeltas: Record<string, number>;
  /** Delta to apply to inventory.bank */
  bankDeltas: Record<string, number>;
  /** Delta to apply to material storage */
  materialStorageDeltas: Record<string, number>;
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
  /** Rich crafting metadata for item instances, jobs, economy, and UI. */
  craftingOutcome?: HarthmereCraftingOutcome;
}

// ---------------------------------------------------------------------------
// Item catalogue registry (stub — production loads from DB/config service)
// ---------------------------------------------------------------------------

const _itemCatalogueRegistry = new Map<string, HarthmereItemDefinition>();

export function registerHarthmereItemDefinition(def: HarthmereItemDefinition) {
  const existing = _itemCatalogueRegistry.get(def.itemId);
  _itemCatalogueRegistry.set(
    def.itemId,
    existing
      ? {
          ...existing,
          ...def,
          stats: { ...(existing.stats ?? {}), ...(def.stats ?? {}) },
        }
      : def
  );
}

function equipmentSlotFromDisplayText(
  def: Pick<HarthmereItemDefinition, "displayName" | "itemId" | "category">
): HarthmereEquipmentSlot | undefined {
  const text = `${def.itemId} ${def.displayName}`.toLowerCase();
  if (/shield|buckler/.test(text)) return "off_hand";
  if (/helmet|helm|hat|hood|crown/.test(text)) return "head";
  if (/trouser|pants|leggings|bottoms|skirt|greaves/.test(text)) return "legs";
  if (/boot|shoe|sandal|feet/.test(text)) return "feet";
  if (/glove|gauntlet|hands/.test(text)) return "hands";
  if (/cloak|cape|mantle|backpack/.test(text)) return "back";
  if (/necklace|amulet|gorget|neck/.test(text)) return "neck";
  if (/camera/.test(text)) return "main_hand";
  if (
    /sword|dagger|blade|axe|mace|hammer|bow|crossbow|staff|wand|pickaxe|mallet|rake/.test(
      text
    )
  ) {
    return "main_hand";
  }
  if (/armor|armour|apron|shirt|tunic|vest|jacket|coat|chestplate/.test(text)) {
    return "chest";
  }
  if (def.category === "weapon" || def.category === "tool") return "main_hand";
  if (def.category === "armor" || def.category === "cosmetic") return "chest";
  return undefined;
}

export function harthmereAllowedEquipmentSlots(
  def: HarthmereItemDefinition
): readonly HarthmereEquipmentSlot[] {
  if (def.equipmentSlots?.length) {
    return [...new Set(def.equipmentSlots)].filter((slot) =>
      HARTHMERE_EQUIPMENT_SLOTS.includes(slot)
    );
  }
  const inferred = equipmentSlotFromDisplayText(def);
  return inferred ? [inferred] : [];
}

export function getHarthmereItemDefinition(
  itemId: string
): HarthmereItemDefinition | undefined {
  return _itemCatalogueRegistry.get(itemId);
}

// Vendor catalogue registry
const _vendorRegistry = new Map<string, Map<string, HarthmereVendorEntry>>();

export function registerHarthmereVendorEntry(entry: HarthmereVendorEntry) {
  let map = _vendorRegistry.get(entry.vendorId);
  if (!map) {
    map = new Map();
    _vendorRegistry.set(entry.vendorId, map);
  }
  map.set(entry.itemId, entry);
}

export function getHarthmereVendorEntry(
  vendorId: string,
  itemId: string
): HarthmereVendorEntry | undefined {
  return _vendorRegistry.get(vendorId)?.get(itemId);
}

// Recipe registry
const _recipeRegistry = new Map<string, HarthmereCraftingRecipe>();
const _craftingStationRegistry = new Map<
  string,
  HarthmereCraftingStationDefinition
>();
const _craftingToolRegistry = new Map<
  string,
  HarthmereCraftingToolDefinition
>();

export function registerHarthmereCraftingRecipe(
  recipe: HarthmereCraftingRecipe
) {
  _recipeRegistry.set(recipe.recipeId, recipe);
}

export function getHarthmereCraftingRecipe(
  recipeId: string
): HarthmereCraftingRecipe | undefined {
  return _recipeRegistry.get(recipeId);
}

export function listHarthmereCraftingRecipes(): HarthmereCraftingRecipe[] {
  return [..._recipeRegistry.values()];
}

export function registerHarthmereCraftingStation(
  station: HarthmereCraftingStationDefinition
) {
  _craftingStationRegistry.set(station.stationId, station);
}

export function normalizeHarthmereCraftingStationId(
  stationId: string | number | undefined
): string | undefined {
  if (typeof stationId === "number" && Number.isFinite(stationId)) {
    return String(Math.trunc(stationId));
  }
  if (typeof stationId === "string" && stationId.length > 0) {
    return stationId;
  }
  return undefined;
}

export function getHarthmereCraftingStation(
  stationId: string | number | undefined
): HarthmereCraftingStationDefinition | undefined {
  const normalizedStationId = normalizeHarthmereCraftingStationId(stationId);
  return normalizedStationId
    ? _craftingStationRegistry.get(normalizedStationId)
    : undefined;
}

export function listHarthmereCraftingStations(): HarthmereCraftingStationDefinition[] {
  return [..._craftingStationRegistry.values()];
}

export function registerHarthmereCraftingTool(
  tool: HarthmereCraftingToolDefinition
) {
  _craftingToolRegistry.set(tool.itemId, tool);
}

export function getHarthmereCraftingTool(
  itemId: string | undefined
): HarthmereCraftingToolDefinition | undefined {
  return itemId ? _craftingToolRegistry.get(itemId) : undefined;
}

export function listHarthmereCraftingTools(): HarthmereCraftingToolDefinition[] {
  return [..._craftingToolRegistry.values()];
}

// ---------------------------------------------------------------------------
// HARTHMERE_TOOL_POWER: equip-gated tool effect + tier-scaled cost.
// A tool only applies its effect while EQUIPPED. These pure helpers read the
// equipped tools and return the strongest matching one for an action, so the
// callers (combat damage, mining/destroy, repair) all share one rule.
// ---------------------------------------------------------------------------

export interface HarthmereEquippedToolPower {
  itemId?: string;
  power: number;
  tier: number;
}

// Best EQUIPPED tool for `action`, by the requested power metric. Returns power
// 0 / no itemId when no matching tool is equipped — i.e. an unequipped tool has
// no effect, and bare-handed actions get the zero baseline.
export function harthmereEquippedToolPower(
  snapshot: Pick<HarthmereInventorySnapshot, "equipment">,
  action: string,
  metric: "damage" | "repairPower" | "cleanupPower" = "damage"
): HarthmereEquippedToolPower {
  let best: HarthmereEquippedToolPower = {
    itemId: undefined,
    power: 0,
    tier: 0,
  };
  for (const equippedItemId of Object.values(snapshot.equipment ?? {})) {
    const tool = getHarthmereCraftingTool(equippedItemId);
    if (!tool || (action && tool.action !== action)) {
      continue;
    }
    const power = Number(tool[metric] ?? 0);
    if (power > best.power) {
      best = { itemId: equippedItemId, power, tier: tool.tier ?? 0 };
    }
  }
  return best;
}

// Tier/power-scaled base gold value so greater-impact tools cost more. Used to
// price tools consistently instead of hand-picking a number per vendor.
export const HARTHMERE_TOOL_BASE_COST = 25;
export const HARTHMERE_TOOL_TIER_COST_MULTIPLIER = 3;

export function harthmereToolBaseValueForTier(
  tier: number | undefined,
  power = 0
): number {
  const t = Math.max(1, Math.floor(tier || 1));
  return Math.round(
    HARTHMERE_TOOL_BASE_COST *
      Math.pow(HARTHMERE_TOOL_TIER_COST_MULTIPLIER, t - 1) +
      Math.max(0, power) * 5
  );
}

// Repair-job tool gate: a repair task requires a REPAIR tool to be equipped.
// When one is, returns the tool + its repair power; otherwise returns a
// directive the quest layer turns into a "go get a repair tool" sub-objective.
export type HarthmereRepairToolGate =
  | { ok: true; toolItemId: string; repairPower: number; tier: number }
  | {
      ok: false;
      reason: "no_repair_tool_equipped";
      requiredAction: "repair";
    };

export function harthmereRepairToolGate(
  snapshot: Pick<HarthmereInventorySnapshot, "equipment">
): HarthmereRepairToolGate {
  const best = harthmereEquippedToolPower(snapshot, "repair", "repairPower");
  if (!best.itemId || best.power <= 0) {
    return {
      ok: false,
      reason: "no_repair_tool_equipped",
      requiredAction: "repair",
    };
  }
  return {
    ok: true,
    toolItemId: best.itemId,
    repairPower: best.power,
    tier: best.tier,
  };
}

// Cleanup-job tool gate: clearing muck requires a CLEANUP tool equipped (it
// converts muck voxels back to dirt, and also plants seeds for gardening). Mirror
// of the repair gate.
export type HarthmereCleanupToolGate =
  | { ok: true; toolItemId: string; cleanupPower: number; tier: number }
  | {
      ok: false;
      reason: "no_cleanup_tool_equipped";
      requiredAction: "cleanup";
    };

export function harthmereCleanupToolGate(
  snapshot: Pick<HarthmereInventorySnapshot, "equipment">
): HarthmereCleanupToolGate {
  const best = harthmereEquippedToolPower(snapshot, "cleanup", "cleanupPower");
  if (!best.itemId || best.power <= 0) {
    return {
      ok: false,
      reason: "no_cleanup_tool_equipped",
      requiredAction: "cleanup",
    };
  }
  return {
    ok: true,
    toolItemId: best.itemId,
    cleanupPower: best.power,
    tier: best.tier,
  };
}

// ---------------------------------------------------------------------------
// Inventory capacity helpers
// ---------------------------------------------------------------------------

export const HARTHMERE_DEFAULT_INVENTORY_SLOTS = 40;
export const HARTHMERE_BANK_SLOTS = 80;

export function countInventorySlots(items: Record<string, number>): number {
  return Object.values(items).filter((count) => Number(count) > 0).length;
}

export function inventoryHasCapacity(
  items: Record<string, number>,
  neededSlots: number,
  maxSlots = HARTHMERE_DEFAULT_INVENTORY_SLOTS
): boolean {
  if (!Number.isFinite(neededSlots) || neededSlots < 0) return false;
  return countInventorySlots(items) + Math.trunc(neededSlots) <= maxSlots;
}

// ---------------------------------------------------------------------------
// Cooldown helpers
// ---------------------------------------------------------------------------

export function isConsumableOnCooldown(
  snapshot: HarthmereInventorySnapshot,
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
  snapshot: HarthmereInventorySnapshot,
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

function positiveWholeCount(
  count: number | undefined,
  fallback = 1
): number | undefined {
  const value = count ?? fallback;
  if (!Number.isFinite(value) || value < 1 || Math.trunc(value) !== value) {
    return undefined;
  }
  return value;
}

function applyProjectedDelta(
  items: Record<string, number>,
  itemId: string,
  delta: number
) {
  const next = Math.max(0, Math.trunc((items[itemId] ?? 0) + delta));
  if (next <= 0) delete items[itemId];
  else items[itemId] = next;
}

function resultOk(
  requestId: string,
  kind: HarthmereInventoryMutationKind,
  actorId: string,
  overrides: Partial<HarthmereInventoryMutationResult> = {}
): HarthmereInventoryMutationResult {
  return {
    ok: true,
    requestId,
    kind,
    actorId,
    errors: [],
    warnings: [],
    itemDeltas: {},
    bankDeltas: {},
    materialStorageDeltas: {},
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
  kind: HarthmereInventoryMutationKind,
  actorId: string,
  errors: string[]
): HarthmereInventoryMutationResult {
  return {
    ok: false,
    requestId,
    kind,
    actorId,
    errors,
    warnings: [],
    itemDeltas: {},
    bankDeltas: {},
    materialStorageDeltas: {},
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
  req: HarthmereInventoryMutationRequest,
  snapshot: HarthmereInventorySnapshot,
  reputation: Record<string, number>
): HarthmereInventoryMutationResult {
  const errors: string[] = [];
  const { requestId, actorId, kind, itemId, vendorId } = req;
  const count = positiveWholeCount(req.count);

  if (!itemId) return resultFail(requestId, kind, actorId, ["missing_item_id"]);
  if (!vendorId)
    return resultFail(requestId, kind, actorId, ["missing_vendor_id"]);
  if (count === undefined)
    return resultFail(requestId, kind, actorId, ["invalid_count"]);

  const def = getHarthmereItemDefinition(itemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);

  const entry = getHarthmereVendorEntry(vendorId, itemId);
  if (!entry)
    return resultFail(requestId, kind, actorId, [
      "item_not_in_vendor_catalogue",
    ]);

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
  req: HarthmereInventoryMutationRequest,
  snapshot: HarthmereInventorySnapshot
): HarthmereInventoryMutationResult {
  const errors: string[] = [];
  const { requestId, actorId, kind, itemId, vendorId } = req;
  const count = positiveWholeCount(req.count);

  if (!itemId) return resultFail(requestId, kind, actorId, ["missing_item_id"]);
  if (!vendorId)
    return resultFail(requestId, kind, actorId, ["missing_vendor_id"]);
  if (count === undefined)
    return resultFail(requestId, kind, actorId, ["invalid_count"]);

  const def = getHarthmereItemDefinition(itemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);

  // Quest/soulbound items cannot be sold
  if (def.isQuestItem) fail(errors, "cannot_sell_quest_item");
  if (
    def.binding === "on_pickup" ||
    def.binding === "quest" ||
    !def.tradeable
  ) {
    fail(errors, "cannot_sell_bound_item");
  }

  // Ownership check — server verifies actual possession
  const owned = availableCount(snapshot, itemId);
  if (owned < count) {
    fail(errors, "insufficient_item_count");
  }

  const entry = getHarthmereVendorEntry(vendorId, itemId);
  if (!entry || entry.sellPrice <= 0) {
    fail(errors, "vendor_does_not_buy_item");
  }

  if (errors.length > 0) return resultFail(requestId, kind, actorId, errors);

  return resultOk(requestId, kind, actorId, {
    itemDeltas: { [itemId]: -count },
    goldDelta: entry!.sellPrice * count,
    auditTags: ["vendor_sell", vendorId, itemId],
  });
}

// ---------------------------------------------------------------------------
// Use consumable item
// ---------------------------------------------------------------------------

function validateUseItem(
  req: HarthmereInventoryMutationRequest,
  snapshot: HarthmereInventorySnapshot,
  playerLevel: number
): HarthmereInventoryMutationResult {
  const errors: string[] = [];
  const { requestId, actorId, kind, itemId, nowMs } = req;
  const count = positiveWholeCount(req.count);

  if (!itemId) return resultFail(requestId, kind, actorId, ["missing_item_id"]);
  if (count === undefined)
    return resultFail(requestId, kind, actorId, ["invalid_count"]);

  const def = getHarthmereItemDefinition(itemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);
  if (!def.isConsumable && !def.isSpellTome) {
    return resultFail(requestId, kind, actorId, ["item_not_consumable"]);
  }

  // Ownership
  const owned = availableCount(snapshot, itemId);
  if (owned < count) fail(errors, "insufficient_item_count");

  // Level requirement
  if (playerLevel < def.levelRequirement)
    fail(errors, "level_requirement_not_met");

  // Consumable cooldown — server clock, not client
  if (def.consumableCooldownCategory) {
    if (
      isConsumableOnCooldown(snapshot, def.consumableCooldownCategory, nowMs!)
    ) {
      fail(errors, "consumable_on_cooldown");
    }
  }

  // Spell tome: already known? Reject the action without consuming the tome.
  if (def.isSpellTome && def.grantsAbilityId) {
    if (snapshot.knownAbilities.includes(def.grantsAbilityId)) {
      return resultFail(requestId, kind, actorId, ["spell_already_known"]);
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
    auditTags: [
      "use_item",
      itemId,
      ...(def.grantsAbilityId ? ["spell_learned"] : []),
    ],
  });
}

// ---------------------------------------------------------------------------
// Crafting
// ---------------------------------------------------------------------------

function deterministicCraftingUnit(seed: number, salt: number): number {
  let value = Math.trunc(seed + salt * 1013904223) % 2147483647;
  if (value <= 0) value += 2147483646;
  value = (value * 16807) % 2147483647;
  return (value - 1) / 2147483646;
}

function craftingSeedFromRequest(req: HarthmereInventoryMutationRequest) {
  if (Number.isFinite(req.qualitySeed)) {
    return Math.trunc(req.qualitySeed ?? 1);
  }
  const raw = `${req.requestId}:${req.actorId}:${req.recipeId}:${req.nowMs}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function craftingQualityTier(quality: number): HarthmereCraftingQualityTier {
  if (quality >= 90) return "masterwork";
  if (quality >= 75) return "excellent";
  if (quality >= 55) return "fine";
  if (quality >= 30) return "standard";
  return "rough";
}

function ownedOrEquippedCount(
  snapshot: HarthmereInventorySnapshot,
  itemId: string
) {
  const equipped = Object.values(snapshot.equipment ?? {}).filter(
    (equippedItemId) => equippedItemId === itemId
  ).length;
  return availableCount(snapshot, itemId) + equipped;
}

function craftingSkillLevel(
  playerSkills: Record<string, { level: number }>,
  skillId: string | undefined
) {
  return skillId ? Math.max(0, playerSkills[skillId]?.level ?? 0) : 0;
}

function selectedCraftingTools(
  req: HarthmereInventoryMutationRequest,
  snapshot: HarthmereInventorySnapshot
) {
  const requested = [...new Set(req.toolItemIds ?? [])];
  if (requested.length > 0) return requested;
  return [
    ...new Set([
      ...Object.keys(snapshot.items ?? {}).filter(
        (itemId) =>
          (snapshot.items[itemId] ?? 0) > 0 && getHarthmereCraftingTool(itemId)
      ),
      ...Object.values(snapshot.equipment ?? {}).filter((itemId) =>
        Boolean(getHarthmereCraftingTool(itemId))
      ),
    ]),
  ];
}

function clampCraftingMaterialEfficiencyBonus(
  optionalReagentCounts: Map<string, number>,
  optionalReagents: NonNullable<HarthmereCraftingRecipe["optionalReagents"]>
) {
  const bonus = [...optionalReagentCounts.entries()].reduce(
    (sum, [reagentId, times]) => {
      const reagent = optionalReagents.find(
        (entry) => entry.itemId === reagentId
      );
      return sum + (reagent?.materialEfficiencyBonus ?? 0) * times;
    },
    0
  );
  return Math.max(0, Math.min(0.75, bonus));
}

function applyCraftingMaterialEfficiency(
  requiredCount: number,
  efficiencyBonus: number
) {
  const count = Math.max(0, Math.trunc(requiredCount));
  if (count <= 1 || efficiencyBonus <= 0) return count;
  const saved = Math.min(count - 1, Math.floor(count * efficiencyBonus));
  return Math.max(1, count - saved);
}

function recordCraftingConsumption(
  snapshot: HarthmereInventorySnapshot,
  projectedItems: Record<string, number>,
  itemDeltas: Record<string, number>,
  materialStorageDeltas: Record<string, number>,
  itemId: string,
  requiredCount: number,
  errors: string[]
) {
  const inputDef = getHarthmereItemDefinition(itemId);
  const backpackAvailable = availableCount(
    { ...snapshot, items: projectedItems },
    itemId
  );
  const storageAvailable = inputDef?.isCraftingMaterial
    ? Math.max(0, snapshot.materialStorage?.[itemId] ?? 0)
    : 0;
  const available = backpackAvailable + storageAvailable;
  if (available < requiredCount) {
    fail(errors, `insufficient_material:${itemId}`);
  }
  const fromBackpack = Math.min(requiredCount, backpackAvailable);
  const fromMaterialStorage = Math.min(
    requiredCount - fromBackpack,
    storageAvailable
  );
  if (fromBackpack > 0) {
    itemDeltas[itemId] = (itemDeltas[itemId] ?? 0) - fromBackpack;
    applyProjectedDelta(projectedItems, itemId, -fromBackpack);
  }
  if (fromMaterialStorage > 0) {
    materialStorageDeltas[itemId] =
      (materialStorageDeltas[itemId] ?? 0) - fromMaterialStorage;
  }
}

function validateCraftItem(
  req: HarthmereInventoryMutationRequest,
  snapshot: HarthmereInventorySnapshot,
  playerLevel: number,
  playerSkills: Record<string, { level: number }>,
  allowPrepaidCraftingInputs = false
): HarthmereInventoryMutationResult {
  const errors: string[] = [];
  const { requestId, actorId, kind, recipeId } = req;
  const craftCount = positiveWholeCount(req.count);

  if (!recipeId)
    return resultFail(requestId, kind, actorId, ["missing_recipe_id"]);
  if (craftCount === undefined)
    return resultFail(requestId, kind, actorId, ["invalid_count"]);

  const recipe = getHarthmereCraftingRecipe(recipeId);
  if (!recipe)
    return resultFail(requestId, kind, actorId, ["unknown_recipe_id"]);

  const phase: HarthmereCraftingPhase = req.craftingPhase ?? "instant";
  const prepaidInputs =
    req.prepaidCraftingInputs === true && allowPrepaidCraftingInputs;
  const workflowKind = recipe.workflowKind ?? "craft";
  const stationId = normalizeHarthmereCraftingStationId(req.stationId);
  const station = getHarthmereCraftingStation(stationId);
  const stationType = station?.stationType ?? req.stationType;
  if (stationId && !station) {
    fail(errors, `unknown_station_id:${stationId}`);
  }
  if (req.prepaidCraftingInputs === true && !allowPrepaidCraftingInputs) {
    fail(errors, "prepaid_crafting_inputs_not_allowed");
  }
  if (kind === "repair_item" && workflowKind !== "repair") {
    fail(errors, "repair_requires_repair_workflow");
  }

  // Player must know the recipe — server checks knownRecipes
  if (!snapshot.knownRecipes.includes(recipeId)) {
    fail(errors, "recipe_not_known");
  }

  // Level requirement
  if (playerLevel < recipe.requiredLevel)
    fail(errors, "level_requirement_not_met");

  // Skill requirement — server-owned skill values
  if (recipe.requiredSkillId && recipe.requiredSkillLevel !== undefined) {
    const skillLevel = playerSkills[recipe.requiredSkillId]?.level ?? 0;
    if (skillLevel < recipe.requiredSkillLevel) {
      fail(errors, "skill_requirement_not_met");
    }
  }

  if (recipe.professionId && recipe.requiredProfessionLevel !== undefined) {
    const professionLevel = craftingSkillLevel(
      playerSkills,
      recipe.professionId
    );
    if (professionLevel < recipe.requiredProfessionLevel) {
      fail(errors, "profession_requirement_not_met");
    }
  }

  if (recipe.requiredStationId && stationId !== recipe.requiredStationId) {
    fail(errors, `missing_station:${recipe.requiredStationId}`);
  }
  if (
    recipe.requiredStationType &&
    stationType !== recipe.requiredStationType
  ) {
    fail(errors, `wrong_station_type:${recipe.requiredStationType}`);
  }

  const toolItemIds = selectedCraftingTools(req, snapshot);
  for (const toolId of req.toolItemIds ?? []) {
    if (ownedOrEquippedCount(snapshot, toolId) <= 0) {
      fail(errors, `tool_not_owned:${toolId}`);
    }
  }
  for (const toolId of recipe.requiredToolIds ?? []) {
    if (
      !toolItemIds.includes(toolId) ||
      ownedOrEquippedCount(snapshot, toolId) <= 0
    ) {
      fail(errors, `missing_tool:${toolId}`);
    }
  }
  for (const action of recipe.requiredToolActions ?? []) {
    const matchingTool = toolItemIds.find((itemId) => {
      const tool = getHarthmereCraftingTool(itemId);
      return (
        tool?.action === action && ownedOrEquippedCount(snapshot, itemId) > 0
      );
    });
    if (!matchingTool) fail(errors, `missing_tool_action:${action}`);
  }
  if (recipe.minToolTier !== undefined) {
    const bestTier = toolItemIds.reduce(
      (best, itemId) =>
        Math.max(best, getHarthmereCraftingTool(itemId)?.tier ?? 0),
      0
    );
    if (bestTier < recipe.minToolTier) {
      fail(errors, "tool_tier_requirement_not_met");
    }
  }

  // HARTHMERE_TOOL_DURABILITY: a BROKEN (or insufficiently-durable) tool
  // blocks the craft. Only tools that would actually be charged durability are
  // gated, and only when the snapshot reports their remaining durability (an
  // absent entry is treated as full, so callers that don't track durability are
  // unaffected).
  const perCraftToolCost = (recipe.toolDurabilityCost ?? 0) * craftCount;
  if (perCraftToolCost > 0 && snapshot.toolDurability) {
    for (const toolId of toolItemIds) {
      const chargesDurability =
        (recipe.requiredToolIds?.includes(toolId) ||
          (recipe.requiredToolActions ?? []).includes(
            getHarthmereCraftingTool(toolId)?.action ?? ""
          )) &&
        (getHarthmereItemDefinition(toolId)?.durabilityMax ??
          getHarthmereCraftingTool(toolId)?.durabilityMax ??
          0) > 0;
      if (!chargesDurability) continue;
      const remaining = snapshot.toolDurability[toolId];
      if (remaining !== undefined && remaining < perCraftToolCost) {
        fail(errors, `insufficient_tool_durability:${toolId}`);
      }
    }
  }

  const optionalReagentCounts = new Map<string, number>();
  for (const reagentId of req.optionalReagentItemIds ?? []) {
    optionalReagentCounts.set(
      reagentId,
      (optionalReagentCounts.get(reagentId) ?? 0) + 1
    );
  }
  const optionalReagents = recipe.optionalReagents ?? [];
  for (const reagentId of optionalReagentCounts.keys()) {
    if (!optionalReagents.some((entry) => entry.itemId === reagentId)) {
      fail(errors, `optional_reagent_not_allowed:${reagentId}`);
    }
  }
  const materialEfficiencyBonus = clampCraftingMaterialEfficiencyBonus(
    optionalReagentCounts,
    optionalReagents
  );

  if (recipe.questStepIds && recipe.questStepIds.length > 0) {
    const suppliedSteps = req.workflowStepIds ?? [];
    if (
      suppliedSteps.length !== recipe.questStepIds.length ||
      recipe.questStepIds.some(
        (stepId, index) => suppliedSteps[index] !== stepId
      )
    ) {
      fail(errors, "quest_crafting_steps_not_completed");
    }
  }

  const itemDeltas: Record<string, number> = {};
  const materialStorageDeltas: Record<string, number> = {};
  const projectedItems = { ...snapshot.items };

  if (!prepaidInputs && (phase === "instant" || phase === "start")) {
    if (
      (recipe.goldCost ?? 0) > 0 &&
      snapshot.gold < (recipe.goldCost ?? 0) * craftCount
    ) {
      fail(errors, "insufficient_gold");
    }
    for (const input of recipe.inputs) {
      const requiredCount = applyCraftingMaterialEfficiency(
        input.count * craftCount,
        materialEfficiencyBonus
      );
      recordCraftingConsumption(
        snapshot,
        projectedItems,
        itemDeltas,
        materialStorageDeltas,
        input.itemId,
        requiredCount,
        errors
      );
    }
    for (const input of recipe.fuelInputs ?? []) {
      recordCraftingConsumption(
        snapshot,
        projectedItems,
        itemDeltas,
        materialStorageDeltas,
        input.itemId,
        input.count * craftCount,
        errors
      );
    }
    for (const [reagentId, times] of optionalReagentCounts.entries()) {
      const reagent = optionalReagents.find(
        (entry) => entry.itemId === reagentId
      );
      if (!reagent) continue;
      recordCraftingConsumption(
        snapshot,
        projectedItems,
        itemDeltas,
        materialStorageDeltas,
        reagentId,
        reagent.count * times * craftCount,
        errors
      );
    }
  }

  if (recipe.targetItemIds && recipe.targetItemIds.length > 0) {
    if (!req.targetItemId || !recipe.targetItemIds.includes(req.targetItemId)) {
      fail(errors, "missing_or_invalid_target_item");
    } else if (
      ownedOrEquippedCount(
        { ...snapshot, items: projectedItems },
        req.targetItemId
      ) <= 0
    ) {
      fail(errors, `target_item_not_owned:${req.targetItemId}`);
    } else if (
      workflowKind === "repair" &&
      getHarthmereItemDefinition(req.targetItemId)?.repairable !== true
    ) {
      fail(errors, `target_item_not_repairable:${req.targetItemId}`);
    }
  }

  // Output inventory space
  const outputDef = getHarthmereItemDefinition(recipe.outputItemId);
  const recipeProducesOutput = recipe.outputCount * craftCount > 0;
  if (!outputDef && recipeProducesOutput) {
    fail(errors, "unknown_output_item_id");
  } else if (outputDef && recipeProducesOutput && phase !== "start") {
    const existing = projectedItems[recipe.outputItemId] ?? 0;
    const newCount = existing + recipe.outputCount * craftCount;
    if (newCount > outputDef.maxStackSize) {
      fail(errors, "output_stack_size_exceeded");
    }
    if (existing === 0 && !inventoryHasCapacity(projectedItems, 1)) {
      fail(errors, "inventory_full");
    }
  }

  if (errors.length > 0) return resultFail(requestId, kind, actorId, errors);

  const reagentQualityBonus = [...optionalReagentCounts.entries()].reduce(
    (sum, [reagentId, times]) => {
      const reagent = optionalReagents.find(
        (entry) => entry.itemId === reagentId
      );
      return sum + (reagent?.qualityBonus ?? 0) * times;
    },
    0
  );
  const reagentSuccessBonus = [...optionalReagentCounts.entries()].reduce(
    (sum, [reagentId, times]) => {
      const reagent = optionalReagents.find(
        (entry) => entry.itemId === reagentId
      );
      return sum + (reagent?.successBonus ?? 0) * times;
    },
    0
  );
  const baseSkillLevel = Math.max(
    craftingSkillLevel(playerSkills, recipe.requiredSkillId),
    craftingSkillLevel(playerSkills, recipe.professionId)
  );
  const requiredSkillFloor = Math.max(
    recipe.requiredSkillLevel ?? 0,
    recipe.requiredProfessionLevel ?? 0
  );
  const skillOverage = Math.max(0, baseSkillLevel - requiredSkillFloor);
  const seed = craftingSeedFromRequest(req);
  const successChance = Math.max(
    0,
    Math.min(
      1,
      (recipe.successChance ?? 1) + reagentSuccessBonus + skillOverage * 0.01
    )
  );
  const success =
    phase === "start"
      ? true
      : deterministicCraftingUnit(seed, 1) < successChance;
  const qualityFloor = recipe.qualityFloor ?? outputDef?.qualityFloor ?? 25;
  const qualityCeiling = recipe.qualityCeiling ?? 100;
  const quality = success
    ? Math.max(
        qualityFloor,
        Math.min(
          qualityCeiling,
          Math.trunc(
            qualityFloor +
              deterministicCraftingUnit(seed, 2) *
                (qualityCeiling - qualityFloor) +
              skillOverage * (recipe.qualitySkillScale ?? 1.5) +
              reagentQualityBonus * (recipe.qualityReagentScale ?? 1)
          )
        )
      )
    : Math.max(1, Math.min(qualityFloor, Math.trunc(qualityFloor / 2)));

  if (phase !== "start" && success) {
    if (recipe.consumeTargetOnSuccess && req.targetItemId) {
      itemDeltas[req.targetItemId] = (itemDeltas[req.targetItemId] ?? 0) - 1;
    }
    if (recipeProducesOutput) {
      itemDeltas[recipe.outputItemId] =
        (itemDeltas[recipe.outputItemId] ?? 0) +
        recipe.outputCount * craftCount;
    }
  } else if (phase !== "start" && !success) {
    const refundPercent = Math.max(
      0,
      Math.min(1, recipe.failureMaterialRefundPercent ?? 0)
    );
    if (refundPercent > 0) {
      // Refund is computed on the TOTAL consumed per item across both the backpack
      // (itemDeltas) and material-storage (materialStorageDeltas) ledgers, then
      // distributed. Flooring each ledger separately rounds a real refund down to zero
      // when a single input was split across backpack + storage (e.g. 1 + 1 at 50%
      // refunds floor(0.5)+floor(0.5)=0 instead of floor(1.0)=1).
      const consumedByItem: Record<string, number> = {};
      for (const [itemId, delta] of Object.entries(itemDeltas)) {
        if (delta < 0)
          consumedByItem[itemId] =
            (consumedByItem[itemId] ?? 0) + Math.abs(delta);
      }
      for (const [itemId, delta] of Object.entries(materialStorageDeltas)) {
        if (delta < 0)
          consumedByItem[itemId] =
            (consumedByItem[itemId] ?? 0) + Math.abs(delta);
      }
      for (const [itemId, consumed] of Object.entries(consumedByItem)) {
        let refundUnits = Math.floor(consumed * refundPercent);
        if (refundUnits <= 0) continue;
        // Return to the backpack ledger first, capped at what was taken from it; any
        // remainder goes back to material storage.
        const backpackConsumed = Math.abs(Math.min(0, itemDeltas[itemId] ?? 0));
        const toBackpack = Math.min(refundUnits, backpackConsumed);
        if (toBackpack > 0) {
          itemDeltas[itemId] = (itemDeltas[itemId] ?? 0) + toBackpack;
          refundUnits -= toBackpack;
        }
        if (refundUnits > 0 && (materialStorageDeltas[itemId] ?? 0) < 0) {
          materialStorageDeltas[itemId] =
            (materialStorageDeltas[itemId] ?? 0) + refundUnits;
        }
      }
    }
  }

  const toolDurabilityCosts = Object.fromEntries(
    toolItemIds
      .filter(
        (itemId) =>
          (recipe.requiredToolIds?.includes(itemId) ||
            (recipe.requiredToolActions ?? []).includes(
              getHarthmereCraftingTool(itemId)?.action ?? ""
            )) &&
          // Only tools with an actual durability pool may be charged durability. A recipe
          // that lists a no-durability action tool (e.g. a bucket) in requiredToolIds with
          // a toolDurabilityCost would otherwise drive a non-existent durability value
          // negative/NaN in the consumer. Durability may be declared on either the item
          // definition or the tool definition.
          (getHarthmereItemDefinition(itemId)?.durabilityMax ??
            getHarthmereCraftingTool(itemId)?.durabilityMax ??
            0) > 0
      )
      .map((itemId) => [itemId, (recipe.toolDurabilityCost ?? 0) * craftCount])
      .filter(([, cost]) => Number(cost) > 0)
  ) as Record<string, number>;
  const goldDelta =
    !prepaidInputs && (phase === "instant" || phase === "start")
      ? -Math.max(0, Math.trunc(recipe.goldCost ?? 0)) * craftCount
      : 0;
  const newRecipeIds =
    phase !== "start" && success ? recipe.teachesRecipesOnSuccess ?? [] : [];
  const outputCount =
    phase === "start" || !success ? 0 : recipe.outputCount * craftCount;
  const outcome: HarthmereCraftingOutcome = {
    recipeId,
    phase,
    success,
    outputItemId: recipe.outputItemId,
    outputCount,
    quality,
    qualityTier: craftingQualityTier(quality),
    craftedByActorId: actorId,
    stationId,
    stationType,
    toolItemIds,
    optionalReagentItemIds: [...optionalReagentCounts.keys()],
    targetItemId: req.targetItemId,
    professionId: recipe.professionId ?? recipe.requiredSkillId,
    recipeTier: recipe.recipeTier,
    materialTier: recipe.materialTier,
    durabilityMax: recipe.durabilityMax ?? outputDef?.durabilityMax,
    binding: recipe.outputBinding ?? outputDef?.binding,
    questId: recipe.questId,
    businessTypeId: recipe.businessTypeId,
    workOrderTag: recipe.workOrderTag,
    toolDurabilityCosts,
    economyTags: [
      workflowKind,
      ...(recipe.businessTypeId ? [`business:${recipe.businessTypeId}`] : []),
      ...(recipe.workOrderTag ? [`work_order:${recipe.workOrderTag}`] : []),
    ],
    readyAtMs:
      phase === "start"
        ? req.nowMs + Math.max(0, recipe.craftingTimeMs)
        : undefined,
    failureReason: success ? undefined : "crafting_roll_failed",
  };

  return resultOk(requestId, kind, actorId, {
    itemDeltas,
    materialStorageDeltas,
    goldDelta,
    newRecipeIds,
    xpDelta: phase !== "start" && success ? recipe.xpReward * craftCount : 0,
    auditTags: [
      workflowKind,
      success ? "craft_success" : "craft_failed",
      recipeId,
      recipe.outputItemId,
      ...(recipe.requiredStationId
        ? [`station:${recipe.requiredStationId}`]
        : []),
    ],
    craftingOutcome: outcome,
  });
}

// ---------------------------------------------------------------------------
// Bank transfer
// ---------------------------------------------------------------------------

function validateBankTransfer(
  req: HarthmereInventoryMutationRequest,
  snapshot: HarthmereInventorySnapshot
): HarthmereInventoryMutationResult {
  const { requestId, actorId, kind, bankItemId } = req;
  const bankCount = positiveWholeCount(req.bankCount);
  const isDeposit = kind === "transfer_to_bank";

  if (!bankItemId)
    return resultFail(requestId, kind, actorId, ["missing_item_id"]);
  if (bankCount === undefined)
    return resultFail(requestId, kind, actorId, ["invalid_count"]);

  const def = getHarthmereItemDefinition(bankItemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);

  const errors: string[] = [];

  if (isDeposit) {
    if (def.isQuestItem || def.binding === "quest") {
      fail(errors, "cannot_bank_quest_item");
    }
    const owned = availableCount(snapshot, bankItemId);
    if (owned < bankCount) fail(errors, "insufficient_item_count");
    const bankExisting = snapshot.bank[bankItemId] ?? 0;
    if (bankExisting + bankCount > def.maxStackSize)
      fail(errors, "bank_stack_size_exceeded");
    if (
      bankExisting === 0 &&
      !inventoryHasCapacity(snapshot.bank, 1, HARTHMERE_BANK_SLOTS)
    ) {
      fail(errors, "bank_full");
    }
  } else {
    // withdraw
    const banked = snapshot.bank[bankItemId] ?? 0;
    if (banked < bankCount) fail(errors, "insufficient_bank_item_count");
    const invExisting = snapshot.items[bankItemId] ?? 0;
    if (invExisting + bankCount > def.maxStackSize)
      fail(errors, "inventory_stack_size_exceeded");
    if (invExisting === 0 && !inventoryHasCapacity(snapshot.items, 1)) {
      fail(errors, "inventory_full");
    }
  }

  if (errors.length > 0) return resultFail(requestId, kind, actorId, errors);

  return resultOk(requestId, kind, actorId, {
    itemDeltas: isDeposit
      ? { [bankItemId]: -bankCount }
      : { [bankItemId]: bankCount },
    bankDeltas: isDeposit
      ? { [bankItemId]: bankCount }
      : { [bankItemId]: -bankCount },
    auditTags: [isDeposit ? "bank_deposit" : "bank_withdraw", bankItemId],
  });
}

// ---------------------------------------------------------------------------
// Quest item grant / remove (server-initiated only)
// ---------------------------------------------------------------------------

function validateGrantQuestItem(
  req: HarthmereInventoryMutationRequest,
  snapshot: HarthmereInventorySnapshot
): HarthmereInventoryMutationResult {
  const { requestId, actorId, kind, itemId, questId } = req;
  const count = positiveWholeCount(req.count);

  if (!itemId) return resultFail(requestId, kind, actorId, ["missing_item_id"]);
  if (!questId)
    return resultFail(requestId, kind, actorId, ["missing_quest_id"]);
  if (count === undefined)
    return resultFail(requestId, kind, actorId, ["invalid_count"]);

  const def = getHarthmereItemDefinition(itemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);
  if (!def.isQuestItem)
    return resultFail(requestId, kind, actorId, ["not_a_quest_item"]);

  const existing = snapshot.items[itemId] ?? 0;
  if (existing + count > def.maxStackSize) {
    return resultFail(requestId, kind, actorId, ["stack_size_exceeded"]);
  }
  if (existing === 0 && !inventoryHasCapacity(snapshot.items, 1)) {
    return resultFail(requestId, kind, actorId, ["inventory_full"]);
  }

  return resultOk(requestId, kind, actorId, {
    itemDeltas: { [itemId]: count },
    auditTags: ["grant_quest_item", questId, itemId],
  });
}

function validateRemoveQuestItem(
  req: HarthmereInventoryMutationRequest,
  snapshot: HarthmereInventorySnapshot
): HarthmereInventoryMutationResult {
  const { requestId, actorId, kind, itemId, questId } = req;
  const count = positiveWholeCount(req.count);

  if (!itemId) return resultFail(requestId, kind, actorId, ["missing_item_id"]);
  if (!questId)
    return resultFail(requestId, kind, actorId, ["missing_quest_id"]);
  if (count === undefined)
    return resultFail(requestId, kind, actorId, ["invalid_count"]);

  const def = getHarthmereItemDefinition(itemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);
  if (!def.isQuestItem)
    return resultFail(requestId, kind, actorId, ["not_a_quest_item"]);

  const owned = (snapshot.items[itemId] ?? 0) + (snapshot.bank[itemId] ?? 0);
  if (owned < count) {
    // Warn but don't hard-fail; quest system should handle gracefully
    return resultOk(requestId, kind, actorId, {
      warnings: ["quest_item_count_mismatch_on_remove"],
      auditTags: ["remove_quest_item_warn", questId, itemId],
    });
  }

  let remaining = count;
  const fromItems = Math.min(remaining, snapshot.items[itemId] ?? 0);
  remaining -= fromItems;
  const fromBank = Math.min(remaining, snapshot.bank[itemId] ?? 0);

  return resultOk(requestId, kind, actorId, {
    itemDeltas: fromItems > 0 ? { [itemId]: -fromItems } : {},
    bankDeltas: fromBank > 0 ? { [itemId]: -fromBank } : {},
    auditTags: ["remove_quest_item", questId, itemId],
  });
}

// ---------------------------------------------------------------------------
// Pickup / loot claim
// ---------------------------------------------------------------------------

function validatePickupItem(
  req: HarthmereInventoryMutationRequest,
  snapshot: HarthmereInventorySnapshot
): HarthmereInventoryMutationResult {
  const { requestId, actorId, kind, itemId } = req;
  const count = positiveWholeCount(req.count);
  if (!itemId) return resultFail(requestId, kind, actorId, ["missing_item_id"]);
  if (count === undefined)
    return resultFail(requestId, kind, actorId, ["invalid_count"]);

  const def = getHarthmereItemDefinition(itemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);

  if (def.isCurrency) {
    return resultOk(requestId, kind, actorId, {
      goldDelta: count,
      auditTags: ["pickup_currency", itemId],
    });
  }

  const errors: string[] = [];
  const existing = snapshot.items[itemId] ?? 0;
  const newCount = existing + count;
  if (newCount > def.maxStackSize) {
    fail(errors, "stack_size_exceeded");
  }
  if (existing === 0 && !inventoryHasCapacity(snapshot.items, 1)) {
    fail(errors, "inventory_full");
  }

  if (errors.length > 0) return resultFail(requestId, kind, actorId, errors);

  return resultOk(requestId, kind, actorId, {
    itemDeltas: { [itemId]: count },
    auditTags: ["pickup_item", itemId],
  });
}

// ---------------------------------------------------------------------------
// Equipment / drop / destroy
// ---------------------------------------------------------------------------

function validateEquipItem(
  req: HarthmereInventoryMutationRequest,
  snapshot: HarthmereInventorySnapshot,
  playerLevel: number,
  playerClassId?: string
): HarthmereInventoryMutationResult {
  const { requestId, actorId, kind, itemId, targetSlot } = req;
  if (!itemId) return resultFail(requestId, kind, actorId, ["missing_item_id"]);
  if (!targetSlot)
    return resultFail(requestId, kind, actorId, ["missing_target_slot"]);

  const def = getHarthmereItemDefinition(itemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);
  const errors: string[] = [];

  if (
    def.isQuestItem ||
    def.isCurrency ||
    def.isCraftingMaterial ||
    def.isConsumable ||
    def.isSpellTome
  ) {
    fail(errors, "item_not_equippable");
  }
  const allowedSlots = harthmereAllowedEquipmentSlots(def);
  if (
    !HARTHMERE_EQUIPMENT_SLOTS.includes(targetSlot as HarthmereEquipmentSlot)
  ) {
    fail(errors, "unknown_equipment_slot");
  } else if (!allowedSlots.includes(targetSlot as HarthmereEquipmentSlot)) {
    fail(errors, "item_not_equippable_in_slot");
  }
  if (playerLevel < def.levelRequirement)
    fail(errors, "level_requirement_not_met");
  // Enforce class-restricted equipment. Only checked when the caller supplies the class
  // (the live path always does); without it we cannot determine eligibility so we skip.
  if (
    def.classRestriction.length > 0 &&
    playerClassId &&
    !def.classRestriction.includes(playerClassId)
  ) {
    fail(errors, "class_requirement_not_met");
  }
  // Two-handed weapons and off-hand items are mutually exclusive: a two-hander needs both
  // hands. Equipping either while the other slot is occupied is rejected (the player must
  // unequip the conflicting item first).
  const HARTHMERE_MAIN_HAND_SLOT = "main_hand";
  const HARTHMERE_OFF_HAND_SLOT = "off_hand";
  if (
    def.twoHanded &&
    targetSlot === HARTHMERE_MAIN_HAND_SLOT &&
    snapshot.equipment[HARTHMERE_OFF_HAND_SLOT]
  ) {
    fail(errors, "off_hand_must_be_empty_for_two_handed");
  }
  if (targetSlot === HARTHMERE_OFF_HAND_SLOT) {
    const mainHandItemId = snapshot.equipment[HARTHMERE_MAIN_HAND_SLOT];
    const mainHandDef = mainHandItemId
      ? getHarthmereItemDefinition(mainHandItemId)
      : undefined;
    if (mainHandDef?.twoHanded) {
      fail(errors, "two_handed_weapon_blocks_off_hand");
    }
  }
  if (availableCount(snapshot, itemId) < 1)
    fail(errors, "insufficient_item_count");

  const currentlyEquipped = snapshot.equipment[targetSlot];
  if (currentlyEquipped === itemId) {
    return resultOk(requestId, kind, actorId, {
      warnings: ["item_already_equipped"],
      auditTags: ["equip_item_noop", targetSlot, itemId],
    });
  }

  const projected = { ...snapshot.items };
  applyProjectedDelta(projected, itemId, -1);
  if (currentlyEquipped) {
    const oldDef = getHarthmereItemDefinition(currentlyEquipped);
    if (!oldDef) {
      fail(errors, "unknown_equipped_item_id");
    } else if ((projected[currentlyEquipped] ?? 0) + 1 > oldDef.maxStackSize) {
      fail(errors, "inventory_stack_size_exceeded");
    } else {
      applyProjectedDelta(projected, currentlyEquipped, 1);
    }
  }
  if (countInventorySlots(projected) > HARTHMERE_DEFAULT_INVENTORY_SLOTS) {
    fail(errors, "inventory_full");
  }

  if (errors.length > 0) return resultFail(requestId, kind, actorId, errors);

  return resultOk(requestId, kind, actorId, {
    itemDeltas: {
      [itemId]: -1,
      ...(currentlyEquipped ? { [currentlyEquipped]: 1 } : {}),
    },
    equipmentChanges: { [targetSlot]: itemId },
    auditTags: ["equip_item", targetSlot, itemId],
  });
}

function validateUnequipItem(
  req: HarthmereInventoryMutationRequest,
  snapshot: HarthmereInventorySnapshot
): HarthmereInventoryMutationResult {
  const { requestId, actorId, kind } = req;
  const slot = req.sourceSlot ?? req.targetSlot;
  if (!slot)
    return resultFail(requestId, kind, actorId, ["missing_source_slot"]);

  const itemId = snapshot.equipment[slot];
  if (!itemId)
    return resultFail(requestId, kind, actorId, ["equipment_slot_empty"]);
  const def = getHarthmereItemDefinition(itemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);

  const existing = snapshot.items[itemId] ?? 0;
  const errors: string[] = [];
  if (existing + 1 > def.maxStackSize)
    fail(errors, "inventory_stack_size_exceeded");
  if (existing === 0 && !inventoryHasCapacity(snapshot.items, 1))
    fail(errors, "inventory_full");
  if (errors.length > 0) return resultFail(requestId, kind, actorId, errors);

  return resultOk(requestId, kind, actorId, {
    itemDeltas: { [itemId]: 1 },
    equipmentChanges: { [slot]: undefined },
    auditTags: ["unequip_item", slot, itemId],
  });
}

function validateRemoveCarriedItem(
  req: HarthmereInventoryMutationRequest,
  snapshot: HarthmereInventorySnapshot
): HarthmereInventoryMutationResult {
  const { requestId, actorId, kind, itemId } = req;
  const count = positiveWholeCount(req.count);
  if (!itemId) return resultFail(requestId, kind, actorId, ["missing_item_id"]);
  if (count === undefined)
    return resultFail(requestId, kind, actorId, ["invalid_count"]);

  const def = getHarthmereItemDefinition(itemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);
  const errors: string[] = [];
  if (def.isCurrency) fail(errors, "cannot_remove_wallet_currency_as_item");
  if (def.isQuestItem || def.binding === "quest") {
    fail(
      errors,
      kind === "drop_item"
        ? "cannot_drop_quest_item"
        : "cannot_destroy_quest_item"
    );
  }
  const sourceSlot = String(req.sourceSlot ?? "");
  const fromMaterialStorage = sourceSlot === "material_storage";
  if (fromMaterialStorage) {
    if ((snapshot.materialStorage?.[itemId] ?? 0) < count) {
      fail(errors, "insufficient_item_count");
    }
  } else if (availableCount(snapshot, itemId) < count) {
    fail(errors, "insufficient_item_count");
  }
  if (errors.length > 0) return resultFail(requestId, kind, actorId, errors);

  return resultOk(requestId, kind, actorId, {
    itemDeltas: fromMaterialStorage ? {} : { [itemId]: -count },
    materialStorageDeltas: fromMaterialStorage ? { [itemId]: -count } : {},
    auditTags: [kind, itemId],
  });
}

// ---------------------------------------------------------------------------
// Admin grant (no inventory restriction checks — must validate caller auth separately)
// ---------------------------------------------------------------------------

function validateAdminGrant(
  req: HarthmereInventoryMutationRequest,
  _snapshot: HarthmereInventorySnapshot
): HarthmereInventoryMutationResult {
  const { requestId, actorId, kind, itemId } = req;
  const count = positiveWholeCount(req.count);
  if (!itemId) return resultFail(requestId, kind, actorId, ["missing_item_id"]);
  if (count === undefined)
    return resultFail(requestId, kind, actorId, ["invalid_count"]);
  const def = getHarthmereItemDefinition(itemId);
  if (!def) return resultFail(requestId, kind, actorId, ["unknown_item_id"]);

  if (def.isCurrency) {
    return resultOk(requestId, kind, actorId, {
      goldDelta: count,
      auditTags: ["admin_grant_currency", itemId],
    });
  }

  return resultOk(requestId, kind, actorId, {
    itemDeltas: { [itemId]: count },
    auditTags: ["admin_grant", itemId],
  });
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

export interface HarthmereInventoryMutationContext {
  snapshot: HarthmereInventorySnapshot;
  playerLevel: number;
  playerSkills: Record<string, { level: number }>;
  /** Server-owned reputation — never trust client */
  reputation: Record<string, number>;
  /** Server-owned class id, used to enforce equipment classRestriction. When absent,
   *  class-restriction enforcement is skipped (the caller could not determine the class). */
  playerClassId?: string;
  /** Internal server-only escape hatch for timed job completion after inputs were reserved. */
  allowPrepaidCraftingInputs?: boolean;
}

export function reduceHarthmereInventoryMutation(
  req: HarthmereInventoryMutationRequest,
  ctx: HarthmereInventoryMutationContext
): HarthmereInventoryMutationResult {
  const {
    snapshot,
    playerLevel,
    playerSkills,
    reputation,
    playerClassId,
    allowPrepaidCraftingInputs,
  } = ctx;

  switch (req.kind) {
    case "pickup_item":
      return validatePickupItem(req, snapshot);

    case "equip_item":
      return validateEquipItem(req, snapshot, playerLevel, playerClassId);

    case "unequip_item":
      return validateUnequipItem(req, snapshot);

    case "drop_item":
    case "destroy_item":
      return validateRemoveCarriedItem(req, snapshot);

    case "buy_from_vendor":
      return validateVendorBuy(req, snapshot, reputation);

    case "sell_to_vendor":
      return validateVendorSell(req, snapshot);

    case "use_item":
    case "learn_spell_from_tome":
      return validateUseItem(req, snapshot, playerLevel);

    case "craft_item":
    case "repair_item":
      return validateCraftItem(
        req,
        snapshot,
        playerLevel,
        playerSkills,
        allowPrepaidCraftingInputs === true
      );

    case "transfer_to_bank":
    case "withdraw_from_bank":
      return validateBankTransfer(req, snapshot);

    case "grant_quest_item":
      return validateGrantQuestItem(req, snapshot);

    case "remove_quest_item":
      return validateRemoveQuestItem(req, snapshot);

    case "admin_grant":
      return validateAdminGrant(req, snapshot);

    // Declared but not yet implemented. Returning a permissive ok:true passthrough here
    // is dangerous: a caller that builds its own deltas from a "validated ok" split/merge
    // result can be driven to duplicate or lose items. Until real validation exists these
    // must hard-fail rather than silently succeed. (Currently no caller issues them.)
    case "stack_items":
    case "split_stack":
      return resultFail(req.requestId, req.kind, req.actorId, [
        `mutation_kind_not_implemented:${req.kind}`,
      ]);

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

export function applyHarthmereInventoryMutationResult(
  snapshot: HarthmereInventorySnapshot,
  result: HarthmereInventoryMutationResult
): HarthmereInventorySnapshot {
  if (!result.ok) return snapshot;

  const next: HarthmereInventorySnapshot = {
    ...snapshot,
    gold: Math.max(0, snapshot.gold + result.goldDelta),
    items: { ...snapshot.items },
    bank: { ...snapshot.bank },
    materialStorage: { ...(snapshot.materialStorage ?? {}) },
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

  for (const [itemId, delta] of Object.entries(
    result.materialStorageDeltas ?? {}
  )) {
    const materialStorage = next.materialStorage ?? (next.materialStorage = {});
    const newCount = Math.max(0, (materialStorage[itemId] ?? 0) + delta);
    if (newCount === 0) {
      delete materialStorage[itemId];
    } else {
      materialStorage[itemId] = newCount;
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

  for (const [category, expiresAt] of Object.entries(
    result.newConsumableCooldowns
  )) {
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
