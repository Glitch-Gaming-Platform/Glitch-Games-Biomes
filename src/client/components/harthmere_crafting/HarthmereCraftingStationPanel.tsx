import * as React from "react";
import { usePointerLockManager } from "../contexts/PointerLockContext";
import {
  closePointerLockUnlockWhileOpen,
  openPointerLockUnlockWhileOpen,
  type PointerLockUnlockWhileOpenReturnRef,
} from "../contexts/pointerLockModalPolicy";
import { RovingGrid } from "../biomes_ui/nav/RovingGrid";
import { installBiomesUITheme } from "../biomes_ui/theme/biomesUITheme";
import {
  harthmereBikkieVisualGlyphStyle,
  harthmereBikkieVisualImageStyle,
  harthmereBikkieVisualImageUrl,
  harthmereBikkieVisualTileStyle,
} from "../biomes_ui/adapters/harthmereBikkieVisualRendering";
import type {
  HarthmereCraftingStationAdapter,
  HarthmereCraftingVisibleRecipe,
} from "./craftingStationLiveAdapter";
import {
  formatHarthmereCraftingRecipeName,
  formatHarthmereCraftingStationTypeLabel,
} from "./craftingStationLiveAdapter";

export interface HarthmereCraftingStationPanelProps {
  adapter: HarthmereCraftingStationAdapter;
  onClose?: () => void;
  compact?: boolean;
  initialTab?: HarthmereCraftingStationPanelTab;
}

export type HarthmereCraftingStationPanelTab =
  | "recipes"
  | "jobs"
  | "services";

const TABS: HarthmereCraftingStationPanelTab[] = [
  "recipes",
  "jobs",
  "services",
];

const TAB_LABELS: Record<HarthmereCraftingStationPanelTab, string> = {
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
  recipe: HarthmereCraftingVisibleRecipe;
}> = ({ recipe }) => {
  const imageUrl = harthmereBikkieVisualImageUrl(recipe.outputVisual);
  return (
    <span
      aria-label={recipe.outputVisual.ariaLabel}
      title={recipe.outputVisual.metadataSummary}
      style={harthmereBikkieVisualTileStyle(recipe.outputVisual, 38)}
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
          style={harthmereBikkieVisualImageStyle}
          data-harthmere-crafting-visual-img="true"
        />
      ) : null}
      <span style={harthmereBikkieVisualGlyphStyle}>
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
    React.useRef<PointerLockUnlockWhileOpenReturnRef>({ current: false });
  const snapshot = adapter.getSnapshot();
  const available = adapter.isHydrated() && !!snapshot;
  const recipes = adapter.getRecipes();
  const [activeTab, setActiveTab] =
    React.useState<HarthmereCraftingStationPanelTab>(
      TABS.includes(initialTab) ? initialTab : "recipes"
    );
  const [busy, setBusy] = React.useState(false);
  const busyRef = React.useRef(false);

  const runAction = React.useCallback(async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await action();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

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
            {formatHarthmereCraftingStationTypeLabel(snapshot.stationType)} ·{" "}
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
        <>
          {/* HARTHMERE_RECIPE_UX_GUIDE: a small, always-on primer so new players
              (e.g. reaching the Road Ahead "Craft a Muck Buster" step) know how to
              turn a known recipe into an item. */}
          <div
            role="note"
            aria-label="How to craft"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              marginBottom: 12,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(120, 180, 240, 0.35)",
              background: "rgba(30, 48, 70, 0.55)",
              fontSize: 12,
              lineHeight: 1.35,
              color: "rgba(226, 236, 248, 0.92)",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1.2 }}>
              💡
            </span>
            <span>
              <strong>How to craft:</strong> pick a recipe below, make sure you
              have the listed materials (they turn green when you do), then press{" "}
              <strong>Craft</strong>. Missing an ingredient? Gather or buy it, then
              come back — the recipe stays in your list.
            </span>
          </div>
          <RecipePane
            recipes={recipes}
            adapter={adapter}
            busy={busy}
            onRunAction={runAction}
          />
        </>
      )}
      {activeTab === "jobs" && (
        <JobsPane
          snapshot={snapshot}
          adapter={adapter}
          busy={busy}
          onRunAction={runAction}
        />
      )}
      {activeTab === "services" && (
        <ServicesPane recipes={recipes} snapshot={snapshot} />
      )}
      {busy ? (
        <div style={craftingPendingNoticeStyle} aria-live="polite">
          Updating crafting...
        </div>
      ) : null}
    </div>
  );
};

const RecipePane: React.FunctionComponent<{
  recipes: HarthmereCraftingVisibleRecipe[];
  adapter: HarthmereCraftingStationAdapter;
  busy: boolean;
  onRunAction: (action: () => Promise<void>) => void;
}> = ({ recipes, adapter, busy, onRunAction }) => {
  return (
    <section style={sectionGridStyle}>
      <RovingGrid
        ariaLabel="Crafting recipes"
        items={chunk(recipes, 2)}
        style={{ display: "grid", gap: 6 }}
        onActivate={(_, __, entry) => {
          if (busy || !entry.canCraft) return;
          onRunAction(() => adapter.craft(entry.recipe.recipeId));
        }}
        renderCell={(entry, coords, cellProps) => (
          <button
            {...cellProps}
            type="button"
            role="gridcell"
            className="biomes-ui-card"
            disabled={busy || !entry.canCraft}
            aria-disabled={busy || !entry.canCraft}
            aria-label={`${entry.outputName} recipe`}
            data-crafting-recipe-id={entry.recipe.recipeId}
            data-crafting-backend-action="true"
            data-focused={coords.focused ? "true" : "false"}
            style={{
              ...recipeButtonStyle,
              opacity: busy ? 0.45 : entry.canCraft ? 1 : 0.58,
              filter: busy ? "grayscale(0.65)" : undefined,
              cursor: busy
                ? "wait"
                : entry.canCraft
                ? "pointer"
                : "not-allowed",
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
              {busy
                ? "Updating..."
                : entry.canCraft
                ? "Ready"
                : entry.missing.slice(0, 3).join(", ")}
            </span>
          </button>
        )}
      />
    </section>
  );
};

const JobsPane: React.FunctionComponent<{
  snapshot: NonNullable<
    ReturnType<HarthmereCraftingStationAdapter["getSnapshot"]>
  >;
  adapter: HarthmereCraftingStationAdapter;
  busy: boolean;
  onRunAction: (action: () => Promise<void>) => void;
}> = ({ snapshot, adapter, busy, onRunAction }) => {
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
                {formatHarthmereCraftingRecipeName(job.recipeId)}
              </strong>
              <p style={mutedStyle}>
                {formatMs(job.readyAtMs - snapshot.nowMs)}
              </p>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                className="biomes-ui-tab"
                data-crafting-backend-action="true"
                disabled={busy}
                style={busy ? pendingButtonStyle : undefined}
                onClick={() =>
                  onRunAction(() => adapter.completeJob(job.jobId))
                }
              >
                Complete
              </button>
              <button
                type="button"
                className="biomes-ui-tab"
                data-crafting-backend-action="true"
                disabled={busy}
                style={busy ? pendingButtonStyle : undefined}
                onClick={() => onRunAction(() => adapter.cancelJob(job.jobId))}
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
  recipes: HarthmereCraftingVisibleRecipe[];
  snapshot: NonNullable<
    ReturnType<HarthmereCraftingStationAdapter["getSnapshot"]>
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

const pendingButtonStyle: React.CSSProperties = {
  opacity: 0.45,
  filter: "grayscale(0.65)",
  cursor: "wait",
};

const craftingPendingNoticeStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "7px 9px",
  border: "1px solid rgba(125, 211, 252, 0.32)",
  borderRadius: 4,
  background: "rgba(7, 12, 26, 0.7)",
  color: "rgba(255,255,255,0.78)",
  fontSize: 12,
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
