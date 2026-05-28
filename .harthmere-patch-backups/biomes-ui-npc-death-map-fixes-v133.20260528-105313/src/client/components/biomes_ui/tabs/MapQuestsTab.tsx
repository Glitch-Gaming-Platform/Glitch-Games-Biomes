// MapQuestsTab — split view: world map left, mission journal right.
// The map area is intentionally a stub canvas (with marker rendering) so
// it can be replaced with the real biomes minimap component without
// changing the tab's contract.
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { UI_IDS } from "../uniqueIds";

interface MapMarker { id: string; label: string; x: number; y: number; kind: "objective" | "vendor" | "rift" }
interface MissionStep { id: string; title: string; objective: string; done: boolean }
interface MapAdapter {
  getMarkers?: () => MapMarker[];
  getMissionTitle?: () => string;
  getMissionSteps?: () => MissionStep[];
}

const PLACEHOLDER_MARKERS: MapMarker[] = [
  { id: "jackie", label: "Jackie", x: 0.42, y: 0.55, kind: "objective" },
  { id: "road_marker", label: "Old Grove Road Post", x: 0.52, y: 0.42, kind: "objective" },
  { id: "muckwad_patch", label: "Muckwad Patch", x: 0.58, y: 0.40, kind: "objective" },
];
const PLACEHOLDER_STEPS: MissionStep[] = [
  { id: "meet_jackie_in_grove", title: "Meet Jackie", objective: "Speak with Jackie in The Grove.", done: true },
  { id: "road_ahead_meet_up_with_billy", title: "Find the Old Grove Road Post", objective: "Follow Jackie's marker.", done: false },
  { id: "road_ahead_collect_muckwad", title: "Break Muckwad", objective: "Break a muckwad patch near the road.", done: false },
];

export const MapQuestsTab: React.FunctionComponent<{ adapter?: MapAdapter }> = ({ adapter }) => {
  const markers = adapter?.getMarkers?.() ?? PLACEHOLDER_MARKERS;
  const title = adapter?.getMissionTitle?.() ?? "The Road Ahead";
  const steps = adapter?.getMissionSteps?.() ?? PLACEHOLDER_STEPS;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, minHeight: 420 }}>
      <section aria-label="World map" style={{ position: "relative", background:
          "radial-gradient(circle at 30% 40%, rgba(74,222,255,0.08), rgba(7,12,26,0.92))",
          border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4, overflow: "hidden" }}>
        {markers.map((m) => (
          <Highlightable key={m.id} uniqueId={UI_IDS.MAP_MARKER(m.id)} showCaption>
            <button type="button" aria-label={`${m.label} marker`} tabIndex={0}
              style={{ position: "absolute", left: `${m.x * 100}%`, top: `${m.y * 100}%`,
                transform: "translate(-50%, -50%)",
                width: 14, height: 14, borderRadius: "50%",
                background: m.kind === "rift" ? "var(--biomes-edge-magenta)" : "var(--biomes-edge-cyan)",
                border: "2px solid #fff", boxShadow: "0 0 8px rgba(74,222,255,0.8)", cursor: "pointer" }} />
          </Highlightable>
        ))}
      </section>
      <section aria-label="Mission journal">
        <h3 style={titleStyle}>{title}</h3>
        <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {steps.map((s) => (
            <li key={s.id} tabIndex={0} aria-label={`${s.title}, ${s.done ? "completed" : "in progress"}`}
              style={{ padding: 8, marginBottom: 4, background: "var(--biomes-bg-glass)",
                border: "1px solid var(--biomes-edge-cyan-soft)",
                borderLeft: s.done ? "3px solid #78e68c" : "3px solid var(--biomes-warn-amber)" }}>
              <strong style={{ fontSize: 12, textDecoration: s.done ? "line-through" : undefined, opacity: s.done ? 0.65 : 1 }}>{s.title}</strong>
              <div style={{ fontSize: 11, color: "var(--biomes-fg-muted)" }}>{s.objective}</div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
};
const titleStyle: React.CSSProperties = { margin: "0 0 8px", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
