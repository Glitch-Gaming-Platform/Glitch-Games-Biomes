import * as React from "react";
import { usePointerLockManager } from "../contexts/PointerLockContext";
import {
  closePointerLockUnlockWhileOpenV1,
  openPointerLockUnlockWhileOpenV1,
  type PointerLockUnlockWhileOpenReturnRefV1,
} from "../contexts/pointerLockModalPolicy";
import { RovingGrid } from "../biomes_ui/nav/RovingGrid";
import { installBiomesUITheme } from "../biomes_ui/theme/biomesUITheme";
import {
  harthmereBikkieVisualGlyphStyleV1,
  harthmereBikkieVisualImageStyleV1,
  harthmereBikkieVisualImageUrlV1,
  harthmereBikkieVisualTileStyleV1,
} from "../biomes_ui/adapters/harthmereBikkieVisualRenderingV1";
import type {
  HarthmereCraftingStationAdapterV1,
  HarthmereCraftingVisibleRecipeV1,
} from "./craftingStationLiveAdapter";
import {
  formatHarthmereCraftingRecipeNameV1,
  formatHarthmereCraftingStationTypeLabelV1,
} from "./craftingStationLiveAdapter";

export interface HarthmereCraftingStationPanelProps {
  adapter: HarthmereCraftingStationAdapterV1;
  onClose?: () => void;
  compact?: boolean;
  initialTab?: HarthmereCraftingStationPanelTabV1;
}

export type HarthmereCraftingStationPanelTabV1 =
  | "recipes"
  | "jobs"
  | "services";

const TABS: HarthmereCraftingStationPanelTabV1[] = [
  "recipes",
  "jobs",
  "services",
];

const TAB_LABELS: Record<HarthmereCraftingStationPanelTabV1, string> = {
  recipes: "Recipes",
  jobs: "Jobs",
  services: "Services",
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

function formatMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "Ready";
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

const CraftingOutputVisual: React.FunctionComponent<{
  recipe: HarthmereCraftingVisibleRecipeV1;
}> = ({ recipe }) => {
  const imageUrl = harthmereBikkieVisualImageUrlV1(recipe.outputVisual);
  return (
    <span
      aria-label={recipe.outputVisual.ariaLabel}
      title={recipe.outputVisual.metadataSummary}
      style={harthmereBikkieVisualTileStyleV1(recipe.outputVisual, 38)}
      data-harthmere-crafting-visual="true"
      data-visual-source={recipe.outputVisual.source}
      data-visual-kind={recipe.outputVisual.shape}
      data-visual-id={recipe.outputVisual.visualId}
      data-icon-asset-path={recipe.outputVisual.iconAssetPath}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          style={harthmereBikkieVisualImageStyleV1}
          data-harthmere-crafting-visual-img="true"
        />
      ) : null}
      <span style={harthmereBikkieVisualGlyphStyleV1}>
        {recipe.outputVisual.glyph}
      </span>
    </span>
  );
};

export const HarthmereCraftingStationPanel: React.FunctionComponent<
  HarthmereCraftingStationPanelProps
> = ({ adapter, onClose, compact = false, initialTab = "recipes" }) => {
  const pointerLockManager = usePointerLockManager();
  const shouldReturnPointerLock =
    React.useRef<PointerLockUnlockWhileOpenReturnRefV1>({ current: false });
  const snapshot = adapter.getSnapshot();
  const available = adapter.isHydrated() && !!snapshot;
  const recipes = adapter.getRecipes();
  const [activeTab, setActiveTab] =
    React.useState<HarthmereCraftingStationPanelTabV1>(
      TABS.includes(initialTab) ? initialTab : "recipes"
    );

  React.useEffect(() => installBiomesUITheme(), []);
  React.useEffect(() => {
    if (!available || compact) return;
    openPointerLockUnlockWhileOpenV1(
      pointerLockManager,
      shouldReturnPointerLock.current
    );
    return () => {
      closePointerLockUnlockWhileOpenV1(
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

  if (!snapshot || !available) return null;

  return (
    <div
      role="dialog"
      aria-label={`${snapshot.stationName} crafting station`}
      data-harthmere-crafting-station-interface="true"
      data-crafting-station-id={snapshot.stationId}
      data-pointer-lock-policy="unlock-while-open"
      data-mouse-policy="show-while-open"
      className="biomes-ui-panel"
      style={{
        position: compact ? "relative" : "fixed",
        inset: compact
          ? undefined
          : "max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))",
        zIndex: compact ? undefined : 1260,
        width: compact ? "100%" : "calc(100vw - 20px)",
        maxWidth: compact ? undefined : 1120,
        maxHeight: compact ? undefined : "calc(100vh - 20px)",
        margin: compact ? undefined : "auto",
        overflow: "auto",
        boxSizing: "border-box",
        padding: compact ? 12 : "16px 18px",
      }}
    >
      <header
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 12,
          alignItems: "start",
          marginBottom: 12,
        }}
      >
        <div>
          <h2 style={titleStyle}>{snapshot.stationName}</h2>
          <p style={mutedStyle}>
            {formatHarthmereCraftingStationTypeLabelV1(snapshot.stationType)} ·{" "}
            {snapshot.gold} gold ·{" "}
            {pluralize(
              Object.keys(snapshot.materialStorage).length,
              "material",
              "materials"
            )}
          </p>
        </div>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={onClose}
          aria-label="Close crafting station"
        >
          Close
        </button>
      </header>

      <nav
        aria-label="Crafting station sections"
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

      {activeTab === "recipes" && (
        <RecipePane recipes={recipes} adapter={adapter} />
      )}
      {activeTab === "jobs" && (
        <JobsPane snapshot={snapshot} adapter={adapter} />
      )}
      {activeTab === "services" && (
        <ServicesPane recipes={recipes} snapshot={snapshot} />
      )}
    </div>
  );
};

const RecipePane: React.FunctionComponent<{
  recipes: HarthmereCraftingVisibleRecipeV1[];
  adapter: HarthmereCraftingStationAdapterV1;
}> = ({ recipes, adapter }) => {
  return (
    <section style={sectionGridStyle}>
      <RovingGrid
        ariaLabel="Crafting recipes"
        items={chunk(recipes, 2)}
        style={{ display: "grid", gap: 6 }}
        onActivate={(_, __, entry) => {
          if (entry.canCraft) void adapter.craft(entry.recipe.recipeId);
        }}
        renderCell={(entry, coords, cellProps) => (
          <button
            {...cellProps}
            type="button"
            role="gridcell"
            className="biomes-ui-card"
            aria-disabled={!entry.canCraft}
            aria-label={`${entry.outputName} recipe`}
            data-crafting-recipe-id={entry.recipe.recipeId}
            data-focused={coords.focused ? "true" : "false"}
            style={{
              ...recipeButtonStyle,
              opacity: entry.canCraft ? 1 : 0.58,
              outline: coords.focused
                ? "2px solid rgba(255,255,255,0.72)"
                : "none",
            }}
          >
            <span style={recipeHeaderStyle}>
              <CraftingOutputVisual recipe={entry} />
              <span style={{ minWidth: 0 }}>
                <span style={recipeTitleStyle}>{entry.outputName}</span>
                <span style={recipeMetaStyle}>
                  {entry.workflowLabel} · {entry.qualityLabel}
                </span>
              </span>
            </span>
            <span style={recipeSmallLineStyle}>
              {entry.canCraft ? "Ready" : entry.missing.slice(0, 3).join(", ")}
            </span>
          </button>
        )}
      />
    </section>
  );
};

const JobsPane: React.FunctionComponent<{
  snapshot: NonNullable<
    ReturnType<HarthmereCraftingStationAdapterV1["getSnapshot"]>
  >;
  adapter: HarthmereCraftingStationAdapterV1;
}> = ({ snapshot, adapter }) => {
  const jobs = snapshot.activeJobs;
  return (
    <section style={sectionGridStyle}>
      {jobs.length === 0 ? (
        <div className="biomes-ui-card" style={emptyStyle}>
          No active work
        </div>
      ) : (
        jobs.map((job) => (
          <div key={job.jobId} className="biomes-ui-card" style={jobRowStyle}>
            <div>
              <strong>
                {formatHarthmereCraftingRecipeNameV1(job.recipeId)}
              </strong>
              <p style={mutedStyle}>
                {formatMs(job.readyAtMs - snapshot.nowMs)}
              </p>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                className="biomes-ui-tab"
                onClick={() => void adapter.completeJob(job.jobId)}
              >
                Complete
              </button>
              <button
                type="button"
                className="biomes-ui-tab"
                onClick={() => void adapter.cancelJob(job.jobId)}
              >
                Cancel
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  );
};

const ServicesPane: React.FunctionComponent<{
  recipes: HarthmereCraftingVisibleRecipeV1[];
  snapshot: NonNullable<
    ReturnType<HarthmereCraftingStationAdapterV1["getSnapshot"]>
  >;
}> = ({ recipes, snapshot }) => {
  const services = recipes.filter(
    (entry) =>
      entry.recipe.workflowKind && entry.recipe.workflowKind !== "craft"
  );
  return (
    <section style={sectionGridStyle}>
      <div className="biomes-ui-card" style={summaryStyle}>
        <strong>{snapshot.stationName}</strong>
        <span>{pluralize(services.length, "service", "services")}</span>
        <span>
          {pluralize(snapshot.history.length, "finished job", "finished jobs")}
        </span>
      </div>
      {services.map((entry) => (
        <div
          key={entry.recipe.recipeId}
          className="biomes-ui-card"
          style={serviceRowStyle}
        >
          <span>{entry.outputName}</span>
          <span style={mutedStyle}>{entry.workflowLabel}</span>
        </div>
      ))}
    </section>
  );
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

const smallLineStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.82)",
  fontSize: 12,
  lineHeight: 1.3,
  minHeight: 16,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const sectionGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const recipeButtonStyle: React.CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: 8,
  width: "min(100%, 256px)",
  minHeight: 98,
  padding: "10px 12px",
  textAlign: "left",
  cursor: "pointer",
};

const recipeHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "38px minmax(0, 1fr)",
  gap: 8,
  alignItems: "center",
};

const recipeTitleStyle: React.CSSProperties = {
  display: "block",
  color: "#101622",
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.2,
  letterSpacing: 0,
};

const recipeMetaStyle: React.CSSProperties = {
  ...mutedStyle,
  color: "rgba(16,22,34,0.72)",
};

const recipeSmallLineStyle: React.CSSProperties = {
  ...smallLineStyle,
  color: "rgba(16,22,34,0.7)",
};

const emptyStyle: React.CSSProperties = {
  padding: 12,
  minHeight: 48,
};

const jobRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 10,
  alignItems: "center",
  padding: 10,
};

const summaryStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  padding: 10,
};

const serviceRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 10,
  padding: 10,
};
