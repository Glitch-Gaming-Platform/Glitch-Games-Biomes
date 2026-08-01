import { resolveChatVoiceRequest } from "@/pages/api/voices/text_to_speech";
import { clearNpcVoiceAudioManifestCacheForTest } from "@/server/shared/npc_voice_audio_cache";
import { harthmereVoiceProfileForActor } from "@/shared/harthmere/npc_voice_profiles";
import { SNAPSHOT_GROVE_JACKIE_ENTITY_ID } from "@/shared/harthmere/snapshot_grove_ids";
import {
  harthmereAdditiveTownNpcDialogueForOffset,
  harthmereAdditiveTownNpcVoiceProfile,
} from "@/shared/harthmere/additive_town_npc_dialogue";
import assert from "assert";

describe("text-to-speech committed audio integration", () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    // A placeholder key is enough for a committed cache hit; the provider must
    // never be contacted by this test.
    process.env.ELEVENLABS_API_KEY = "test-key-not-a-real-secret";
    delete process.env.ELEVEN_LABS_API_KEY;
    delete process.env.XI_API_KEY;
    delete process.env.ELEVENLABS_MODEL_ID;
    delete process.env.ELEVENLABS_OUTPUT_FORMAT;
    delete process.env.ELEVENLABS_VOICE_ID;
    delete process.env.ELEVENLABS_VOICE_IDS;
    delete process.env.ELEVENLABS_FEMALE_VOICE_IDS;
    delete process.env.ELEVENLABS_MALE_VOICE_IDS;
    delete process.env.ELEVENLABS_NEUTRAL_VOICE_IDS;
    clearNpcVoiceAudioManifestCacheForTest();
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
    clearNpcVoiceAudioManifestCacheForTest();
  });

  it("resolves the attached production HAR Jackie line to a shipped MP3", async () => {
    const voice = harthmereVoiceProfileForActor({
      source: "runtime_entity",
      entityId: SNAPSHOT_GROVE_JACKIE_ENTITY_ID,
      displayName: "Jackie",
    }).voiceParameterId;
    const response = await resolveChatVoiceRequest({
      text: "The name is Jackie. I'm glad we found ya before the Muckers did.",
      voice,
      language: "en-US",
      provider: "elevenlabs",
    });

    assert.match(
      response.url,
      /^\/harthmere\/voices\/generated\/current\/native-robot-story\/the-road-ahead-/
    );
    assert.ok(!response.url.includes("/runtime/"));
  });

  it("resolves every additive-town conversation tier to shipped MP3s", async () => {
    const mira = harthmereAdditiveTownNpcDialogueForOffset(1)!;
    const voice = harthmereAdditiveTownNpcVoiceProfile(mira).voiceParameterId;
    for (const [text, lineId] of [
      [mira.intro, "line-01"],
      [mira.story, "line-02"],
      [mira.location, "line-03"],
    ] as const) {
      const response = await resolveChatVoiceRequest({
        text,
        voice,
        language: "en-US",
        provider: "elevenlabs",
      });

      assert.equal(
        response.url,
        `/harthmere/voices/generated/current/harthmere-additive-town-additive-town-1-mira-town-guide/${lineId}.mp3`
      );
      assert.ok(!response.url.includes("/runtime/"));
    }
  });
});
