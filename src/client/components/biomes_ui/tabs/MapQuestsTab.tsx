// MapQuestsTab — production world map + mission journal.
//
// No placeholder markers live here. The tab renders only live adapter data:
// current player position, Grove landmarks, quest markers, service NPCs/stores,
// and mission objectives supplied by the Snapshot/Grove adapter.
//
// BIOMES_UI_MAP_TAB_V141 upgrade:
//   - Mouse wheel zoom (centered on cursor).
//   - Click+drag to pan.
//   - Player marker is a pulsing ring (animated, easy to spot).
//   - Active-quest markers are larger, color-shifted, and labeled.
//   - Right rail is split: mission journal (active step list) AND a
//     trackable quest list with click-to-pan behaviour.
//   - Mobile-responsive: collapses to a single column under 720px, the
//     map scales to viewport height, side rail moves underneath.
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { UI_IDS } from "../uniqueIds";

export type MapMarkerKind =
  | "objective"
  | "vendor"
  | "store"
  | "bank"
  | "quest"
  | "rift"
  | "resource"
  | "danger"
  | "safe_zone"
  | "player";

export interface MapMarker {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: MapMarkerKind;
  active?: boolean;
  description?: string;
  worldPosition?: [number, number, number];
}

interface MissionStep { id: string; title: string; objective: string; done: boolean }

// BIOMES_UI_MAP_TAB_QUESTS_V141:
// Trackable-quest entries surface in the new clickable side list and let
// the player center the map on each quest's first marker without scrolling
// through the active mission timeline.
export interface MapTrackableQuest {
  questId: string;
  title: string;
  area: string;
  status: "active" | "available" | "completed";
  firstMarkerId?: string;
  reward?: string;
}

interface MapAdapter {
  getMarkers?: () => MapMarker[];
  getPlayerMarker?: () => MapMarker | undefined;
  getMissionTitle?: () => string;
  getMissionSteps?: () => MissionStep[];
  getMapBounds?: () => { minX: number; maxX: number; minZ: number; maxZ: number } | undefined;
  getTrackableQuests?: () => MapTrackableQuest[];
}

const KIND_LABEL: Record<MapMarkerKind, string> = {
  objective: "Objective",
  vendor: "NPC",
  store: "Store",
  bank: "Bank",
  quest: "Jobs / Quest Board",
  rift: "Rift",
  resource: "Resource",
  danger: "Danger",
  safe_zone: "Safe Zone",
  player: "You",
};

const KIND_COLOR: Record<MapMarkerKind, string> = {
  objective: "var(--biomes-warn-amber)",
  vendor: "#7dd3fc",
  store: "#93c5fd",
  bank: "#c4b5fd",
  quest: "var(--biomes-edge-cyan)",
  rift: "var(--biomes-edge-magenta)",
  resource: "#86efac",
  danger: "#f87171",
  safe_zone: "#a7f3d0",
  player: "#ffffff",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function markerPosition(marker: { x: number; y: number }, zoom: number, pan: { x: number; y: number }) {
  const x = ((clamp01(marker.x) - 0.5) * zoom + 0.5 + pan.x) * 100;
  const y = ((clamp01(marker.y) - 0.5) * zoom + 0.5 + pan.y) * 100;
  return { left: `${x}%`, top: `${y}%` };
}

// BIOMES_UI_MAP_TAB_V141:
// Inject the keyframes for the player pulse + active-marker ping. Idempotent —
// guarded by the style tag id so multiple mounts don't duplicate.
function ensureMapTabStylesV141() {
  if (typeof document === "undefined") return;
  const id = "biomes-ui-map-tab-styles-v141";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
@keyframes biomesMapPlayerPulseV141 {
  0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.85), 0 0 14px rgba(255,255,255,0.6); }
  70%  { box-shadow: 0 0 0 12px rgba(255,255,255,0), 0 0 22px rgba(255,255,255,0.5); }
  100% { box-shadow: 0 0 0 0 rgba(255,255,255,0), 0 0 14px rgba(255,255,255,0.6); }
}
@keyframes biomesMapActivePingV141 {
  0%   { box-shadow: 0 0 0 0 rgba(252,211,77,0.85), 0 0 14px rgba(252,211,77,0.6); }
  70%  { box-shadow: 0 0 0 14px rgba(252,211,77,0),    0 0 22px rgba(252,211,77,0.5); }
  100% { box-shadow: 0 0 0 0 rgba(252,211,77,0),       0 0 14px rgba(252,211,77,0.6); }
}
.biomes-map-tab-v141 .biomes-map-marker:focus-visible {
  outline: 2px solid var(--biomes-edge-cyan);
  outline-offset: 2px;
}
@media (max-width: 720px) {
  .biomes-map-tab-v141 {
    grid-template-columns: 1fr !important;
  }
  .biomes-map-tab-v141 .biomes-map-canvas {
    min-height: 320px;
    aspect-ratio: 4 / 3;
  }
}
`;
  document.head.appendChild(style);
}

export const MapQuestsTab: React.FunctionComponent<{ adapter?: MapAdapter }> = ({ adapter }) => {
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [focusedMarkerId, setFocusedMarkerId] = React.useState<string | null>(null);
  const [trackedQuestId, setTrackedQuestId] = React.useState<string | null>(null);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const draggingRef = React.useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  React.useEffect(() => ensureMapTabStylesV141(), []);

  const markers = React.useMemo(() => adapter?.getMarkers?.() ?? [], [adapter]);
  const playerMarker = adapter?.getPlayerMarker?.();
  const allMarkers = React.useMemo(() => {
    const byId = new Map<string, MapMarker>();
    for (const marker of markers) byId.set(marker.id, marker);
    if (playerMarker) byId.set(playerMarker.id, playerMarker);
    return Array.from(byId.values());
  }, [markers, playerMarker]);
  const title = adapter?.getMissionTitle?.() ?? "No active mission";
  const steps = adapter?.getMissionSteps?.() ?? [];
  const bounds = adapter?.getMapBounds?.();
  const trackableQuests = adapter?.getTrackableQuests?.() ?? [];
  const focusedMarker = focusedMarkerId ? allMarkers.find((marker) => marker.id === focusedMarkerId) : undefined;

  const clampZoom = React.useCallback((value: number) => Math.max(0.5, Math.min(8, value)), []);
  const zoomIn = () => setZoom((value) => clampZoom(Number((value + 0.25).toFixed(2))));
  const zoomOut = () => setZoom((value) => clampZoom(Number((value - 0.25).toFixed(2))));
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFocusedMarkerId(null);
    setTrackedQuestId(null);
  };
  const centerOnMarker = React.useCallback((marker: { x: number; y: number; id: string }) => {
    setZoom((value) => Math.max(value, 2));
    setPan({ x: 0.5 - clamp01(marker.x), y: 0.5 - clamp01(marker.y) });
    setFocusedMarkerId(marker.id);
  }, []);
  const centerOnPlayer = () => {
    if (!playerMarker) return;
    centerOnMarker(playerMarker);
  };
  const trackQuest = (quest: MapTrackableQuest) => {
    setTrackedQuestId(quest.questId);
    const marker = quest.firstMarkerId
      ? allMarkers.find((entry) => entry.id === quest.firstMarkerId)
      : undefined;
    if (marker) centerOnMarker(marker);
  };

  // BIOMES_UI_MAP_TAB_V141:
  // Mouse wheel zoom (Shift+wheel pans horizontally). Centered on the cursor
  // so the point under the pointer stays put — same behaviour every modern
  // map UI uses.
  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.shiftKey) {
      setPan((prev) => ({ x: prev.x - event.deltaY / 500, y: prev.y }));
      return;
    }
    const delta = event.deltaY < 0 ? 0.15 : -0.15;
    setZoom((prev) => {
      const next = clampZoom(prev * (1 + delta));
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const cursorX = (event.clientX - rect.left) / rect.width;
        const cursorY = (event.clientY - rect.top) / rect.height;
        setPan((p) => ({
          x: p.x + (cursorX - 0.5) * (1 / prev - 1 / next),
          y: p.y + (cursorY - 0.5) * (1 / prev - 1 / next),
        }));
      }
      return next;
    });
  };
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button[data-marker]")) return;
    draggingRef.current = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = draggingRef.current;
    if (!drag) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = (event.clientX - drag.startX) / rect.width;
    const dy = (event.clientY - drag.startY) / rect.height;
    setPan({ x: drag.panX + dx, y: drag.panY + dy });
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = null;
    try { (event.target as HTMLElement).releasePointerCapture(event.pointerId); } catch {}
  };

  // BIOMES_UI_MAP_TAB_V141: keyboard pan (arrow keys when the canvas has focus).
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 0.08;
    if (event.key === "ArrowLeft") { setPan((p) => ({ ...p, x: p.x + step })); event.preventDefault(); }
    else if (event.key === "ArrowRight") { setPan((p) => ({ ...p, x: p.x - step })); event.preventDefault(); }
    else if (event.key === "ArrowUp") { setPan((p) => ({ ...p, y: p.y + step })); event.preventDefault(); }
    else if (event.key === "ArrowDown") { setPan((p) => ({ ...p, y: p.y - step })); event.preventDefault(); }
    else if (event.key === "+" || event.key === "=") { zoomIn(); event.preventDefault(); }
    else if (event.key === "-") { zoomOut(); event.preventDefault(); }
    else if (event.key.toLowerCase() === "c") { centerOnPlayer(); event.preventDefault(); }
    else if (event.key.toLowerCase() === "r") { resetView(); event.preventDefault(); }
  };

  return (
    <div
      className="biomes-map-tab-v141"
      style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 18, minHeight: 420 }}
    >
      <section
        aria-label="Live world map"
        className="biomes-map-canvas"
        ref={canvasRef}
        tabIndex={0}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        style={{
          position: "relative",
          background:
            "radial-gradient(circle at 30% 40%, rgba(74,222,255,0.10), rgba(7,12,26,0.94))",
          border: "1px solid var(--biomes-edge-cyan-soft)",
          borderRadius: 4,
          overflow: "hidden",
          cursor: draggingRef.current ? "grabbing" : "grab",
          touchAction: "none",
        }}
      >
        <div style={mapToolbarStyle}>
          <button type="button" onClick={zoomOut} aria-label="Zoom map out">−</button>
          <span aria-label={`Map zoom ${Math.round(zoom * 100)} percent`}>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={zoomIn} aria-label="Zoom map in">+</button>
          <button type="button" onClick={resetView} title="Reset view (R)">Reset</button>
          <button type="button" onClick={centerOnPlayer} disabled={!playerMarker} title="Center on player (C)">
            Center Player
          </button>
        </div>

        {bounds ? (
          <div style={boundsStyle} aria-label="Current map bounds">
            X {Math.round(bounds.minX)}…{Math.round(bounds.maxX)} · Z {Math.round(bounds.minZ)}…{Math.round(bounds.maxZ)}
          </div>
        ) : null}

        {allMarkers.length === 0 ? (
          <div style={emptyMapStyle}>No live map markers are available for this player yet.</div>
        ) : (
          allMarkers.map((marker) => {
            const isPlayer = marker.kind === "player";
            const isActive = marker.active;
            const size = isPlayer ? 20 : isActive ? 18 : 12;
            return (
              <Highlightable key={marker.id} uniqueId={UI_IDS.MAP_MARKER(marker.id)} showCaption>
                <button
                  type="button"
                  data-marker={marker.id}
                  className="biomes-map-marker"
                  aria-label={`${marker.label} ${KIND_LABEL[marker.kind]} marker`}
                  tabIndex={0}
                  onClick={() => setFocusedMarkerId(marker.id)}
                  onFocus={() => setFocusedMarkerId(marker.id)}
                  onDoubleClick={() => centerOnMarker(marker)}
                  style={{
                    position: "absolute",
                    ...markerPosition(marker, zoom, pan),
                    transform: "translate(-50%, -50%)",
                    width: size,
                    height: size,
                    borderRadius: marker.kind === "store" || marker.kind === "bank" ? 3 : "50%",
                    background: KIND_COLOR[marker.kind],
                    border: isPlayer ? "3px solid #111827" : "2px solid #fff",
                    boxShadow: isPlayer
                      ? "0 0 14px rgba(255,255,255,0.7)"
                      : isActive
                        ? "0 0 14px rgba(252,211,77,0.9)"
                        : "0 0 8px rgba(74,222,255,0.65)",
                    cursor: "pointer",
                    animation: isPlayer
                      ? "biomesMapPlayerPulseV141 1.6s ease-in-out infinite"
                      : isActive
                        ? "biomesMapActivePingV141 1.4s ease-in-out infinite"
                        : undefined,
                    zIndex: isPlayer ? 4 : isActive ? 3 : 2,
                  }}
                >
                  <span className="sr-only">{marker.label}</span>
                  {(isPlayer || isActive) && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        top: "115%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "rgba(7,12,26,0.85)",
                        border: "1px solid var(--biomes-edge-cyan-soft)",
                        borderRadius: 3,
                        padding: "1px 5px",
                        fontSize: 10,
                        color: "var(--biomes-fg)",
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                      }}
                    >
                      {marker.label}
                    </span>
                  )}
                </button>
              </Highlightable>
            );
          })
        )}

        <div style={legendStyle} aria-label="Map legend">
          {Object.entries(KIND_LABEL).map(([kind, label]) => (
            <span key={kind} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: kind === "store" || kind === "bank" ? 2 : "50%", background: KIND_COLOR[kind as MapMarkerKind], display: "inline-block" }} />
              {label}
            </span>
          ))}
          <span style={{ marginLeft: "auto", color: "var(--biomes-fg-dim)" }}>
            wheel to zoom · drag to pan · C center · R reset
          </span>
        </div>

        {focusedMarker ? (
          <div style={markerCardStyle} aria-live="polite">
            <strong>{focusedMarker.label}</strong>
            <span>{KIND_LABEL[focusedMarker.kind]}</span>
            {focusedMarker.worldPosition ? (
              <small>
                World {focusedMarker.worldPosition.map((value) => Math.round(value)).join(", ")}
              </small>
            ) : null}
            {focusedMarker.description ? <p style={{ margin: 0 }}>{focusedMarker.description}</p> : null}
            <button
              type="button"
              onClick={() => centerOnMarker(focusedMarker)}
              style={{
                marginTop: 4,
                padding: "4px 8px",
                fontSize: 11,
                fontWeight: 700,
                background: "rgba(74,222,255,0.18)",
                color: "var(--biomes-fg)",
                border: "1px solid var(--biomes-edge-cyan)",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Center on marker
            </button>
          </div>
        ) : null}
      </section>
      <section aria-label="Mission journal" style={{ display: "grid", gap: 12 }}>
        <div>
          <h3 style={titleStyle}>{title}</h3>
          {steps.length === 0 ? (
            <p style={mutedTextStyle}>No active quest steps are available yet. Pick a quest below to track it.</p>
          ) : (
            <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {steps.map((step) => (
                <li
                  key={step.id}
                  tabIndex={0}
                  aria-label={`${step.title}, ${step.done ? "completed" : "in progress"}`}
                  style={{
                    padding: 8,
                    marginBottom: 4,
                    background: "var(--biomes-bg-glass)",
                    border: "1px solid var(--biomes-edge-cyan-soft)",
                    borderLeft: step.done ? "3px solid #78e68c" : "3px solid var(--biomes-warn-amber)",
                  }}
                >
                  <strong style={{ fontSize: 12, textDecoration: step.done ? "line-through" : undefined, opacity: step.done ? 0.65 : 1 }}>
                    {step.title}
                  </strong>
                  <div style={{ fontSize: 11, color: "var(--biomes-fg-muted)" }}>{step.objective}</div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* BIOMES_UI_MAP_TAB_QUESTS_V141: clickable quest list */}
        {trackableQuests.length > 0 && (
          <div data-testid="biomes-map-quest-list">
            <h3 style={titleStyle}>Quests</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 }}>
              {trackableQuests.map((quest) => {
                const isTracked = trackedQuestId === quest.questId || (trackedQuestId === null && quest.status === "active");
                return (
                  <li key={quest.questId}>
                    <button
                      type="button"
                      data-testid={`biomes-map-quest-${quest.questId}`}
                      aria-pressed={isTracked}
                      onClick={() => trackQuest(quest)}
                      style={{
                        display: "block",
                        textAlign: "left",
                        width: "100%",
                        padding: 8,
                        background: isTracked ? "rgba(74,222,255,0.18)" : "var(--biomes-bg-glass)",
                        color: "var(--biomes-fg)",
                        border: "1px solid var(--biomes-edge-cyan-soft)",
                        borderLeft:
                          quest.status === "active"
                            ? "3px solid var(--biomes-warn-amber)"
                            : quest.status === "completed"
                              ? "3px solid #78e68c"
                              : "3px solid var(--biomes-edge-cyan-soft)",
                        cursor: "pointer",
                        font: "inherit",
                      }}
                    >
                      <strong style={{ fontSize: 12 }}>{quest.title}</strong>
                      <div style={{ fontSize: 10, color: "var(--biomes-fg-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        {quest.status} · {quest.area}
                      </div>
                      {quest.reward ? (
                        <div style={{ fontSize: 11, color: "var(--biomes-fg-muted)" }}>
                          Reward: {quest.reward}
                        </div>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
};

const titleStyle: React.CSSProperties = { margin: "0 0 8px", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
const mutedTextStyle: React.CSSProperties = { margin: 0, fontSize: 12, color: "var(--biomes-fg-muted)" };
const mapToolbarStyle: React.CSSProperties = { position: "absolute", zIndex: 5, top: 8, left: 8, display: "flex", alignItems: "center", gap: 6, padding: 6, border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, background: "rgba(7, 12, 26, 0.86)", fontSize: 11 };
const boundsStyle: React.CSSProperties = { position: "absolute", zIndex: 5, top: 8, right: 8, padding: "4px 6px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, background: "rgba(7, 12, 26, 0.72)", fontSize: 10, color: "var(--biomes-fg-muted)" };
const emptyMapStyle: React.CSSProperties = { position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 20, color: "var(--biomes-fg-muted)", fontSize: 12, textAlign: "center" };
const legendStyle: React.CSSProperties = { position: "absolute", zIndex: 5, left: 8, right: 8, bottom: 8, display: "flex", flexWrap: "wrap", gap: "8px 10px", padding: 6, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, background: "rgba(7, 12, 26, 0.76)", fontSize: 10, color: "var(--biomes-fg-muted)" };
const markerCardStyle: React.CSSProperties = { position: "absolute", zIndex: 6, right: 8, bottom: 54, width: 240, display: "grid", gap: 3, padding: 8, border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, background: "rgba(7, 12, 26, 0.92)", color: "var(--biomes-fg)", fontSize: 11 };
