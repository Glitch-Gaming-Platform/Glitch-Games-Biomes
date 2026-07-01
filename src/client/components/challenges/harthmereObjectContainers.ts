import { grantHarthmereItem } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { consumeHarthmereItemByItemId } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { completeHarthmereDailyTaskSoon } from "@/client/components/challenges/harthmereDailyTasks";
import { dispatchHarthmereWorldObjectInteractionEvent } from "@/client/components/challenges/harthmereObjectInteractions";
import { harthmereUserScopedStorageKey } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import { harthmereLocalStorage } from "@/client/util/storage";
import type { BiomesId } from "@/shared/ids";

export const HARTHMERE_OBJECT_CONTAINER_OPENED_EVENT =
  "biomes:harthmere-object-container-opened";

// HARTHMERE_OBJECT_CONTAINER_UI:
// Fired whenever the contents of any world-object container change (item taken
// out or stored in). The container panel subscribes to re-render.
export const HARTHMERE_OBJECT_CONTAINER_CHANGED_EVENT =
  "biomes:harthmere-object-container-changed";

// Fired when the player presses the container interaction; the mounted
// container panel listens and opens the take/store interface.
export const HARTHMERE_OBJECT_CONTAINER_OPEN_EVENT =
  "biomes:harthmere-object-container-open";

export const HARTHMERE_OBJECT_CONTAINER_CONTENTS_KEY =
  "biomes.localDev.harthmere.objectContainerContents";

const HARTHMERE_OBJECT_CONTAINER_OPEN_REQUEST_KEY =
  "biomes.localDev.harthmere.objectContainerOpenRequest";

export interface HarthmereObjectContainerLoot {
  itemId: string;
  quantity: number;
}

export interface HarthmereObjectContainerSlot {
  itemId: string;
  quantity: number;
}

export interface HarthmereObjectContainerRecord {
  key: string;
  label: string;
  items: HarthmereObjectContainerSlot[];
  // HARTHMERE_ROAD_AHEAD_CLOTHING_GATE: a quest-gated crate (e.g. the Road
  // Ahead Clothing Crate) starts UNSEALED and empty; it only gets its quest loot
  // — and becomes sealed — once the quest reaches the right step. A sealed crate
  // is a normal inventory (take/store, never re-seeded). Non-gated crates seal on
  // first open. `note` is shown in the panel while a crate is locked/empty.
  sealed?: boolean;
  note?: string;
  // One-shot marker for quest loot migrations/backfills. Older saves do not
  // have this, so repair logic must also look at the actual contents.
  questLootVersion?: string;
}

export interface HarthmereObjectContainerOpenRequest {
  entityId: BiomesId;
  key: string;
  label: string;
}

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

export function normalizeHarthmereContainerKey(
  entityId: BiomesId,
  label: string
) {
  const normalizedLabel = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${entityId}:${normalizedLabel || "container"}`;
}

function objectContainerContentsStorageKey() {
  return harthmereUserScopedStorageKey(HARTHMERE_OBJECT_CONTAINER_CONTENTS_KEY);
}

// HARTHMERE_ROAD_AHEAD_CLOTHING_GATE: the Clothing Crate is quest-gated — its
// contents must not appear until The Road Ahead has passed the Billy/Muckwad
// handoff. This is the same family of labels the loot table routes to the
// clothing outfit.
const HARTHMERE_CLOTHING_QUEST_CRATE_RE =
  /clothing|wardrobe|outfit|garment|laundry/;

export function isHarthmereClothingQuestCrateLabel(
  label?: string | null
): boolean {
  return HARTHMERE_CLOTHING_QUEST_CRATE_RE.test((label ?? "").toLowerCase());
}

export const HARTHMERE_CLOTHING_CRATE_LOCKED_NOTE =
  "This crate is empty for now. Billy or Jackie will point you here when it's time to gear up on The Road Ahead.";

const HARTHMERE_ROAD_AHEAD_CLOTHING_LOOT_VERSION = "road-ahead-clothing-outfit";

const HARTHMERE_CLOTHING_QUEST_REQUIRED_ITEM_IDS = [
  "baker_apron",
  "field_trousers",
];

export function harthmereContainerLootForLabel(
  label?: string | null
): HarthmereObjectContainerLoot[] {
  const text = (label ?? "").toLowerCase();
  if (HARTHMERE_CLOTHING_QUEST_CRATE_RE.test(text)) {
    // A full starter outfit: a top (chest) AND bottoms (legs). The Road Ahead
    // "equip both clothing slots" step requires both halves, so the clothing
    // container must grant both — otherwise the quest can never complete from
    // the crate. See hasRequiredClothing in LocalDevSnapshotMissionBridge.
    return [
      { itemId: "baker_apron", quantity: 1 },
      { itemId: "field_trousers", quantity: 1 },
      { itemId: "cloth_scrap", quantity: 4 },
    ];
  }
  // Mail/bank intent (e.g. "Kit's Mailbag Stand") must win over the tool branch,
  // whose "kit" keyword would otherwise match the courier's name.
  if (/mail|bank|courier|postage|parcel|deposit/.test(text)) {
    return [
      { itemId: "old_coin", quantity: 3 },
      { itemId: "iron_key_blank", quantity: 1 },
    ];
  }
  if (/toolbag|tool|repair|kit/.test(text)) {
    return [
      { itemId: "woodcutters_axe", quantity: 1 },
      { itemId: "rough_stone", quantity: 3 },
      { itemId: "scrap_metal", quantity: 2 },
    ];
  }
  if (/underwater|waterproof|water|dock|river|fishing/.test(text)) {
    return [
      { itemId: "clean_water", quantity: 3 },
      { itemId: "river_trout", quantity: 2 },
    ];
  }
  if (/key|lock|strongbox|lockbox/.test(text)) {
    return [
      { itemId: "iron_key_blank", quantity: 1 },
      { itemId: "scrap_metal", quantity: 2 },
    ];
  }
  if (/first.?aid|bandage|medicine|medical|infirmary|salve|healer/.test(text)) {
    return [
      { itemId: "minor_healing_salve", quantity: 2 },
      { itemId: "cloth_scrap", quantity: 2 },
    ];
  }
  if (/food|ration|satchel|bag|basket/.test(text)) {
    return [
      { itemId: "road_ration", quantity: 3 },
      { itemId: "wild_berries", quantity: 2 },
    ];
  }
  return [
    { itemId: "road_ration", quantity: 1 },
    { itemId: "rough_stone", quantity: 2 },
    { itemId: "cloth_scrap", quantity: 2 },
  ];
}

function parseContainerStore(
  raw: string | null
): Record<string, HarthmereObjectContainerRecord> | undefined {
  if (!raw) {
    return undefined;
  }
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  return parsed as Record<string, HarthmereObjectContainerRecord>;
}

// HARTHMERE_CONTAINER_STORAGE (2026-07-01): reference migration to the portable
// storage layer (see src/client/util/storage/README.md). The container/crate
// contents used to persist through raw `window.localStorage`, whose UNGUARDED
// write threw a SecurityError in the cross-origin glitch.fun iframe — so opening
// the quest-gated Clothing Crate seeded its loot, then threw while persisting,
// leaving the player with no clothing and the "equip both clothing slots"
// objective impossible to complete. `harthmereLocalStorage` is a drop-in with the
// same synchronous API that NEVER throws: it serves an in-memory cache in the
// iframe (so the crate works this session) and best-effort persists to
// localStorage / Glitch Cloud Save when the browser allows it.
function readContainerStore(): Record<string, HarthmereObjectContainerRecord> {
  const scopedKey = objectContainerContentsStorageKey();
  const scoped = parseContainerStore(harthmereLocalStorage.getItem(scopedKey));
  if (scoped !== undefined) {
    return scoped;
  }
  const legacy = parseContainerStore(
    harthmereLocalStorage.getItem(HARTHMERE_OBJECT_CONTAINER_CONTENTS_KEY)
  );
  if (legacy !== undefined) {
    // Migrate old unscoped browser saves once. After this, container contents
    // are per cloud-save user so one player cannot consume another's quest box.
    harthmereLocalStorage.setItem(scopedKey, JSON.stringify(legacy));
    return legacy;
  }
  return {};
}

function writeContainerStore(
  store: Record<string, HarthmereObjectContainerRecord>
) {
  // Never throws; persists when the browser allows and always keeps the value in
  // the in-memory cache so the crate works this session even in a blocked iframe.
  harthmereLocalStorage.setItem(
    objectContainerContentsStorageKey(),
    JSON.stringify(store)
  );
  // Fire the change event regardless of persistence so the inventory/UI updates.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(HARTHMERE_OBJECT_CONTAINER_CHANGED_EVENT));
  }
}

export interface HarthmereContainerSeedOptions {
  // HARTHMERE_ROAD_AHEAD_CLOTHING_GATE: whether the Road Ahead clothing is
  // allowed to appear yet. Injectable for tests; defaults to reading the live
  // mission state from localStorage.
  questClothingReady?: boolean;
}

function roadAheadClothingCrateReadyForContainer(
  options?: HarthmereContainerSeedOptions
) {
  // The crate is a progression-critical recovery point. Tests can still force
  // the pre-handoff locked state, but live players should never be stranded by a
  // missing or stale local mission mirror.
  if (options?.questClothingReady !== undefined) {
    return options.questClothingReady;
  }
  return true;
}

function lootSlotsForLabel(label: string): HarthmereObjectContainerSlot[] {
  return harthmereContainerLootForLabel(label).map((loot) => ({
    itemId: loot.itemId,
    quantity: loot.quantity,
  }));
}

function isRequiredClothingQuestItemId(itemId: string): boolean {
  return HARTHMERE_CLOTHING_QUEST_REQUIRED_ITEM_IDS.includes(itemId);
}

function containerItemQuantity(
  items: HarthmereObjectContainerSlot[],
  itemId: string
): number {
  return items
    .filter((slot) => slot.itemId === itemId)
    .reduce((sum, slot) => sum + Math.max(0, slot.quantity), 0);
}

function missingRequiredClothingQuestLootSlots(
  label: string,
  items: HarthmereObjectContainerSlot[]
): HarthmereObjectContainerSlot[] {
  return lootSlotsForLabel(label)
    .filter((slot) => isRequiredClothingQuestItemId(slot.itemId))
    .map((slot) => ({
      itemId: slot.itemId,
      quantity: slot.quantity - containerItemQuantity(items, slot.itemId),
    }))
    .filter((slot) => slot.quantity > 0);
}

function backfillLegacySealedRoadAheadClothingCrate(
  record: HarthmereObjectContainerRecord
): HarthmereObjectContainerRecord | undefined {
  const items = record.items ?? [];
  if (
    !record.sealed ||
    record.questLootVersion === HARTHMERE_ROAD_AHEAD_CLOTHING_LOOT_VERSION
  ) {
    return undefined;
  }
  const missing = missingRequiredClothingQuestLootSlots(record.label, items);
  if (missing.length <= 0 && !record.note) {
    return undefined;
  }
  return {
    ...record,
    items: missing.length > 0 ? mergeContainerSlots(items, missing) : items,
    sealed: true,
    note: undefined,
    questLootVersion: HARTHMERE_ROAD_AHEAD_CLOTHING_LOOT_VERSION,
  };
}

// Returns the live record for a container, seeding it from the label-driven
// loot table. Presence of a SEALED key in the store means the container has
// already been seeded, so emptying it does NOT refill it.
//
// Quest-gated crates (the Road Ahead Clothing Crate) are special: until the
// quest reaches the post-Muckwad handoff they stay UNSEALED and empty
// (re-evaluated each open), so the clothing only appears at the right time. Once
// the gate opens we fill the quest loot and seal the crate; from then on it is a
// normal inventory.
export function getOrSeedHarthmereContainer(
  entityId: BiomesId,
  label?: string | null,
  options?: HarthmereContainerSeedOptions
): HarthmereObjectContainerRecord {
  const displayLabel = label?.trim() || "Container";
  const key = normalizeHarthmereContainerKey(entityId, displayLabel);
  const store = readContainerStore();
  const existing = store[key];

  if (!isHarthmereClothingQuestCrateLabel(displayLabel)) {
    // Ordinary container: seed once and seal.
    if (existing) {
      return existing;
    }
    const seeded: HarthmereObjectContainerRecord = {
      key,
      label: displayLabel,
      items: lootSlotsForLabel(displayLabel),
      sealed: true,
    };
    store[key] = seeded;
    writeContainerStore(store);
    return seeded;
  }

  // Quest-gated clothing crate.
  const ready = roadAheadClothingCrateReadyForContainer(options);
  if (existing?.sealed) {
    if (ready) {
      const repaired = backfillLegacySealedRoadAheadClothingCrate(existing);
      if (repaired) {
        store[key] = repaired;
        writeContainerStore(store);
        return repaired;
      }
    }
    // Already filled (the gate opened on a previous interaction); behave normally.
    return existing;
  }
  // Preserve anything the player may have stored into the open (unsealed) crate.
  const carriedItems = existing?.items ?? [];

  if (!ready) {
    const locked: HarthmereObjectContainerRecord = {
      key,
      label: displayLabel,
      items: carriedItems,
      sealed: false,
      note: HARTHMERE_CLOTHING_CRATE_LOCKED_NOTE,
    };
    store[key] = locked;
    writeContainerStore(store);
    return locked;
  }

  // The right time: merge the quest loot into whatever is already there, seal it.
  const merged = mergeContainerSlots(
    carriedItems,
    lootSlotsForLabel(displayLabel)
  );
  const filled: HarthmereObjectContainerRecord = {
    key,
    label: displayLabel,
    items: merged,
    sealed: true,
    questLootVersion: HARTHMERE_ROAD_AHEAD_CLOTHING_LOOT_VERSION,
  };
  store[key] = filled;
  writeContainerStore(store);
  return filled;
}

function mergeContainerSlots(
  base: HarthmereObjectContainerSlot[],
  add: HarthmereObjectContainerSlot[]
): HarthmereObjectContainerSlot[] {
  const merged = base.map((slot) => ({ ...slot }));
  for (const slot of add) {
    const existing = merged.find((s) => s.itemId === slot.itemId);
    if (existing) {
      existing.quantity += slot.quantity;
    } else {
      merged.push({ ...slot });
    }
  }
  return merged;
}

export function readHarthmereContainer(
  key: string
): HarthmereObjectContainerRecord | undefined {
  return readContainerStore()[key];
}

// Called by the Road Ahead bridge when the Billy/Muckwad handoff advances. If a
// player already opened the Clothing Crate while it was locked, this fills that
// known unsealed record immediately instead of waiting for a close/reopen.
export function fillKnownRoadAheadClothingCrates(
  options?: HarthmereContainerSeedOptions
): HarthmereObjectContainerRecord[] {
  const ready = roadAheadClothingCrateReadyForContainer(options);
  if (!ready) {
    return [];
  }
  const store = readContainerStore();
  const filled: HarthmereObjectContainerRecord[] = [];
  for (const [key, record] of Object.entries(store)) {
    if (!isHarthmereClothingQuestCrateLabel(record.label)) {
      continue;
    }
    const next = record.sealed
      ? backfillLegacySealedRoadAheadClothingCrate(record)
      : ({
          ...record,
          items: mergeContainerSlots(
            record.items ?? [],
            lootSlotsForLabel(record.label)
          ),
          sealed: true,
          note: undefined,
          questLootVersion: HARTHMERE_ROAD_AHEAD_CLOTHING_LOOT_VERSION,
        } satisfies HarthmereObjectContainerRecord);
    if (!next) {
      continue;
    }
    store[key] = next;
    filled.push(next);
  }
  if (filled.length > 0) {
    writeContainerStore(store);
  }
  return filled;
}

// Move `quantity` of `itemId` from the container into the player inventory.
// grantHarthmereItem routes the item to the correct storage (backpack,
// material storage, quest pouch, keyring) by category. Returns amount taken.
export function takeFromHarthmereContainer(
  key: string,
  itemId: string,
  quantity = 1
): number {
  const store = readContainerStore();
  const record = store[key];
  if (!record || quantity <= 0) {
    return 0;
  }
  let remaining = quantity;
  let taken = 0;
  const items = record.items.map((slot) => ({ ...slot }));
  for (const slot of items) {
    if (slot.itemId !== itemId || remaining <= 0) {
      continue;
    }
    const move = Math.min(slot.quantity, remaining);
    slot.quantity -= move;
    remaining -= move;
    taken += move;
  }
  if (taken <= 0) {
    return 0;
  }
  record.items = items.filter((slot) => slot.quantity > 0);
  store[key] = record;
  writeContainerStore(store);
  grantHarthmereItem(itemId, taken, `${record.label} contents`);
  return taken;
}

export function takeAllFromHarthmereContainer(key: string): number {
  const record = readHarthmereContainer(key);
  if (!record) {
    return 0;
  }
  let total = 0;
  // Snapshot ids first; each take mutates the stored record.
  const slots = record.items.map((slot) => ({ ...slot }));
  for (const slot of slots) {
    total += takeFromHarthmereContainer(key, slot.itemId, slot.quantity);
  }
  return total;
}

// Move `quantity` of `itemId` from the player inventory into the container.
// Returns the amount actually stored (limited by what the player holds).
export function putIntoHarthmereContainer(
  key: string,
  itemId: string,
  quantity = 1
): number {
  const store = readContainerStore();
  const record = store[key];
  if (!record || quantity <= 0) {
    return 0;
  }
  const removed = consumeHarthmereItemByItemId(
    itemId,
    quantity,
    `Stored in ${record.label}`
  );
  if (removed <= 0) {
    return 0;
  }
  const existing = record.items.find((slot) => slot.itemId === itemId);
  if (existing) {
    existing.quantity += removed;
  } else {
    record.items = [...record.items, { itemId, quantity: removed }];
  }
  store[key] = record;
  writeContainerStore(store);
  return removed;
}

export function readHarthmereContainerOpenRequest():
  | HarthmereObjectContainerOpenRequest
  | undefined {
  if (!isBrowser()) {
    return undefined;
  }
  try {
    const raw = harthmereLocalStorage.getItem(
      HARTHMERE_OBJECT_CONTAINER_OPEN_REQUEST_KEY
    );
    if (!raw) {
      return undefined;
    }
    const parsed = JSON.parse(raw) as HarthmereObjectContainerOpenRequest;
    if (parsed && typeof parsed.key === "string") {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function clearHarthmereContainerOpenRequest() {
  if (!isBrowser()) {
    return;
  }
  harthmereLocalStorage.removeItem(HARTHMERE_OBJECT_CONTAINER_OPEN_REQUEST_KEY);
}

// HARTHMERE_OBJECT_CONTAINER_UI:
// Opening a container is now a UI action: it seeds the container (first time),
// runs any label-driven daily-task hooks, and asks the mounted panel to show
// the take/store interface. It no longer one-shot-grants loot and no longer
// marks the container "searched" — the player decides what to take or store.
export function openHarthmereObjectContainer({
  entityId,
  label,
}: {
  entityId: BiomesId;
  label?: string | null;
  // Accepted for call-site compatibility; the panel is the feedback surface.
  resources?: unknown;
}) {
  const displayLabel = label?.trim() || "Container";
  const record = getOrSeedHarthmereContainer(entityId, displayLabel);

  const labelText = displayLabel.toLowerCase();
  if (/food|ration|satchel|bag|basket|berries|forage/.test(labelText)) {
    completeHarthmereDailyTaskSoon("forage_walk");
  }
  if (/tool|repair|kit|crate|box|chest|container/.test(labelText)) {
    completeHarthmereDailyTaskSoon("home_care");
  }

  dispatchHarthmereWorldObjectInteractionEvent({
    entityId,
    label: displayLabel,
    kind: "open_container",
    title: "Open Container",
  });

  const request: HarthmereObjectContainerOpenRequest = {
    entityId,
    key: record.key,
    label: displayLabel,
  };
  if (isBrowser()) {
    harthmereLocalStorage.setItem(
      HARTHMERE_OBJECT_CONTAINER_OPEN_REQUEST_KEY,
      JSON.stringify(request)
    );
    window.dispatchEvent(
      new CustomEvent(HARTHMERE_OBJECT_CONTAINER_OPEN_EVENT, {
        detail: request,
      })
    );
  }
}
