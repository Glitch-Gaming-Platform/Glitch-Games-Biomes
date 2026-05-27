// OptionsTab — graphics, audio, controls (incl. tab shortcut remapping), accessibility.
import * as React from "react";
import { DEFAULT_TAB_SHORTCUTS } from "../shortcuts/BiomesShortcuts";
import type { TabShortcut } from "../shortcuts/BiomesShortcuts";

interface OptionsAdapter {
  getShortcuts?: () => TabShortcut[];
  setShortcut?: (tab: string, key: string) => void;
}

export const OptionsTab: React.FunctionComponent<{ adapter?: OptionsAdapter }> = ({ adapter }) => {
  const [shortcuts, setShortcuts] = React.useState<TabShortcut[]>(
    adapter?.getShortcuts?.() ?? DEFAULT_TAB_SHORTCUTS
  );
  const [recordingFor, setRecordingFor] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!recordingFor) return;
    function onKey(e: KeyboardEvent) {
      e.preventDefault();
      const next = shortcuts.map((s) => s.tab === recordingFor ? { ...s, key: e.key.toLowerCase(), label: e.key.toUpperCase() } : s);
      setShortcuts(next);
      adapter?.setShortcut?.(recordingFor, e.key.toLowerCase());
      setRecordingFor(null);
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [recordingFor, shortcuts, adapter]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <section aria-label="Graphics & Audio">
        <h3 style={titleStyle}>Graphics & Performance</h3>
        <Row label="Show Performance Stats"><input type="checkbox" defaultChecked /></Row>
        <Row label="Quality">
          <select aria-label="Quality"><option>Auto</option><option>Low</option><option>Medium</option><option>High</option></select>
        </Row>

        <h3 style={{ ...titleStyle, marginTop: 18 }}>Sound</h3>
        <Row label="Sound Effects"><input type="range" min={0} max={100} defaultValue={100} /></Row>
        <Row label="Music"><input type="range" min={0} max={100} defaultValue={50} /></Row>
        <Row label="Voices"><input type="range" min={0} max={100} defaultValue={50} /></Row>

        <h3 style={{ ...titleStyle, marginTop: 18 }}>Accessibility</h3>
        <Row label="High-contrast highlights"><input type="checkbox" /></Row>
        <Row label="Reduce motion (blink animations)"><input type="checkbox" /></Row>
        <Row label="Screen-reader friendly captions"><input type="checkbox" defaultChecked /></Row>
      </section>
      <section aria-label="Keyboard shortcuts">
        <h3 style={titleStyle}>Tab Shortcuts</h3>
        <table aria-label="Tab shortcut bindings" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr><th align="left">Tab</th><th align="left">Key</th><th /></tr>
          </thead>
          <tbody>
            {shortcuts.map((s) => (
              <tr key={s.tab}>
                <td style={{ padding: "4px 0", textTransform: "capitalize" }}>{s.tab}</td>
                <td><kbd>{s.label}</kbd></td>
                <td>
                  <button type="button" className="biomes-ui-tab" onClick={() => setRecordingFor(s.tab)}>
                    {recordingFor === s.tab ? "Press a key…" : "Rebind"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: "var(--biomes-fg-muted)", marginTop: 10 }}>
          Hotbar slots 1–9 are always bound to the number keys. Arrow keys and Enter navigate the UI.
        </p>
      </section>
    </div>
  );
};

const Row: React.FunctionComponent<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", padding: "4px 0", fontSize: 12 }}>
    <span>{label}</span>
    {children}
  </label>
);
const titleStyle: React.CSSProperties = { margin: "0 0 8px", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
