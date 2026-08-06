// HARTHMERE_COOKING_STATION_UI: the timer-based cooking interface. Opens when
// the player presses F at a campfire / oven / cookpot (see harthmereCookingStations
// + the "cook" object interaction). Mirrors the BiomesUI / Business / Crafting
// panels: biomes-ui-panel chrome, RovingGrid keyboard nav, mouse + keyboard, and
// mobile-responsive layout. Self-contained like HarthmereObjectContainerPanel —
// it fetches live farming/food state and submits cook_enqueue/collect/cancel.

import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import {
  closePointerLockUnlockWhileOpen,
  openPointerLockUnlockWhileOpen,
  type PointerLockUnlockWhileOpenReturnRef,
} from "@/client/components/contexts/pointerLockModalPolicy";
import {
  createHarthmereCookingAdapter,
  type HarthmereCookJobClient,
  type HarthmereCookSnapshot,
  type HarthmereCookVisibleRecipe,
} from "@/client/components/harthmere_cooking/cookingStationLiveAdapter";
import {
  clearHarthmereCookingStationOpenRequest,
  HARTHMERE_COOKING_STATION_OPEN_EVENT,
  readHarthmereCookingStationOpenRequest,
  type HarthmereCookingStationOpenRequest,
} from "@/client/components/harthmere_cooking/harthmereCookingStations";
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import { RovingGrid } from "@/client/components/biomes_ui/nav/RovingGrid";
import { installBiomesUITheme } from "@/client/components/biomes_ui/theme/biomesUITheme";
import { HARTHMERE_COOKING_RECIPES } from "@/shared/harthmere/mmo_farming_food_stamina";
import { emitHarthmereSoundEffect } from "@/shared/harthmere/sound_effect_manifest";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const COOKING_OPEN_REQUEST_STORAGE_KEY =
  "biomes.localDev.harthmere.cookingStationOpenRequest";
const COOKING_POLL_INTERVAL_MS = 1000;

function toCookSnapshot(
  farmingFoodState: any
): HarthmereCookSnapshot | undefined {
  if (!farmingFoodState) {
    return undefined;
  }
  return {
    inventory: farmingFoodState.inventory ?? {},
    stations: Array.isArray(farmingFoodState.cookingStations)
      ? farmingFoodState.cookingStations
      : [],
    availableStationKinds: Array.isArray(
      farmingFoodState.availableCookingStations
    )
      ? farmingFoodState.availableCookingStations
      : [],
    cookingSkillLevel: Math.max(
      1,
      Number(farmingFoodState.cookingSkillLevel ?? 1)
    ),
    updatedAtMs: Number(farmingFoodState.updatedAtMs ?? 0),
  };
}

async function fetchCookingState(): Promise<
  HarthmereCookSnapshot | undefined
> {
  const response = await defaultHarthmereLiveFetch(
    "/api/harthmere/live_mode_farming_food_state",
    { method: "GET", credentials: "same-origin" }
  );
  if (!response.ok) {
    return undefined;
  }
  const body = await response.json();
  return toCookSnapshot(body?.farmingFoodState);
}

async function submitCookingAction(
  operation: "cook_enqueue" | "cook_collect" | "cook_cancel",
  payload: Record<string, unknown>
): Promise<{
  ok: boolean;
  warnings?: string[];
  farmingFoodState?: any;
}> {
  const requestId = `biomes_ui_cooking_${operation}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const response = await defaultHarthmereLiveFetch(
    "/api/harthmere/live_mode",
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        idempotencyKey: requestId,
        actionKind: "request_farming_action",
        subsystem: "farming",
        actorEntityVersion: 1,
        zoneId: "the_grove",
        payload: { operation, ...payload },
        clientClaims: {},
      }),
    }
  );
  const body = await response.json().catch(() => undefined);
  if (!response.ok || body?.ok === false) {
    return { ok: false, warnings: ["cooking_rejected:unavailable"] };
  }
  const warnings: string[] = Array.isArray(body?.backendMutation?.warnings)
    ? body.backendMutation.warnings.filter(
        (w: unknown) =>
          typeof w === "string" && w.startsWith("cooking_rejected:")
      )
    : [];
  return {
    ok: warnings.length === 0,
    warnings,
    farmingFoodState: body?.farmingFoodState,
  };
}

function cookingActionSoundId(
  operation: "cook_enqueue" | "cook_collect" | "cook_cancel",
  payload: Record<string, unknown>
) {
  if (operation === "cook_collect") return "cooking_collect";
  if (operation === "cook_cancel") return "cooking_cancel";
  const recipe = HARTHMERE_COOKING_RECIPES[String(payload.recipeId ?? "")];
  const recipeText = `${recipe?.recipeId ?? ""} ${
    recipe?.displayName ?? ""
  }`.toLowerCase();
  if (/minced|sashimi|chop|slice/.test(recipeText)) return "food_chop";
  if (/fertilizer|ground|grind|milled/.test(recipeText)) return "food_grind";
  return "cooking_start";
}

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: 0,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0,
  color: "var(--biomes-fg-muted)",
};

function StatusBadge({
  status,
}: {
  status: HarthmereCookJobClient["status"];
}) {
  const label =
    status === "ready" ? "Ready" : status === "cooking" ? "Cooking" : "Queued";
  const color =
    status === "ready"
      ? "#7CFFA0"
      : status === "cooking"
      ? "var(--biomes-edge-cyan)"
      : "var(--biomes-fg-muted)";
  return (
    <span style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: 0 }}>
      {label}
    </span>
  );
}

function stationKindLabel(stationKind: string): string {
  return stationKind
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCookingSeconds(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function recipeIngredientPreview(
  recipe: HarthmereCookVisibleRecipe
): string {
  const names = recipe.ingredients.map((line) => line.name).filter(Boolean);
  if (names.length === 0) {
    return "No ingredients";
  }
  const first = names.slice(0, 2).join(", ");
  return names.length > 2 ? `${first} +${names.length - 2}` : first;
}

function recipeAvailabilityLabel(
  recipe: HarthmereCookVisibleRecipe
): string {
  if (recipe.canCook) {
    return "Ready";
  }
  return `Missing ${pluralize(recipe.missing.length, "ingredient")}`;
}

export interface HarthmereCookingStationSurfaceProps {
  request: Pick<HarthmereCookingStationOpenRequest, "label" | "stationKind">;
  recipes: HarthmereCookVisibleRecipe[];
  jobs: HarthmereCookJobClient[];
  detail?: HarthmereCookVisibleRecipe;
  selectedRecipeId?: string;
  count: number;
  maxCookable: number;
  canCook: boolean;
  hydrated: boolean;
  busy?: boolean;
  error?: string;
  updatedAtMs?: number;
  compact?: boolean;
  onClose?: () => void;
  onSelectRecipe?: (recipeId: string) => void;
  onCountChange?: (count: number) => void;
  onCook?: () => void;
  onCollect?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
}

export const HarthmereCookingStationSurfaceForTest: React.FunctionComponent<
  HarthmereCookingStationSurfaceProps
> = ({
  request,
  recipes,
  jobs,
  detail,
  selectedRecipeId,
  count,
  maxCookable,
  canCook,
  hydrated,
  busy = false,
  error,
  updatedAtMs = 0,
  compact = false,
  onClose,
  onSelectRecipe,
  onCountChange,
  onCook,
  onCollect,
  onCancel,
}) => (
  <div
    role="dialog"
    aria-label={`${request.label ?? "Cooking"} cooking interface`}
    data-harthmere-cooking-interface="true"
    data-harthmere-cooking-surface="refined"
    data-pointer-lock-policy="unlock-while-open"
    data-mouse-policy="show-while-open"
    className="biomes-ui-panel"
    style={{
      position: compact ? "relative" : "fixed",
      inset: compact
        ? undefined
        : "max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))",
      margin: compact ? undefined : "auto",
      width: compact ? "100%" : "calc(100vw - 20px)",
      maxWidth: compact ? undefined : 1060,
      maxHeight: compact ? undefined : "min(760px, calc(100vh - 20px))",
      display: "flex",
      flexDirection: "column",
      zIndex: compact ? undefined : 1250,
      padding: compact ? 12 : "16px 18px",
      overflow: "hidden",
      boxSizing: "border-box",
    }}
  >
    <header style={cookingHeaderStyle}>
      <div style={{ minWidth: 0 }}>
        <h2 style={panelTitleStyle}>{request.label ?? "Cooking Station"}</h2>
        <div style={stationMetaStyle}>
          <span style={stationPillStyle}>
            {stationKindLabel(request.stationKind)}
          </span>
          <span>{pluralize(recipes.length, "recipe")}</span>
          <span>
            {pluralize(jobs.length, "queued dish", "queued dishes")}
          </span>
        </div>
      </div>
      <button
        type="button"
        className="biomes-ui-tab"
        onClick={onClose}
        aria-label="Close cooking interface"
      >
        Close
      </button>
    </header>

    {error ? (
      <div role="alert" style={errorStyle}>
        {error}
      </div>
    ) : null}

    <div style={cookingLayoutStyle}>
      <section style={recipesColumnStyle} data-harthmere-cooking-recipes="true">
        <div style={sectionHeaderRowStyle}>
          <h3 style={sectionTitleStyle}>Recipes</h3>
          <span style={mutedSmallStyle}>
            {recipes.filter((recipe) => recipe.canCook).length} ready
          </span>
        </div>
        {recipes.length === 0 ? (
          <p style={emptyStateStyle}>
            {hydrated
              ? "No cooking recipes at this station."
              : "Loading recipes..."}
          </p>
        ) : (
          <RovingGrid<HarthmereCookVisibleRecipe>
            ariaLabel="Cooking recipes"
            items={recipes.map((recipe) => [recipe])}
            onActivate={(_row, _col, recipe) => {
              onSelectRecipe?.(recipe.recipeId);
            }}
            style={recipeListStyle}
            renderCell={(recipe, _coords, cell) => {
              const selected = selectedRecipeId === recipe.recipeId;
              return (
                <button
                  ref={cell.ref}
                  tabIndex={cell.tabIndex}
                  onFocus={cell.onFocus}
                  onKeyDown={cell.onKeyDown}
                  onClick={() => {
                    cell.onClick();
                    onSelectRecipe?.(recipe.recipeId);
                  }}
                  aria-pressed={selected}
                  data-harthmere-cooking-recipe-card="true"
                  data-recipe-ready={recipe.canCook ? "true" : "false"}
                  style={recipeCardStyle(selected, recipe.canCook)}
                >
                  <span style={recipeCardTopLineStyle}>
                    <strong style={recipeTitleStyle}>
                      {recipe.displayName}
                    </strong>
                    <span style={recipeStatusStyle(recipe.canCook)}>
                      {recipeAvailabilityLabel(recipe)}
                    </span>
                  </span>
                  <span style={recipeMetaStyle}>
                    Makes {recipe.outputCount} {recipe.outputName} ·{" "}
                    {formatCookingSeconds(recipe.durationMs)}
                  </span>
                  <span style={recipeMetaStyle}>
                    {recipeIngredientPreview(recipe)}
                  </span>
                </button>
              );
            }}
          />
        )}
      </section>

      <section style={detailsColumnStyle}>
        <div style={detailPanelStyle} data-harthmere-cooking-detail="true">
          {detail ? (
            <>
              <div style={detailHeaderStyle}>
                <div style={outputTileStyle} aria-hidden="true">
                  {detail.outputName.slice(0, 1)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={detailTitleStyle}>{detail.displayName}</h3>
                  <p style={detailSubtitleStyle}>
                    Makes {detail.outputCount} {detail.outputName} ·{" "}
                    {formatCookingSeconds(detail.durationMs)}
                  </p>
                </div>
              </div>

              <div style={ingredientListStyle}>
                {detail.ingredients.map((line) => (
                  <div
                    key={line.itemId}
                    style={ingredientRowStyle(line.enough)}
                    data-ingredient-enough={line.enough ? "true" : "false"}
                  >
                    <span style={ingredientNameStyle}>{line.name}</span>
                    <span style={ingredientCountStyle(line.enough)}>
                      {line.have}/{line.need}
                    </span>
                  </div>
                ))}
              </div>

              <div style={batchRowStyle}>
                <span style={mutedSmallStyle}>Batch</span>
                <button
                  type="button"
                  className="biomes-ui-tab"
                  aria-label="Decrease batch"
                  disabled={count <= 1}
                  onClick={() => onCountChange?.(Math.max(1, count - 1))}
                >
                  -
                </button>
                <span style={batchCountStyle}>{count}</span>
                <button
                  type="button"
                  className="biomes-ui-tab"
                  aria-label="Increase batch"
                  disabled={count >= Math.max(1, maxCookable)}
                  onClick={() =>
                    onCountChange?.(
                      Math.min(Math.max(1, maxCookable), count + 1)
                    )
                  }
                >
                  +
                </button>
                <span style={mutedSmallStyle}>Max {maxCookable}</span>
              </div>

              <button
                type="button"
                className="biomes-ui-tab"
                disabled={!canCook || busy}
                onClick={onCook}
                data-harthmere-cooking-action="cook"
                style={cookButtonStyle(canCook && !busy)}
              >
                {busy ? "Working..." : canCook ? "Cook" : "Missing ingredients"}
              </button>
            </>
          ) : (
            <div style={emptyDetailStyle}>
              <h3 style={detailTitleStyle}>Recipe details</h3>
              <p style={detailSubtitleStyle}>No recipe selected.</p>
            </div>
          )}
        </div>

        <div style={queuePanelStyle} data-harthmere-cooking-queue="true">
          <div style={sectionHeaderRowStyle}>
            <h3 style={sectionTitleStyle}>Station Queue</h3>
            <span style={mutedSmallStyle}>{jobs.length}/3 slots</span>
          </div>
          {jobs.length === 0 ? (
            <p style={emptyStateStyle}>No dishes queued.</p>
          ) : (
            <ul style={jobListStyle}>
              {jobs.map((job) => {
                const remainingS = Math.max(
                  0,
                  Math.ceil((job.readyAtMs - updatedAtMs) / 1000)
                );
                return (
                  <li key={job.jobId} style={jobCardStyle}>
                    <div style={jobTitleRowStyle}>
                      <span style={jobTitleStyle}>
                        {job.displayName}
                        {job.count > 1 ? ` x${job.count}` : ""}
                      </span>
                      <StatusBadge status={job.status} />
                    </div>
                    <div aria-hidden style={progressTrackStyle}>
                      <div
                        style={{
                          ...progressFillStyle,
                          width: `${Math.round(job.progress * 100)}%`,
                          background:
                            job.status === "ready"
                              ? "#7CFFA0"
                              : "var(--biomes-edge-cyan)",
                        }}
                      />
                    </div>
                    <div style={jobFooterStyle}>
                      <span style={mutedSmallStyle}>
                        {job.status === "ready"
                          ? "Ready to collect"
                          : job.status === "cooking"
                          ? `${remainingS}s left`
                          : "Queued"}
                      </span>
                      {job.status === "ready" ? (
                        <span style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="biomes-ui-tab"
                            disabled={busy}
                            onClick={() => onCollect?.(job.jobId)}
                          >
                            Collect
                          </button>
                          <button
                            type="button"
                            className="biomes-ui-tab"
                            disabled={busy}
                            title="Discard this dish"
                            onClick={() => onCancel?.(job.jobId)}
                          >
                            Discard
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="biomes-ui-tab"
                          disabled={busy}
                          onClick={() => onCancel?.(job.jobId)}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  </div>
);

const cookingHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 12,
  alignItems: "start",
  marginBottom: 12,
};

const stationMetaStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 7,
  marginTop: 5,
  color: "var(--biomes-fg-muted)",
  fontSize: 12,
};

const stationPillStyle: React.CSSProperties = {
  border: "1px solid rgba(125, 211, 252, 0.36)",
  background: "rgba(14, 165, 233, 0.14)",
  color: "var(--biomes-fg)",
  borderRadius: 3,
  padding: "2px 6px",
  fontWeight: 700,
};

const errorStyle: React.CSSProperties = {
  marginBottom: 10,
  padding: "8px 10px",
  borderRadius: 4,
  border: "1px solid rgba(248, 113, 113, 0.42)",
  background: "rgba(127, 29, 29, 0.32)",
  color: "#ffd9d9",
  fontSize: 13,
};

const cookingLayoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
  gap: 14,
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
};

const recipesColumnStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr)",
  gap: 8,
  border: "1px solid rgba(125, 211, 252, 0.28)",
  background: "rgba(7, 12, 26, 0.42)",
  padding: 10,
  overflow: "hidden",
};

const detailsColumnStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gridTemplateRows: "minmax(260px, 0.9fr) minmax(160px, 0.7fr)",
  gap: 12,
  overflow: "hidden",
};

const sectionHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const mutedSmallStyle: React.CSSProperties = {
  color: "var(--biomes-fg-muted)",
  fontSize: 11,
  lineHeight: 1.35,
};

const emptyStateStyle: React.CSSProperties = {
  margin: 0,
  padding: "14px 10px",
  border: "1px dashed rgba(125, 211, 252, 0.26)",
  background: "rgba(7, 12, 26, 0.36)",
  color: "var(--biomes-fg-muted)",
  fontSize: 13,
};

const recipeListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  overflowY: "auto",
  paddingRight: 4,
  minHeight: 0,
};

function recipeCardStyle(
  selected: boolean,
  ready: boolean
): React.CSSProperties {
  return {
    display: "grid",
    gap: 4,
    width: "100%",
    minHeight: 64,
    padding: "8px 9px",
    textAlign: "left",
    border: selected
      ? "1px solid var(--biomes-edge-cyan)"
      : "1px solid rgba(125, 211, 252, 0.24)",
    borderLeft: `3px solid ${ready ? "#7CFFA0" : "rgba(248, 113, 113, 0.72)"}`,
    borderRadius: 4,
    background: selected ? "rgba(14, 165, 233, 0.20)" : "rgba(5, 10, 22, 0.68)",
    color: "var(--biomes-fg)",
    cursor: "pointer",
    font: "inherit",
    opacity: ready ? 1 : 0.84,
    boxSizing: "border-box",
  };
}

const recipeCardTopLineStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const recipeTitleStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 13,
  lineHeight: 1.2,
};

function recipeStatusStyle(ready: boolean): React.CSSProperties {
  return {
    flex: "0 0 auto",
    color: ready ? "#7CFFA0" : "#ffb4b4",
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0,
  };
}

const recipeMetaStyle: React.CSSProperties = {
  color: "var(--biomes-fg-muted)",
  fontSize: 11,
  lineHeight: 1.3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const detailPanelStyle: React.CSSProperties = {
  minHeight: 0,
  overflow: "auto",
  border: "1px solid rgba(125, 211, 252, 0.28)",
  background: "rgba(5, 10, 22, 0.58)",
  padding: 12,
};

const queuePanelStyle: React.CSSProperties = {
  minHeight: 0,
  overflow: "auto",
  border: "1px solid rgba(125, 211, 252, 0.28)",
  background: "rgba(7, 12, 26, 0.42)",
  padding: 10,
};

const detailHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px minmax(0, 1fr)",
  gap: 10,
  alignItems: "center",
  marginBottom: 12,
};

const outputTileStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  display: "grid",
  placeItems: "center",
  borderRadius: 4,
  border: "1px solid rgba(252, 211, 77, 0.52)",
  background:
    "linear-gradient(180deg, rgba(252,211,77,0.28), rgba(14,165,233,0.16))",
  color: "var(--biomes-fg)",
  fontWeight: 900,
  fontSize: 18,
  textTransform: "uppercase",
};

const detailTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: 0,
  overflowWrap: "anywhere",
};

const detailSubtitleStyle: React.CSSProperties = {
  margin: "3px 0 0",
  color: "var(--biomes-fg-muted)",
  fontSize: 12,
  lineHeight: 1.35,
};

const ingredientListStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  marginBottom: 12,
};

function ingredientRowStyle(enough: boolean): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "center",
    padding: "7px 8px",
    border: `1px solid ${
      enough ? "rgba(124, 255, 160, 0.28)" : "rgba(248, 113, 113, 0.38)"
    }`,
    background: enough ? "rgba(22, 101, 52, 0.18)" : "rgba(127, 29, 29, 0.22)",
    borderRadius: 4,
  };
}

const ingredientNameStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 12,
};

function ingredientCountStyle(enough: boolean): React.CSSProperties {
  return {
    color: enough ? "#7CFFA0" : "#ffb4b4",
    fontSize: 12,
    fontWeight: 800,
  };
}

const batchRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 10,
};

const batchCountStyle: React.CSSProperties = {
  minWidth: 28,
  padding: "4px 7px",
  border: "1px solid rgba(125, 211, 252, 0.28)",
  borderRadius: 3,
  background: "rgba(7, 12, 26, 0.62)",
  textAlign: "center",
  fontWeight: 800,
};

function cookButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    minHeight: 34,
    fontWeight: 900,
    letterSpacing: 0,
    opacity: enabled ? 1 : 0.55,
    borderColor: enabled ? "rgba(124, 255, 160, 0.58)" : undefined,
    background: enabled
      ? "linear-gradient(180deg, rgba(124,255,160,0.32), rgba(14,165,233,0.16))"
      : undefined,
  };
}

const emptyDetailStyle: React.CSSProperties = {
  minHeight: 220,
  display: "grid",
  alignContent: "center",
  justifyItems: "center",
  textAlign: "center",
  border: "1px dashed rgba(125, 211, 252, 0.26)",
  background: "rgba(7, 12, 26, 0.34)",
  padding: 16,
};

const jobListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: 8,
};

const jobCardStyle: React.CSSProperties = {
  padding: 9,
  border: "1px solid rgba(125, 211, 252, 0.24)",
  borderRadius: 4,
  background: "rgba(5, 10, 22, 0.62)",
};

const jobTitleRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const jobTitleStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontWeight: 800,
  fontSize: 13,
};

const progressTrackStyle: React.CSSProperties = {
  height: 7,
  borderRadius: 4,
  margin: "8px 0",
  background: "rgba(255,255,255,0.12)",
  overflow: "hidden",
};

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  transition: "width 0.3s linear",
};

const jobFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

export const HarthmereCookingStationPanel: React.FunctionComponent = () => {
  const pointerLockManager = usePointerLockManager();
  const shouldReturnPointerLock = useRef<PointerLockUnlockWhileOpenReturnRef>(
    {
      current: false,
    }
  );

  const [request, setRequest] = useState<
    HarthmereCookingStationOpenRequest | undefined
  >(undefined);
  const [snapshot, setSnapshot] = useState<HarthmereCookSnapshot | undefined>(
    undefined
  );
  const [hydrated, setHydrated] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | undefined>(
    undefined
  );
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    installBiomesUITheme();
  }, []);

  // Listen for the F-interaction open event (+ cross-tab storage + initial read).
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const openRequest = (detail?: HarthmereCookingStationOpenRequest) => {
      const pending = detail ?? readHarthmereCookingStationOpenRequest();
      if (!pending) {
        return;
      }
      setRequest(pending);
      setError(undefined);
      setSelectedRecipeId(undefined);
      setCount(1);
    };
    const handler = (event: Event) =>
      openRequest(
        (event as CustomEvent<HarthmereCookingStationOpenRequest>).detail
      );
    const storageHandler = (event: StorageEvent) => {
      if (event.key === COOKING_OPEN_REQUEST_STORAGE_KEY) {
        openRequest();
      }
    };
    openRequest();
    window.addEventListener(HARTHMERE_COOKING_STATION_OPEN_EVENT, handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(
        HARTHMERE_COOKING_STATION_OPEN_EVENT,
        handler
      );
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  // Release the mouse while the panel is open (like the other Harthmere panels).
  useEffect(() => {
    if (!request) {
      return;
    }
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
  }, [request, pointerLockManager]);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchCookingState();
      setSnapshot(next);
    } catch {
      setSnapshot(undefined);
    } finally {
      setHydrated(true);
    }
  }, []);

  // Fetch on open and poll while open so progress bars and "Ready" update live.
  useEffect(() => {
    if (!request) {
      return;
    }
    void refresh();
    const interval = setInterval(
      () => void refresh(),
      COOKING_POLL_INTERVAL_MS
    );
    return () => clearInterval(interval);
  }, [request, refresh]);

  const closePanel = useCallback(() => {
    clearHarthmereCookingStationOpenRequest();
    setRequest(undefined);
    setError(undefined);
  }, []);

  // Escape closes.
  useEffect(() => {
    if (!request) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [request, closePanel]);

  const adapter = useMemo(
    () =>
      request
        ? createHarthmereCookingAdapter({
            snapshot,
            hydrated,
            stationId: request.stationId,
            stationKind: request.stationKind,
            label: request.label,
            submit: async (operation, payload) => {
              const result = await submitCookingAction(operation, payload);
              if (result.farmingFoodState) {
                setSnapshot(toCookSnapshot(result.farmingFoodState));
              }
              if (result.ok) {
                emitHarthmereSoundEffect(
                  cookingActionSoundId(operation, payload)
                );
              }
              return { ok: result.ok, warnings: result.warnings };
            },
          })
        : undefined,
    [request, snapshot, hydrated]
  );

  const recipes = useMemo(() => adapter?.getRecipes() ?? [], [adapter]);
  const jobs = useMemo(() => adapter?.getJobs() ?? [], [adapter]);
  const hasActiveCookingJob = jobs.some(
    (job) => job.status === "pending" || job.status === "cooking"
  );
  useEffect(() => {
    if (!request || !hasActiveCookingJob) return;
    if (request.stationKind === "cookpot") {
      emitHarthmereSoundEffect("cookpot_loop", { idempotent: true });
    } else if (request.stationKind === "oven") {
      emitHarthmereSoundEffect("oven_loop", { idempotent: true });
    }
  }, [request, hasActiveCookingJob, snapshot?.updatedAtMs]);
  const detail = useMemo(
    () =>
      adapter && selectedRecipeId
        ? adapter.getRecipeDetail(selectedRecipeId, count)
        : undefined,
    [adapter, selectedRecipeId, count]
  );

  const runAction = useCallback(
    async (fn: () => Promise<void>) => {
      if (busyRef.current) {
        return;
      }
      busyRef.current = true;
      setBusy(true);
      setError(undefined);
      try {
        await fn();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Cooking is unavailable.");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [refresh]
  );

  if (!request) {
    return null;
  }

  const maxCookable = detail?.maxCookable ?? 0;
  const canCook = Boolean(detail?.canCook) && maxCookable >= 1 && count >= 1;

  const panel = (
    <HarthmereCookingStationSurfaceForTest
      request={request}
      recipes={recipes}
      jobs={jobs}
      detail={detail}
      selectedRecipeId={selectedRecipeId}
      count={count}
      maxCookable={maxCookable}
      canCook={canCook}
      hydrated={hydrated}
      busy={busy}
      error={error}
      updatedAtMs={snapshot?.updatedAtMs ?? 0}
      onClose={closePanel}
      onSelectRecipe={(recipeId) => {
        setSelectedRecipeId(recipeId);
        setCount(1);
      }}
      onCountChange={setCount}
      onCook={() =>
        detail && runAction(() => adapter!.enqueueCook(detail.recipeId, count))
      }
      onCollect={(jobId) => runAction(() => adapter!.collectCook(jobId))}
      onCancel={(jobId) => runAction(() => adapter!.cancelCook(jobId))}
    />
  );

  if (typeof document === "undefined") {
    return null;
  }
  return createPortal(panel, document.body);
};

export default HarthmereCookingStationPanel;
