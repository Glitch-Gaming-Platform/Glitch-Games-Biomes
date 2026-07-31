// OptionsTab — avatar editor, graphics, audio, controls (incl. tab shortcut
// remapping), accessibility.
import {
  type BiomesHUDVisibilityId,
  useBiomesHUDVisibilitySnapshot,
  useBiomesHUDVisibilitySetting,
} from "@/client/components/biomes_ui/hudVisibilitySettings";
import {
  DEFAULT_TAB_SHORTCUTS,
  isReservedGameplayShortcutKey,
  type TabShortcut,
} from "@/client/components/biomes_ui/shortcuts/BiomesShortcuts";
import { OptionsControlsSurfaceForTest } from "@/client/components/biomes_ui/tabs/OptionsControlsSurface";
import {
  biomesUIMicrophoneOptionsFromDevices,
  biomesUISelectedMicrophoneDeviceId,
  type BiomesUIMicrophoneDeviceOption,
} from "@/client/components/biomes_ui/tabs/microphoneDeviceSettings";
import { useTypedStorageItem } from "@/client/util/typed_local_storage";
import dynamic from "next/dynamic";
import * as React from "react";

interface OptionsAdapter {
  getShortcuts?: () => TabShortcut[];
  setShortcut?: (tab: string, key: string) => void;
}

const BiomesUIAvatarEditor = dynamic(
  () =>
    import("@/client/components/biomes_ui/BiomesUIAvatarEditor").then(
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
  const [npcSpeechProvider, setNpcSpeechProvider] = useTypedStorageItem(
    // ElevenLabs is the product default, but the setting remains local and
    // reversible so the existing provider can be selected at any time.
    "settings.voice.npcSpeechProvider",
    "elevenlabs"
  );
  const [microphoneInputEnabled, setMicrophoneInputEnabled] =
    useTypedStorageItem("settings.voice.microphoneInputEnabled", true);
  const [microphoneDeviceId, setMicrophoneDeviceId] = useTypedStorageItem(
    "settings.voice.microphoneDeviceId",
    ""
  );
  const [microphoneDevices, setMicrophoneDevices] = React.useState<
    BiomesUIMicrophoneDeviceOption[]
  >(() => biomesUIMicrophoneOptionsFromDevices([]));
  const [microphoneRefreshState, setMicrophoneRefreshState] = React.useState<
    "idle" | "loading" | "unavailable"
  >("idle");
  const hudVisibility = useBiomesHUDVisibilitySnapshot();
  const [, setObjectivesVisible] = useBiomesHUDVisibilitySetting("objectives");
  const [, setMiniMapVisible] = useBiomesHUDVisibilitySetting("miniMap");
  const [, setHelpButtonsVisible] =
    useBiomesHUDVisibilitySetting("helpButtons");
  const [, setHotbarVisible] = useBiomesHUDVisibilitySetting("hotbar");
  const [, setVitalsVisible] = useBiomesHUDVisibilitySetting("vitals");
  const [, setActionBarVisible] = useBiomesHUDVisibilitySetting("actionBar");
  const setHudVisibility = React.useCallback(
    (id: BiomesHUDVisibilityId, visible: boolean) => {
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
      if (isReservedGameplayShortcutKey(e.key)) {
        setRecordingFor(null);
        return;
      }
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
        setMicrophoneDevices(biomesUIMicrophoneOptionsFromDevices([]));
        return;
      }

      setMicrophoneRefreshState("loading");
      let stream: MediaStream | undefined;
      try {
        if (requestPermission && mediaDevices.getUserMedia) {
          stream = await mediaDevices.getUserMedia({ audio: true });
        }
        const devices = await mediaDevices.enumerateDevices();
        setMicrophoneDevices(biomesUIMicrophoneOptionsFromDevices(devices));
        setMicrophoneRefreshState("idle");
      } catch {
        setMicrophoneRefreshState("unavailable");
        setMicrophoneDevices(biomesUIMicrophoneOptionsFromDevices([]));
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
        npcSpeechProvider={npcSpeechProvider}
        onNpcSpeechProviderChange={setNpcSpeechProvider}
        microphoneInputEnabled={microphoneInputEnabled}
        onMicrophoneInputEnabledChange={setMicrophoneInputEnabled}
        microphoneDevices={microphoneDevices}
        selectedMicrophoneDeviceId={biomesUISelectedMicrophoneDeviceId({
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
