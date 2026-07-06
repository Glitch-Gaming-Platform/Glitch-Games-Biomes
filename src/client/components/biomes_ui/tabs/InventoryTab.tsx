// InventoryTab — production BiomesUI inventory surface.
//
// This panel is intentionally backed by the real ECS inventory/wearing adapter
// instead of local placeholder state. It supports keyboard-navigable backpack
// browsing, equipment, currencies, selected-item details, hotbar movement,
// stack operations, sorting, dropping, destroying, and equip/unequip actions.

import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { RovingGrid } from "../nav/RovingGrid";
import { biomesPlayerTitle } from "../playerFacingText";
import { UI_IDS } from "../uniqueIds";
import type {
  FarmingFoodInterfaceAction,
  FarmingFoodInterfaceModel,
} from "../adapters/farmingFoodInterfaceAdapter";
import { biomesUIStaminaWarningLevelForTest } from "../staminaWarning";

export type InventoryContainerKey =
  | "backpack"
  | "hotbar"
  | "equipment"
  | "material_storage"
  | "overflow"
  | "wallet";

export interface InventoryUiRef {
  kind: "item" | "hotbar" | "wearable" | "currency" | "material";
  idx?: number;
  key?: string | number;
}

export interface InventoryUiItem {
  id: string;
  label: string;
  icon: string;
  count?: number;
  quality?: "common" | "uncommon" | "rare" | "epic" | "legendary" | "quest";
  category?: string;
  description?: string;
  weight?: { unit: number; total: number };
  durability?: { current: number; max: number };
  equipSlot?: string;
  ref?: InventoryUiRef;
  source?: InventoryContainerKey;
  storageLocation?: InventoryContainerKey;
  canUse?: boolean;
  useActionLabel?: string;
  canEquip?: boolean;
  canMove?: boolean;
  canSplit?: boolean;
  canDrop?: boolean;
  canDestroy?: boolean;
  canUnequip?: boolean;
  protectedReason?: string;
  selected?: boolean;
}

interface InventoryEquipmentSlot {
  id: string;
  label: string;
  item?: InventoryUiItem | null;
  ref: InventoryUiRef;
}

interface InventoryStorageSummary {
  items: Array<InventoryUiItem | null>;
  maxSlots: number;
  usedSlots?: number;
  capacityLabel?: string;
}

interface InventoryAdapter {
  getEquipment?: () =>
    | InventoryEquipmentSlot[]
    | Partial<Record<string, InventoryUiItem | null>>;
  getBackpack?: () => {
    items: Array<InventoryUiItem | null>;
    maxSlots: number;
    usedSlots?: number;
    capacityLabel?: string;
    weight?: { current: number; max: number; overLimit: boolean };
    materialStorage?: InventoryStorageSummary;
    overflow?: InventoryUiItem[];
  };
  getCurrencies?: () => Array<{
    id: string;
    name: string;
    amount: number;
    icon: string;
  }>;
  getHotbar?: () => {
    items: Array<InventoryUiItem | null>;
    selectedIndex: number;
  };
  getFarmingFood?: () => FarmingFoodInterfaceModel | undefined;
  getSelectedItem?: () => InventoryUiItem | null;
  selectItem?: (ref: InventoryUiRef) => void;
  useItem?: (ref: InventoryUiRef) => void;
  equipItem?: (ref: InventoryUiRef, equipSlot?: string) => void;
  unequipItem?: (ref: InventoryUiRef) => void;
  moveItem?: (src: InventoryUiRef, dst: InventoryUiRef) => void;
  /**
   * Remove an item from a hotbar slot (returning it to the backpack /
   * clearing the quick-slot assignment). Wired to both the per-slot remove
   * button and drag-and-drop from the hotbar onto the backpack grid.
   */
  removeFromHotbar?: (ref: InventoryUiRef) => void;
  splitStack?: (
    src: InventoryUiRef,
    dst: InventoryUiRef,
    count: number
  ) => void;
  combineStack?: (
    src: InventoryUiRef,
    dst: InventoryUiRef,
    count: number
  ) => void;
  dropItem?: (ref: InventoryUiRef, count?: number) => void;
  destroyItem?: (ref: InventoryUiRef, count?: number) => void;
  sortInventory?: () => void;
  performFarmingFoodAction?: (action: FarmingFoodInterfaceAction) => void;
}

const EQUIPMENT_ORDER: Array<{
  id: string;
  label: string;
  key: string;
  highlight: string;
}> = [
  {
    id: "head",
    label: "Head",
    key: "head",
    highlight: UI_IDS.INVENTORY_SLOT_HEAD,
  },
  {
    id: "chest",
    label: "Chest",
    key: "chest",
    highlight: UI_IDS.INVENTORY_SLOT_CHEST,
  },
  {
    id: "legs",
    label: "Legs",
    key: "legs",
    highlight: UI_IDS.INVENTORY_SLOT_LEGS,
  },
  {
    id: "feet",
    label: "Feet",
    key: "feet",
    highlight: UI_IDS.INVENTORY_SLOT_FEET,
  },
  {
    id: "hands",
    label: "Hands",
    key: "hands",
    highlight: UI_IDS.INVENTORY_SLOT_HANDS,
  },
  {
    id: "main_hand",
    label: "Main Hand",
    key: "main_hand",
    highlight: UI_IDS.INVENTORY_SLOT_MAIN_HAND,
  },
  {
    id: "off_hand",
    label: "Off Hand",
    key: "off_hand",
    highlight: UI_IDS.INVENTORY_SLOT_OFF_HAND,
  },
];

const FILTERS = [
  "all",
  "gear",
  "tools",
  "materials",
  "consumables",
  "quest",
] as const;
type InventoryFilter = (typeof FILTERS)[number];

export const BIOMES_INVENTORY_DRAG_MIME =
  "application/x-biomes-inventory-ref+json";
export const BIOMES_INVENTORY_HOTBAR_SLOT_COUNT = 9;
const BIOMES_INVENTORY_DRAG_TEXT_PREFIX = "biomes-inventory-ref:";

type InventoryDragDataTransfer = Pick<DataTransfer, "getData" | "setData"> &
  Partial<Pick<DataTransfer, "effectAllowed" | "dropEffect">>;

function normalizeInventoryDragRef(raw: unknown): InventoryUiRef | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const candidate = raw as Partial<InventoryUiRef>;
  if (candidate.kind === "item" || candidate.kind === "hotbar") {
    const idx = Number(candidate.idx);
    if (!Number.isInteger(idx) || idx < 0) return undefined;
    return {
      kind: candidate.kind,
      idx,
      key:
        candidate.key === undefined || candidate.key === null
          ? undefined
          : candidate.key,
    };
  }
  if (candidate.kind === "material") {
    if (candidate.key === undefined || candidate.key === null) {
      return undefined;
    }
    return { kind: "material", key: candidate.key };
  }
  if (candidate.kind === "wearable" || candidate.kind === "currency") {
    if (candidate.key === undefined || candidate.key === null) {
      return undefined;
    }
    return { kind: candidate.kind, key: candidate.key };
  }
  return undefined;
}

export function serializeInventoryDragRef(ref: InventoryUiRef): string {
  return JSON.stringify({
    kind: ref.kind,
    idx: ref.idx,
    key: ref.key,
  });
}

export function parseInventoryDragRef(
  payload: string | null | undefined
): InventoryUiRef | undefined {
  if (!payload) return undefined;
  const text = payload.startsWith(BIOMES_INVENTORY_DRAG_TEXT_PREFIX)
    ? payload.slice(BIOMES_INVENTORY_DRAG_TEXT_PREFIX.length)
    : payload;
  try {
    return normalizeInventoryDragRef(JSON.parse(text));
  } catch {
    return undefined;
  }
}

export function writeInventoryDragRefToTransfer(
  dataTransfer: InventoryDragDataTransfer,
  ref: InventoryUiRef
) {
  const payload = serializeInventoryDragRef(ref);
  dataTransfer.setData(BIOMES_INVENTORY_DRAG_MIME, payload);
  dataTransfer.setData(
    "text/plain",
    `${BIOMES_INVENTORY_DRAG_TEXT_PREFIX}${payload}`
  );
  dataTransfer.effectAllowed = "move";
}

export function readInventoryDragRefFromTransfer(
  dataTransfer: Pick<DataTransfer, "getData">
): InventoryUiRef | undefined {
  return (
    parseInventoryDragRef(dataTransfer.getData(BIOMES_INVENTORY_DRAG_MIME)) ??
    parseInventoryDragRef(dataTransfer.getData("text/plain"))
  );
}

function canMoveInventoryRefToHotbar(ref: InventoryUiRef | undefined) {
  return (
    ref?.kind === "item" || ref?.kind === "hotbar" || ref?.kind === "material"
  );
}

export function canMoveInventoryItemToHotbar(
  item: InventoryUiItem | null | undefined
) {
  return (
    !!item?.ref &&
    item.canMove !== false &&
    canMoveInventoryRefToHotbar(item.ref)
  );
}

export function resolveInventoryHotbarDrop(
  src: InventoryUiRef | null | undefined,
  hotbarIndex: number
): { src: InventoryUiRef; dst: InventoryUiRef } | undefined {
  if (
    !src ||
    !Number.isInteger(hotbarIndex) ||
    hotbarIndex < 0 ||
    hotbarIndex >= BIOMES_INVENTORY_HOTBAR_SLOT_COUNT ||
    !canMoveInventoryRefToHotbar(src)
  ) {
    return undefined;
  }
  if (src.kind === "hotbar" && src.idx === hotbarIndex) {
    return undefined;
  }
  return { src, dst: { kind: "hotbar", idx: hotbarIndex } };
}

export const InventoryTab: React.FunctionComponent<{
  adapter?: InventoryAdapter;
}> = ({ adapter }) => {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<InventoryFilter>("all");
  const [selectedRef, setSelectedRef] = React.useState<InventoryUiRef | null>(
    null
  );
  const [draggedRef, setDraggedRef] = React.useState<InventoryUiRef | null>(
    null
  );

  const backpack = adapter?.getBackpack?.() ?? {
    items: [],
    maxSlots: 0,
    usedSlots: 0,
    capacityLabel: "Inventory unavailable",
  };
  const hotbar = adapter?.getHotbar?.() ?? { items: [], selectedIndex: -1 };
  const currencies = adapter?.getCurrencies?.() ?? [];
  const farmingFood = adapter?.getFarmingFood?.();
  const equipment = normalizeEquipment(adapter?.getEquipment?.());
  const materialStorage = backpack.materialStorage;
  const materialItems =
    materialStorage?.items.filter((item): item is InventoryUiItem => !!item) ??
    [];
  const selectedItem =
    findItemByRef(
      backpack.items,
      equipment,
      selectedRef,
      hotbar.items,
      materialItems
    ) ??
    adapter?.getSelectedItem?.() ??
    backpack.items.find((item): item is InventoryUiItem => Boolean(item)) ??
    hotbar.items.find((item): item is InventoryUiItem => Boolean(item)) ??
    null;
  const overflowItems = backpack.overflow ?? [];
  const firstEmptyBackpackIndex = React.useMemo(
    () => backpack.items.findIndex((item) => !item),
    [backpack.items]
  );

  const cells = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const sourceItems = Array.from({ length: backpack.maxSlots }, (_, i) => {
      const item = backpack.items[i] ?? null;
      if (!item) return null;
      const label = item.label.toLowerCase();
      const category = String(item.category ?? "").toLowerCase();
      const matchesQuery =
        !q ||
        label.includes(q) ||
        category.includes(q) ||
        item.id.toLowerCase().includes(q);
      const matchesFilter =
        filter === "all" ||
        category.includes(filter) ||
        item.quality === filter ||
        (filter === "gear" && !!item.equipSlot);
      return matchesQuery && matchesFilter ? item : null;
    });
    const rows: Array<Array<InventoryUiItem | null>> = [];
    const cols = 8;
    for (let r = 0; r < Math.ceil(sourceItems.length / cols); r++) {
      rows.push(sourceItems.slice(r * cols, (r + 1) * cols));
    }
    return rows;
  }, [backpack.items, backpack.maxSlots, filter, query]);

  const selectItem = React.useCallback(
    (item: InventoryUiItem | null) => {
      if (!item?.ref) return;
      setSelectedRef(item.ref);
      adapter?.selectItem?.(item.ref);
    },
    [adapter]
  );

  const startInventoryDrag = React.useCallback(
    (event: React.DragEvent, item: InventoryUiItem | null) => {
      if (
        !adapter?.moveItem ||
        !canMoveInventoryItemToHotbar(item) ||
        !item?.ref
      ) {
        event.preventDefault();
        return;
      }
      writeInventoryDragRefToTransfer(event.dataTransfer, item.ref);
      setDraggedRef(item.ref);
    },
    [adapter]
  );

  const endInventoryDrag = React.useCallback(() => {
    setDraggedRef(null);
  }, []);

  const handleHotbarDragOver = React.useCallback(
    (event: React.DragEvent, hotbarIndex: number) => {
      if (!adapter?.moveItem) return;
      const sourceRef =
        draggedRef ?? readInventoryDragRefFromTransfer(event.dataTransfer);
      if (!resolveInventoryHotbarDrop(sourceRef, hotbarIndex)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },
    [adapter, draggedRef]
  );

  const handleHotbarDrop = React.useCallback(
    (event: React.DragEvent, hotbarIndex: number) => {
      if (!adapter?.moveItem) return;
      const sourceRef =
        readInventoryDragRefFromTransfer(event.dataTransfer) ?? draggedRef;
      const move = resolveInventoryHotbarDrop(sourceRef, hotbarIndex);
      setDraggedRef(null);
      if (!move) return;
      event.preventDefault();
      adapter.moveItem(move.src, move.dst);
    },
    [adapter, draggedRef]
  );

  const removeHotbarRef = React.useCallback(
    (ref: InventoryUiRef | null | undefined) => {
      if (!ref || ref.kind !== "hotbar") return;
      if (adapter?.removeFromHotbar) {
        adapter.removeFromHotbar(ref);
        return;
      }
      // Fallback: move the hotbar stack into the first empty backpack slot.
      adapter?.moveItem?.(ref, {
        kind: "item",
        idx: firstEmptyBackpackIndex < 0 ? 0 : firstEmptyBackpackIndex,
      });
    },
    [adapter, firstEmptyBackpackIndex]
  );

  // Dragging a hotbar item anywhere onto the backpack grid removes it from
  // the hotbar (returns it to the backpack / clears the quick-slot).
  const handleBackpackDragOver = React.useCallback(
    (event: React.DragEvent) => {
      const sourceRef =
        draggedRef ?? readInventoryDragRefFromTransfer(event.dataTransfer);
      if (sourceRef?.kind !== "hotbar") return;
      if (!adapter?.removeFromHotbar && !adapter?.moveItem) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },
    [adapter, draggedRef]
  );

  const handleBackpackDrop = React.useCallback(
    (event: React.DragEvent) => {
      const sourceRef =
        readInventoryDragRefFromTransfer(event.dataTransfer) ?? draggedRef;
      setDraggedRef(null);
      if (sourceRef?.kind !== "hotbar") return;
      event.preventDefault();
      removeHotbarRef(sourceRef);
    },
    [draggedRef, removeHotbarRef]
  );

  return (
    <div className="biomes-ui-inventory" data-production-inventory="true">
      <section
        className="biomes-ui-inventory__sidebar"
        aria-label="Inventory character state"
      >
        <div style={sectionHeaderRowStyle}>
          <h3 style={titleStyle}>Equipped</h3>
          <button
            type="button"
            className="biomes-ui-action-button"
            onClick={() => adapter?.sortInventory?.()}
            data-inventory-action="sort"
          >
            Sort
          </button>
        </div>
        <div style={paperDollStyle}>
          {equipment.map((slot) => (
            <EquipSlot
              key={slot.id}
              id={slot.highlight}
              label={slot.label}
              item={slot.item ?? undefined}
              onClick={() => {
                if (slot.item?.ref) {
                  setSelectedRef(slot.item.ref);
                  adapter?.selectItem?.(slot.item.ref);
                }
              }}
              onUnequip={() =>
                slot.item?.ref && adapter?.unequipItem?.(slot.item.ref)
              }
            />
          ))}
        </div>

        <h3 style={{ ...titleStyle, marginTop: 16 }}>Currencies</h3>
        <div
          className="biomes-ui-inventory__currency-list"
          aria-label="Currencies"
        >
          {currencies.length === 0 ? (
            <p style={mutedTextStyle}>No currency balances found.</p>
          ) : (
            currencies.map((currency) => (
              <div
                key={currency.id}
                className="biomes-ui-inventory__currency-row"
              >
                <span aria-hidden>{currency.icon}</span>
                <span>{currency.name}</span>
                <strong>{currency.amount.toLocaleString()}</strong>
              </div>
            ))
          )}
        </div>

        {farmingFood ? (
          <FarmingFoodSection
            model={farmingFood}
            onAction={(action) => adapter?.performFarmingFoodAction?.(action)}
          />
        ) : null}

        <CompactInventoryList
          title="Material Storage"
          ariaLabel="Material storage"
          items={materialItems}
          usedSlots={materialStorage?.usedSlots}
          maxSlots={materialStorage?.maxSlots}
          emptyText="No stored materials."
          tone="materials"
        />

        {overflowItems.length > 0 ? (
          <CompactInventoryList
            title="Overflow"
            ariaLabel="Inventory overflow"
            items={overflowItems}
            emptyText=""
            tone="overflow"
          />
        ) : null}
      </section>

      <section
        className="biomes-ui-inventory__main"
        aria-label="Backpack inventory"
      >
        <div className="biomes-ui-inventory__toolbar">
          <label className="biomes-ui-inventory__search">
            <span>Search</span>
            <input
              aria-label="Search inventory"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="filter by item, material, quest..."
            />
          </label>
          <div
            className="biomes-ui-inventory__filters"
            role="tablist"
            aria-label="Inventory filters"
          >
            {FILTERS.map((entry) => (
              <button
                key={entry}
                type="button"
                role="tab"
                aria-selected={filter === entry}
                className="biomes-ui-tab"
                onClick={() => setFilter(entry)}
              >
                {entry}
              </button>
            ))}
          </div>
        </div>

        <h3 style={titleStyle}>
          Backpack
          <span
            style={{
              marginLeft: 8,
              fontSize: 11,
              color: backpack.weight?.overLimit
                ? "var(--biomes-fg-danger, #ff7777)"
                : "var(--biomes-fg-muted)",
            }}
          >
            {backpack.usedSlots ?? backpack.items.filter(Boolean).length} /{" "}
            {backpack.maxSlots}
            {backpack.capacityLabel
              ? ` · ${biomesPlayerTitle(backpack.capacityLabel)}`
              : ""}
            {backpack.weight
              ? ` · Weight ${backpack.weight.current.toFixed(
                  1
                )} / ${backpack.weight.max.toFixed(1)}`
              : ""}
          </span>
        </h3>
        {backpack.weight?.overLimit ? (
          <p
            style={{
              ...mutedTextStyle,
              marginBottom: 8,
              color: "var(--biomes-fg-danger, #ff7777)",
            }}
          >
            Carry weight is over the field limit. Store heavy items in homes,
            shops, or approved storage before taking more.
          </p>
        ) : null}
        <MaterialStorageShelf
          items={materialItems}
          usedSlots={materialStorage?.usedSlots}
          maxSlots={materialStorage?.maxSlots}
          onSelect={selectItem}
          onDragStart={startInventoryDrag}
          onDragEnd={endInventoryDrag}
          canDrag={Boolean(adapter?.moveItem)}
        />
        <div
          data-backpack-drop-target="true"
          onDragOver={handleBackpackDragOver}
          onDrop={handleBackpackDrop}
        >
        <RovingGrid
          ariaLabel="Backpack slots"
          items={cells}
          renderCell={(item, { focused }, cell) => {
            const canDragItem =
              canMoveInventoryItemToHotbar(item) && Boolean(adapter?.moveItem);
            const slotButton = React.createElement(
              "button",
              {
                ref: cell.ref,
                tabIndex: cell.tabIndex,
                onFocus: cell.onFocus,
                onClick: (event: React.MouseEvent) => {
                  cell.onClick?.();
                  selectItem(item);
                },
                onKeyDown: (event: React.KeyboardEvent) => {
                  cell.onKeyDown?.(event as any);
                  if ((event.key === "Enter" || event.key === " ") && item) {
                    event.preventDefault();
                    selectItem(item);
                  }
                },
                className: `biomes-ui-slot biomes-ui-inventory__slot${
                  item ? " biomes-ui-inventory-tooltip-target" : ""
                }`,
                "aria-label": item
                  ? `${item.label}${item.count ? ` x${item.count}` : ""}`
                  : "Empty slot",
                title: item ? inventoryTooltipLabel(item) : "Empty slot",
                "data-inventory-tooltip": item
                  ? inventoryTooltipLabel(item)
                  : undefined,
                "data-focused": focused ? "true" : undefined,
                "data-selected":
                  selectedRef && item?.ref && refsEqual(selectedRef, item.ref)
                    ? "true"
                    : undefined,
                "data-inventory-ref": item?.ref
                  ? serializeInventoryRef(item.ref)
                  : undefined,
                "data-inventory-draggable": canDragItem ? "true" : undefined,
                "data-inventory-dragging":
                  item?.ref && draggedRef && refsEqual(draggedRef, item.ref)
                    ? "true"
                    : undefined,
                draggable: canDragItem ? true : undefined,
                onDragStart: canDragItem
                  ? (event: React.DragEvent) => startInventoryDrag(event, item)
                  : undefined,
                onDragEnd: canDragItem ? endInventoryDrag : undefined,
                style: { width: 52, height: 52 },
              },
              item
                ? React.createElement(
                    React.Fragment,
                    null,
                    renderInventoryIcon(item),
                    // Always show the quantity so every stack reads consistently
                    // (users could not tell a 1-stack from an uncounted item).
                    item.count && item.count >= 1
                      ? React.createElement(
                          "span",
                          { className: "biomes-ui-inventory__count" },
                          item.count
                        )
                      : null,
                    item.durability
                      ? React.createElement("span", {
                          className: "biomes-ui-inventory__durability",
                          style: {
                            width: `${Math.max(
                              4,
                              Math.min(
                                100,
                                (item.durability.current /
                                  Math.max(1, item.durability.max)) *
                                  100
                              )
                            )}%`,
                          },
                        })
                      : null
                  )
                : null
            );
            return item
              ? React.createElement(Highlightable, {
                  uniqueId: UI_IDS.INVENTORY_ITEM(item.id),
                  showCaption: true,
                  children: slotButton,
                })
              : slotButton;
          }}
        />
        </div>

        <div
          className="biomes-ui-inventory__hotbar-sync"
          aria-label="Hotbar inventory sync"
          style={hotbarSyncStyle}
        >
          <h3 style={titleStyle}>
            Hotbar / quick slots
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                color: "var(--biomes-fg-muted)",
              }}
            >
              Mirrors the bottom HUD hotbar
            </span>
          </h3>
          <div style={hotbarRowStyle}>
            {Array.from(
              { length: BIOMES_INVENTORY_HOTBAR_SLOT_COUNT },
              (_unused, index) => {
                const item = hotbar.items[index] ?? null;
                const selected = index === hotbar.selectedIndex;
                const canDragHotbarItem =
                  canMoveInventoryItemToHotbar(item) &&
                  Boolean(adapter?.moveItem);
                const hotbarDropActive = Boolean(
                  adapter?.moveItem &&
                    resolveInventoryHotbarDrop(draggedRef, index)
                );
                const canRemoveHotbarItem = Boolean(
                  item?.ref &&
                    item.ref.kind === "hotbar" &&
                    (adapter?.removeFromHotbar || adapter?.moveItem)
                );
                return (
                  <div
                    key={`hotbar-sync-${index}`}
                    style={{ position: "relative", display: "inline-flex" }}
                  >
                  <button
                    type="button"
                    className={`biomes-ui-slot biomes-ui-inventory__slot${
                      item ? " biomes-ui-inventory-tooltip-target" : ""
                    }`}
                    aria-label={
                      item
                        ? `Hotbar ${index + 1}: ${item.label}`
                        : `Hotbar ${index + 1}: empty`
                    }
                    title={
                      item
                        ? `Hotbar ${index + 1}: ${inventoryTooltipLabel(item)}`
                        : `Hotbar ${index + 1}: empty`
                    }
                    data-inventory-tooltip={
                      item ? inventoryTooltipLabel(item) : undefined
                    }
                    data-hotbar-sync-slot={index + 1}
                    data-hotbar-drop-target="true"
                    data-hotbar-drop-index={index}
                    data-hotbar-drop-enabled={
                      adapter?.moveItem ? "true" : "false"
                    }
                    data-hotbar-drop-active={
                      hotbarDropActive ? "true" : undefined
                    }
                    data-selected={selected ? "true" : undefined}
                    data-inventory-ref={
                      item?.ref ? serializeInventoryRef(item.ref) : undefined
                    }
                    data-inventory-draggable={
                      canDragHotbarItem ? "true" : undefined
                    }
                    data-inventory-dragging={
                      item?.ref && draggedRef && refsEqual(draggedRef, item.ref)
                        ? "true"
                        : undefined
                    }
                    draggable={canDragHotbarItem ? true : undefined}
                    onClick={() => selectItem(item)}
                    onDragStart={
                      canDragHotbarItem
                        ? (event) => startInventoryDrag(event, item)
                        : undefined
                    }
                    onDragEnd={canDragHotbarItem ? endInventoryDrag : undefined}
                    onDragOver={(event) => handleHotbarDragOver(event, index)}
                    onDrop={(event) => handleHotbarDrop(event, index)}
                    style={{
                      width: 44,
                      height: 44,
                      borderColor: selected
                        ? "var(--biomes-edge-magenta)"
                        : undefined,
                    }}
                  >
                    {item ? (
                      <>
                        {renderInventoryIcon(item)}
                        <span style={visuallyHiddenStyle}>{item.label}</span>
                        {item.count && item.count >= 1 ? (
                          <span className="biomes-ui-inventory__count">
                            {item.count}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </button>
                  {item && canRemoveHotbarItem ? (
                    <button
                      type="button"
                      aria-label={`Remove ${item.label} from hotbar slot ${
                        index + 1
                      }`}
                      title={`Remove ${item.label} from hotbar`}
                      data-hotbar-remove-index={index}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeHotbarRef(item.ref);
                      }}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: "1px solid var(--biomes-fg-muted, #888)",
                        background: "var(--biomes-bg-panel, rgba(10,14,20,0.9))",
                        color: "var(--biomes-fg-danger, #ff7777)",
                        fontSize: 10,
                        lineHeight: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        padding: 0,
                        zIndex: 2,
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                  </div>
                );
              }
            )}
          </div>
        </div>
      </section>

      <section
        className="biomes-ui-inventory__details"
        aria-label="Selected item details"
      >
        <h3 style={titleStyle}>Selected Item</h3>
        {selectedItem ? (
          <div className="biomes-ui-inventory__details-card">
            <div className="biomes-ui-inventory__details-heading">
              <span aria-hidden style={{ fontSize: 28 }}>
                {renderInventoryIcon(selectedItem)}
              </span>
              <div>
                <strong>{selectedItem.label}</strong>
                <p>
                  {biomesPlayerTitle(
                    selectedItem.category ??
                      selectedItem.quality ??
                      "inventory item"
                  )}
                </p>
              </div>
            </div>
            {selectedItem.description ? (
              <p style={mutedTextStyle}>{selectedItem.description}</p>
            ) : null}
            {selectedItem.weight ? (
              <p style={mutedTextStyle}>
                Weight {formatInventoryWeight(selectedItem.weight.total)}
                {selectedItem.count && selectedItem.count > 1
                  ? ` total · ${formatInventoryWeight(
                      selectedItem.weight.unit
                    )} each`
                  : ""}
              </p>
            ) : null}
            {selectedItem.storageLocation &&
            selectedItem.storageLocation !== selectedItem.source ? (
              <p style={mutedTextStyle}>
                {biomesPlayerTitle(selectedItem.storageLocation)}
              </p>
            ) : null}
            {selectedItem.protectedReason ? (
              <p
                style={{
                  ...mutedTextStyle,
                  color: "var(--biomes-fg-warning, #ffc66d)",
                }}
              >
                {selectedItem.protectedReason}
              </p>
            ) : null}
            <div
              className="biomes-ui-inventory__actions"
              aria-label="Inventory item actions"
            >
              <Highlightable
                uniqueId={UI_IDS.INVENTORY_ACTION("use")}
                showCaption
              >
                <button
                  type="button"
                  onClick={() =>
                    selectedItem.ref && adapter?.useItem?.(selectedItem.ref)
                  }
                  disabled={!selectedItem.ref || selectedItem.canUse === false}
                  data-inventory-action="use"
                >
                  {selectedItem.useActionLabel ?? "Use / Select"}
                </button>
              </Highlightable>
              <Highlightable
                uniqueId={UI_IDS.INVENTORY_ACTION("equip")}
                showCaption
              >
                <button
                  type="button"
                  onClick={() =>
                    selectedItem.ref &&
                    adapter?.equipItem?.(
                      selectedItem.ref,
                      selectedItem.equipSlot
                    )
                  }
                  disabled={
                    !selectedItem.equipSlot || selectedItem.canEquip === false
                  }
                  data-inventory-action="equip"
                >
                  Equip
                </button>
              </Highlightable>
              <Highlightable
                uniqueId={UI_IDS.INVENTORY_ACTION("unequip")}
                showCaption
              >
                <button
                  type="button"
                  onClick={() =>
                    selectedItem.ref && adapter?.unequipItem?.(selectedItem.ref)
                  }
                  disabled={
                    !selectedItem.ref ||
                    selectedItem.source !== "equipment" ||
                    selectedItem.canUnequip === false
                  }
                  data-inventory-action="unequip"
                >
                  Unequip
                </button>
              </Highlightable>
              <Highlightable
                uniqueId={UI_IDS.INVENTORY_ACTION("move-hotbar")}
                showCaption
              >
                <button
                  type="button"
                  onClick={() =>
                    selectedItem.ref &&
                    adapter?.moveItem?.(selectedItem.ref, {
                      kind: "hotbar",
                      idx: 0,
                    })
                  }
                  disabled={!selectedItem.ref || selectedItem.canMove === false}
                  data-inventory-action="move-hotbar"
                >
                  Hotbar 1
                </button>
              </Highlightable>
              <button
                type="button"
                onClick={() =>
                  selectedItem.ref &&
                  firstEmptyBackpackIndex >= 0 &&
                  adapter?.splitStack?.(
                    selectedItem.ref,
                    { kind: "item", idx: firstEmptyBackpackIndex },
                    Math.max(1, Math.floor((selectedItem.count ?? 1) / 2))
                  )
                }
                disabled={
                  (selectedItem.count ?? 1) < 2 ||
                  firstEmptyBackpackIndex < 0 ||
                  selectedItem.canSplit === false
                }
                data-inventory-action="split"
              >
                Split
              </button>
              <Highlightable
                uniqueId={UI_IDS.INVENTORY_ACTION("drop-one")}
                showCaption
              >
                <button
                  type="button"
                  onClick={() =>
                    selectedItem.ref && adapter?.dropItem?.(selectedItem.ref, 1)
                  }
                  disabled={!selectedItem.ref || selectedItem.canDrop === false}
                  data-inventory-action="drop-one"
                >
                  Drop 1
                </button>
              </Highlightable>
              <Highlightable
                uniqueId={UI_IDS.INVENTORY_ACTION("drop-all")}
                showCaption
              >
                <button
                  type="button"
                  onClick={() =>
                    selectedItem.ref && adapter?.dropItem?.(selectedItem.ref)
                  }
                  disabled={!selectedItem.ref || selectedItem.canDrop === false}
                  data-inventory-action="drop-all"
                >
                  Drop All
                </button>
              </Highlightable>
              <button
                type="button"
                onClick={() =>
                  selectedItem.ref &&
                  adapter?.destroyItem?.(selectedItem.ref, 1)
                }
                disabled={
                  !selectedItem.ref || selectedItem.canDestroy === false
                }
                data-inventory-action="destroy"
              >
                Destroy
              </button>
            </div>
          </div>
        ) : (
          <p style={mutedTextStyle}>
            Select a backpack, hotbar, or equipment slot to inspect and act on
            it.
          </p>
        )}
        <div className="biomes-ui-inventory__contract-note">
          Changes you make here are saved to your character.
        </div>
      </section>
    </div>
  );
};

function normalizeEquipment(
  raw?:
    | InventoryEquipmentSlot[]
    | Partial<Record<string, InventoryUiItem | null>>
): Array<InventoryEquipmentSlot & { highlight: string }> {
  if (Array.isArray(raw)) {
    return EQUIPMENT_ORDER.map((slot) => {
      const found = raw.find(
        (entry) => entry.id === slot.id || String(entry.ref?.key) === slot.key
      );
      return {
        id: slot.id,
        label: found?.label ?? slot.label,
        item: found?.item ?? null,
        ref: found?.ref ?? { kind: "wearable", key: slot.key },
        highlight: slot.highlight,
      };
    });
  }
  return EQUIPMENT_ORDER.map((slot) => ({
    id: slot.id,
    label: slot.label,
    item: raw?.[slot.key] ?? null,
    ref: { kind: "wearable", key: slot.key },
    highlight: slot.highlight,
  }));
}

function findItemByRef(
  backpackItems: Array<InventoryUiItem | null>,
  equipment: Array<InventoryEquipmentSlot>,
  ref: InventoryUiRef | null,
  hotbarItems: Array<InventoryUiItem | null> = [],
  materialItems: Array<InventoryUiItem | null> = []
): InventoryUiItem | null {
  if (!ref) return null;
  for (const item of backpackItems) {
    if (item?.ref && refsEqual(item.ref, ref)) return item;
  }
  for (const item of hotbarItems) {
    if (item?.ref && refsEqual(item.ref, ref)) return item;
  }
  for (const item of materialItems) {
    if (item?.ref && refsEqual(item.ref, ref)) return item;
  }
  for (const slot of equipment) {
    if (slot.item?.ref && refsEqual(slot.item.ref, ref)) return slot.item;
  }
  return null;
}

function refsEqual(a: InventoryUiRef, b: InventoryUiRef): boolean {
  return (
    a.kind === b.kind &&
    a.idx === b.idx &&
    String(a.key ?? "") === String(b.key ?? "")
  );
}

function serializeInventoryRef(ref: InventoryUiRef): string {
  return `${ref.kind}:${ref.idx ?? ref.key ?? ""}`;
}

function isInventoryImageIcon(icon: string | undefined) {
  if (!icon) return false;
  return /^(?:https?:\/\/|data:image\/|blob:|\/)/i.test(icon);
}

function inventoryTooltipLabel(item: InventoryUiItem) {
  const stackLabel =
    item.count && item.count > 1 ? `${item.label} x${item.count}` : item.label;
  return item.weight
    ? `${stackLabel} · ${formatInventoryWeight(item.weight.total)}`
    : stackLabel;
}

function formatInventoryWeight(weight: number) {
  const safeWeight = Math.max(0, Number(weight) || 0);
  return `${safeWeight.toFixed(safeWeight > 0 && safeWeight < 1 ? 2 : 1)} lb`;
}

function renderInventoryIcon(item: InventoryUiItem): React.ReactNode {
  if (isInventoryImageIcon(item.icon)) {
    const src =
      item.icon.startsWith("buckets/") || item.icon.startsWith("assets/")
        ? `/${item.icon}`
        : item.icon;
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        draggable={false}
        data-inventory-icon-kind="image"
        style={{ width: 30, height: 30, objectFit: "contain" }}
      />
    );
  }
  return (
    <span aria-hidden data-inventory-icon-kind="glyph" style={{ fontSize: 22 }}>
      {item.icon || "IT"}
    </span>
  );
}

const MaterialStorageShelf: React.FunctionComponent<{
  items: InventoryUiItem[];
  usedSlots?: number;
  maxSlots?: number;
  onSelect?: (item: InventoryUiItem) => void;
  onDragStart?: (event: React.DragEvent, item: InventoryUiItem | null) => void;
  onDragEnd?: () => void;
  canDrag?: boolean;
}> = ({
  items,
  usedSlots,
  maxSlots,
  onSelect,
  onDragStart,
  onDragEnd,
  canDrag,
}) => {
  if (items.length === 0) {
    return null;
  }
  return (
    <div
      className="biomes-ui-inventory__material-shelf"
      aria-label="Material storage"
    >
      <div className="biomes-ui-inventory__material-shelf-header">
        <h3 style={{ ...titleStyle, marginBottom: 0 }}>Material Storage</h3>
        {typeof maxSlots === "number" && maxSlots > 0 ? (
          <span>
            {usedSlots ?? items.length} / {maxSlots}
          </span>
        ) : null}
      </div>
      <div role="list" className="biomes-ui-inventory__material-shelf-list">
        {items.map((item) => {
          const draggable =
            Boolean(canDrag) && canMoveInventoryItemToHotbar(item);
          return (
            <button
              key={`material-shelf-${item.id}`}
              type="button"
              role="listitem"
              className="biomes-ui-inventory__material-chip biomes-ui-inventory-tooltip-target"
              title={inventoryTooltipLabel(item)}
              data-inventory-tooltip={inventoryTooltipLabel(item)}
              data-inventory-draggable={draggable ? "true" : "false"}
              draggable={draggable}
              onClick={() => onSelect?.(item)}
              onDragStart={(event) => onDragStart?.(event, item)}
              onDragEnd={onDragEnd}
            >
              {renderInventoryIcon(item)}
              {item.count && item.count >= 1 ? (
                <span className="biomes-ui-inventory__count">{item.count}</span>
              ) : null}
              <span style={visuallyHiddenStyle}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const CompactInventoryList: React.FunctionComponent<{
  title: string;
  ariaLabel: string;
  items: InventoryUiItem[];
  usedSlots?: number;
  maxSlots?: number;
  emptyText: string;
  tone: "materials" | "overflow";
}> = ({ title, ariaLabel, items, usedSlots, maxSlots, emptyText, tone }) => (
  <div aria-label={ariaLabel} style={{ marginTop: 16 }}>
    <h3 style={{ ...titleStyle, marginBottom: 8 }}>
      {title}
      {typeof maxSlots === "number" && maxSlots > 0 ? (
        <span
          style={{
            marginLeft: 8,
            fontSize: 11,
            color: "var(--biomes-fg-muted)",
          }}
        >
          {usedSlots ?? items.length} / {maxSlots}
        </span>
      ) : null}
    </h3>
    {items.length === 0 ? (
      emptyText ? (
        <p style={mutedTextStyle}>{emptyText}</p>
      ) : null
    ) : (
      <div role="list" style={{ display: "grid", gap: 4 }}>
        {items.map((item) => (
          <div
            key={`${tone}_${item.id}`}
            role="listitem"
            className="biomes-ui-inventory__currency-row biomes-ui-inventory-tooltip-target"
            title={inventoryTooltipLabel(item)}
            data-inventory-tooltip={inventoryTooltipLabel(item)}
            style={{
              borderColor:
                tone === "overflow"
                  ? "var(--biomes-fg-danger, #ff7777)"
                  : undefined,
            }}
          >
            <span aria-hidden>{renderInventoryIcon(item)}</span>
            <span>{item.label}</span>
            <strong>{(item.count ?? 1).toLocaleString()}</strong>
          </div>
        ))}
      </div>
    )}
  </div>
);

const FarmingFoodSection: React.FunctionComponent<{
  model: FarmingFoodInterfaceModel;
  onAction: (action: FarmingFoodInterfaceAction) => void;
}> = ({ model, onAction }) => {
  const staminaPct = Math.max(
    0,
    Math.min(100, (model.stamina / Math.max(1, model.maxStamina)) * 100)
  );
  const staminaWarning = biomesUIStaminaWarningLevelForTest(
    model.stamina,
    model.maxStamina
  );
  const staminaWarns = staminaWarning !== "none";
  const visibleActions = model.actions.filter(
    (action) =>
      action.id !== "forage_food" ||
      !action.disabled ||
      model.actions.some(
        (entry) => entry.id === "forage_food" && !entry.disabled
      )
  );
  return (
    <div aria-label="Farming hunting cattle and food" style={{ marginTop: 16 }}>
      <h3 style={{ ...titleStyle, marginBottom: 8 }}>Food & Farm</h3>
      <div
        aria-label={`Stamina ${model.stamina} of ${model.maxStamina}`}
        data-stamina-warning={staminaWarns ? staminaWarning : undefined}
        style={{
          height: 8,
          overflow: "hidden",
          borderRadius: 4,
          border: staminaWarns
            ? "1px solid rgba(255, 82, 82, 0.78)"
            : "1px solid var(--biomes-edge-cyan-soft)",
          background: staminaWarns
            ? "rgba(70, 0, 0, 0.46)"
            : "rgba(0,0,0,0.35)",
          marginBottom: 8,
          boxShadow: staminaWarns
            ? "0 0 14px rgba(255, 54, 54, 0.62)"
            : undefined,
          animation: staminaWarns
            ? `biomes-ui-stamina-warning-pulse ${
                staminaWarning === "critical" ? "0.58s" : "1.05s"
              } ease-in-out infinite`
            : undefined,
        }}
      >
        <span
          style={{
            display: "block",
            height: "100%",
            width: `${staminaPct}%`,
            background: staminaWarns
              ? "linear-gradient(90deg, #ff2e4f, #ff744a, #ffc14d)"
              : "linear-gradient(90deg, #1f9d72, #d9e76c)",
          }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {visibleActions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="biomes-ui-action-button"
            disabled={action.disabled}
            title={action.blockedReason ?? action.label}
            data-farming-food-action={action.id}
            onClick={() => onAction(action)}
          >
            {action.label}
          </button>
        ))}
      </div>
      <p style={{ ...mutedTextStyle, marginTop: 8 }}>
        {model.plots.length} plots · {model.livestock.length} livestock ·{" "}
        {model.wildlife.length} wildlife
      </p>
    </div>
  );
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 12,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--biomes-fg-muted)",
};

const sectionHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const paperDollStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 56px)",
  gap: 8,
};

const mutedTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "var(--biomes-fg-muted)",
  lineHeight: 1.45,
};

const EquipSlot: React.FunctionComponent<{
  id: string;
  label: string;
  item?: InventoryUiItem | null;
  onClick?: () => void;
  onUnequip?: () => void;
}> = ({ id, label, item, onClick, onUnequip }) => (
  <Highlightable uniqueId={id} showCaption>
    <button
      type="button"
      className={`biomes-ui-slot${
        item ? " biomes-ui-inventory-tooltip-target" : ""
      }`}
      aria-label={item ? `${label}: ${item.label}` : `${label}: empty`}
      title={item ? inventoryTooltipLabel(item) : label}
      data-inventory-tooltip={item ? inventoryTooltipLabel(item) : undefined}
      onClick={onClick}
      onDoubleClick={onUnequip}
      data-inventory-equipment-slot={label}
    >
      {item ? (
        <>
          {renderInventoryIcon(item)}
          <span style={visuallyHiddenStyle}>{item.label}</span>
        </>
      ) : (
        <span aria-hidden style={{ fontSize: 9, opacity: 0.5 }}>
          {label}
        </span>
      )}
    </button>
  </Highlightable>
);

const hotbarSyncStyle: React.CSSProperties = {
  marginTop: 16,
  paddingTop: 12,
  borderTop: "1px solid var(--biomes-edge-cyan-soft)",
};
const hotbarRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  alignItems: "center",
};
const visuallyHiddenStyle: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};
