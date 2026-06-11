import { DialogButton } from "@/client/components/system/DialogButton";
import { Tooltipped } from "@/client/components/system/Tooltipped";
import {
  blobToBase64V1,
  startAzureSpeechWavRecorderV1,
  type AzureSpeechWavRecorderV1,
} from "@/client/components/system/speechCapture";
import {
  browserSupportsNpcSpeechInputV1,
  npcSpeechButtonTooltipV1,
  npcSpeechEmptyTranscriptMessageV1,
  npcSpeechRecordingRemainingSecondsV1,
  npcSpeechRecordingTimeoutProgressV1,
  npcSpeechStatusActiveV1,
  type NpcSpeechButtonStateV1,
} from "@/client/components/system/npcSpeechInputState";
import type {
  SpeechToTextRequest,
  SpeechToTextResponse,
} from "@/pages/api/voices/speech_to_text";
import type { SpeechStatusResponse } from "@/pages/api/voices/speech_status";
import { log } from "@/shared/logging";
import { jsonFetch, jsonPost } from "@/shared/util/fetch_helpers";
import { useTypedStorageItem } from "@/client/util/typed_local_storage";
import {
  AudioOutlined,
  LoadingOutlined,
  StopOutlined,
} from "@ant-design/icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const NPC_SPEECH_STOP_RECORDING_EVENT_V1 =
  "biomes:npc-speech-stop-recording-v1";
export const NPC_SPEECH_MAX_RECORDING_MS_V1 = 15_000;

export const NpcSpeechInputButton: React.FunctionComponent<{
  disabled?: boolean;
  language?: string;
  maxRecordingMs?: number;
  onStateChange?: (state: NpcSpeechButtonStateV1) => void;
  onTranscript: (text: string) => unknown;
}> = ({
  disabled,
  language,
  maxRecordingMs = NPC_SPEECH_MAX_RECORDING_MS_V1,
  onStateChange,
  onTranscript,
}) => {
  const recorderRef = useRef<AzureSpeechWavRecorderV1 | undefined>();
  const recordingTimeoutRef = useRef<number | undefined>();
  const recordingStartedAtRef = useRef<number | undefined>();
  const stateRef = useRef<NpcSpeechButtonStateV1>("idle");
  const [state, setState] = useState<NpcSpeechButtonStateV1>("idle");
  const [error, setError] = useState<string | undefined>();
  const [remainingRecordingMs, setRemainingRecordingMs] =
    useState(maxRecordingMs);
  const [speechActive, setSpeechActive] = useState(false);
  const [microphoneDeviceId] = useTypedStorageItem(
    "settings.voice.microphoneDeviceId",
    ""
  );

  const supported = useMemo(
    () =>
      browserSupportsNpcSpeechInputV1({
        navigator: typeof navigator !== "undefined" ? navigator : undefined,
        window: typeof window !== "undefined" ? window : undefined,
      }),
    []
  );

  useEffect(() => {
    stateRef.current = state;
    onStateChange?.(state);
  }, [onStateChange, state]);

  useEffect(() => {
    let disposed = false;
    jsonFetch<SpeechStatusResponse>("/api/voices/speech_status", {
      timeoutMs: 5000,
    })
      .then((status) => {
        if (!disposed) {
          setSpeechActive(npcSpeechStatusActiveV1(status));
        }
      })
      .catch((error) => {
        log.warn("NPC speech status unavailable", { error });
        if (!disposed) {
          setSpeechActive(false);
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!error) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setError(undefined);
      setState("idle");
    }, 2500);
    return () => window.clearTimeout(timeout);
  }, [error]);

  const clearRecordingTimeout = useCallback(() => {
    if (recordingTimeoutRef.current !== undefined) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    if (state !== "recording") {
      recordingStartedAtRef.current = undefined;
      setRemainingRecordingMs(maxRecordingMs);
      return;
    }
    const updateRemaining = () => {
      const startedAt = recordingStartedAtRef.current ?? Date.now();
      const nextRemainingMs = Math.max(
        0,
        maxRecordingMs - (Date.now() - startedAt)
      );
      setRemainingRecordingMs(nextRemainingMs);
    };
    updateRemaining();
    const interval = window.setInterval(updateRemaining, 250);
    return () => window.clearInterval(interval);
  }, [maxRecordingMs, state]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) {
      return;
    }
    recorderRef.current = undefined;
    recordingStartedAtRef.current = undefined;
    clearRecordingTimeout();
    setState("transcribing");
    try {
      const recording = await recorder.stop();
      const audioBase64 = await blobToBase64V1(recording.blob);
      const res = await jsonPost<SpeechToTextResponse, SpeechToTextRequest>(
        "/api/voices/speech_to_text",
        {
          audioBase64,
          mimeType: recording.mimeType,
          language,
        },
        { timeoutMs: 20000 }
      );
      const text = res.text.trim();
      if (!text) {
        setState("error");
        setError(npcSpeechEmptyTranscriptMessageV1(res.unavailableReason));
        return;
      }
      setState("idle");
      await onTranscript(text);
    } catch (error) {
      log.warn("NPC speech transcription failed", { error });
      setState("error");
      setError("I couldn't catch that.");
    }
  }, [clearRecordingTimeout, language, onTranscript]);

  useEffect(() => {
    const onStopRecording = () => {
      if (stateRef.current === "recording" || recorderRef.current) {
        void stopRecording();
      }
    };
    window.addEventListener(
      NPC_SPEECH_STOP_RECORDING_EVENT_V1,
      onStopRecording
    );
    return () => {
      window.removeEventListener(
        NPC_SPEECH_STOP_RECORDING_EVENT_V1,
        onStopRecording
      );
    };
  }, [stopRecording]);

  useEffect(() => {
    return () => {
      clearRecordingTimeout();
      const recorder = recorderRef.current;
      recorderRef.current = undefined;
      void recorder?.stop().catch((error) => {
        log.warn("NPC speech recorder cleanup failed", { error });
      });
    };
  }, [clearRecordingTimeout]);

  const onClick = async () => {
    if (disabled || !supported) {
      return;
    }
    try {
      if (state === "recording") {
        await stopRecording();
        return;
      }
      setError(undefined);
      recorderRef.current = await startAzureSpeechWavRecorderV1({
        deviceId: microphoneDeviceId || undefined,
      });
      recordingStartedAtRef.current = Date.now();
      setRemainingRecordingMs(maxRecordingMs);
      setState("recording");
      clearRecordingTimeout();
      if (Number.isFinite(maxRecordingMs) && maxRecordingMs > 0) {
        recordingTimeoutRef.current = window.setTimeout(() => {
          void stopRecording();
        }, maxRecordingMs);
      }
    } catch (error) {
      log.warn("NPC speech input unavailable", { error });
      recorderRef.current = undefined;
      recordingStartedAtRef.current = undefined;
      clearRecordingTimeout();
      setState("error");
      setError("Microphone is unavailable.");
    }
  };

  const busy = state === "recording" || state === "transcribing";
  const buttonDisabled = disabled || !supported || state === "transcribing";
  if (!speechActive) {
    return null;
  }
  const icon =
    state === "recording" ? (
      <StopOutlined />
    ) : state === "transcribing" ? (
      <LoadingOutlined />
    ) : (
      <AudioOutlined />
    );
  const remainingSeconds =
    state === "recording"
      ? npcSpeechRecordingRemainingSecondsV1({
          maxRecordingMs,
          remainingMs: remainingRecordingMs,
        })
      : undefined;
  const timeoutProgress =
    state === "recording"
      ? npcSpeechRecordingTimeoutProgressV1({
          maxRecordingMs,
          remainingMs: remainingRecordingMs,
        })
      : 0;
  const recordingButtonStyle =
    state === "recording"
      ? {
          filter: `grayscale(${Math.round(timeoutProgress * 100)}%)`,
          opacity: 1 - timeoutProgress * 0.35,
        }
      : undefined;

  return (
    <Tooltipped
      wrapperExtraClass="mx-auto"
      tooltip={npcSpeechButtonTooltipV1({
        error,
        supported,
        state,
      })}
    >
      <span
        data-npc-speech-input-button-v1={state}
        data-npc-speech-input-active-v1={speechActive ? "true" : "false"}
        data-npc-speech-input-remaining-seconds-v1={remainingSeconds}
        data-npc-speech-input-timeout-progress-v1={timeoutProgress.toFixed(2)}
      >
        <DialogButton
          size="small"
          type={busy ? "special" : "normal-filled"}
          disabled={buttonDisabled}
          extraClassNames="relative overflow-hidden items-center justify-center flex w-8 h-8 min-w-8 mx-auto"
          onClick={() => {
            void onClick();
          }}
        >
          {state === "recording" && (
            <span
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                backgroundColor: `rgba(96, 96, 96, ${
                  0.2 + timeoutProgress * 0.55
                })`,
              }}
            />
          )}
          <span
            className="relative z-10 flex h-full w-full items-center justify-center"
            style={recordingButtonStyle}
          >
            {remainingSeconds !== undefined ? (
              <span className="text-[11px] font-bold leading-none">
                {remainingSeconds}
              </span>
            ) : (
              icon
            )}
          </span>
        </DialogButton>
      </span>
    </Tooltipped>
  );
};
