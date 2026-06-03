import { grantHarthmereItem } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { completeHarthmereDailyTaskSoonV1 } from "@/client/components/challenges/harthmereDailyTasks";
import { dispatchHarthmereWorldObjectInteractionEventV1 } from "@/client/components/challenges/harthmereObjectInteractions";
import { addToast } from "@/client/components/toast/helpers";
import type { ClientResources } from "@/client/game/resources/types";
import type { BiomesId } from "@/shared/ids";

export const HARTHMERE_OBJECT_CONTAINER_OPENED_EVENT_V1 =
  "biomes:harthmere-object-container-opened-v1";

const HARTHMERE_OBJECT_CONTAINER_STATE_KEY_V1 =
  "biomes.localDev.harthmere.objectContainers.v1";

export interface HarthmereObjectContainerLootV1 {
  itemId: string;
  quantity: number;
}

function isBrowserV1() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function normalizeContainerKeyV1(entityId: BiomesId, label: string) {
  const normalizedLabel = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${entityId}:${normalizedLabel || "container"}`;
}

function readOpenedContainersV1() {
  if (!isBrowserV1()) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(
      HARTHMERE_OBJECT_CONTAINER_STATE_KEY_V1
    );
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function writeOpenedContainersV1(opened: string[]) {
  if (!isBrowserV1()) {
    return;
  }
  window.localStorage.setItem(
    HARTHMERE_OBJECT_CONTAINER_STATE_KEY_V1,
    JSON.stringify([...new Set(opened)])
  );
  window.dispatchEvent(new Event(HARTHMERE_OBJECT_CONTAINER_OPENED_EVENT_V1));
}

export function harthmereContainerLootForLabelV1(
  label?: string | null
): HarthmereObjectContainerLootV1[] {
  const text = (label ?? "").toLowerCase();
  if (/clothing|wardrobe|outfit|garment|laundry/.test(text)) {
    return [
      { itemId: "baker_apron", quantity: 1 },
      { itemId: "cloth_scrap", quantity: 4 },
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

export function openHarthmereObjectContainerV1({
  entityId,
  label,
  resources,
}: {
  entityId: BiomesId;
  label?: string | null;
  resources: ClientResources;
}) {
  const displayLabel = label?.trim() || "Container";
  const key = normalizeContainerKeyV1(entityId, displayLabel);
  const opened = readOpenedContainersV1();
  if (opened.includes(key)) {
    addToast(resources, {
      kind: "basic",
      id: `harthmere-object-container:${key}:opened`,
      message: `${displayLabel} has already been searched.`,
    });
    return;
  }

  const loot = harthmereContainerLootForLabelV1(displayLabel);
  dispatchHarthmereWorldObjectInteractionEventV1({
    entityId,
    label: displayLabel,
    kind: "open_container",
    title: "Open Container",
  });
  for (const item of loot) {
    grantHarthmereItem(item.itemId, item.quantity, `${displayLabel} contents`);
  }
  const labelText = displayLabel.toLowerCase();
  if (/food|ration|satchel|bag|basket|berries|forage/.test(labelText)) {
    completeHarthmereDailyTaskSoonV1("forage_walk");
  }
  if (/tool|repair|kit|crate|box|chest|container/.test(labelText)) {
    completeHarthmereDailyTaskSoonV1("home_care");
  }
  writeOpenedContainersV1([...opened, key]);
  addToast(resources, {
    kind: "new",
    id: `harthmere-object-container:${key}:new`,
    message: `Opened ${displayLabel}. Contents moved to your Harthmere inventory.`,
  });
}
