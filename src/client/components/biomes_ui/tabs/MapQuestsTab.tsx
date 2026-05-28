// MapQuestsTab — production world map + mission journal.
//
// No placeholder markers live here. The tab renders only live adapter data:
// current player position, Grove landmarks, quest markers, service NPCs/stores,
// and mission objectives supplied by the Snapshot/Grove adapter.
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
interface MapAdapter {
  getMarkers?: () => MapMarker[];
  getPlayerMarker?: () => MapMarker | undefined;
  getMissionTitle?: () => string;
  getMissionSteps?: () => MissionStep[];
  getMapBounds?: () => { minX: number; maxX: number; minZ: number; maxZ: number } | undefined;
}

const KIND_LABEL: Record<MapMarkerKind, string> = {
  objective: "Objective",
  vendor: "Vendor",
  store: "Store",
  bank: "Bank",
  quest: "Quest",
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

function markerPosition(marker: MapMarker, zoom: number, pan: { x: number; y: number }) {
  const x = ((clamp01(marker.x) - 0.5) * zoom + 0.5 + pan.x) * 100;
  const y = ((clamp01(marker.y) - 0.5) * zoom + 0.5 + pan.y) * 100;
  return { left: `${x}%`, top: `${y}%` };
}

export const MapQuestsTab: React.FunctionComponent<{ adapter?: MapAdapter }> = ({ adapter }) => {
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [focusedMarkerId, setFocusedMarkerId] = React.useState<string | null>(null);

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
  const focusedMarker = focusedMarkerId ? allMarkers.find((marker) => marker.id === focusedMarkerId) : undefined;

  const zoomIn = () => setZoom((value) => Math.min(4, Number((value + 0.25).toFixed(2))));
  const zoomOut = () => setZoom((value) => Math.max(0.75, Number((value - 0.25).toFixed(2))));
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const centerOnPlayer = () => {
    if (!playerMarker) return;
    setZoom((value) => Math.max(value, 1.75));
    setPan({ x: 0.5 - clamp01(playerMarker.x), y: 0.5 - clamp01(playerMarker.y) });
    setFocusedMarkerId(playerMarker.id);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, minHeight: 420 }}>
      <section aria-label="Live world map" style={{ position: "relative", background:
          "radial-gradient(circle at 30% 40%, rgba(74,222,255,0.10), rgba(7,12,26,0.94))",
          border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, overflow: "hidden" }}>
        <div style={mapToolbarStyle}>
          <button type="button" onClick={zoomOut} aria-label="Zoom map out">−</button>
          <span aria-label={`Map zoom ${Math.round(zoom * 100)} percent`}>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={zoomIn} aria-label="Zoom map in">+</button>
          <button type="button" onClick={resetView}>Reset</button>
          <button type="button" onClick={centerOnPlayer} disabled={!playerMarker}>Center Player</button>
        </div>

        {bounds ? (
          <div style={boundsStyle} aria-label="Current map bounds">
            X {Math.round(bounds.minX)}…{Math.round(bounds.maxX)} · Z {Math.round(bounds.minZ)}…{Math.round(bounds.maxZ)}
          </div>
        ) : null}

        {allMarkers.length === 0 ? (
          <div style={emptyMapStyle}>No live map markers are available for this player yet.</div>
        ) : (
          allMarkers.map((marker) => (
            <Highlightable key={marker.id} uniqueId={UI_IDS.MAP_MARKER(marker.id)} showCaption>
              <button
                type="button"
                aria-label={`${marker.label} ${KIND_LABEL[marker.kind]} marker`}
                tabIndex={0}
                onClick={() => setFocusedMarkerId(marker.id)}
                onFocus={() => setFocusedMarkerId(marker.id)}
                style={{
                  position: "absolute",
                  ...markerPosition(marker, zoom, pan),
                  transform: "translate(-50%, -50%)",
                  width: marker.kind === "player" ? 18 : marker.active ? 16 : 13,
                  height: marker.kind === "player" ? 18 : marker.active ? 16 : 13,
                  borderRadius: marker.kind === "store" || marker.kind === "bank" ? 3 : "50%",
                  background: KIND_COLOR[marker.kind],
                  border: marker.kind === "player" ? "3px solid #111827" : "2px solid #fff",
                  boxShadow: marker.active
                    ? "0 0 14px rgba(251,191,36,0.9)"
                    : "0 0 8px rgba(74,222,255,0.65)",
                  cursor: "pointer",
                }}
              >
                <span className="sr-only">{marker.label}</span>
              </button>
            </Highlightable>
          ))
        )}

        <div style={legendStyle} aria-label="Map legend">
          {Object.entries(KIND_LABEL).map(([kind, label]) => (
            <span key={kind} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: kind === "store" || kind === "bank" ? 2 : "50%", background: KIND_COLOR[kind as MapMarkerKind], display: "inline-block" }} />
              {label}
            </span>
          ))}
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
            {focusedMarker.description ? <p>{focusedMarker.description}</p> : null}
          </div>
        ) : null}
      </section>
      <section aria-label="Mission journal">
        <h3 style={titleStyle}>{title}</h3>
        {steps.length === 0 ? (
          <p style={mutedTextStyle}>No active quest steps are available yet.</p>
        ) : (
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {steps.map((step) => (
              <li key={step.id} tabIndex={0} aria-label={`${step.title}, ${step.done ? "completed" : "in progress"}`}
                style={{ padding: 8, marginBottom: 4, background: "var(--biomes-bg-glass)",
                  border: "1px solid var(--biomes-edge-cyan-soft)",
                  borderLeft: step.done ? "3px solid #78e68c" : "3px solid var(--biomes-warn-amber)" }}>
                <strong style={{ fontSize: 12, textDecoration: step.done ? "line-through" : undefined, opacity: step.done ? 0.65 : 1 }}>{step.title}</strong>
                <div style={{ fontSize: 11, color: "var(--biomes-fg-muted)" }}>{step.objective}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
};

const titleStyle: React.CSSProperties = { margin: "0 0 8px", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
const mutedTextStyle: React.CSSProperties = { margin: 0, fontSize: 12, color: "var(--biomes-fg-muted)" };
const mapToolbarStyle: React.CSSProperties = { position: "absolute", zIndex: 2, top: 8, left: 8, display: "flex", alignItems: "center", gap: 6, padding: 6, border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, background: "rgba(7, 12, 26, 0.86)", fontSize: 11 };
const boundsStyle: React.CSSProperties = { position: "absolute", zIndex: 2, top: 8, right: 8, padding: "4px 6px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, background: "rgba(7, 12, 26, 0.72)", fontSize: 10, color: "var(--biomes-fg-muted)" };
const emptyMapStyle: React.CSSProperties = { position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 20, color: "var(--biomes-fg-muted)", fontSize: 12, textAlign: "center" };
const legendStyle: React.CSSProperties = { position: "absolute", zIndex: 2, left: 8, right: 8, bottom: 8, display: "flex", flexWrap: "wrap", gap: "8px 10px", padding: 6, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, background: "rgba(7, 12, 26, 0.76)", fontSize: 10, color: "var(--biomes-fg-muted)" };
const markerCardStyle: React.CSSProperties = { position: "absolute", zIndex: 3, right: 8, bottom: 54, width: 220, display: "grid", gap: 3, padding: 8, border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, background: "rgba(7, 12, 26, 0.92)", color: "var(--biomes-fg)", fontSize: 11 };
