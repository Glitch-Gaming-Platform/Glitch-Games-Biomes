import { DialogButton } from "@/client/components/system/DialogButton";
import { Tooltipped } from "@/client/components/system/Tooltipped";
import {
  browserSupportsNpcSpeechInput,
  npcSpeechButtonTooltip,
  npcSpeechEmptyTranscriptMessage,
  npcSpeechHotkeyIndicator,
  npcSpeechRecordingRemainingSeconds,
  npcSpeechRecordingTimeoutProgress,
  npcSpeechStatusActive,
  shouldHandleNpcSpeechHotkey,
  type NpcSpeechButtonState,
} from "@/client/components/system/npcSpeechInputState";
import {
  blobToBase64,
  startAzureSpeechWavRecorder,
  type AzureSpeechWavRecorder,
} from "@/client/components/system/speechCapture";
import { useTypedStorageItem } from "@/client/util/typed_local_storage";
import type {
  SpeechToTextRequest,
  SpeechToTextResponse,
} from "@/pages/api/voices/speech_to_text";
import type { SpeechStatusResponse } from "@/pages/api/voices/speech_status";
import { log } from "@/shared/logging";
import { jsonFetch, jsonPost } from "@/shared/util/fetch_helpers";
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

export const NPC_SPEECH_STOP_RECORDING_EVENT =
  "biomes:npc-speech-stop-recording";
export const NPC_SPEECH_MAX_RECORDING_MS = 15_000;

export const NpcSpeechInputButton: React.FunctionComponent<{
  disabled?: boolean;
  language?: string;
  maxRecordingMs?: number;
  onStateChange?: (state: NpcSpeechButtonState) => void;
  onTranscript: (text: string) => unknown;
}> = ({
  disabled,
  language,
  maxRecordingMs = NPC_SPEECH_MAX_RECORDING_MS,
  onStateChange,
  onTranscript,
}) => {
  const recorderRef = useRef<AzureSpeechWavRecorder | undefined>();
  const recordingTimeoutRef = useRef<number | undefined>();
  const recordingStartedAtRef = useRef<number | undefined>();
  const stateRef = useRef<NpcSpeechButtonState>("idle");
  // Refs provide synchronous guards for document-level key events and async
  // microphone permission callbacks, where React state may still be stale.
  const mountedRef = useRef(true);
  const disabledRef = useRef(Boolean(disabled));
  const keyHeldRef = useRef(false);
  const startTokenRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const [state, setState] = useState<NpcSpeechButtonState>("idle");
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
      browserSupportsNpcSpeechInput({
        navigator: typeof navigator !== "undefined" ? navigator : undefined,
        window: typeof window !== "undefined" ? window : undefined,
      }),
    []
  );

  const setButtonState = useCallback((next: NpcSpeechButtonState) => {
    // Update the synchronous state first so rapid keyup/click events observe the
    // new lifecycle phase before React completes its render.
    stateRef.current = next;
    if (mountedRef.current) {
      setState(next);
    }
  }, []);

  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);

  useEffect(() => {
    let disposed = false;
    // Speech input requires transcription and generated chat, but deliberately
    // does not require NPC TTS so a player can receive text-only responses.
    jsonFetch<SpeechStatusResponse>("/api/voices/speech_status", {
      timeoutMs: 5000,
    })
      .then((status) => {
        if (!disposed) {
          setSpeechActive(npcSpeechStatusActive(status));
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
      setButtonState("idle");
    }, 2500);
    return () => window.clearTimeout(timeout);
  }, [error, setButtonState]);

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

  const transcribeRecording = useCallback(
    async (recorder: AzureSpeechWavRecorder) => {
      // Stop capture before encoding/uploading so browser microphone tracks are
      // released during the longer transcription and AI-response work.
      recordingStartedAtRef.current = undefined;
      clearRecordingTimeout();
      setButtonState("transcribing");
      try {
        const recording = await recorder.stop();
        const audioBase64 = await blobToBase64(recording.blob);
        const res = await jsonPost<SpeechToTextResponse, SpeechToTextRequest>(
          "/api/voices/speech_to_text",
          {
            audioBase64,
            mimeType: recording.mimeType,
            language,
          },
          { timeoutMs: 20000 }
        );
        if (!mountedRef.current) {
          // Dialog closure invalidates late transcription results and prevents
          // them from mutating or reopening a conversation that no longer exists.
          return;
        }
        const text = res.text.trim();
        if (!text) {
          setButtonState("error");
          setError(npcSpeechEmptyTranscriptMessage(res.unavailableReason));
          return;
        }
        setButtonState("idle");
        await onTranscript(text);
      } catch (error) {
        log.warn("NPC speech transcription failed", { error });
        if (mountedRef.current) {
          setButtonState("error");
          setError("I couldn't catch that.");
        }
      }
    },
    [clearRecordingTimeout, language, onTranscript, setButtonState]
  );

  const stopRecording = useCallback(async () => {
    // Remember release/stop requests even before getUserMedia resolves. This
    // handles a quick T tap while a permission prompt is still on screen.
    stopRequestedRef.current = true;
    const recorder = recorderRef.current;
    if (!recorder) {
      // A quick tap can release T before getUserMedia resolves. Return the UI
      // to idle immediately; the pending start token will discard the recorder
      // if permission later succeeds.
      if (stateRef.current === "starting") {
        setButtonState("idle");
      }
      return;
    }
    recorderRef.current = undefined;
    await transcribeRecording(recorder);
  }, [transcribeRecording]);

  const beginRecording = useCallback(async () => {
    if (
      disabledRef.current ||
      !supported ||
      stateRef.current === "starting" ||
      stateRef.current === "recording" ||
      stateRef.current === "transcribing"
    ) {
      return;
    }
    const startToken = ++startTokenRef.current;
    // Each permission attempt gets a token so an older async completion cannot
    // replace a newer recorder after retries or unmounts.
    stopRequestedRef.current = false;
    setError(undefined);
    setButtonState("starting");
    try {
      const recorder = await startAzureSpeechWavRecorder({
        deviceId: microphoneDeviceId || undefined,
      });
      if (!mountedRef.current || startToken !== startTokenRef.current) {
        // Permission resolved after the owning dialog changed or unmounted.
        // Immediately stop the newly-created recorder instead of leaking a mic.
        await recorder.stop();
        return;
      }
      if (disabledRef.current || stopRequestedRef.current) {
        // The player released T (or AI processing disabled input) before capture
        // was ready, so discard the empty/partial permission-window recording.
        setButtonState("idle");
        await recorder.stop();
        return;
      }
      recorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      setRemainingRecordingMs(maxRecordingMs);
      setButtonState("recording");
      clearRecordingTimeout();
      if (Number.isFinite(maxRecordingMs) && maxRecordingMs > 0) {
        // A hard cap prevents an indefinitely held key from creating oversized
        // audio uploads or unexpected speech-recognition cost.
        recordingTimeoutRef.current = window.setTimeout(() => {
          void stopRecording();
        }, maxRecordingMs);
      }
    } catch (error) {
      if (!mountedRef.current || startToken !== startTokenRef.current) {
        return;
      }
      log.warn("NPC speech input unavailable", { error });
      recorderRef.current = undefined;
      recordingStartedAtRef.current = undefined;
      clearRecordingTimeout();
      setButtonState("error");
      setError("Microphone is unavailable.");
    }
  }, [
    clearRecordingTimeout,
    maxRecordingMs,
    microphoneDeviceId,
    setButtonState,
    stopRecording,
    supported,
  ]);

  useEffect(() => {
    disabledRef.current = Boolean(disabled);
    // If the parent begins querying the NPC while capture is starting/active,
    // finalize the current utterance instead of leaving the mic live.
    if (
      disabled &&
      (stateRef.current === "starting" || stateRef.current === "recording")
    ) {
      void stopRecording();
    }
  }, [disabled, stopRecording]);

  useEffect(() => {
    const onStopRecording = () => {
      if (
        stateRef.current === "starting" ||
        stateRef.current === "recording" ||
        recorderRef.current
      ) {
        void stopRecording();
      }
    };
    window.addEventListener(NPC_SPEECH_STOP_RECORDING_EVENT, onStopRecording);
    return () => {
      window.removeEventListener(
        NPC_SPEECH_STOP_RECORDING_EVENT,
        onStopRecording
      );
    };
  }, [stopRecording]);

  useEffect(() => {
    if (!speechActive || !supported) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        !shouldHandleNpcSpeechHotkey({
          code: event.code,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          targetTagName: target?.tagName,
          targetIsContentEditable: target?.isContentEditable,
        })
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      // Key repeat must not start multiple recorders while T remains held.
      if (event.repeat || keyHeldRef.current || disabledRef.current) {
        return;
      }
      keyHeldRef.current = true;
      void beginRecording();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "KeyT" || !keyHeldRef.current) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      keyHeldRef.current = false;
      // Releasing T is the authoritative end of push-to-talk and immediately
      // transitions into transcription when capture is ready.
      void stopRecording();
    };
    const stopForFocusLoss = () => {
      // Browsers may omit keyup when focus changes. Treat blur/tab hiding as a
      // release so recording never remains stuck in the background.
      keyHeldRef.current = false;
      if (stateRef.current === "starting" || stateRef.current === "recording") {
        void stopRecording();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        stopForFocusLoss();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", stopForFocusLoss);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", stopForFocusLoss);
    };
  }, [beginRecording, speechActive, stopRecording, supported]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      // Invalidate pending permission callbacks and release any live recorder.
      // Cleanup intentionally skips transcription because the dialog is gone.
      mountedRef.current = false;
      startTokenRef.current += 1;
      stopRequestedRef.current = true;
      keyHeldRef.current = false;
      clearRecordingTimeout();
      const recorder = recorderRef.current;
      recorderRef.current = undefined;
      void recorder?.stop().catch((error) => {
        log.warn("NPC speech recorder cleanup failed", { error });
      });
    };
  }, [clearRecordingTimeout]);

  const onClick = async () => {
    if (disabled || !supported || state === "transcribing") {
      return;
    }
    if (state === "starting" || state === "recording") {
      await stopRecording();
      return;
    }
    await beginRecording();
  };

  const busy =
    state === "starting" || state === "recording" || state === "transcribing";
  const buttonDisabled = disabled || !supported || state === "transcribing";
  if (!speechActive) {
    return null;
  }
  const icon =
    state === "recording" ? (
      <StopOutlined />
    ) : state === "starting" || state === "transcribing" ? (
      <LoadingOutlined />
    ) : (
      <AudioOutlined />
    );
  const remainingSeconds =
    state === "recording"
      ? npcSpeechRecordingRemainingSeconds({
          maxRecordingMs,
          remainingMs: remainingRecordingMs,
        })
      : undefined;
  const timeoutProgress =
    state === "recording"
      ? npcSpeechRecordingTimeoutProgress({
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
  const indicator = npcSpeechHotkeyIndicator({ error, state });

  return (
    <Tooltipped
      wrapperExtraClass="mx-auto"
      tooltip={npcSpeechButtonTooltip({
        error,
        supported,
        state,
      })}
    >
      <span
        className="flex flex-col items-center gap-0.4"
        data-npc-speech-input-button={state}
        data-npc-speech-input-active={speechActive ? "true" : "false"}
        data-npc-speech-input-remaining-seconds={remainingSeconds}
        data-npc-speech-input-timeout-progress={timeoutProgress.toFixed(2)}
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
        <span
          aria-live="polite"
          className="whitespace-nowrap text-[10px] font-semibold text-white/80"
          data-npc-speech-hotkey-indicator={state}
        >
          {/* The live label gives both keyboard instructions and an accessible
              listening/processing state without replacing the existing button. */}
          {(state === "starting" || state === "recording") && (
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 mr-0.4 inline-block animate-pulse rounded-full bg-red"
            />
          )}
          {indicator}
        </span>
      </span>
    </Tooltipped>
  );
};
