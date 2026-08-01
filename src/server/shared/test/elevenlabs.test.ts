import {
  ELEVENLABS_DEFAULT_MODEL_ID,
  ELEVENLABS_DEFAULT_OUTPUT_FORMAT,
  clearElevenLabsVoiceCacheForTest,
  elevenLabsDeliveryTextForTest,
  elevenLabsKnownVoiceGenderForTest,
  elevenLabsNaturalVoiceSettingsForTest,
  elevenLabsConfigFromEnv,
  elevenLabsSpokenTextForTest,
  elevenLabsSynthesisCacheIdentity,
  listElevenLabsVoices,
  pinnedElevenLabsVoiceIdForActor,
  selectElevenLabsVoiceForActor,
  synthesizeElevenLabsSpeech,
  type ElevenLabsConfig,
} from "@/server/shared/elevenlabs";
import { buildHarthmereAzureVoiceParameterId } from "@/shared/harthmere/npc_voice_profiles";
import assert from "assert";

describe("ElevenLabs NPC speech", () => {
  beforeEach(() => {
    clearElevenLabsVoiceCacheForTest();
  });

  it("requires a server-side API key and uses natural quality defaults", () => {
    assert.equal(elevenLabsConfigFromEnv({}), undefined);
    assert.deepEqual(
      elevenLabsConfigFromEnv({ ELEVENLABS_API_KEY: "test-key" }),
      {
        apiKey: "test-key",
        apiBaseUrl: "https://api.elevenlabs.io",
        modelId: ELEVENLABS_DEFAULT_MODEL_ID,
        outputFormat: ELEVENLABS_DEFAULT_OUTPUT_FORMAT,
        voiceIds: [],
        femaleVoiceIds: [],
        maleVoiceIds: [],
        neutralVoiceIds: [],
      }
    );
  });

  it("parses configurable voice pools without duplicate IDs", () => {
    const config = elevenLabsConfigFromEnv({
      XI_API_KEY: "test-key",
      ELEVENLABS_VOICE_IDS: "general-a, general-b general-a",
      ELEVENLABS_FEMALE_VOICE_IDS: "female-a,female-b",
      ELEVENLABS_MALE_VOICE_IDS: "male-a",
      ELEVENLABS_NEUTRAL_VOICE_IDS: "neutral-a",
      ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
    });
    assert.deepEqual(config?.voiceIds, ["general-a", "general-b"]);
    assert.deepEqual(config?.femaleVoiceIds, ["female-a", "female-b"]);
    assert.deepEqual(config?.maleVoiceIds, ["male-a"]);
    assert.deepEqual(config?.neutralVoiceIds, ["neutral-a"]);
    assert.equal(config?.modelId, "eleven_flash_v2_5");
  });

  it("selects a stable, gender-matched high-quality voice for each NPC", () => {
    const voiceProfileId = buildHarthmereAzureVoiceParameterId({
      voiceName: "en-US-LunaNeural",
      gender: "female",
      actorKind: "humanoid",
      rate: "-3%",
      pitch: "+1%",
      actorKey: "npc:rosalyn",
    });
    const voices = [
      {
        voice_id: "male",
        name: "Male",
        labels: { gender: "male" },
        category: "professional",
      },
      {
        voice_id: "female-premade",
        name: "Female Premade",
        labels: { gender: "female" },
        category: "premade",
      },
      {
        voice_id: "female-studio",
        name: "Female Studio",
        labels: { gender: "female" },
        category: "professional",
        recording_quality: "studio" as const,
        high_quality_base_model_ids: [ELEVENLABS_DEFAULT_MODEL_ID],
      },
    ];
    const first = selectElevenLabsVoiceForActor({ voices, voiceProfileId });
    const second = selectElevenLabsVoiceForActor({ voices, voiceProfileId });
    assert.equal(first?.voice_id, "female-studio");
    assert.equal(second?.voice_id, first?.voice_id);
  });

  it("keeps the restricted-key fallback cast labeled by sex", () => {
    assert.equal(
      elevenLabsKnownVoiceGenderForTest("EXAVITQu4vr4xnSDxMaL"),
      "female"
    );
    assert.equal(
      elevenLabsKnownVoiceGenderForTest("ErXwobaYiN019PkySvjV"),
      "male"
    );
    assert.equal(elevenLabsKnownVoiceGenderForTest("unknown"), undefined);
  });

  it("uses an age-matched reviewed voice for authored child roles", () => {
    const voiceProfileId = buildHarthmereAzureVoiceParameterId({
      voiceName: "en-US-LunaNeural",
      gender: "female",
      actorKind: "humanoid",
      deliveryStyle: "child",
      rate: "+0%",
      pitch: "+0%",
      actorKey: "npc:choir-child",
    });
    const voice = selectElevenLabsVoiceForActor({
      voices: [
        {
          voice_id: "adult-female",
          name: "Rachel",
          labels: { gender: "female" },
          category: "premade",
        },
        {
          voice_id: "child-female",
          name: "Elli",
          labels: { gender: "female" },
          category: "premade",
        },
      ],
      voiceProfileId,
    });
    assert.equal(voice?.voice_id, "child-female");
  });

  it("pins aliased NPC identities to one reviewed ElevenLabs voice", () => {
    const groveJackie = buildHarthmereAzureVoiceParameterId({
      voiceName: "en-US-LunaNeural",
      gender: "female",
      actorKind: "humanoid",
      rate: "+0%",
      pitch: "+0%",
      actorKey: "snapshot_grove:jackie:8810000000019301:jackie:jackie",
    });
    const legacyJackie = buildHarthmereAzureVoiceParameterId({
      voiceName: "en-US-AriaNeural",
      gender: "female",
      actorKind: "humanoid",
      rate: "+2%",
      pitch: "-1%",
      actorKey: "runtime_entity:8997551883502307:jackie",
    });
    assert.equal(
      pinnedElevenLabsVoiceIdForActor(groveJackie),
      "AZnzlk1XvdvUeBnXmlld"
    );
    assert.equal(
      pinnedElevenLabsVoiceIdForActor(legacyJackie),
      "AZnzlk1XvdvUeBnXmlld"
    );
    assert.equal(
      selectElevenLabsVoiceForActor({
        voices: [],
        voiceProfileId: groveJackie,
      })?.voice_id,
      "AZnzlk1XvdvUeBnXmlld"
    );
    assert.equal(
      selectElevenLabsVoiceForActor({
        voices: [],
        voiceProfileId: legacyJackie,
      })?.voice_id,
      "AZnzlk1XvdvUeBnXmlld"
    );
  });

  it("prepares written dialogue for natural spoken pacing", () => {
    assert.equal(
      elevenLabsSpokenTextForTest(
        "<text>Hello there!!!\n\nI checked the road... Everything looks good. One more thing: take a lantern.</text>"
      ),
      "Hello there!\n\nI checked the road... Everything looks good.\n\nOne more thing: take a lantern."
    );
    assert.equal(
      elevenLabsSpokenTextForTest("<text>[listens closely...]</text>"),
      ""
    );
    assert.equal(
      elevenLabsSpokenTextForTest(
        "<text>Salt &amp; iron{break}That's what we'll need.</text>"
      ),
      "Salt & iron\n\nThat's what we'll need."
    );
  });

  it("uses conservative human voice settings near normal speed", () => {
    assert.deepEqual(
      elevenLabsNaturalVoiceSettingsForTest({
        actorKind: "humanoid",
        deliveryStyle: "country",
        rate: "+3%",
      }),
      {
        stability: 0.5,
        similarity_boost: 0.82,
        style: 0,
        use_speaker_boost: true,
        speed: 0.98,
      }
    );
    assert.deepEqual(
      elevenLabsNaturalVoiceSettingsForTest({
        actorKind: "humanoid",
        rate: "-3%",
      }),
      {
        stability: 0.55,
        similarity_boost: 0.82,
        style: 0,
        use_speaker_boost: true,
        speed: 1.01,
      }
    );
    assert.deepEqual(
      elevenLabsNaturalVoiceSettingsForTest({
        actorKind: "robot",
        rate: "+20%",
      }),
      {
        stability: 0.63,
        similarity_boost: 0.82,
        style: 0,
        use_speaker_boost: true,
        speed: 1.05,
      }
    );
  });

  it("gives country actors a natural drawl without changing robot delivery", () => {
    assert.equal(
      elevenLabsDeliveryTextForTest({
        text: "Muck Busters oughta do the trick.",
        actorKind: "humanoid",
        deliveryStyle: "country",
        modelId: "eleven_v3",
      }),
      "[warm country drawl, relaxed, natural conversation]\n" +
        "Muck Busters oughta do the trick."
    );
    assert.equal(
      elevenLabsDeliveryTextForTest({
        text: "SYSTEM READY.",
        actorKind: "robot",
        deliveryStyle: "country",
        modelId: "eleven_v3",
      }),
      "[robotic, precise, lightly degraded transmission]\nSYSTEM READY."
    );
  });

  it("versions cached audio without including the secret API key", () => {
    const identity = elevenLabsSynthesisCacheIdentity(testConfig());
    assert.ok(identity.includes(ELEVENLABS_DEFAULT_MODEL_ID));
    assert.ok(identity.includes(ELEVENLABS_DEFAULT_OUTPUT_FORMAT));
    assert.ok(!identity.includes("test-key"));
  });

  it("paginates the current ElevenLabs voice search endpoint", async () => {
    const requestedUrls: string[] = [];
    const fetchImpl = (async (url: string) => {
      requestedUrls.push(url);
      const parsed = new URL(url);
      const next = parsed.searchParams.get("next_page_token");
      return new Response(
        JSON.stringify(
          next
            ? {
                voices: [{ voice_id: "voice-b" }],
                has_more: false,
                next_page_token: null,
              }
            : {
                voices: [{ voice_id: "voice-a" }],
                has_more: true,
                next_page_token: "page-2",
              }
        ),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;
    const voices = await listElevenLabsVoices({
      config: testConfig(),
      fetchImpl,
    });
    assert.deepEqual(
      voices?.map((voice) => voice.voice_id),
      ["voice-a", "voice-b"]
    );
    assert.equal(requestedUrls.length, 2);
    assert.equal(
      new URL(requestedUrls[1]).searchParams.get("next_page_token"),
      "page-2"
    );
  });

  it("sends TTS only from the server with the selected voice and delivery settings", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(Uint8Array.from([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      });
    }) as typeof fetch;
    const config: ElevenLabsConfig = {
      ...testConfig(),
      femaleVoiceIds: ["natural-female-voice"],
    };
    const result = await synthesizeElevenLabsSpeech({
      config,
      fetchImpl,
      text: "<text>Hello from Harthmere.</text>",
      language: "en-US",
      voiceProfileId: buildHarthmereAzureVoiceParameterId({
        voiceName: "en-US-LunaNeural",
        gender: "female",
        actorKind: "humanoid",
        rate: "-3%",
        pitch: "+1%",
        actorKey: "npc:rosalyn",
      }),
    });

    assert.equal(calls.length, 1);
    assert.equal(
      new URL(calls[0].url).pathname,
      "/v1/text-to-speech/natural-female-voice"
    );
    assert.equal(
      new URL(calls[0].url).searchParams.get("output_format"),
      ELEVENLABS_DEFAULT_OUTPUT_FORMAT
    );
    assert.equal(
      (calls[0].init?.headers as Record<string, string>)["xi-api-key"],
      "test-key"
    );
    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.text, "Hello from Harthmere.");
    assert.equal(body.model_id, ELEVENLABS_DEFAULT_MODEL_ID);
    assert.equal(body.language_code, "en");
    assert.equal(body.apply_text_normalization, "on");
    assert.equal(body.voice_settings.stability, 0.55);
    assert.equal(body.voice_settings.similarity_boost, 0.82);
    assert.equal(body.voice_settings.style, 0);
    assert.equal(body.voice_settings.use_speaker_boost, true);
    assert.equal(body.voice_settings.speed, 1.01);
    assert.deepEqual([...result!.audio], [1, 2, 3]);
    assert.equal(result?.contentType, "audio/mpeg");
    assert.equal(result?.voiceId, "natural-female-voice");
  });

  it("caches denied voice discovery and keeps synthesizing with fallback voices", async () => {
    let discoveryCalls = 0;
    let synthesisCalls = 0;
    const fetchImpl = (async (url: string) => {
      if (url.includes("/v2/voices")) {
        discoveryCalls += 1;
        return new Response(
          JSON.stringify({
            detail: {
              message: "missing the permission voices_read",
            },
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }
      synthesisCalls += 1;
      return new Response(Uint8Array.from([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      });
    }) as typeof fetch;
    const input = {
      config: testConfig(),
      fetchImpl,
      text: "Fallback voice test.",
      voiceProfileId: buildHarthmereAzureVoiceParameterId({
        voiceName: "en-US-LunaNeural",
        gender: "female" as const,
        actorKind: "humanoid" as const,
        rate: "+0%",
        pitch: "+0%",
        actorKey: "npc:fallback",
      }),
    };

    assert.ok(await synthesizeElevenLabsSpeech(input));
    assert.ok(await synthesizeElevenLabsSpeech(input));
    assert.equal(discoveryCalls, 1);
    assert.equal(synthesisCalls, 2);
  });
});

function testConfig(): ElevenLabsConfig {
  return {
    apiKey: "test-key",
    apiBaseUrl: "https://api.elevenlabs.test",
    modelId: ELEVENLABS_DEFAULT_MODEL_ID,
    outputFormat: ELEVENLABS_DEFAULT_OUTPUT_FORMAT,
    voiceIds: [],
    femaleVoiceIds: [],
    maleVoiceIds: [],
    neutralVoiceIds: [],
  };
}
