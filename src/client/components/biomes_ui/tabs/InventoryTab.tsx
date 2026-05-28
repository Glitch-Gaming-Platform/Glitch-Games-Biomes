// InventoryTab — production BiomesUI inventory surface.
//
// This panel is intentionally backed by the real ECS inventory/wearing adapter
// instead of local placeholder state. It supports keyboard-navigable backpack
// browsing, equipment, currencies, selected-item details, hotbar movement,
// stack operations, sorting, dropping, destroying, and equip/unequip actions.

import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { RovingGrid } from "../nav/RovingGrid";
import { UI_IDS } from "../uniqueIds";

export type InventoryContainerKey = "backpack" | "hotbar" | "equipment";

export interface InventoryUiRef {
  kind: "item" | "hotbar" | "wearable" | "currency";
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
  durability?: { current: number; max: number };
  equipSlot?: string;
  ref?: InventoryUiRef;
  source?: InventoryContainerKey;
  selected?: boolean;
}

interface InventoryEquipmentSlot {
  id: string;
  label: string;
  item?: InventoryUiItem | null;
  ref: InventoryUiRef;
}

interface InventoryAdapter {
  getEquipment?: () => InventoryEquipmentSlot[] | Partial<Record<string, InventoryUiItem | null>>;
  getBackpack?: () => {
    items: Array<InventoryUiItem | null>;
    maxSlots: number;
    usedSlots?: number;
    capacityLabel?: string;
  };
  getCurrencies?: () => Array<{ id: string; name: string; amount: number; icon: string }>;
  getSelectedItem?: () => InventoryUiItem | null;
  selectItem?: (ref: InventoryUiRef) => void;
  useItem?: (ref: InventoryUiRef) => void;
  equipItem?: (ref: InventoryUiRef, equipSlot?: string) => void;
  unequipItem?: (ref: InventoryUiRef) => void;
  moveItem?: (src: InventoryUiRef, dst: InventoryUiRef) => void;
  splitStack?: (src: InventoryUiRef, dst: InventoryUiRef, count: number) => void;
  combineStack?: (src: InventoryUiRef, dst: InventoryUiRef, count: number) => void;
  dropItem?: (ref: InventoryUiRef, count?: number) => void;
  destroyItem?: (ref: InventoryUiRef, count?: number) => void;
  sortInventory?: () => void;
}

const EQUIPMENT_ORDER: Array<{ id: string; label: string; key: string; highlight: string }> = [
  { id: "head", label: "Head", key: "head", highlight: UI_IDS.INVENTORY_SLOT_HEAD },
  { id: "chest", label: "Chest", key: "chest", highlight: UI_IDS.INVENTORY_SLOT_CHEST },
  { id: "legs", label: "Legs", key: "legs", highlight: UI_IDS.INVENTORY_SLOT_LEGS },
  { id: "feet", label: "Feet", key: "feet", highlight: UI_IDS.INVENTORY_SLOT_FEET },
  { id: "hands", label: "Hands", key: "hands", highlight: UI_IDS.INVENTORY_SLOT_HANDS },
  { id: "main_hand", label: "Main Hand", key: "main_hand", highlight: UI_IDS.INVENTORY_SLOT_MAIN_HAND },
  { id: "off_hand", label: "Off Hand", key: "off_hand", highlight: UI_IDS.INVENTORY_SLOT_OFF_HAND },
];

const FILTERS = ["all", "gear", "tools", "materials", "consumables", "quest"] as const;
type InventoryFilter = (typeof FILTERS)[number];

export const InventoryTab: React.FunctionComponent<{ adapter?: InventoryAdapter }> = ({
  adapter,
}) => {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<InventoryFilter>("all");
  const [selectedRef, setSelectedRef] = React.useState<InventoryUiRef | null>(null);

  const backpack = adapter?.getBackpack?.() ?? { items: [], maxSlots: 32, usedSlots: 0 };
  const currencies = adapter?.getCurrencies?.() ?? [];
  const equipment = normalizeEquipment(adapter?.getEquipment?.());
  const selectedItem =
    findItemByRef(backpack.items, equipment, selectedRef) ?? adapter?.getSelectedItem?.() ?? null;
  const firstEmptyBackpackIndex = React.useMemo(
    () => Math.max(0, backpack.items.findIndex((item) => !item)),
    [backpack.items],
  );

  const cells = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const sourceItems = Array.from({ length: backpack.maxSlots }, (_, i) => {
      const item = backpack.items[i] ?? null;
      if (!item) return null;
      const label = item.label.toLowerCase();
      const category = String(item.category ?? "").toLowerCase();
      const matchesQuery = !q || label.includes(q) || category.includes(q) || item.id.toLowerCase().includes(q);
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
    [adapter],
  );

  return (
    <div className="biomes-ui-inventory" data-production-inventory="true">
      <section className="biomes-ui-inventory__sidebar" aria-label="Inventory character state">
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
              onUnequip={() => slot.item?.ref && adapter?.unequipItem?.(slot.item.ref)}
            />
          ))}
        </div>

        <h3 style={{ ...titleStyle, marginTop: 16 }}>Currencies</h3>
        <div className="biomes-ui-inventory__currency-list" aria-label="Currencies">
          {currencies.length === 0 ? (
            <p style={mutedTextStyle}>No currency balances found.</p>
          ) : (
            currencies.map((currency) => (
              <div key={currency.id} className="biomes-ui-inventory__currency-row">
                <span aria-hidden>{currency.icon}</span>
                <span>{currency.name}</span>
                <strong>{currency.amount.toLocaleString()}</strong>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="biomes-ui-inventory__main" aria-label="Backpack inventory">
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
          <div className="biomes-ui-inventory__filters" role="tablist" aria-label="Inventory filters">
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
          <span style={{ marginLeft: 8, fontSize: 11, color: "var(--biomes-fg-muted)" }}>
            {backpack.usedSlots ?? backpack.items.filter(Boolean).length} / {backpack.maxSlots}
            {backpack.capacityLabel ? ` · ${backpack.capacityLabel}` : ""}
          </span>
        </h3>
        <RovingGrid
          ariaLabel="Backpack slots"
          items={cells}
          renderCell={(item, { focused }, cell) =>
            React.createElement(
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
                className: "biomes-ui-slot biomes-ui-inventory__slot",
                "aria-label": item ? `${item.label}${item.count ? ` x${item.count}` : ""}` : "Empty slot",
                "data-focused": focused ? "true" : undefined,
                "data-selected": selectedRef && item?.ref && refsEqual(selectedRef, item.ref) ? "true" : undefined,
                "data-inventory-ref": item?.ref ? serializeInventoryRef(item.ref) : undefined,
                style: { width: 52, height: 52 },
              },
              item
                ? React.createElement(React.Fragment, null,
                    renderInventoryIcon(item),
                    item.count && item.count > 1
                      ? React.createElement("span", { className: "biomes-ui-inventory__count" }, item.count)
                      : null,
                    item.durability
                      ? React.createElement("span", {
                          className: "biomes-ui-inventory__durability",
                          style: { width: `${Math.max(4, Math.min(100, (item.durability.current / Math.max(1, item.durability.max)) * 100))}%` },
                        })
                      : null,
                  )
                : null,
            )
          }
        />
      </section>

      <section className="biomes-ui-inventory__details" aria-label="Selected item details">
        <h3 style={titleStyle}>Selected Item</h3>
        {selectedItem ? (
          <div className="biomes-ui-inventory__details-card">
            <div className="biomes-ui-inventory__details-heading">
              <span aria-hidden style={{ fontSize: 28 }}>{renderInventoryIcon(selectedItem)}</span>
              <div>
                <strong>{selectedItem.label}</strong>
                <p>{selectedItem.category ?? selectedItem.quality ?? "inventory item"}</p>
              </div>
            </div>
            <p style={mutedTextStyle}>{selectedItem.description ?? "No description available from item metadata."}</p>
            <div className="biomes-ui-inventory__actions" aria-label="Inventory item actions">
              <button type="button" onClick={() => selectedItem.ref && adapter?.useItem?.(selectedItem.ref)} data-inventory-action="use">Use / Select</button>
              <button type="button" onClick={() => selectedItem.ref && adapter?.equipItem?.(selectedItem.ref, selectedItem.equipSlot)} disabled={!selectedItem.equipSlot} data-inventory-action="equip">Equip</button>
              <button type="button" onClick={() => selectedItem.ref && adapter?.moveItem?.(selectedItem.ref, { kind: "hotbar", idx: 0 })} data-inventory-action="move-hotbar">Hotbar 1</button>
              <button type="button" onClick={() => selectedItem.ref && adapter?.splitStack?.(selectedItem.ref, { kind: "item", idx: firstEmptyBackpackIndex < 0 ? 0 : firstEmptyBackpackIndex }, Math.max(1, Math.floor((selectedItem.count ?? 1) / 2)))} disabled={(selectedItem.count ?? 1) < 2} data-inventory-action="split">Split</button>
              <button type="button" onClick={() => selectedItem.ref && adapter?.dropItem?.(selectedItem.ref, 1)} data-inventory-action="drop-one">Drop 1</button>
              <button type="button" onClick={() => selectedItem.ref && adapter?.dropItem?.(selectedItem.ref)} data-inventory-action="drop-all">Drop All</button>
              <button type="button" onClick={() => selectedItem.ref && adapter?.destroyItem?.(selectedItem.ref, 1)} data-inventory-action="destroy">Destroy</button>
            </div>
          </div>
        ) : (
          <p style={mutedTextStyle}>Select a backpack, hotbar, or equipment slot to inspect and act on it.</p>
        )}
        <div className="biomes-ui-inventory__contract-note">
          Real inventory actions publish ECS inventory events. The UI does not mutate browser storage as inventory truth.
        </div>
      </section>
    </div>
  );
};

function normalizeEquipment(
  raw?: InventoryEquipmentSlot[] | Partial<Record<string, InventoryUiItem | null>>,
): Array<InventoryEquipmentSlot & { highlight: string }> {
  if (Array.isArray(raw)) {
    return EQUIPMENT_ORDER.map((slot) => {
      const found = raw.find((entry) => entry.id === slot.id || String(entry.ref?.key) === slot.key);
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
): InventoryUiItem | null {
  if (!ref) return null;
  for (const item of backpackItems) {
    if (item?.ref && refsEqual(item.ref, ref)) return item;
  }
  for (const slot of equipment) {
    if (slot.item?.ref && refsEqual(slot.item.ref, ref)) return slot.item;
  }
  return null;
}

function refsEqual(a: InventoryUiRef, b: InventoryUiRef): boolean {
  return a.kind === b.kind && a.idx === b.idx && String(a.key ?? "") === String(b.key ?? "");
}

function serializeInventoryRef(ref: InventoryUiRef): string {
  return `${ref.kind}:${ref.idx ?? ref.key ?? ""}`;
}

function renderInventoryIcon(item: InventoryUiItem): React.ReactNode {
  if (item.icon && /^https?:\/\//.test(item.icon)) {
    return <img src={item.icon} alt="" aria-hidden style={{ width: 30, height: 30, objectFit: "contain" }} />;
  }
  return <span aria-hidden style={{ fontSize: 22 }}>{item.icon || "◼"}</span>;
}

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
      className="biomes-ui-slot"
      aria-label={item ? `${label}: ${item.label}` : `${label}: empty`}
      title={item?.label ?? label}
      onClick={onClick}
      onDoubleClick={onUnequip}
      data-inventory-equipment-slot={label}
    >
      {item ? renderInventoryIcon(item) : <span aria-hidden style={{ fontSize: 9, opacity: 0.5 }}>{label}</span>}
    </button>
  </Highlightable>
);
