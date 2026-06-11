import {
  clearVoiceChatAudioElementForTestV1,
  clearRecentVoiceLinesForTestV1,
  RECENT_VOICE_LINE_TTL_MS_FOR_TEST_V1,
  shouldApplyVoiceChatAudioResultForTestV1,
  shouldRequestVoiceChatAudioForTestV1,
  shouldPlayVoiceLineForTestV1,
  voiceLineSuppressionKeyForTestV1,
} from "@/client/components/system/VoiceChat";
import assert from "assert";

describe("NPC voice playback", () => {
  beforeEach(() => {
    clearRecentVoiceLinesForTestV1();
  });

  it("suppresses immediate duplicate voice lines", () => {
    assert.equal(shouldPlayVoiceLineForTestV1("npc:line", 1000), true);
    assert.equal(shouldPlayVoiceLineForTestV1("npc:line", 1500), false);
    assert.equal(shouldPlayVoiceLineForTestV1("npc:other", 1500), true);
  });

  it("allows the same line after the repeat window expires", () => {
    assert.equal(shouldPlayVoiceLineForTestV1("npc:line", 1000), true);
    assert.equal(
      shouldPlayVoiceLineForTestV1(
        "npc:line",
        1000 + RECENT_VOICE_LINE_TTL_MS_FOR_TEST_V1 + 1
      ),
      true
    );
  });

  it("deduplicates the same spoken line even when the dialog playback id changes", () => {
    const keyFromFirstRender = voiceLineSuppressionKeyForTestV1({
      text: "  Same line,   same voice. ",
      voice: "azure-speech-v1|voice=en-US-BrandonNeural",
      language: "en-US",
    });
    const keyFromSecondRender = voiceLineSuppressionKeyForTestV1({
      text: "Same line, same voice.",
      voice: "azure-speech-v1|voice=en-US-BrandonNeural",
      language: "en-US",
    });

    assert.equal(keyFromFirstRender, keyFromSecondRender);
    assert.equal(shouldPlayVoiceLineForTestV1(keyFromFirstRender, 1000), true);
    assert.equal(
      shouldPlayVoiceLineForTestV1(keyFromSecondRender, 3000),
      false
    );
  });

  it("does not suppress the same words when voice or language changes", () => {
    const avaEnglish = voiceLineSuppressionKeyForTestV1({
      text: "Meet me by the board.",
      voice: "azure-speech-v1|voice=en-US-AvaNeural",
      language: "en-US",
    });
    const avaFrench = voiceLineSuppressionKeyForTestV1({
      text: "Meet me by the board.",
      voice: "azure-speech-v1|voice=en-US-AvaNeural",
      language: "fr-FR",
    });
    const brianEnglish = voiceLineSuppressionKeyForTestV1({
      text: "Meet me by the board.",
      voice: "azure-speech-v1|voice=en-US-BrianNeural",
      language: "en-US",
    });

    assert.equal(shouldPlayVoiceLineForTestV1(avaEnglish, 1000), true);
    assert.equal(shouldPlayVoiceLineForTestV1(avaFrench, 1500), true);
    assert.equal(shouldPlayVoiceLineForTestV1(brianEnglish, 2000), true);
  });

  it("expires old voice-line entries while checking new lines", () => {
    assert.equal(shouldPlayVoiceLineForTestV1("old-line", 1000), true);
    assert.equal(
      shouldPlayVoiceLineForTestV1(
        "new-line",
        1000 + RECENT_VOICE_LINE_TTL_MS_FOR_TEST_V1 + 1
      ),
      true
    );
    assert.equal(
      shouldPlayVoiceLineForTestV1(
        "old-line",
        1000 + RECENT_VOICE_LINE_TTL_MS_FOR_TEST_V1 + 2
      ),
      true
    );
  });

  it("clears finished audio so external audio-unlock code cannot replay old NPC lines", () => {
    const calls: string[] = [];
    const audio = {
      pause: () => calls.push("pause"),
      removeAttribute: (name: string) => calls.push(`remove:${name}`),
      load: () => calls.push("load"),
    } as unknown as HTMLAudioElement;

    clearVoiceChatAudioElementForTestV1(audio);

    assert.deepEqual(calls, ["pause", "remove:src", "load"]);
  });

  it("does not request NPC speech audio when the player turns NPC speech off", () => {
    assert.equal(
      shouldRequestVoiceChatAudioForTestV1({
        npcSpeechEnabled: true,
        text: "Hello",
        voice: "azure-speech-v1|voice=en-US-AvaNeural",
      }),
      true
    );
    assert.equal(
      shouldRequestVoiceChatAudioForTestV1({
        npcSpeechEnabled: false,
        text: "Hello",
        voice: "azure-speech-v1|voice=en-US-AvaNeural",
      }),
      false
    );
    assert.equal(
      shouldRequestVoiceChatAudioForTestV1({
        npcSpeechEnabled: true,
        text: "",
        voice: "azure-speech-v1|voice=en-US-AvaNeural",
      }),
      false
    );
  });

  it("ignores late TTS results after the dialog closes or changes", () => {
    const base = {
      cancelled: false,
      requestText: "Billy says this once.",
      latestText: "Billy says this once.",
      requestKey: "billy:1",
      latestRequestKey: "billy:1",
      audioStillMounted: true,
      responseUrl: "data:audio/wav;base64,ok",
      currentAudioSrc: "",
    };

    assert.equal(shouldApplyVoiceChatAudioResultForTestV1(base), true);
    assert.equal(
      shouldApplyVoiceChatAudioResultForTestV1({
        ...base,
        cancelled: true,
      }),
      false
    );
    assert.equal(
      shouldApplyVoiceChatAudioResultForTestV1({
        ...base,
        audioStillMounted: false,
      }),
      false
    );
    assert.equal(
      shouldApplyVoiceChatAudioResultForTestV1({
        ...base,
        latestText: "Another line.",
      }),
      false
    );
    assert.equal(
      shouldApplyVoiceChatAudioResultForTestV1({
        ...base,
        latestRequestKey: "",
      }),
      false
    );
  });
});
