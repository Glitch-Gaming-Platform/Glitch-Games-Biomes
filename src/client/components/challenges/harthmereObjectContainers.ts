import { grantHarthmereItem } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { consumeHarthmereItemByItemIdV141 } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { completeHarthmereDailyTaskSoonV1 } from "@/client/components/challenges/harthmereDailyTasks";
import { dispatchHarthmereWorldObjectInteractionEventV1 } from "@/client/components/challenges/harthmereObjectInteractions";
import { readRoadAheadClothingCrateReadyV1 } from "@/client/components/challenges/harthmereRoadAheadClothingGate";
import type { BiomesId } from "@/shared/ids";

export const HARTHMERE_OBJECT_CONTAINER_OPENED_EVENT_V1 =
  "biomes:harthmere-object-container-opened-v1";

// HARTHMERE_OBJECT_CONTAINER_UI_V199:
// Fired whenever the contents of any world-object container change (item taken
// out or stored in). The container panel subscribes to re-render.
export const HARTHMERE_OBJECT_CONTAINER_CHANGED_EVENT_V1 =
  "biomes:harthmere-object-container-changed-v1";

// Fired when the player presses the container interaction; the mounted
// container panel listens and opens the take/store interface.
export const HARTHMERE_OBJECT_CONTAINER_OPEN_EVENT_V1 =
  "biomes:harthmere-object-container-open-v1";

const HARTHMERE_OBJECT_CONTAINER_CONTENTS_KEY_V1 =
  "biomes.localDev.harthmere.objectContainerContents.v1";

const HARTHMERE_OBJECT_CONTAINER_OPEN_REQUEST_KEY_V1 =
  "biomes.localDev.harthmere.objectContainerOpenRequest.v1";

export interface HarthmereObjectContainerLootV1 {
  itemId: string;
  quantity: number;
}

export interface HarthmereObjectContainerSlotV1 {
  itemId: string;
  quantity: number;
}

export interface HarthmereObjectContainerRecordV1 {
  key: string;
  label: string;
  items: HarthmereObjectContainerSlotV1[];
  // HARTHMERE_ROAD_AHEAD_CLOTHING_GATE_V1: a quest-gated crate (e.g. the Road
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

export interface HarthmereObjectContainerOpenRequestV1 {
  entityId: BiomesId;
  key: string;
  label: string;
}

function isBrowserV1() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

export function normalizeHarthmereContainerKeyV1(
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

// HARTHMERE_ROAD_AHEAD_CLOTHING_GATE_V1: the Clothing Crate is quest-gated — its
// contents must not appear until The Road Ahead has passed the Billy/Muckwad
// handoff. This is the same family of labels the loot table routes to the
// clothing outfit.
const HARTHMERE_CLOTHING_QUEST_CRATE_RE_V1 =
  /clothing|wardrobe|outfit|garment|laundry/;

export function isHarthmereClothingQuestCrateLabelV1(
  label?: string | null
): boolean {
  return HARTHMERE_CLOTHING_QUEST_CRATE_RE_V1.test((label ?? "").toLowerCase());
}

export const HARTHMERE_CLOTHING_CRATE_LOCKED_NOTE_V1 =
  "This crate is empty for now. Billy or Jackie will point you here when it's time to gear up on The Road Ahead.";

const HARTHMERE_ROAD_AHEAD_CLOTHING_LOOT_VERSION_V1 =
  "road-ahead-clothing-outfit-v1";

const HARTHMERE_CLOTHING_QUEST_REQUIRED_ITEM_IDS_V1 = [
  "baker_apron",
  "field_trousers",
];

export function harthmereContainerLootForLabelV1(
  label?: string | null
): HarthmereObjectContainerLootV1[] {
  const text = (label ?? "").toLowerCase();
  if (HARTHMERE_CLOTHING_QUEST_CRATE_RE_V1.test(text)) {
    // A full starter outfit: a top (chest) AND bottoms (legs). The Road Ahead
    // "equip both clothing slots" step requires both halves, so the clothing
    // container must grant both — otherwise the quest can never complete from
    // the crate. See hasRequiredClothingV73 in LocalDevSnapshotMissionBridge.
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

function readContainerStoreV1(): Record<
  string,
  HarthmereObjectContainerRecordV1
> {
  if (!isBrowserV1()) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(
      HARTHMERE_OBJECT_CONTAINER_CONTENTS_KEY_V1
    );
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, HarthmereObjectContainerRecordV1>;
  } catch {
    return {};
  }
}

function writeContainerStoreV1(
  store: Record<string, HarthmereObjectContainerRecordV1>
) {
  if (!isBrowserV1()) {
    return;
  }
  window.localStorage.setItem(
    HARTHMERE_OBJECT_CONTAINER_CONTENTS_KEY_V1,
    JSON.stringify(store)
  );
  window.dispatchEvent(new Event(HARTHMERE_OBJECT_CONTAINER_CHANGED_EVENT_V1));
}

export interface HarthmereContainerSeedOptionsV1 {
  // HARTHMERE_ROAD_AHEAD_CLOTHING_GATE_V1: whether the Road Ahead clothing is
  // allowed to appear yet. Injectable for tests; defaults to reading the live
  // mission state from localStorage.
  questClothingReady?: boolean;
}

function lootSlotsForLabelV1(label: string): HarthmereObjectContainerSlotV1[] {
  return harthmereContainerLootForLabelV1(label).map((loot) => ({
    itemId: loot.itemId,
    quantity: loot.quantity,
  }));
}

function isRequiredClothingQuestItemIdV1(itemId: string): boolean {
  return HARTHMERE_CLOTHING_QUEST_REQUIRED_ITEM_IDS_V1.includes(itemId);
}

function containerItemQuantityV1(
  items: HarthmereObjectContainerSlotV1[],
  itemId: string
): number {
  return items
    .filter((slot) => slot.itemId === itemId)
    .reduce((sum, slot) => sum + Math.max(0, slot.quantity), 0);
}

function hasAnyRequiredClothingQuestItemV1(
  items: HarthmereObjectContainerSlotV1[]
): boolean {
  return items.some(
    (slot) => slot.quantity > 0 && isRequiredClothingQuestItemIdV1(slot.itemId)
  );
}

function missingRequiredClothingQuestLootSlotsV1(
  label: string,
  items: HarthmereObjectContainerSlotV1[]
): HarthmereObjectContainerSlotV1[] {
  return lootSlotsForLabelV1(label)
    .filter((slot) => isRequiredClothingQuestItemIdV1(slot.itemId))
    .map((slot) => ({
      itemId: slot.itemId,
      quantity: slot.quantity - containerItemQuantityV1(items, slot.itemId),
    }))
    .filter((slot) => slot.quantity > 0);
}

function backfillLegacySealedRoadAheadClothingCrateV1(
  record: HarthmereObjectContainerRecordV1
): HarthmereObjectContainerRecordV1 | undefined {
  const items = record.items ?? [];
  if (
    !record.sealed ||
    record.questLootVersion === HARTHMERE_ROAD_AHEAD_CLOTHING_LOOT_VERSION_V1 ||
    items.length <= 0 ||
    hasAnyRequiredClothingQuestItemV1(items)
  ) {
    return undefined;
  }
  const missing = missingRequiredClothingQuestLootSlotsV1(record.label, items);
  if (missing.length <= 0) {
    return undefined;
  }
  return {
    ...record,
    items: mergeContainerSlotsV1(items, missing),
    sealed: true,
    note: undefined,
    questLootVersion: HARTHMERE_ROAD_AHEAD_CLOTHING_LOOT_VERSION_V1,
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
export function getOrSeedHarthmereContainerV1(
  entityId: BiomesId,
  label?: string | null,
  options?: HarthmereContainerSeedOptionsV1
): HarthmereObjectContainerRecordV1 {
  const displayLabel = label?.trim() || "Container";
  const key = normalizeHarthmereContainerKeyV1(entityId, displayLabel);
  const store = readContainerStoreV1();
  const existing = store[key];

  if (!isHarthmereClothingQuestCrateLabelV1(displayLabel)) {
    // Ordinary container: seed once and seal.
    if (existing) {
      return existing;
    }
    const seeded: HarthmereObjectContainerRecordV1 = {
      key,
      label: displayLabel,
      items: lootSlotsForLabelV1(displayLabel),
      sealed: true,
    };
    store[key] = seeded;
    writeContainerStoreV1(store);
    return seeded;
  }

  // Quest-gated clothing crate.
  const ready =
    options?.questClothingReady ?? readRoadAheadClothingCrateReadyV1();
  if (existing?.sealed) {
    if (ready) {
      const repaired = backfillLegacySealedRoadAheadClothingCrateV1(existing);
      if (repaired) {
        store[key] = repaired;
        writeContainerStoreV1(store);
        return repaired;
      }
    }
    // Already filled (the gate opened on a previous interaction); behave normally.
    return existing;
  }
  // Preserve anything the player may have stored into the open (unsealed) crate.
  const carriedItems = existing?.items ?? [];

  if (!ready) {
    const locked: HarthmereObjectContainerRecordV1 = {
      key,
      label: displayLabel,
      items: carriedItems,
      sealed: false,
      note: HARTHMERE_CLOTHING_CRATE_LOCKED_NOTE_V1,
    };
    store[key] = locked;
    writeContainerStoreV1(store);
    return locked;
  }

  // The right time: merge the quest loot into whatever is already there, seal it.
  const merged = mergeContainerSlotsV1(
    carriedItems,
    lootSlotsForLabelV1(displayLabel)
  );
  const filled: HarthmereObjectContainerRecordV1 = {
    key,
    label: displayLabel,
    items: merged,
    sealed: true,
    questLootVersion: HARTHMERE_ROAD_AHEAD_CLOTHING_LOOT_VERSION_V1,
  };
  store[key] = filled;
  writeContainerStoreV1(store);
  return filled;
}

function mergeContainerSlotsV1(
  base: HarthmereObjectContainerSlotV1[],
  add: HarthmereObjectContainerSlotV1[]
): HarthmereObjectContainerSlotV1[] {
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

export function readHarthmereContainerV1(
  key: string
): HarthmereObjectContainerRecordV1 | undefined {
  return readContainerStoreV1()[key];
}

// Called by the Road Ahead bridge when the Billy/Muckwad handoff advances. If a
// player already opened the Clothing Crate while it was locked, this fills that
// known unsealed record immediately instead of waiting for a close/reopen.
export function fillKnownRoadAheadClothingCratesV1(
  options?: HarthmereContainerSeedOptionsV1
): HarthmereObjectContainerRecordV1[] {
  const ready =
    options?.questClothingReady ?? readRoadAheadClothingCrateReadyV1();
  if (!ready) {
    return [];
  }
  const store = readContainerStoreV1();
  const filled: HarthmereObjectContainerRecordV1[] = [];
  for (const [key, record] of Object.entries(store)) {
    if (!isHarthmereClothingQuestCrateLabelV1(record.label)) {
      continue;
    }
    const next = record.sealed
      ? backfillLegacySealedRoadAheadClothingCrateV1(record)
      : ({
          ...record,
          items: mergeContainerSlotsV1(
            record.items ?? [],
            lootSlotsForLabelV1(record.label)
          ),
          sealed: true,
          note: undefined,
          questLootVersion: HARTHMERE_ROAD_AHEAD_CLOTHING_LOOT_VERSION_V1,
        } satisfies HarthmereObjectContainerRecordV1);
    if (!next) {
      continue;
    }
    store[key] = next;
    filled.push(next);
  }
  if (filled.length > 0) {
    writeContainerStoreV1(store);
  }
  return filled;
}

// Move `quantity` of `itemId` from the container into the player inventory.
// grantHarthmereItem routes the item to the correct storage (backpack,
// material storage, quest pouch, keyring) by category. Returns amount taken.
export function takeFromHarthmereContainerV1(
  key: string,
  itemId: string,
  quantity = 1
): number {
  const store = readContainerStoreV1();
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
  writeContainerStoreV1(store);
  grantHarthmereItem(itemId, taken, `${record.label} contents`);
  return taken;
}

export function takeAllFromHarthmereContainerV1(key: string): number {
  const record = readHarthmereContainerV1(key);
  if (!record) {
    return 0;
  }
  let total = 0;
  // Snapshot ids first; each take mutates the stored record.
  const slots = record.items.map((slot) => ({ ...slot }));
  for (const slot of slots) {
    total += takeFromHarthmereContainerV1(key, slot.itemId, slot.quantity);
  }
  return total;
}

// Move `quantity` of `itemId` from the player inventory into the container.
// Returns the amount actually stored (limited by what the player holds).
export function putIntoHarthmereContainerV1(
  key: string,
  itemId: string,
  quantity = 1
): number {
  const store = readContainerStoreV1();
  const record = store[key];
  if (!record || quantity <= 0) {
    return 0;
  }
  const removed = consumeHarthmereItemByItemIdV141(
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
  writeContainerStoreV1(store);
  return removed;
}

export function readHarthmereContainerOpenRequestV1():
  | HarthmereObjectContainerOpenRequestV1
  | undefined {
  if (!isBrowserV1()) {
    return undefined;
  }
  try {
    const raw = window.localStorage.getItem(
      HARTHMERE_OBJECT_CONTAINER_OPEN_REQUEST_KEY_V1
    );
    if (!raw) {
      return undefined;
    }
    const parsed = JSON.parse(raw) as HarthmereObjectContainerOpenRequestV1;
    if (parsed && typeof parsed.key === "string") {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function clearHarthmereContainerOpenRequestV1() {
  if (!isBrowserV1()) {
    return;
  }
  window.localStorage.removeItem(
    HARTHMERE_OBJECT_CONTAINER_OPEN_REQUEST_KEY_V1
  );
}

// HARTHMERE_OBJECT_CONTAINER_UI_V199:
// Opening a container is now a UI action: it seeds the container (first time),
// runs any label-driven daily-task hooks, and asks the mounted panel to show
// the take/store interface. It no longer one-shot-grants loot and no longer
// marks the container "searched" — the player decides what to take or store.
export function openHarthmereObjectContainerV1({
  entityId,
  label,
}: {
  entityId: BiomesId;
  label?: string | null;
  // Accepted for call-site compatibility; the panel is the feedback surface.
  resources?: unknown;
}) {
  const displayLabel = label?.trim() || "Container";
  const record = getOrSeedHarthmereContainerV1(entityId, displayLabel);

  const labelText = displayLabel.toLowerCase();
  if (/food|ration|satchel|bag|basket|berries|forage/.test(labelText)) {
    completeHarthmereDailyTaskSoonV1("forage_walk");
  }
  if (/tool|repair|kit|crate|box|chest|container/.test(labelText)) {
    completeHarthmereDailyTaskSoonV1("home_care");
  }

  dispatchHarthmereWorldObjectInteractionEventV1({
    entityId,
    label: displayLabel,
    kind: "open_container",
    title: "Open Container",
  });

  const request: HarthmereObjectContainerOpenRequestV1 = {
    entityId,
    key: record.key,
    label: displayLabel,
  };
  if (isBrowserV1()) {
    window.localStorage.setItem(
      HARTHMERE_OBJECT_CONTAINER_OPEN_REQUEST_KEY_V1,
      JSON.stringify(request)
    );
    window.dispatchEvent(
      new CustomEvent(HARTHMERE_OBJECT_CONTAINER_OPEN_EVENT_V1, {
        detail: request,
      })
    );
  }
}
