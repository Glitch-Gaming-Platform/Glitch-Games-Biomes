import * as React from "react";
import { usePointerLockManager } from "../contexts/PointerLockContext";
import {
  closePointerLockUnlockWhileOpen,
  openPointerLockUnlockWhileOpen,
  type PointerLockUnlockWhileOpenReturnRef,
} from "../contexts/pointerLockModalPolicy";
import { installBiomesUITheme } from "../biomes_ui/theme/biomesUITheme";
import { RovingGrid } from "../biomes_ui/nav/RovingGrid";
import {
  harthmereBikkieVisualGlyphStyle,
  harthmereBikkieVisualImageStyle,
  harthmereBikkieVisualImageUrl,
  harthmereBikkieVisualTileStyle,
} from "../biomes_ui/adapters/harthmereBikkieVisualRendering";
import type {
  HarthmereHomeConsoleAdapter,
  HarthmereHomeConsoleVisibleDecoration,
  HarthmereHomeConsoleVisibleDefinition,
  HarthmereHomeConsoleVisibleSeed,
  HarthmereHomeConsoleWorldContext,
} from "./homeConsoleLiveAdapter";

export interface HarthmereHomeConsolePanelProps {
  adapter: HarthmereHomeConsoleAdapter;
  context?: HarthmereHomeConsoleWorldContext;
  onClose?: () => void;
  compact?: boolean;
  initialTab?: HarthmereHomeConsolePanelTab;
}

export type HarthmereHomeConsolePanelTab =
  | "overview"
  | "furniture"
  | "decorate"
  | "garden"
  | "access";

const TABS: HarthmereHomeConsolePanelTab[] = [
  "overview",
  "furniture",
  "decorate",
  "garden",
  "access",
];

const TAB_LABELS: Record<HarthmereHomeConsolePanelTab, string> = {
  overview: "Overview",
  furniture: "Furniture",
  decorate: "Decorate",
  garden: "Garden",
  access: "Access",
};

function isTypingInInput(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || active.isContentEditable;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows.length ? rows : [[]];
}

function moveBy(
  entry: HarthmereHomeConsoleVisibleDecoration,
  dx: number,
  dz: number
) {
  return {
    x: entry.record.position.x + dx,
    y: entry.record.position.y,
    z: entry.record.position.z + dz,
  };
}

function rotated(entry: HarthmereHomeConsoleVisibleDecoration) {
  const next = (entry.record.rotationDegrees + 90) % 360;
  return next === 90 || next === 180 || next === 270 ? next : 0;
}

const BikkieVisualTile: React.FunctionComponent<{
  entry: Pick<HarthmereHomeConsoleVisibleDefinition, "visual">;
  size?: number;
}> = ({ entry, size = 40 }) => {
  const imageUrl = harthmereBikkieVisualImageUrl(entry.visual);
  return (
    <span
      aria-label={entry.visual.ariaLabel}
      title={entry.visual.metadataSummary}
      style={harthmereBikkieVisualTileStyle(entry.visual, size)}
      data-home-console-visual="true"
      data-visual-source={entry.visual.source}
      data-visual-kind={entry.visual.shape}
      data-visual-id={entry.visual.visualId}
      data-icon-asset-path={entry.visual.iconAssetPath}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          style={harthmereBikkieVisualImageStyle}
          data-home-console-visual-img="true"
        />
      ) : null}
      <span style={harthmereBikkieVisualGlyphStyle}>
        {entry.visual.glyph}
      </span>
    </span>
  );
};

export const HarthmereHomeConsolePanel: React.FunctionComponent<
  HarthmereHomeConsolePanelProps
> = ({ adapter, context = {}, onClose, compact = false, initialTab = "overview" }) => {
  const pointerLockManager = usePointerLockManager();
  const shouldReturnPointerLock =
    React.useRef<PointerLockUnlockWhileOpenReturnRef>({ current: false });
  const panel = adapter.getPanel(context);
  const available = adapter.isHydrated() && panel.canAccess;
  const [activeTab, setActiveTab] =
    React.useState<HarthmereHomeConsolePanelTab>(
      TABS.includes(initialTab) ? initialTab : "overview"
    );

  React.useEffect(() => installBiomesUITheme(), []);
  React.useEffect(() => {
    if (!available || compact) return;
    openPointerLockUnlockWhileOpen(
      pointerLockManager,
      shouldReturnPointerLock.current
    );
    return () => {
      closePointerLockUnlockWhileOpen(
        pointerLockManager,
        shouldReturnPointerLock.current
      );
    };
  }, [available, compact, pointerLockManager]);
  React.useEffect(() => {
    if (!available) return;
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingInInput()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const index = TABS.indexOf(activeTab);
      const dir = event.key === "ArrowRight" ? 1 : -1;
      setActiveTab(TABS[(index + dir + TABS.length) % TABS.length]);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeTab, available, onClose]);

  if (!available || !panel.property) return null;

  return (
    <div
      role="dialog"
      aria-label={`${panel.propertyDisplayName} home console`}
      data-harthmere-home-console-interface="true"
      data-home-console-access="owner-only"
      data-home-console-property-id={panel.property.propertyId}
      data-home-console-marker-id={panel.consoleMarker?.markerId}
      data-pointer-lock-policy="unlock-while-open"
      data-mouse-policy="show-while-open"
      className="biomes-ui-panel"
      style={{
        position: compact ? "relative" : "fixed",
        inset: compact
          ? undefined
          : "max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))",
        zIndex: compact ? undefined : 1265,
        width: compact ? "100%" : "calc(100vw - 20px)",
        maxWidth: compact ? undefined : 1160,
        maxHeight: compact ? undefined : "calc(100vh - 20px)",
        margin: compact ? undefined : "auto",
        overflow: "auto",
        boxSizing: "border-box",
        padding: compact ? 12 : "16px 18px",
      }}
    >
      <header style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Home Console</h2>
          <p style={mutedStyle}>
            {panel.propertyDisplayName} | Private owner access |{" "}
            {panel.summary.activeDecorations} placed items
          </p>
        </div>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={onClose}
          aria-label="Close home console"
        >
          Close
        </button>
      </header>

      <nav
        aria-label="Home console sections"
        style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className="biomes-ui-tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && <OverviewPane panel={panel} />}
      {activeTab === "furniture" && (
        <FurniturePane placeable={panel.placeable} adapter={adapter} />
      )}
      {activeTab === "decorate" && (
        <DecoratePane placed={panel.placed} adapter={adapter} />
      )}
      {activeTab === "garden" && (
        <GardenPane placed={panel.placed} seeds={panel.seeds} adapter={adapter} />
      )}
      {activeTab === "access" && <AccessPane panel={panel} />}
    </div>
  );
};

const OverviewPane: React.FunctionComponent<{
  panel: ReturnType<HarthmereHomeConsoleAdapter["getPanel"]>;
}> = ({ panel }) => {
  const metrics = [
    ["Storage", `+${panel.summary.storageSlotsBonus}`],
    ["Comfort", `${panel.summary.comfort}`],
    ["Lighting", `${panel.summary.lighting}`],
    ["Safety", `${panel.summary.safety}`],
    ["Power", `${panel.summary.powerMegawatts} MW`],
    ["Garden", `${panel.summary.gardenSlots}`],
  ];
  return (
    <section style={sectionGridStyle}>
      <div style={metricGridStyle}>
        {metrics.map(([label, value]) => (
          <div key={label} className="biomes-ui-card" style={metricCardStyle}>
            <span style={metricLabelStyle}>{label}</span>
            <strong style={metricValueStyle}>{value}</strong>
          </div>
        ))}
      </div>
      <div className="biomes-ui-card" style={summaryCardStyle}>
        <strong>Ready Home Items</strong>
        <span style={mutedDarkStyle}>
          {panel.placeable.filter((entry) => entry.canPlace).length} item types
          available from inventory.
        </span>
      </div>
    </section>
  );
};

const FurniturePane: React.FunctionComponent<{
  placeable: HarthmereHomeConsoleVisibleDefinition[];
  adapter: HarthmereHomeConsoleAdapter;
}> = ({ placeable, adapter }) => {
  return (
    <section style={sectionGridStyle}>
      <RovingGrid
        ariaLabel="Home furniture and items"
        items={chunk(placeable, 2)}
        style={{ display: "grid", gap: 6 }}
        onActivate={(_, __, entry) => {
          if (entry.canPlace) void adapter.placeDecoration(entry.definition.itemId);
        }}
        renderCell={(entry, coords, cellProps) => (
          <button
            {...cellProps}
            type="button"
            role="gridcell"
            className="biomes-ui-card"
            data-home-console-placeable="true"
            data-home-console-item-id={entry.definition.itemId}
            data-focused={coords.focused ? "true" : "false"}
            disabled={!entry.canPlace}
            aria-disabled={!entry.canPlace}
            aria-label={`Place ${entry.definition.displayName}`}
            onClick={() => void adapter.placeDecoration(entry.definition.itemId)}
            style={{
              ...itemButtonStyle,
              opacity: entry.canPlace ? 1 : 0.56,
              outline: coords.focused
                ? "2px solid rgba(255,255,255,0.72)"
                : "none",
            }}
          >
            <span style={itemHeaderStyle}>
              <BikkieVisualTile entry={entry} />
              <span style={{ minWidth: 0 }}>
                <span style={itemTitleStyle}>{entry.definition.displayName}</span>
                <span style={itemMetaStyle}>
                  Owned {entry.ownedCount} | Size {entry.footprintLabel}
                </span>
              </span>
            </span>
            <span style={itemSmallLineStyle}>
              {entry.canPlace ? entry.effectLabel : entry.missingReason}
            </span>
          </button>
        )}
      />
    </section>
  );
};

const DecoratePane: React.FunctionComponent<{
  placed: HarthmereHomeConsoleVisibleDecoration[];
  adapter: HarthmereHomeConsoleAdapter;
}> = ({ placed, adapter }) => {
  if (placed.length === 0) {
    return (
      <section style={sectionGridStyle}>
        <div className="biomes-ui-card" style={emptyStyle}>
          No placed home items
        </div>
      </section>
    );
  }
  return (
    <section style={sectionGridStyle}>
      {placed.map((entry) => (
        <div
          key={entry.record.decorationId}
          className="biomes-ui-card"
          data-home-console-placed-item="true"
          data-home-console-decoration-id={entry.record.decorationId}
          style={placedRowStyle}
        >
          <span style={itemHeaderStyle}>
            <BikkieVisualTile entry={entry} />
            <span style={{ minWidth: 0 }}>
              <strong style={itemTitleStyle}>{entry.record.displayName}</strong>
              <span style={itemMetaStyle}>
                X {entry.record.position.x} | Z {entry.record.position.z} |
                Turn {entry.record.rotationDegrees}
              </span>
            </span>
          </span>
          <span style={actionGroupStyle}>
            <button
              type="button"
              className="biomes-ui-tab"
              style={cardActionButtonStyle}
              aria-label={`Move ${entry.record.displayName} left`}
              onClick={() =>
                void adapter.moveDecoration(
                  entry.record.decorationId,
                  moveBy(entry, -1, 0),
                  entry.record.rotationDegrees
                )
              }
            >
              X-
            </button>
            <button
              type="button"
              className="biomes-ui-tab"
              style={cardActionButtonStyle}
              aria-label={`Move ${entry.record.displayName} right`}
              onClick={() =>
                void adapter.moveDecoration(
                  entry.record.decorationId,
                  moveBy(entry, 1, 0),
                  entry.record.rotationDegrees
                )
              }
            >
              X+
            </button>
            <button
              type="button"
              className="biomes-ui-tab"
              style={cardActionButtonStyle}
              aria-label={`Move ${entry.record.displayName} back`}
              onClick={() =>
                void adapter.moveDecoration(
                  entry.record.decorationId,
                  moveBy(entry, 0, -1),
                  entry.record.rotationDegrees
                )
              }
            >
              Z-
            </button>
            <button
              type="button"
              className="biomes-ui-tab"
              style={cardActionButtonStyle}
              aria-label={`Move ${entry.record.displayName} forward`}
              onClick={() =>
                void adapter.moveDecoration(
                  entry.record.decorationId,
                  moveBy(entry, 0, 1),
                  entry.record.rotationDegrees
                )
              }
            >
              Z+
            </button>
            <button
              type="button"
              className="biomes-ui-tab"
              style={cardActionButtonStyle}
              onClick={() =>
                void adapter.moveDecoration(
                  entry.record.decorationId,
                  entry.record.position,
                  rotated(entry)
                )
              }
            >
              Turn
            </button>
            {entry.canUse ? (
              <button
                type="button"
                className="biomes-ui-tab"
                style={cardActionButtonStyle}
                onClick={() => void adapter.useDecoration(entry.record.decorationId)}
              >
                Use
              </button>
            ) : null}
            <button
              type="button"
              className="biomes-ui-tab"
              style={cardActionButtonStyle}
              onClick={() => void adapter.removeDecoration(entry.record.decorationId)}
            >
              Remove
            </button>
          </span>
        </div>
      ))}
    </section>
  );
};

const GardenPane: React.FunctionComponent<{
  placed: HarthmereHomeConsoleVisibleDecoration[];
  seeds: HarthmereHomeConsoleVisibleSeed[];
  adapter: HarthmereHomeConsoleAdapter;
}> = ({ placed, seeds, adapter }) => {
  const gardens = placed.filter((entry) => entry.record.kind === "garden");
  if (gardens.length === 0) {
    return (
      <section style={sectionGridStyle}>
        <div className="biomes-ui-card" style={emptyStyle}>
          Place a Garden Planter Box to grow crops at home.
        </div>
      </section>
    );
  }
  return (
    <section style={sectionGridStyle}>
      {gardens.map((entry) => (
        <div
          key={entry.record.decorationId}
          className="biomes-ui-card"
          style={placedRowStyle}
          data-home-console-garden="true"
        >
          <span style={itemHeaderStyle}>
            <BikkieVisualTile entry={entry} />
            <span style={{ minWidth: 0 }}>
              <strong style={itemTitleStyle}>{entry.record.displayName}</strong>
              <span style={itemMetaStyle}>
                {entry.gardenStatus === "empty"
                  ? "Empty planter"
                  : entry.gardenStatus === "ready"
                    ? "Ready to harvest"
                    : entry.gardenLabel ?? "Growing"}
              </span>
            </span>
          </span>
          <span style={actionGroupStyle}>
            {entry.gardenStatus === "empty"
              ? seeds.map((seed) => (
                  <button
                    key={seed.seedItemId}
                    type="button"
                    className="biomes-ui-tab"
                    style={cardActionButtonStyle}
                    disabled={!seed.canPlant}
                    aria-disabled={!seed.canPlant}
                    onClick={() =>
                      void adapter.plantGarden(
                        entry.record.decorationId,
                        seed.seedItemId
                      )
                    }
                  >
                    Plant {seed.displayName}
                  </button>
                ))
              : null}
            {entry.gardenStatus === "growing" ? (
              <button
                type="button"
                className="biomes-ui-tab"
                style={cardActionButtonStyle}
                onClick={() => void adapter.waterGarden(entry.record.decorationId)}
              >
                Water
              </button>
            ) : null}
            {entry.gardenStatus === "ready" ? (
              <button
                type="button"
                className="biomes-ui-tab"
                style={cardActionButtonStyle}
                onClick={() => void adapter.harvestGarden(entry.record.decorationId)}
              >
                Harvest
              </button>
            ) : null}
          </span>
        </div>
      ))}
    </section>
  );
};

const AccessPane: React.FunctionComponent<{
  panel: ReturnType<HarthmereHomeConsoleAdapter["getPanel"]>;
}> = ({ panel }) => (
  <section style={sectionGridStyle}>
    <div className="biomes-ui-card" style={summaryCardStyle}>
      <strong>Private Owner Console</strong>
      <span style={mutedDarkStyle}>
        Only the owner can manage this home's furniture, decorating, gardens,
        utilities, and station placements.
      </span>
      <span style={mutedDarkStyle}>
        Use the {panel.consoleMarker?.label ?? "Home Console"} inside your home
        to place furniture, run stations, and care for plants.
      </span>
    </div>
  </section>
);

const headerStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 12,
  alignItems: "start",
  marginBottom: 12,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  lineHeight: 1.15,
  letterSpacing: 0,
};

const mutedStyle: React.CSSProperties = {
  margin: 0,
  color: "rgba(255,255,255,0.68)",
  fontSize: 12,
  lineHeight: 1.35,
  letterSpacing: 0,
};

const mutedDarkStyle: React.CSSProperties = {
  margin: 0,
  color: "rgba(16,22,34,0.72)",
  fontSize: 12,
  lineHeight: 1.35,
  letterSpacing: 0,
};

const sectionGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const metricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
  gap: 8,
};

const metricCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 10,
};

const metricLabelStyle: React.CSSProperties = {
  color: "rgba(16,22,34,0.72)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const metricValueStyle: React.CSSProperties = {
  color: "#101622",
  fontSize: 20,
  lineHeight: 1,
  letterSpacing: 0,
};

const summaryCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 12,
};

const itemButtonStyle: React.CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: 8,
  width: "min(100%, 292px)",
  minHeight: 110,
  padding: "10px 12px",
  textAlign: "left",
  cursor: "pointer",
};

const itemHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "40px minmax(0, 1fr)",
  gap: 8,
  alignItems: "center",
  minWidth: 0,
};

const itemTitleStyle: React.CSSProperties = {
  display: "block",
  color: "#101622",
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.2,
  letterSpacing: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const itemMetaStyle: React.CSSProperties = {
  display: "block",
  color: "rgba(16,22,34,0.72)",
  fontSize: 12,
  lineHeight: 1.3,
  letterSpacing: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const itemSmallLineStyle: React.CSSProperties = {
  color: "rgba(16,22,34,0.72)",
  fontSize: 12,
  lineHeight: 1.3,
  minHeight: 16,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const emptyStyle: React.CSSProperties = {
  padding: 12,
  minHeight: 48,
};

const placedRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 10,
  alignItems: "center",
  padding: 10,
};

const actionGroupStyle: React.CSSProperties = {
  display: "flex",
  gap: 4,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const cardActionButtonStyle: React.CSSProperties = {
  minWidth: 44,
  minHeight: 32,
  padding: "7px 9px",
  border: "1px solid rgba(16,22,34,0.16)",
  borderRadius: 5,
  background: "rgba(7,12,26,0.06)",
  color: "#101622",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase",
};
