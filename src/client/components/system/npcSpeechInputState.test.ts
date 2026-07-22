import {
  browserSupportsNpcSpeechInput,
  npcSpeechButtonTooltip,
  npcSpeechEmptyTranscriptMessage,
  npcSpeechHotkeyIndicator,
  npcSpeechRecordingRemainingSeconds,
  npcSpeechRecordingTimeoutProgress,
  npcSpeechStatusActive,
  shouldHandleNpcSpeechHotkey,
} from "@/client/components/system/npcSpeechInputState";
import assert from "assert";

describe("NPC speech input state", () => {
  it("enables voice input when STT and generated chat are configured, even if NPC TTS is off", () => {
    assert.equal(npcSpeechStatusActive(undefined), false);
    assert.equal(
      npcSpeechStatusActive({
        speechToText: true,
        textToSpeech: true,
        generatedChat: true,
      }),
      true
    );
    assert.equal(
      npcSpeechStatusActive({
        speechToText: false,
        textToSpeech: true,
        generatedChat: true,
      }),
      false
    );
    assert.equal(
      npcSpeechStatusActive({
        speechToText: true,
        textToSpeech: false,
        generatedChat: true,
      }),
      true
    );
    assert.equal(
      npcSpeechStatusActive({
        speechToText: true,
        textToSpeech: true,
        generatedChat: false,
      }),
      false
    );
  });

  it("requires browser recording and audio APIs before the talk button can record", () => {
    const getUserMedia = () => undefined;
    const AudioContext = function AudioContext() {};

    assert.equal(
      browserSupportsNpcSpeechInput({
        navigator: { mediaDevices: { getUserMedia } },
        window: { AudioContext },
      }),
      true
    );
    assert.equal(
      browserSupportsNpcSpeechInput({
        navigator: { mediaDevices: { getUserMedia } },
        window: {},
      }),
      false
    );
    assert.equal(
      browserSupportsNpcSpeechInput({
        navigator: { mediaDevices: {} },
        window: { AudioContext },
      }),
      false
    );
  });

  it("uses explicit STT failure reasons before generic empty-transcript text", () => {
    assert.equal(
      npcSpeechEmptyTranscriptMessage("Azure Speech is not configured."),
      "Azure Speech is not configured."
    );
    assert.equal(
      npcSpeechEmptyTranscriptMessage("   "),
      "I couldn't catch that."
    );
    assert.equal(
      npcSpeechEmptyTranscriptMessage(undefined),
      "I couldn't catch that."
    );
  });

  it("returns state-specific tooltips for idle, recording, transcribing, unsupported, and error", () => {
    assert.equal(
      npcSpeechButtonTooltip({ supported: true, state: "idle" }),
      "Talk"
    );
    assert.equal(
      npcSpeechButtonTooltip({ supported: true, state: "starting" }),
      "Starting microphone"
    );
    assert.equal(
      npcSpeechButtonTooltip({ supported: true, state: "recording" }),
      "Stop talking"
    );
    assert.equal(
      npcSpeechButtonTooltip({ supported: true, state: "transcribing" }),
      "Interpreting speech"
    );
    assert.equal(
      npcSpeechButtonTooltip({ supported: false, state: "idle" }),
      "Microphone recording is not available here."
    );
    assert.equal(
      npcSpeechButtonTooltip({
        error: "Microphone is unavailable.",
        supported: true,
        state: "error",
      }),
      "Microphone is unavailable."
    );
  });

  it("shows clear hold-to-talk states and ignores T inside editable controls", () => {
    assert.equal(
      npcSpeechHotkeyIndicator({ state: "idle" }),
      "Press T to talk"
    );
    assert.equal(
      npcSpeechHotkeyIndicator({ state: "starting" }),
      "Listening… release T to send"
    );
    assert.equal(
      npcSpeechHotkeyIndicator({ state: "recording" }),
      "Listening… release T to send"
    );
    assert.equal(
      npcSpeechHotkeyIndicator({ state: "transcribing" }),
      "Interpreting…"
    );
    assert.equal(shouldHandleNpcSpeechHotkey({ code: "KeyT" }), true);
    assert.equal(
      shouldHandleNpcSpeechHotkey({ code: "KeyT", targetTagName: "input" }),
      false
    );
    assert.equal(
      shouldHandleNpcSpeechHotkey({
        code: "KeyT",
        targetIsContentEditable: true,
      }),
      false
    );
    assert.equal(
      shouldHandleNpcSpeechHotkey({ code: "KeyT", ctrlKey: true }),
      false
    );
    assert.equal(shouldHandleNpcSpeechHotkey({ code: "KeyF" }), false);
  });

  it("maps recording time into a visible countdown and grey-out progress", () => {
    assert.equal(
      npcSpeechRecordingRemainingSeconds({
        maxRecordingMs: 15_000,
        remainingMs: 15_000,
      }),
      15
    );
    assert.equal(
      npcSpeechRecordingRemainingSeconds({
        maxRecordingMs: 15_000,
        remainingMs: 14_001,
      }),
      15
    );
    assert.equal(
      npcSpeechRecordingRemainingSeconds({
        maxRecordingMs: 15_000,
        remainingMs: 14_000,
      }),
      14
    );
    assert.equal(
      npcSpeechRecordingRemainingSeconds({
        maxRecordingMs: 15_000,
        remainingMs: -100,
      }),
      0
    );
    assert.equal(
      npcSpeechRecordingRemainingSeconds({
        maxRecordingMs: 0,
        remainingMs: 0,
      }),
      undefined
    );

    assert.equal(
      npcSpeechRecordingTimeoutProgress({
        maxRecordingMs: 15_000,
        remainingMs: 15_000,
      }),
      0
    );
    assert.equal(
      npcSpeechRecordingTimeoutProgress({
        maxRecordingMs: 15_000,
        remainingMs: 7_500,
      }),
      0.5
    );
    assert.equal(
      npcSpeechRecordingTimeoutProgress({
        maxRecordingMs: 15_000,
        remainingMs: -100,
      }),
      1
    );
  });
});
