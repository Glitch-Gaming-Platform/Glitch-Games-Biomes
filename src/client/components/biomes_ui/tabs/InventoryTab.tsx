// InventoryTab — equipment paper doll + backpack grid.
//
// Wires (optionally) to the Harthmere inventory state via the `adapter`
// prop. The adapter is expected to expose:
//   - getEquipment(): Partial<Record<EquipmentSlot, Item>>
//   - getBackpack(): { items: Item[]; maxSlots: number }
//   - equip(slot, instanceId): void
//   - unequip(slot): void
//
// When no adapter is provided, we render an empty scaffold so the panel
// is still navigable for design/test purposes.

import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { RovingGrid } from "../nav/RovingGrid";
import { UI_IDS } from "../uniqueIds";

interface InventoryAdapter {
  getEquipment?: () => Partial<Record<string, { id: string; name: string; icon: string }>>;
  getBackpack?: () => {
    items: Array<{ id: string; name: string; icon: string; count?: number } | null>;
    maxSlots: number;
  };
}

export const InventoryTab: React.FunctionComponent<{ adapter?: InventoryAdapter }> = ({
  adapter,
}) => {
  const equipment = adapter?.getEquipment?.() ?? {};
  const backpack = adapter?.getBackpack?.() ?? { items: [], maxSlots: 32 };

  const cells = React.useMemo(() => {
    const items: Array<{ id: string; name: string; icon: string; count?: number } | null> =
      Array.from({ length: backpack.maxSlots }, (_, i) => backpack.items[i] ?? null);
    const rows: typeof items[] = [];
    const cols = 8;
    for (let r = 0; r < Math.ceil(items.length / cols); r++) {
      rows.push(items.slice(r * cols, (r + 1) * cols));
    }
    return rows;
  }, [backpack]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 18 }}>
      <section aria-label="Equipped gear">
        <h3 style={titleStyle}>Equipped</h3>
        <div style={paperDollStyle}>
          <EquipSlot id={UI_IDS.INVENTORY_SLOT_HEAD} label="Head" item={equipment.head} />
          <EquipSlot id={UI_IDS.INVENTORY_SLOT_CHEST} label="Chest" item={equipment.chest} />
          <EquipSlot id={UI_IDS.INVENTORY_SLOT_LEGS} label="Legs" item={equipment.legs} />
          <EquipSlot id={UI_IDS.INVENTORY_SLOT_FEET} label="Feet" item={equipment.feet} />
          <EquipSlot id={UI_IDS.INVENTORY_SLOT_HANDS} label="Hands" item={equipment.hands} />
          <EquipSlot id={UI_IDS.INVENTORY_SLOT_MAIN_HAND} label="Main Hand" item={equipment.main_hand} />
          <EquipSlot id={UI_IDS.INVENTORY_SLOT_OFF_HAND} label="Off Hand" item={equipment.off_hand} />
        </div>
      </section>
      <section aria-label="Backpack">
        <h3 style={titleStyle}>
          Backpack
          <span style={{ marginLeft: 8, fontSize: 11, color: "var(--biomes-fg-muted)" }}>
            {backpack.items.filter(Boolean).length} / {backpack.maxSlots}
          </span>
        </h3>
        <RovingGrid
          ariaLabel="Backpack slots"
          items={cells}
          renderCell={(item, { focused }, cell) =>
            React.createElement(
              "div",
              {
                ref: cell.ref,
                tabIndex: cell.tabIndex,
                onFocus: cell.onFocus,
                onClick: cell.onClick,
                onKeyDown: cell.onKeyDown,
                className: "biomes-ui-slot",
                "aria-label": item ? `${item.name}${item.count ? ` x${item.count}` : ""}` : "Empty slot",
                "data-focused": focused ? "true" : undefined,
                style: { width: 52, height: 52 },
              },
              item
                ? React.createElement(React.Fragment, null,
                    React.createElement("span", { "aria-hidden": true, style: { fontSize: 22 } }, item.icon),
                    item.count && item.count > 1
                      ? React.createElement("span", {
                          style: {
                            position: "absolute", right: 4, top: 2,
                            fontSize: 10, fontWeight: 700, color: "#fff",
                            textShadow: "0 0 4px rgba(0,0,0,0.7)",
                          },
                        }, item.count)
                      : null
                  )
                : null
            )
          }
        />
      </section>
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

const paperDollStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 56px)",
  gap: 8,
};

const EquipSlot: React.FunctionComponent<{
  id: string;
  label: string;
  item?: { id: string; name: string; icon: string };
}> = ({ id, label, item }) => (
  <Highlightable uniqueId={id} showCaption>
    <button
      type="button"
      className="biomes-ui-slot"
      aria-label={item ? `${label}: ${item.name}` : `${label}: empty`}
      title={item?.name ?? label}
    >
      {item ? (
        <span aria-hidden style={{ fontSize: 22 }}>{item.icon}</span>
      ) : (
        <span aria-hidden style={{ fontSize: 9, opacity: 0.5 }}>{label}</span>
      )}
    </button>
  </Highlightable>
);
