import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  GlitchPlayerVoiceClient,
  PLAYER_VOICE_TOGGLE_CODE,
  PLAYER_VOICE_TOGGLE_LABEL,
  playerVoiceControlAvailable,
  type PlayerVoiceStatus,
} from "@/client/game/voice/player_voice_chat";
import { useTypedStorageItem } from "@/client/util/typed_local_storage";
import { log } from "@/shared/logging";
import React, { useCallback, useEffect, useRef, useState } from "react";

const OFF_STATUS: PlayerVoiceStatus = {
  state: "off",
  speaking: false,
  peerCount: 0,
};

export function shouldHandlePlayerVoiceToggle(input: {
  code: string;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  targetTagName?: string;
  targetContentEditable?: boolean;
}) {
  return (
    input.code === PLAYER_VOICE_TOGGLE_CODE &&
    !input.repeat &&
    !input.altKey &&
    !input.ctrlKey &&
    !input.metaKey &&
    !input.targetContentEditable &&
    !["input", "textarea", "select"].includes(
      String(input.targetTagName ?? "").toLowerCase()
    )
  );
}

function statusCopy(
  status: PlayerVoiceStatus,
  enabled: boolean,
  microphoneInputEnabled: boolean
) {
  if (!microphoneInputEnabled) {
    return "Microphone input is disabled in Options";
  }
  if (!enabled) {
    return `Turn microphone on (${PLAYER_VOICE_TOGGLE_LABEL})`;
  }
  switch (status.state) {
    case "requesting_permission":
      return "Waiting for microphone permission";
    case "joining":
      return "Joining nearby player voice";
    case "reconnecting":
      return "Reconnecting player voice";
    case "error":
      return status.message ?? "Player voice is unavailable";
    case "connected":
      return `Microphone on (${PLAYER_VOICE_TOGGLE_LABEL})${
        status.peerCount > 0 ? ` · ${status.peerCount} nearby` : ""
      }`;
    default:
      return "Starting player voice";
  }
}

export const PlayerVoiceChat: React.FunctionComponent = React.memo(() => {
  const { audioManager, clientConfig, resources, table, userId } =
    useClientContext();
  const [playerVoiceEnabled, setPlayerVoiceEnabled] = useTypedStorageItem(
    "settings.voice.playerVoiceEnabled",
    false
  );
  const [microphoneInputEnabled] = useTypedStorageItem(
    "settings.voice.microphoneInputEnabled",
    true
  );
  const [microphoneDeviceId] = useTypedStorageItem(
    "settings.voice.microphoneDeviceId",
    ""
  );
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<PlayerVoiceStatus>(OFF_STATUS);
  const clientRef = useRef<GlitchPlayerVoiceClient | undefined>(undefined);

  useEffect(() => {
    setSupported(
      playerVoiceControlAvailable({
        showVirtualJoystick: clientConfig.showVirtualJoystick,
        isSecureContext: window.isSecureContext !== false,
        hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
        hasRTCPeerConnection: typeof RTCPeerConnection !== "undefined",
      })
    );
  }, [clientConfig.showVirtualJoystick]);

  const toggleVoice = useCallback(() => {
    if (!supported || !microphoneInputEnabled) return;
    audioManager.playSound("button_click");
    setPlayerVoiceEnabled(!playerVoiceEnabled);
  }, [
    audioManager,
    microphoneInputEnabled,
    playerVoiceEnabled,
    setPlayerVoiceEnabled,
    supported,
  ]);

  useEffect(() => {
    if (!supported) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        !shouldHandlePlayerVoiceToggle({
          code: event.code,
          repeat: event.repeat,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          targetTagName: target?.tagName,
          targetContentEditable: target?.isContentEditable,
        })
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleVoice();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [supported, toggleVoice]);

  useEffect(() => {
    const previous = clientRef.current;
    clientRef.current = undefined;
    if (previous) void previous.stop();
    if (!supported || !playerVoiceEnabled || !microphoneInputEnabled) {
      setStatus(OFF_STATUS);
      return;
    }

    let client: GlitchPlayerVoiceClient;
    client = new GlitchPlayerVoiceClient({
      userId,
      displayName: table.get(userId)?.label?.text ?? `Player ${userId}`,
      resources,
      microphoneDeviceId: microphoneDeviceId || undefined,
      getOutputVolume: () =>
        audioManager.getVolume("settings.volume.playerVoice"),
      setGameAudioDucking: (active) =>
        audioManager.setPlayerVoiceDucking(active),
      onStatus: (nextStatus) => {
        if (clientRef.current === client) setStatus(nextStatus);
      },
    });
    clientRef.current = client;
    void client
      .start()
      .then(() => {
        if (clientRef.current === client) client.setSpeaking(true);
      })
      .catch((error) => {
        log.warn("Player voice chat did not start", { error });
      });
    return () => {
      if (clientRef.current === client) clientRef.current = undefined;
      void client.stop();
    };
  }, [
    audioManager,
    microphoneDeviceId,
    microphoneInputEnabled,
    playerVoiceEnabled,
    resources,
    supported,
    table,
    userId,
  ]);

  if (!supported) return null;

  const active = Boolean(playerVoiceEnabled && microphoneInputEnabled);
  const failed = status.state === "error";
  const busy =
    active &&
    ["requesting_permission", "joining", "reconnecting"].includes(status.state);
  const title = statusCopy(status, active, microphoneInputEnabled);

  return (
    <button
      type="button"
      aria-label={title}
      aria-pressed={active}
      title={title}
      data-player-voice-control="true"
      data-player-voice-status={status.state}
      onClick={toggleVoice}
      disabled={!microphoneInputEnabled}
      style={{
        ...voiceButtonStyle,
        borderColor: failed
          ? "rgba(239, 118, 122, 0.72)"
          : active
            ? "rgba(120, 224, 143, 0.72)"
            : "rgba(255, 255, 255, 0.3)",
        color: failed ? "#ef767a" : active ? "#78e08f" : "#e8eef8",
        opacity: microphoneInputEnabled ? 1 : 0.55,
      }}
    >
      <svg
        aria-hidden="true"
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0" />
        <path d="M12 17v5" />
        <path d="M8 22h8" />
        {!active && <path d="M3 3l18 18" />}
      </svg>
      <span aria-hidden="true" style={keyStyle}>
        {PLAYER_VOICE_TOGGLE_LABEL}
      </span>
      {status.peerCount > 0 && active && (
        <span
          aria-label={`${status.peerCount} nearby players`}
          style={peerStyle}
        >
          {status.peerCount}
        </span>
      )}
      {busy && <span aria-hidden="true" style={busyDotStyle} />}
    </button>
  );
});

const voiceButtonStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  width: 46,
  height: 34,
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  padding: "4px 5px",
  border: "1px solid",
  borderRadius: 8,
  background: "rgba(6, 12, 28, 0.86)",
  boxShadow: "0 5px 18px rgba(0, 0, 0, 0.32)",
  cursor: "pointer",
  pointerEvents: "auto",
};

const keyStyle: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 900,
  letterSpacing: "0.02em",
};

const peerStyle: React.CSSProperties = {
  position: "absolute",
  right: -5,
  top: -5,
  display: "grid",
  minWidth: 15,
  height: 15,
  placeItems: "center",
  padding: "0 3px",
  borderRadius: 999,
  background: "#78e08f",
  color: "#07111c",
  fontSize: 9,
  fontWeight: 900,
};

const busyDotStyle: React.CSSProperties = {
  position: "absolute",
  left: 4,
  top: 4,
  width: 5,
  height: 5,
  borderRadius: "50%",
  background: "#f4c66a",
  boxShadow: "0 0 8px #f4c66a",
};
