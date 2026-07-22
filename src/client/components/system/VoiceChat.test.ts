import {
  clearVoiceChatAudioElementForTest,
  clearRecentVoiceLinesForTest,
  RECENT_VOICE_LINE_TTL_MS_FOR_TEST,
  shouldApplyVoiceChatAudioResultForTest,
  shouldRequestVoiceChatAudioForTest,
  shouldPlayVoiceLineForTest,
  voiceLineSuppressionKeyForTest,
} from "@/client/components/system/VoiceChat";
import assert from "assert";

describe("NPC voice playback", () => {
  beforeEach(() => {
    clearRecentVoiceLinesForTest();
  });

  it("suppresses immediate duplicate voice lines", () => {
    assert.equal(shouldPlayVoiceLineForTest("npc:line", 1000), true);
    assert.equal(shouldPlayVoiceLineForTest("npc:line", 1500), false);
    assert.equal(shouldPlayVoiceLineForTest("npc:other", 1500), true);
  });

  it("allows the same line after the repeat window expires", () => {
    assert.equal(shouldPlayVoiceLineForTest("npc:line", 1000), true);
    assert.equal(
      shouldPlayVoiceLineForTest(
        "npc:line",
        1000 + RECENT_VOICE_LINE_TTL_MS_FOR_TEST + 1
      ),
      true
    );
  });

  it("deduplicates the same spoken line even when the dialog playback id changes", () => {
    const keyFromFirstRender = voiceLineSuppressionKeyForTest({
      text: "  Same line,   same voice. ",
      voice: "azure-speech|voice=en-US-BrandonNeural",
      language: "en-US",
    });
    const keyFromSecondRender = voiceLineSuppressionKeyForTest({
      text: "Same line, same voice.",
      voice: "azure-speech|voice=en-US-BrandonNeural",
      language: "en-US",
    });

    assert.equal(keyFromFirstRender, keyFromSecondRender);
    assert.equal(shouldPlayVoiceLineForTest(keyFromFirstRender, 1000), true);
    assert.equal(shouldPlayVoiceLineForTest(keyFromSecondRender, 3000), false);
  });

  it("does not suppress the same words when voice or language changes", () => {
    const avaEnglish = voiceLineSuppressionKeyForTest({
      text: "Meet me by the board.",
      voice: "azure-speech|voice=en-US-AvaNeural",
      language: "en-US",
    });
    const avaFrench = voiceLineSuppressionKeyForTest({
      text: "Meet me by the board.",
      voice: "azure-speech|voice=en-US-AvaNeural",
      language: "fr-FR",
    });
    const brianEnglish = voiceLineSuppressionKeyForTest({
      text: "Meet me by the board.",
      voice: "azure-speech|voice=en-US-BrianNeural",
      language: "en-US",
    });

    assert.equal(shouldPlayVoiceLineForTest(avaEnglish, 1000), true);
    assert.equal(shouldPlayVoiceLineForTest(avaFrench, 1500), true);
    assert.equal(shouldPlayVoiceLineForTest(brianEnglish, 2000), true);
  });

  it("does not suppress a line after the player switches voice providers", () => {
    const elevenLabs = voiceLineSuppressionKeyForTest({
      text: "Meet me by the board.",
      voice: "azure-speech|voice=en-US-AvaNeural",
      provider: "elevenlabs",
    });
    const openAI = voiceLineSuppressionKeyForTest({
      text: "Meet me by the board.",
      voice: "azure-speech|voice=en-US-AvaNeural",
      provider: "openai",
    });
    assert.notEqual(elevenLabs, openAI);
    assert.equal(shouldPlayVoiceLineForTest(elevenLabs, 1000), true);
    assert.equal(shouldPlayVoiceLineForTest(openAI, 1500), true);
  });

  it("expires old voice-line entries while checking new lines", () => {
    assert.equal(shouldPlayVoiceLineForTest("old-line", 1000), true);
    assert.equal(
      shouldPlayVoiceLineForTest(
        "new-line",
        1000 + RECENT_VOICE_LINE_TTL_MS_FOR_TEST + 1
      ),
      true
    );
    assert.equal(
      shouldPlayVoiceLineForTest(
        "old-line",
        1000 + RECENT_VOICE_LINE_TTL_MS_FOR_TEST + 2
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

    clearVoiceChatAudioElementForTest(audio);

    assert.deepEqual(calls, ["pause", "remove:src", "load"]);
  });

  it("does not request NPC speech audio when the player turns NPC speech off", () => {
    assert.equal(
      shouldRequestVoiceChatAudioForTest({
        npcSpeechEnabled: true,
        text: "Hello",
        voice: "azure-speech|voice=en-US-AvaNeural",
      }),
      true
    );
    assert.equal(
      shouldRequestVoiceChatAudioForTest({
        npcSpeechEnabled: false,
        text: "Hello",
        voice: "azure-speech|voice=en-US-AvaNeural",
      }),
      false
    );
    assert.equal(
      shouldRequestVoiceChatAudioForTest({
        npcSpeechEnabled: true,
        text: "",
        voice: "azure-speech|voice=en-US-AvaNeural",
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

    assert.equal(shouldApplyVoiceChatAudioResultForTest(base), true);
    assert.equal(
      shouldApplyVoiceChatAudioResultForTest({
        ...base,
        cancelled: true,
      }),
      false
    );
    assert.equal(
      shouldApplyVoiceChatAudioResultForTest({
        ...base,
        audioStillMounted: false,
      }),
      false
    );
    assert.equal(
      shouldApplyVoiceChatAudioResultForTest({
        ...base,
        latestText: "Another line.",
      }),
      false
    );
    assert.equal(
      shouldApplyVoiceChatAudioResultForTest({
        ...base,
        latestRequestKey: "",
      }),
      false
    );
  });
});
