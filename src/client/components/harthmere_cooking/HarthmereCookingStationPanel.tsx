// HARTHMERE_COOKING_STATION_UI_V1: the timer-based cooking interface. Opens when
// the player presses F at a campfire / oven / cookpot (see harthmereCookingStations
// + the "cook" object interaction). Mirrors the BiomesUI / Business / Crafting
// panels: biomes-ui-panel chrome, RovingGrid keyboard nav, mouse + keyboard, and
// mobile-responsive layout. Self-contained like HarthmereObjectContainerPanel —
// it fetches live farming/food state and submits cook_enqueue/collect/cancel.

import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import {
  closePointerLockUnlockWhileOpenV1,
  openPointerLockUnlockWhileOpenV1,
  type PointerLockUnlockWhileOpenReturnRefV1,
} from "@/client/components/contexts/pointerLockModalPolicy";
import {
  createHarthmereCookingAdapterV1,
  type HarthmereCookJobClientV1,
  type HarthmereCookSnapshotV1,
  type HarthmereCookVisibleRecipeV1,
} from "@/client/components/harthmere_cooking/cookingStationLiveAdapter";
import {
  clearHarthmereCookingStationOpenRequestV1,
  HARTHMERE_COOKING_STATION_OPEN_EVENT_V1,
  readHarthmereCookingStationOpenRequestV1,
  type HarthmereCookingStationOpenRequestV1,
} from "@/client/components/harthmere_cooking/harthmereCookingStations";
import { defaultHarthmereLiveFetchV1 } from "@/client/components/harthmere_live_fetch";
import { RovingGrid } from "@/client/components/biomes_ui/nav/RovingGrid";
import { installBiomesUITheme } from "@/client/components/biomes_ui/theme/biomesUITheme";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const COOKING_OPEN_REQUEST_STORAGE_KEY_V1 =
  "biomes.localDev.harthmere.cookingStationOpenRequest.v1";
const COOKING_POLL_INTERVAL_MS_V1 = 1000;

function toCookSnapshotV1(
  farmingFoodState: any
): HarthmereCookSnapshotV1 | undefined {
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
    updatedAtMs: Number(farmingFoodState.updatedAtMs ?? 0),
  };
}

async function fetchCookingStateV1(): Promise<HarthmereCookSnapshotV1 | undefined> {
  const response = await defaultHarthmereLiveFetchV1(
    "/api/harthmere/live_mode_farming_food_state",
    { method: "GET", credentials: "same-origin" }
  );
  if (!response.ok) {
    return undefined;
  }
  const body = await response.json();
  return toCookSnapshotV1(body?.farmingFoodState);
}

async function submitCookingActionV1(
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
  const response = await defaultHarthmereLiveFetchV1("/api/harthmere/live_mode", {
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
  });
  const body = await response.json().catch(() => undefined);
  if (!response.ok || body?.ok === false) {
    return { ok: false, warnings: ["cooking_rejected:unavailable"] };
  }
  const warnings: string[] = Array.isArray(body?.backendMutation?.warnings)
    ? body.backendMutation.warnings.filter((w: unknown) =>
        typeof w === "string" && w.startsWith("cooking_rejected:")
      )
    : [];
  return {
    ok: warnings.length === 0,
    warnings,
    farmingFoodState: body?.farmingFoodState,
  };
}

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: 0.4,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "var(--biomes-fg-muted)",
};

function StatusBadge({ status }: { status: HarthmereCookJobClientV1["status"] }) {
  const label =
    status === "ready" ? "Ready" : status === "cooking" ? "Cooking" : "Queued";
  const color =
    status === "ready"
      ? "#7CFFA0"
      : status === "cooking"
      ? "var(--biomes-edge-cyan)"
      : "var(--biomes-fg-muted)";
  return (
    <span style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
      {label}
    </span>
  );
}

export const HarthmereCookingStationPanel: React.FunctionComponent = () => {
  const pointerLockManager = usePointerLockManager();
  const shouldReturnPointerLock = useRef<PointerLockUnlockWhileOpenReturnRefV1>({
    current: false,
  });

  const [request, setRequest] = useState<
    HarthmereCookingStationOpenRequestV1 | undefined
  >(undefined);
  const [snapshot, setSnapshot] = useState<HarthmereCookSnapshotV1 | undefined>(
    undefined
  );
  const [hydrated, setHydrated] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | undefined>(
    undefined
  );
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    installBiomesUITheme();
  }, []);

  // Listen for the F-interaction open event (+ cross-tab storage + initial read).
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const openRequest = (detail?: HarthmereCookingStationOpenRequestV1) => {
      const pending = detail ?? readHarthmereCookingStationOpenRequestV1();
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
        (event as CustomEvent<HarthmereCookingStationOpenRequestV1>).detail
      );
    const storageHandler = (event: StorageEvent) => {
      if (event.key === COOKING_OPEN_REQUEST_STORAGE_KEY_V1) {
        openRequest();
      }
    };
    openRequest();
    window.addEventListener(HARTHMERE_COOKING_STATION_OPEN_EVENT_V1, handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(
        HARTHMERE_COOKING_STATION_OPEN_EVENT_V1,
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
  }, [request, pointerLockManager]);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchCookingStateV1();
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
    const interval = setInterval(() => void refresh(), COOKING_POLL_INTERVAL_MS_V1);
    return () => clearInterval(interval);
  }, [request, refresh]);

  const closePanel = useCallback(() => {
    clearHarthmereCookingStationOpenRequestV1();
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
        ? createHarthmereCookingAdapterV1({
            snapshot,
            hydrated,
            stationId: request.stationId,
            stationKind: request.stationKind,
            label: request.label,
            submit: async (operation, payload) => {
              const result = await submitCookingActionV1(operation, payload);
              if (result.farmingFoodState) {
                setSnapshot(toCookSnapshotV1(result.farmingFoodState));
              }
              return { ok: result.ok, warnings: result.warnings };
            },
          })
        : undefined,
    [request, snapshot, hydrated]
  );

  const recipes = useMemo(() => adapter?.getRecipes() ?? [], [adapter]);
  const jobs = useMemo(() => adapter?.getJobs() ?? [], [adapter]);
  const detail = useMemo(
    () =>
      adapter && selectedRecipeId
        ? adapter.getRecipeDetail(selectedRecipeId, count)
        : undefined,
    [adapter, selectedRecipeId, count]
  );

  const runAction = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError(undefined);
      try {
        await fn();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Cooking is unavailable.");
      } finally {
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
    <div
      role="dialog"
      aria-label={`${request.label ?? "Cooking"} cooking interface`}
      data-harthmere-cooking-interface="true"
      className="biomes-ui-panel"
      style={{
        position: "fixed",
        inset:
          "max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))",
        margin: "auto",
        maxWidth: 900,
        maxHeight: "min(720px, calc(100vh - 20px))",
        display: "flex",
        flexDirection: "column",
        zIndex: 1250,
        padding: "16px 18px",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <h2 style={panelTitleStyle}>{request.label ?? "Cooking Station"}</h2>
          <div style={{ fontSize: 12, color: "var(--biomes-fg-muted)" }}>
            {request.stationKind.charAt(0).toUpperCase() +
              request.stationKind.slice(1)}{" "}
            · cook, queue, and collect dishes
          </div>
        </div>
        <button
          type="button"
          className="biomes-ui-tab"
          onClick={closePanel}
          aria-label="Close cooking interface"
        >
          Close
        </button>
      </header>

      {error ? (
        <div
          role="alert"
          style={{
            marginBottom: 10,
            padding: "6px 10px",
            borderRadius: "var(--biomes-radius)",
            background: "rgba(255, 110, 110, 0.16)",
            color: "#ffd9d9",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 1fr) minmax(240px, 1.1fr)",
          gap: 14,
          flex: 1,
          minHeight: 0,
          overflow: "auto",
        }}
      >
        {/* Recipes + selected detail */}
        <section style={{ minWidth: 0 }}>
          <h3 style={sectionTitleStyle}>Recipes</h3>
          {recipes.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--biomes-fg-muted)" }}>
              {hydrated
                ? "No recipes can be cooked at this station."
                : "Loading recipes…"}
            </p>
          ) : (
            <RovingGrid<HarthmereCookVisibleRecipeV1>
              ariaLabel="Cooking recipes"
              items={recipes.map((recipe) => [recipe])}
              onActivate={(_row, _col, recipe) => {
                setSelectedRecipeId(recipe.recipeId);
                setCount(1);
              }}
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
              renderCell={(recipe, _coords, cell) => (
                <button
                  ref={cell.ref}
                  tabIndex={cell.tabIndex}
                  onFocus={cell.onFocus}
                  onKeyDown={cell.onKeyDown}
                  onClick={() => {
                    cell.onClick();
                    setSelectedRecipeId(recipe.recipeId);
                    setCount(1);
                  }}
                  className="biomes-ui-card"
                  aria-pressed={selectedRecipeId === recipe.recipeId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    width: "100%",
                    textAlign: "left",
                    outline:
                      selectedRecipeId === recipe.recipeId
                        ? "2px solid var(--biomes-edge-cyan)"
                        : undefined,
                    opacity: recipe.canCook ? 1 : 0.62,
                  }}
                >
                  <span>{recipe.displayName}</span>
                  <span style={{ fontSize: 11, color: "var(--biomes-fg-muted)" }}>
                    {recipe.canCook
                      ? "Ready"
                      : `Need ${recipe.missing.join(", ")}`}
                  </span>
                </button>
              )}
            />
          )}

          {detail ? (
            <div className="biomes-ui-card" style={{ marginTop: 10 }}>
              <h3 style={sectionTitleStyle}>{detail.displayName}</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px" }}>
                {detail.ingredients.map((line) => (
                  <li
                    key={line.itemId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      color: line.enough ? "var(--biomes-fg)" : "#ffb4b4",
                    }}
                  >
                    <span>{line.name}</span>
                    <span>
                      {line.have}/{line.need}
                    </span>
                  </li>
                ))}
              </ul>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 12, color: "var(--biomes-fg-muted)" }}>
                  Batch
                </span>
                <button
                  type="button"
                  className="biomes-ui-tab"
                  aria-label="Decrease batch"
                  disabled={count <= 1}
                  onClick={() => setCount((c) => Math.max(1, c - 1))}
                >
                  −
                </button>
                <span style={{ minWidth: 18, textAlign: "center" }}>{count}</span>
                <button
                  type="button"
                  className="biomes-ui-tab"
                  aria-label="Increase batch"
                  disabled={count >= Math.max(1, maxCookable)}
                  onClick={() =>
                    setCount((c) => Math.min(Math.max(1, maxCookable), c + 1))
                  }
                >
                  +
                </button>
                <span style={{ fontSize: 11, color: "var(--biomes-fg-muted)" }}>
                  {Math.round(detail.durationMs / 1000)}s · makes{" "}
                  {detail.outputCount} {detail.outputName}
                </span>
              </div>
              <button
                type="button"
                className="biomes-ui-tab"
                disabled={!canCook || busy}
                onClick={() =>
                  runAction(() =>
                    adapter!.enqueueCook(detail.recipeId, count)
                  )
                }
                style={{
                  width: "100%",
                  fontWeight: 700,
                  opacity: canCook && !busy ? 1 : 0.5,
                }}
              >
                {busy ? "Working…" : "Cook"}
              </button>
            </div>
          ) : (
            <p
              style={{
                marginTop: 10,
                fontSize: 13,
                color: "var(--biomes-fg-muted)",
              }}
            >
              Select a recipe to see its ingredients.
            </p>
          )}
        </section>

        {/* Queue */}
        <section style={{ minWidth: 0 }}>
          <h3 style={sectionTitleStyle}>This station</h3>
          {jobs.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--biomes-fg-muted)" }}>
              Nothing cooking yet. Pick a recipe and press Cook.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {jobs.map((job) => {
                const remainingS = Math.max(
                  0,
                  Math.ceil(
                    (job.readyAtMs - (snapshot?.updatedAtMs ?? 0)) / 1000
                  )
                );
                return (
                  <li
                    key={job.jobId}
                    className="biomes-ui-card"
                    style={{ marginBottom: 8 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {job.displayName}
                        {job.count > 1 ? ` ×${job.count}` : ""}
                      </span>
                      <StatusBadge status={job.status} />
                    </div>
                    <div
                      aria-hidden
                      style={{
                        height: 6,
                        borderRadius: 3,
                        margin: "6px 0",
                        background: "rgba(255,255,255,0.12)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round(job.progress * 100)}%`,
                          background:
                            job.status === "ready"
                              ? "#7CFFA0"
                              : "var(--biomes-edge-cyan)",
                          transition: "width 0.3s linear",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{ fontSize: 11, color: "var(--biomes-fg-muted)" }}
                      >
                        {job.status === "ready"
                          ? "Ready to collect"
                          : job.status === "cooking"
                          ? `~${remainingS}s left`
                          : "Queued"}
                      </span>
                      {job.status === "ready" ? (
                        <span style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="biomes-ui-tab"
                            disabled={busy}
                            onClick={() =>
                              runAction(() => adapter!.collectCook(job.jobId))
                            }
                          >
                            Collect
                          </button>
                          <button
                            type="button"
                            className="biomes-ui-tab"
                            disabled={busy}
                            title="Discard this dish (frees the slot; no refund)"
                            onClick={() =>
                              runAction(() => adapter!.cancelCook(job.jobId))
                            }
                          >
                            Discard
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="biomes-ui-tab"
                          disabled={busy}
                          onClick={() =>
                            runAction(() => adapter!.cancelCook(job.jobId))
                          }
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
        </section>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }
  return createPortal(panel, document.body);
};

export default HarthmereCookingStationPanel;
