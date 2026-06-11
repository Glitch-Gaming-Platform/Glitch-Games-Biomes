// OptionsTab — avatar editor, graphics, audio, controls (incl. tab shortcut
// remapping), accessibility.
import {
  type BiomesHUDVisibilityIdV1,
  useBiomesHUDVisibilitySnapshotV1,
  useBiomesHUDVisibilitySettingV1,
} from "@/client/components/biomes_ui/hudVisibilitySettings";
import { useTypedStorageItem } from "@/client/util/typed_local_storage";
import dynamic from "next/dynamic";
import * as React from "react";
import { DEFAULT_TAB_SHORTCUTS } from "../shortcuts/BiomesShortcuts";
import type { TabShortcut } from "../shortcuts/BiomesShortcuts";
import {
  biomesUIMicrophoneOptionsFromDevicesV1,
  biomesUISelectedMicrophoneDeviceIdV1,
} from "./microphoneDeviceSettings";
import type { BiomesUIMicrophoneDeviceOptionV1 } from "./microphoneDeviceSettings";
import { OptionsControlsSurfaceForTest } from "./OptionsControlsSurface";

interface OptionsAdapter {
  getShortcuts?: () => TabShortcut[];
  setShortcut?: (tab: string, key: string) => void;
}

const BiomesUIAvatarEditor = dynamic(
  () =>
    import("../BiomesUIAvatarEditor").then(
      (module) => module.BiomesUIAvatarEditor
    ),
  {
    ssr: false,
    loading: () => (
      <section aria-label="Avatar" style={{ marginBottom: 24 }}>
        <h3 style={avatarLoadingTitleStyle}>Avatar</h3>
        <p style={avatarLoadingCopyStyle}>Loading character...</p>
      </section>
    ),
  }
);

export const OptionsTab: React.FunctionComponent<{
  adapter?: OptionsAdapter;
}> = ({ adapter }) => {
  const [shortcuts, setShortcuts] = React.useState<TabShortcut[]>(
    adapter?.getShortcuts?.() ?? DEFAULT_TAB_SHORTCUTS
  );
  const [recordingFor, setRecordingFor] = React.useState<string | null>(null);
  const [showPerformanceHUD, setShowPerformanceHUD] = useTypedStorageItem(
    "settings.hud.showPerformance",
    true
  );
  const [graphicsQuality, setGraphicsQuality] = useTypedStorageItem(
    "settings.graphics.quality",
    "auto"
  );
  const [effectsVolume, setEffectsVolume] = useTypedStorageItem(
    "settings.volume.effects",
    100
  );
  const [musicVolume, setMusicVolume] = useTypedStorageItem(
    "settings.volume.music",
    50
  );
  const [voiceVolume, setVoiceVolume] = useTypedStorageItem(
    "settings.volume.voice",
    50
  );
  const [npcSpeechEnabled, setNpcSpeechEnabled] = useTypedStorageItem(
    "settings.voice.npcSpeechEnabled",
    true
  );
  const [microphoneInputEnabled, setMicrophoneInputEnabled] =
    useTypedStorageItem("settings.voice.microphoneInputEnabled", true);
  const [microphoneDeviceId, setMicrophoneDeviceId] = useTypedStorageItem(
    "settings.voice.microphoneDeviceId",
    ""
  );
  const [microphoneDevices, setMicrophoneDevices] = React.useState<
    BiomesUIMicrophoneDeviceOptionV1[]
  >(() => biomesUIMicrophoneOptionsFromDevicesV1([]));
  const [microphoneRefreshState, setMicrophoneRefreshState] = React.useState<
    "idle" | "loading" | "unavailable"
  >("idle");
  const hudVisibility = useBiomesHUDVisibilitySnapshotV1();
  const [, setObjectivesVisible] =
    useBiomesHUDVisibilitySettingV1("objectives");
  const [, setMiniMapVisible] = useBiomesHUDVisibilitySettingV1("miniMap");
  const [, setHelpButtonsVisible] =
    useBiomesHUDVisibilitySettingV1("helpButtons");
  const [, setHotbarVisible] = useBiomesHUDVisibilitySettingV1("hotbar");
  const [, setVitalsVisible] = useBiomesHUDVisibilitySettingV1("vitals");
  const [, setActionBarVisible] = useBiomesHUDVisibilitySettingV1("actionBar");
  const setHudVisibility = React.useCallback(
    (id: BiomesHUDVisibilityIdV1, visible: boolean) => {
      switch (id) {
        case "objectives":
          setObjectivesVisible(visible);
          break;
        case "miniMap":
          setMiniMapVisible(visible);
          break;
        case "helpButtons":
          setHelpButtonsVisible(visible);
          break;
        case "hotbar":
          setHotbarVisible(visible);
          break;
        case "vitals":
          setVitalsVisible(visible);
          break;
        case "actionBar":
          setActionBarVisible(visible);
          break;
      }
    },
    [
      setActionBarVisible,
      setHelpButtonsVisible,
      setHotbarVisible,
      setMiniMapVisible,
      setObjectivesVisible,
      setVitalsVisible,
    ]
  );

  React.useEffect(() => {
    if (!recordingFor) return;
    const tabBeingRecorded = recordingFor;
    function onKey(e: KeyboardEvent) {
      e.preventDefault();
      const next = shortcuts.map((s) =>
        s.tab === tabBeingRecorded
          ? { ...s, key: e.key.toLowerCase(), label: e.key.toUpperCase() }
          : s
      );
      setShortcuts(next);
      adapter?.setShortcut?.(tabBeingRecorded, e.key.toLowerCase());
      setRecordingFor(null);
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [recordingFor, shortcuts, adapter]);

  const refreshMicrophoneDevices = React.useCallback(
    async (requestPermission: boolean) => {
      const mediaDevices =
        typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
      if (!mediaDevices?.enumerateDevices) {
        setMicrophoneRefreshState("unavailable");
        setMicrophoneDevices(biomesUIMicrophoneOptionsFromDevicesV1([]));
        return;
      }

      setMicrophoneRefreshState("loading");
      let stream: MediaStream | undefined;
      try {
        if (requestPermission && mediaDevices.getUserMedia) {
          stream = await mediaDevices.getUserMedia({ audio: true });
        }
        const devices = await mediaDevices.enumerateDevices();
        setMicrophoneDevices(biomesUIMicrophoneOptionsFromDevicesV1(devices));
        setMicrophoneRefreshState("idle");
      } catch {
        setMicrophoneRefreshState("unavailable");
        setMicrophoneDevices(biomesUIMicrophoneOptionsFromDevicesV1([]));
      } finally {
        stream?.getTracks().forEach((track) => track.stop());
      }
    },
    []
  );

  React.useEffect(() => {
    void refreshMicrophoneDevices(false);
  }, [refreshMicrophoneDevices]);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <BiomesUIAvatarEditor />
      <OptionsControlsSurfaceForTest
        showPerformanceHUD={showPerformanceHUD}
        onShowPerformanceHUDChange={setShowPerformanceHUD}
        graphicsQuality={graphicsQuality}
        onGraphicsQualityChange={setGraphicsQuality}
        effectsVolume={effectsVolume}
        onEffectsVolumeChange={setEffectsVolume}
        musicVolume={musicVolume}
        onMusicVolumeChange={setMusicVolume}
        voiceVolume={voiceVolume}
        onVoiceVolumeChange={setVoiceVolume}
        npcSpeechEnabled={npcSpeechEnabled}
        onNpcSpeechEnabledChange={setNpcSpeechEnabled}
        microphoneInputEnabled={microphoneInputEnabled}
        onMicrophoneInputEnabledChange={setMicrophoneInputEnabled}
        microphoneDevices={microphoneDevices}
        selectedMicrophoneDeviceId={biomesUISelectedMicrophoneDeviceIdV1({
          selectedDeviceId: microphoneDeviceId,
          options: microphoneDevices,
        })}
        microphoneRefreshState={microphoneRefreshState}
        onMicrophoneDeviceChange={setMicrophoneDeviceId}
        onRefreshMicrophoneDevices={() => {
          void refreshMicrophoneDevices(true);
        }}
        hudVisibility={hudVisibility}
        onHudVisibilityChange={setHudVisibility}
        shortcuts={shortcuts}
        recordingFor={recordingFor}
        onStartRecordingShortcut={setRecordingFor}
      />
    </div>
  );
};

const avatarLoadingTitleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  letterSpacing: 0,
  textTransform: "uppercase",
  color: "var(--biomes-fg-muted)",
};

const avatarLoadingCopyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "var(--biomes-fg-muted)",
};
