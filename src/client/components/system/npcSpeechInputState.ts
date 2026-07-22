import type { SpeechStatusResponse } from "@/pages/api/voices/speech_status";

export type NpcSpeechButtonState =
  | "idle"
  | "starting"
  | "recording"
  | "transcribing"
  | "error";

export function npcSpeechStatusActive(
  status:
    | Pick<
        SpeechStatusResponse,
        "speechToText" | "textToSpeech" | "generatedChat"
      >
    | null
    | undefined
) {
  // Input remains useful when NPC output audio is disabled: the transcript can
  // still be interpreted and the NPC response displayed as text.
  return Boolean(status?.speechToText && status.generatedChat);
}

export function browserSupportsNpcSpeechInput(input: {
  navigator?: {
    mediaDevices?: {
      getUserMedia?: unknown;
    };
  };
  window?: {
    AudioContext?: unknown;
    webkitAudioContext?: unknown;
  };
}) {
  return Boolean(
    input.navigator?.mediaDevices?.getUserMedia &&
      (input.window?.AudioContext || input.window?.webkitAudioContext)
  );
}

export function npcSpeechEmptyTranscriptMessage(reason: string | undefined) {
  return reason?.trim() || "I couldn't catch that.";
}

export function npcSpeechButtonTooltip(input: {
  error?: string;
  supported: boolean;
  state: NpcSpeechButtonState;
}) {
  if (input.error) {
    return input.error;
  }
  if (!input.supported) {
    return "Microphone recording is not available here.";
  }
  if (input.state === "recording") {
    return "Stop talking";
  }
  if (input.state === "starting") {
    return "Starting microphone";
  }
  if (input.state === "transcribing") {
    return "Interpreting speech";
  }
  return "Talk";
}

export function npcSpeechHotkeyIndicator(input: {
  error?: string;
  state: NpcSpeechButtonState;
}) {
  if (input.state === "starting" || input.state === "recording") {
    return "Listening… release T to send";
  }
  if (input.state === "transcribing") {
    return "Interpreting…";
  }
  if (input.error) {
    return input.error;
  }
  return "Press T to talk";
}

export function shouldHandleNpcSpeechHotkey(input: {
  code: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  targetTagName?: string;
  targetIsContentEditable?: boolean;
}) {
  // Do not steal typing, browser/editor shortcuts, or modified key chords from
  // other UI. The dialogue-scoped component only claims an unmodified KeyT.
  if (
    input.code !== "KeyT" ||
    input.altKey ||
    input.ctrlKey ||
    input.metaKey ||
    input.targetIsContentEditable
  ) {
    return false;
  }
  return !["INPUT", "TEXTAREA", "SELECT"].includes(
    input.targetTagName?.toUpperCase() ?? ""
  );
}

export function npcSpeechRecordingRemainingSeconds(input: {
  maxRecordingMs: number;
  remainingMs: number;
}) {
  if (!Number.isFinite(input.maxRecordingMs) || input.maxRecordingMs <= 0) {
    return undefined;
  }
  return Math.max(0, Math.ceil(input.remainingMs / 1000));
}

export function npcSpeechRecordingTimeoutProgress(input: {
  maxRecordingMs: number;
  remainingMs: number;
}) {
  if (!Number.isFinite(input.maxRecordingMs) || input.maxRecordingMs <= 0) {
    return 0;
  }
  const elapsedMs = input.maxRecordingMs - input.remainingMs;
  return Math.max(0, Math.min(1, elapsedMs / input.maxRecordingMs));
}
