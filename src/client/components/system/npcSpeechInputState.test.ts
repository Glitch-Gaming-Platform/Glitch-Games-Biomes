import {
  browserSupportsNpcSpeechInputV1,
  npcSpeechButtonTooltipV1,
  npcSpeechEmptyTranscriptMessageV1,
  npcSpeechRecordingRemainingSecondsV1,
  npcSpeechRecordingTimeoutProgressV1,
  npcSpeechStatusActiveV1,
} from "@/client/components/system/npcSpeechInputState";
import assert from "assert";

describe("NPC speech input state", () => {
  it("only enables voice UI when STT, TTS, and generated chat are configured", () => {
    assert.equal(npcSpeechStatusActiveV1(undefined), false);
    assert.equal(
      npcSpeechStatusActiveV1({
        speechToText: true,
        textToSpeech: true,
        generatedChat: true,
      }),
      true
    );
    assert.equal(
      npcSpeechStatusActiveV1({
        speechToText: false,
        textToSpeech: true,
        generatedChat: true,
      }),
      false
    );
    assert.equal(
      npcSpeechStatusActiveV1({
        speechToText: true,
        textToSpeech: false,
        generatedChat: true,
      }),
      false
    );
    assert.equal(
      npcSpeechStatusActiveV1({
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
      browserSupportsNpcSpeechInputV1({
        navigator: { mediaDevices: { getUserMedia } },
        window: { AudioContext },
      }),
      true
    );
    assert.equal(
      browserSupportsNpcSpeechInputV1({
        navigator: { mediaDevices: { getUserMedia } },
        window: {},
      }),
      false
    );
    assert.equal(
      browserSupportsNpcSpeechInputV1({
        navigator: { mediaDevices: {} },
        window: { AudioContext },
      }),
      false
    );
  });

  it("uses explicit STT failure reasons before generic empty-transcript text", () => {
    assert.equal(
      npcSpeechEmptyTranscriptMessageV1("Azure Speech is not configured."),
      "Azure Speech is not configured."
    );
    assert.equal(
      npcSpeechEmptyTranscriptMessageV1("   "),
      "I couldn't catch that."
    );
    assert.equal(
      npcSpeechEmptyTranscriptMessageV1(undefined),
      "I couldn't catch that."
    );
  });

  it("returns state-specific tooltips for idle, recording, transcribing, unsupported, and error", () => {
    assert.equal(
      npcSpeechButtonTooltipV1({ supported: true, state: "idle" }),
      "Talk"
    );
    assert.equal(
      npcSpeechButtonTooltipV1({ supported: true, state: "recording" }),
      "Stop talking"
    );
    assert.equal(
      npcSpeechButtonTooltipV1({ supported: true, state: "transcribing" }),
      "Listening"
    );
    assert.equal(
      npcSpeechButtonTooltipV1({ supported: false, state: "idle" }),
      "Microphone recording is not available here."
    );
    assert.equal(
      npcSpeechButtonTooltipV1({
        error: "Microphone is unavailable.",
        supported: true,
        state: "error",
      }),
      "Microphone is unavailable."
    );
  });

  it("maps recording time into a visible countdown and grey-out progress", () => {
    assert.equal(
      npcSpeechRecordingRemainingSecondsV1({
        maxRecordingMs: 15_000,
        remainingMs: 15_000,
      }),
      15
    );
    assert.equal(
      npcSpeechRecordingRemainingSecondsV1({
        maxRecordingMs: 15_000,
        remainingMs: 14_001,
      }),
      15
    );
    assert.equal(
      npcSpeechRecordingRemainingSecondsV1({
        maxRecordingMs: 15_000,
        remainingMs: 14_000,
      }),
      14
    );
    assert.equal(
      npcSpeechRecordingRemainingSecondsV1({
        maxRecordingMs: 15_000,
        remainingMs: -100,
      }),
      0
    );
    assert.equal(
      npcSpeechRecordingRemainingSecondsV1({
        maxRecordingMs: 0,
        remainingMs: 0,
      }),
      undefined
    );

    assert.equal(
      npcSpeechRecordingTimeoutProgressV1({
        maxRecordingMs: 15_000,
        remainingMs: 15_000,
      }),
      0
    );
    assert.equal(
      npcSpeechRecordingTimeoutProgressV1({
        maxRecordingMs: 15_000,
        remainingMs: 7_500,
      }),
      0.5
    );
    assert.equal(
      npcSpeechRecordingTimeoutProgressV1({
        maxRecordingMs: 15_000,
        remainingMs: -100,
      }),
      1
    );
  });
});
