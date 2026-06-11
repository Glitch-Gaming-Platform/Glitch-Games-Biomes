import type { SpeechStatusResponse } from "@/pages/api/voices/speech_status";

export type NpcSpeechButtonStateV1 =
  | "idle"
  | "recording"
  | "transcribing"
  | "error";

export function npcSpeechStatusActiveV1(
  status:
    | Pick<
        SpeechStatusResponse,
        "speechToText" | "textToSpeech" | "generatedChat"
      >
    | null
    | undefined
) {
  return Boolean(
    status?.speechToText && status.textToSpeech && status.generatedChat
  );
}

export function browserSupportsNpcSpeechInputV1(input: {
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

export function npcSpeechEmptyTranscriptMessageV1(reason: string | undefined) {
  return reason?.trim() || "I couldn't catch that.";
}

export function npcSpeechButtonTooltipV1(input: {
  error?: string;
  supported: boolean;
  state: NpcSpeechButtonStateV1;
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
  if (input.state === "transcribing") {
    return "Listening";
  }
  return "Talk";
}

export function npcSpeechRecordingRemainingSecondsV1(input: {
  maxRecordingMs: number;
  remainingMs: number;
}) {
  if (!Number.isFinite(input.maxRecordingMs) || input.maxRecordingMs <= 0) {
    return undefined;
  }
  return Math.max(0, Math.ceil(input.remainingMs / 1000));
}

export function npcSpeechRecordingTimeoutProgressV1(input: {
  maxRecordingMs: number;
  remainingMs: number;
}) {
  if (!Number.isFinite(input.maxRecordingMs) || input.maxRecordingMs <= 0) {
    return 0;
  }
  const elapsedMs = input.maxRecordingMs - input.remainingMs;
  return Math.max(0, Math.min(1, elapsedMs / input.maxRecordingMs));
}
