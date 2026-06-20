import {
  BIOMES_HUD_VISIBILITY_OPTIONS,
  type BiomesHUDVisibilityId,
  type BiomesHUDVisibilitySnapshot,
} from "@/client/components/biomes_ui/hudVisibilitySettings";
import type { GraphicsQuality } from "@/client/util/typed_local_storage";
import * as React from "react";
import type { TabShortcut } from "../shortcuts/BiomesShortcuts";
import {
  BIOMES_UI_DEFAULT_MICROPHONE_DEVICE_ID,
  biomesUIMicrophoneOptionsFromDevices,
  biomesUISelectedMicrophoneDeviceId,
  type BiomesUIMicrophoneDeviceOption,
} from "./microphoneDeviceSettings";

const GRAPHICS_QUALITY_OPTIONS: readonly {
  value: GraphicsQuality;
  label: string;
}[] = [
  { value: "auto", label: "Auto" },
  { value: "low", label: "Low" },
  { value: "high", label: "High" },
  { value: "custom", label: "Custom" },
  { value: "safeMode", label: "Safe Mode" },
];

interface OptionsControlsSurfaceProps {
  showPerformanceHUD: boolean;
  onShowPerformanceHUDChange?: (next: boolean) => void;
  graphicsQuality: GraphicsQuality;
  onGraphicsQualityChange?: (next: GraphicsQuality) => void;
  effectsVolume: number;
  onEffectsVolumeChange?: (next: number) => void;
  musicVolume: number;
  onMusicVolumeChange?: (next: number) => void;
  voiceVolume: number;
  onVoiceVolumeChange?: (next: number) => void;
  npcSpeechEnabled?: boolean;
  onNpcSpeechEnabledChange?: (next: boolean) => void;
  microphoneInputEnabled?: boolean;
  onMicrophoneInputEnabledChange?: (next: boolean) => void;
  microphoneDevices?: readonly BiomesUIMicrophoneDeviceOption[];
  selectedMicrophoneDeviceId?: string;
  microphoneRefreshState?: "idle" | "loading" | "unavailable";
  onMicrophoneDeviceChange?: (deviceId: string) => void;
  onRefreshMicrophoneDevices?: () => void;
  hudVisibility: BiomesHUDVisibilitySnapshot;
  onHudVisibilityChange?: (
    id: BiomesHUDVisibilityId,
    visible: boolean
  ) => void;
  shortcuts: TabShortcut[];
  recordingFor?: string | null;
  onStartRecordingShortcut?: (tab: string) => void;
}

export const OptionsControlsSurfaceForTest: React.FunctionComponent<
  OptionsControlsSurfaceProps
> = ({
  showPerformanceHUD,
  onShowPerformanceHUDChange,
  graphicsQuality,
  onGraphicsQualityChange,
  effectsVolume,
  onEffectsVolumeChange,
  musicVolume,
  onMusicVolumeChange,
  voiceVolume,
  onVoiceVolumeChange,
  npcSpeechEnabled = true,
  onNpcSpeechEnabledChange,
  microphoneInputEnabled = true,
  onMicrophoneInputEnabledChange,
  microphoneDevices = biomesUIMicrophoneOptionsFromDevices([]),
  selectedMicrophoneDeviceId = BIOMES_UI_DEFAULT_MICROPHONE_DEVICE_ID,
  microphoneRefreshState = "idle",
  onMicrophoneDeviceChange,
  onRefreshMicrophoneDevices,
  hudVisibility,
  onHudVisibilityChange,
  shortcuts,
  recordingFor = null,
  onStartRecordingShortcut,
}) => {
  const selectedMicrophoneValue = biomesUISelectedMicrophoneDeviceId({
    selectedDeviceId: selectedMicrophoneDeviceId,
    options: microphoneDevices,
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))",
        gap: 24,
        alignItems: "start",
      }}
    >
      <section aria-label="Graphics and sound settings">
        <h3 style={titleStyle}>Graphics & Performance</h3>
        <Row label="Show Performance Stats">
          <input
            type="checkbox"
            checked={showPerformanceHUD}
            onChange={(event) =>
              onShowPerformanceHUDChange?.(event.currentTarget.checked)
            }
          />
        </Row>
        <Row label="Quality">
          <select
            aria-label="Quality"
            value={graphicsQuality}
            onChange={(event) =>
              onGraphicsQualityChange?.(
                event.currentTarget.value as GraphicsQuality
              )
            }
          >
            {GRAPHICS_QUALITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Row>

        <h3 style={{ ...titleStyle, marginTop: 18 }}>Sound</h3>
        <SliderRow
          label="Sound Effects"
          value={effectsVolume}
          onChange={onEffectsVolumeChange}
        />
        <SliderRow
          label="Music"
          value={musicVolume}
          onChange={onMusicVolumeChange}
        />
        <SliderRow
          label="Voices"
          value={voiceVolume}
          onChange={onVoiceVolumeChange}
        />
        <Row label="NPC Speech">
          <input
            type="checkbox"
            checked={npcSpeechEnabled}
            aria-label="NPC Speech"
            onChange={(event) =>
              onNpcSpeechEnabledChange?.(event.currentTarget.checked)
            }
          />
        </Row>
        <Row label="Microphone Input">
          <input
            type="checkbox"
            checked={microphoneInputEnabled}
            aria-label="Microphone Input"
            onChange={(event) =>
              onMicrophoneInputEnabledChange?.(event.currentTarget.checked)
            }
          />
        </Row>
        <Row label="Microphone">
          <div style={microphoneControlStyle}>
            <select
              aria-label="Microphone"
              value={selectedMicrophoneValue}
              disabled={!microphoneInputEnabled}
              onChange={(event) =>
                onMicrophoneDeviceChange?.(event.currentTarget.value)
              }
              style={microphoneSelectStyle}
            >
              {microphoneDevices.map((option) => (
                <option
                  key={option.deviceId || "browser-default"}
                  value={option.deviceId}
                >
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="biomes-ui-tab"
              disabled={
                !microphoneInputEnabled || microphoneRefreshState === "loading"
              }
              onClick={onRefreshMicrophoneDevices}
            >
              {microphoneRefreshState === "loading" ? "Refreshing" : "Refresh"}
            </button>
            {microphoneRefreshState === "unavailable" && (
              <span style={microphoneStatusStyle}>Unavailable</span>
            )}
          </div>
        </Row>
      </section>

      <section aria-label="HUD visibility settings">
        <h3 style={titleStyle}>HUD</h3>
        <div style={{ display: "grid", gap: 2 }}>
          {BIOMES_HUD_VISIBILITY_OPTIONS.map((option) => (
            <Row key={option.id} label={option.label}>
              <input
                type="checkbox"
                checked={hudVisibility[option.id]}
                data-biomes-hud-setting-id={option.id}
                onChange={(event) =>
                  onHudVisibilityChange?.(
                    option.id,
                    event.currentTarget.checked
                  )
                }
              />
            </Row>
          ))}
        </div>
      </section>

      <section aria-label="Keyboard shortcuts">
        <h3 style={titleStyle}>Tab Shortcuts</h3>
        <table
          aria-label="Tab shortcut bindings"
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
        >
          <thead>
            <tr>
              <th align="left">Tab</th>
              <th align="left">Key</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shortcuts.map((s) => (
              <tr key={s.tab}>
                <td style={{ padding: "4px 0", textTransform: "capitalize" }}>
                  {s.tab}
                </td>
                <td>
                  <kbd>{s.label}</kbd>
                </td>
                <td>
                  <button
                    type="button"
                    className="biomes-ui-tab"
                    onClick={() => onStartRecordingShortcut?.(s.tab)}
                  >
                    {recordingFor === s.tab ? "Press a key..." : "Rebind"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p
          style={{
            fontSize: 11,
            color: "var(--biomes-fg-muted)",
            marginTop: 10,
          }}
        >
          Hotbar slots 1-9 stay on the number keys.
        </p>
      </section>
    </div>
  );
};

const Row: React.FunctionComponent<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <label
    style={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto",
      alignItems: "center",
      gap: 12,
      padding: "4px 0",
      fontSize: 12,
    }}
  >
    <span>{label}</span>
    {children}
  </label>
);

const SliderRow: React.FunctionComponent<{
  label: string;
  value: number;
  onChange?: (next: number) => void;
}> = ({ label, value, onChange }) => (
  <Row label={label}>
    <input
      type="range"
      min={0}
      max={100}
      value={value}
      onChange={(event) => onChange?.(Number(event.currentTarget.value))}
    />
  </Row>
);

const titleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  letterSpacing: 0,
  textTransform: "uppercase",
  color: "var(--biomes-fg-muted)",
};

const microphoneControlStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 8,
  alignItems: "center",
  minWidth: 0,
  width: "min(100%, 18rem)",
};

const microphoneSelectStyle: React.CSSProperties = {
  minWidth: 0,
  width: "100%",
};

const microphoneStatusStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  fontSize: 11,
  color: "var(--biomes-fg-muted)",
};
