import assert from "assert";

import { HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1 } from "@/shared/harthmere/business_customer_npc_seed_v1";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1 } from "@/shared/harthmere/business_owner_npc_seed_v1";
import { HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS_V1 } from "@/shared/harthmere/live_entity_production_seed_v1";
import { HARTHMERE_NAMED_NPCS_V44 } from "@/shared/harthmere/npc_compendium_v44";
import { HARTHMERE_REMAINING_NPCS_V45 } from "@/shared/harthmere/npc_compendium_v45";
import {
  HARTHMERE_NPC_VOICE_CATALOG_V1,
  HARTHMERE_NPC_VOICE_PROFILE_BY_ACTOR_KEY_V1,
} from "@/shared/harthmere/npc_voice_catalog_v1";
import { harthmereSpeechDeliveryToneForActorForTestV1 } from "@/shared/harthmere/npc_speech_delivery_v1";
import {
  buildHarthmereAzureVoiceParameterIdV1,
  buildAzureSpeechSsmlV1,
  harthmereAzureVoiceIdOrFallbackV1,
  harthmereVoiceProfileForActorV1,
  parseHarthmereAzureVoiceIdV1,
} from "@/shared/harthmere/npc_voice_profiles_v1";
import { SNAPSHOT_GROVE_NPCS_V75 } from "@/shared/harthmere/snapshot_grove_content_v75";
import { SNAPSHOT_LIVE_NPC_LORE_V79 } from "@/shared/harthmere/snapshot_live_npc_bible_v79";

describe("Harthmere Azure NPC voice profiles", () => {
  it("builds a profile catalog for authored NPC and living entity sources", () => {
    const expectedMinimum =
      HARTHMERE_NAMED_NPCS_V44.length +
      HARTHMERE_REMAINING_NPCS_V45.length +
      SNAPSHOT_GROVE_NPCS_V75.length +
      SNAPSHOT_LIVE_NPC_LORE_V79.length +
      HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1.length +
      HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1.length +
      HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS_V1.length;

    assert.ok(HARTHMERE_NPC_VOICE_CATALOG_V1.length >= expectedMinimum);
    assert.equal(
      HARTHMERE_NPC_VOICE_PROFILE_BY_ACTOR_KEY_V1.size,
      HARTHMERE_NPC_VOICE_CATALOG_V1.length
    );
  });

  it("assigns unique Azure voice parameter ids and parseable prosody", () => {
    const actorKeys = new Set<string>();
    const voiceIds = new Set<string>();
    const genders = new Set<string>();
    const kinds = new Set<string>();
    const expressiveHumanoidStyles = new Set<string>();
    const disallowedStyles = new Set([
      "assistant",
      "customerservice",
      "newscast",
      "newscast-casual",
      "newscast-formal",
      "narration-professional",
    ]);

    for (const entry of HARTHMERE_NPC_VOICE_CATALOG_V1) {
      actorKeys.add(entry.profile.actorKey);
      voiceIds.add(entry.profile.voiceParameterId);
      genders.add(entry.profile.inferredGender);
      kinds.add(entry.profile.actorKind);
      const parsed = parseHarthmereAzureVoiceIdV1(
        entry.profile.voiceParameterId
      );
      assert.ok(parsed, `${entry.id} has an unparsable voice id`);
      assert.ok(parsed!.voiceName.includes("Neural"));
      assert.match(parsed!.rate, /^[+-]\d+%$/);
      assert.match(parsed!.pitch, /^[+-]\d+%$/);
      assert.ok(parsed!.sentenceBreakMs >= 50);
      assert.equal(parsed!.style, entry.profile.style);
      assert.equal(parsed!.styleDegree, entry.profile.styleDegree);
      assert.ok(!disallowedStyles.has(parsed!.style ?? ""));
      if (parsed!.styleDegree) {
        const degree = Number(parsed!.styleDegree);
        assert.ok(Number.isFinite(degree));
        assert.ok(degree >= 0.65);
        assert.ok(degree <= 1.1);
      }
      if (entry.profile.actorKind === "humanoid") {
        assert.ok(
          parsed!.style,
          `${entry.id} should use an expressive Azure style`
        );
        expressiveHumanoidStyles.add(parsed!.style!);
        assert.ok(Math.abs(Number(parsed!.rate.replace("%", ""))) <= 5);
        assert.ok(Math.abs(Number(parsed!.pitch.replace("%", ""))) <= 3);
      }
    }

    assert.equal(actorKeys.size, HARTHMERE_NPC_VOICE_CATALOG_V1.length);
    assert.equal(voiceIds.size, HARTHMERE_NPC_VOICE_CATALOG_V1.length);
    assert.ok(genders.has("female"));
    assert.ok(genders.has("male"));
    assert.ok(genders.has("neutral"));
    assert.ok(kinds.has("robot"));
    assert.ok(kinds.has("animal"));
    assert.ok(kinds.has("creature"));
    assert.ok(expressiveHumanoidStyles.has("conversation"));
    assert.ok(expressiveHumanoidStyles.has("chat"));
    assert.ok(expressiveHumanoidStyles.has("friendly"));
    assert.ok(expressiveHumanoidStyles.has("empathetic"));
  });

  it("keeps static recording lines clean for speech synthesis", () => {
    const entriesWithLines = HARTHMERE_NPC_VOICE_CATALOG_V1.filter(
      (entry) => entry.staticLines.length > 0
    );
    assert.ok(entriesWithLines.length > 100);

    for (const entry of entriesWithLines) {
      for (const line of entry.staticLines) {
        assert.ok(line.text.trim().length > 0, `${entry.id} has empty line`);
        assert.ok(!line.text.includes("<"), `${entry.id} line has markup`);
        assert.ok(
          line.recordingPath.endsWith(".mp3"),
          `${entry.id} line does not target mp3`
        );
      }
    }
  });

  it("infers castable voices from name, role, and background", () => {
    const sergeant = harthmereVoiceProfileForActorV1({
      source: "test",
      id: "sergeant_bram_holt",
      displayName: "Sergeant Bramwell Holt",
      role: "guard",
      kind: "humanoid",
      background: "Widowed watch sergeant and father of sick Yenna.",
    });
    assert.equal(sergeant.inferredGender, "male");
    assert.equal(sergeant.actorKind, "humanoid");

    const sentinel = harthmereVoiceProfileForActorV1({
      source: "test",
      id: "robot-sentinel",
      displayName: "Grove Sentinel",
      role: "robot_sentinel",
      kind: "robot_sentinel",
      background: "A robot sentinel protects the Grove.",
    });
    assert.equal(sentinel.inferredGender, "neutral");
    assert.equal(sentinel.actorKind, "robot");

    const explicitlyFemale = harthmereVoiceProfileForActorV1({
      source: "test",
      id: "female-guard",
      displayName: "Captain Vale",
      sex: "female",
      role: "guard captain",
      kind: "humanoid",
    });
    assert.equal(explicitlyFemale.inferredGender, "female");

    const creature = harthmereVoiceProfileForActorV1({
      source: "test",
      id: "muckling",
      displayName: "Muckling Scout",
      role: "creature",
      kind: "mucker",
      background: "A muck creature that should never use a humanoid sex cast.",
    });
    assert.equal(creature.inferredGender, "neutral");
    assert.equal(creature.actorKind, "creature");
  });

  it("builds escaped SSML using the assigned Azure voice", () => {
    const profile = harthmereVoiceProfileForActorV1({
      source: "test",
      id: "ssml",
      displayName: "Mira & Co",
      role: "designer",
      background: "Says quoted text.",
    });
    const parsed = parseHarthmereAzureVoiceIdV1(profile.voiceParameterId);
    assert.ok(parsed);
    const ssml = buildAzureSpeechSsmlV1({
      text: '<text>Mira says "mind the anchor" & smiles.</text>',
      voice: parsed!,
      language: "en-US",
    });
    assert.ok(ssml.includes(profile.azureVoiceName));
    assert.ok(ssml.includes("&quot;mind the anchor&quot;"));
    assert.ok(ssml.includes("&amp; smiles"));
    assert.ok(!ssml.includes("<text>"));
  });

  it("builds expressive SSML for style-capable voices", () => {
    const voiceId = buildHarthmereAzureVoiceParameterIdV1({
      voiceName: "en-US-LunaNeural",
      style: "conversation",
      styleDegree: "0.95",
      rate: "-3%",
      pitch: "+1%",
      volume: "default",
      sentenceBreakMs: 160,
      actorKey: "test:expressive",
    });
    const parsed = parseHarthmereAzureVoiceIdV1(voiceId);
    assert.ok(parsed);
    const ssml = buildAzureSpeechSsmlV1({
      text: "First sentence. Second thought: with a softer pause.",
      voice: parsed!,
      language: "en-US",
    });
    assert.ok(ssml.includes('xmlns:mstts="https://www.w3.org/2001/mstts"'));
    assert.ok(ssml.includes('<mstts:express-as style="conversation"'));
    assert.ok(ssml.includes('styledegree="0.95"'));
    assert.ok(ssml.includes('<break time="170ms"/>Second thought'));
    assert.ok(ssml.includes('<break time="82ms"/>with a softer pause.'));
  });

  it("adds actor-specific human delivery to SSML instead of one flat cadence", () => {
    const jackieVoice = parseHarthmereAzureVoiceIdV1(
      buildHarthmereAzureVoiceParameterIdV1({
        voiceName: "en-US-LunaNeural",
        style: "conversation",
        styleDegree: "0.95",
        rate: "-3%",
        pitch: "+1%",
        volume: "default",
        sentenceBreakMs: 150,
        actorKey: "snapshot_grove_v75:jackie:8810000000019301:jackie",
      })
    );
    const docVoice = parseHarthmereAzureVoiceIdV1(
      buildHarthmereAzureVoiceParameterIdV1({
        voiceName: "en-US-DavisNeural",
        style: "chat",
        styleDegree: "0.90",
        rate: "-2%",
        pitch: "+0%",
        volume: "default",
        sentenceBreakMs: 150,
        actorKey: "snapshot_grove_v75:doc:8810000000019309:doc",
      })
    );
    const sentinelVoice = parseHarthmereAzureVoiceIdV1(
      buildHarthmereAzureVoiceParameterIdV1({
        voiceName: "en-US-AlloyTurboMultilingualNeural",
        rate: "-1%",
        pitch: "+0%",
        volume: "default",
        sentenceBreakMs: 120,
        actorKey:
          "live_entity_seed_v1:robot-sentinel-west_muck_breach:8810000000019401:west muck breach sentinel",
      })
    );
    assert.ok(jackieVoice);
    assert.ok(docVoice);
    assert.ok(sentinelVoice);

    const jackieSsml = buildAzureSpeechSsmlV1({
      text: "Talk to me, and I'll mark the next stop.",
      voice: jackieVoice!,
      language: "en-US",
    });
    const docSsml = buildAzureSpeechSsmlV1({
      text: "Heavy muck, more than a few seconds, and your status bar becomes the lesson.",
      voice: docVoice!,
      language: "en-US",
    });
    const sentinelSsml = buildAzureSpeechSsmlV1({
      text: "Power steady. If my energy drops, bring Stabilized Exotic Matter.",
      voice: sentinelVoice!,
      language: "en-US",
    });

    assert.match(jackieSsml, /<prosody rate="-3%" pitch="\+1%"/);
    assert.match(jackieSsml, /<break time="45ms"\/>/);
    assert.match(docSsml, /<prosody rate="-2%" pitch="-2%"/);
    assert.match(docSsml, /<break time="49ms"\/>/);
    assert.match(sentinelSsml, /<prosody rate="-5%" pitch="-2%"/);
    assert.match(sentinelSsml, /<break time="184ms"\/>/);
  });

  it("maps known NPCs and stressed customer lines to distinct delivery tones", () => {
    assert.equal(
      harthmereSpeechDeliveryToneForActorForTestV1({
        actorKey: "snapshot_grove_v75:jackie:8810000000019301:jackie",
      }),
      "warm_practical"
    );
    assert.equal(
      harthmereSpeechDeliveryToneForActorForTestV1({
        actorKey: "snapshot_grove_v75:doc:8810000000019309:doc",
      }),
      "clinical_blunt"
    );
    assert.equal(
      harthmereSpeechDeliveryToneForActorForTestV1({
        text: "My home folded in the night and we got out with each other.",
      }),
      "refugee_weary"
    );
    assert.equal(
      harthmereSpeechDeliveryToneForActorForTestV1({
        text: "Three blades. Cold steel, no cores. No marks, no ledger.",
      }),
      "shady_clipped"
    );
  });

  it("parses raw Azure short names and full parameter ids", () => {
    assert.deepEqual(parseHarthmereAzureVoiceIdV1("en-US-AvaNeural"), {
      provider: "azure-speech",
      voiceName: "en-US-AvaNeural",
      rate: "+0%",
      pitch: "+0%",
      volume: "default",
      sentenceBreakMs: 120,
    });

    const voiceId = buildHarthmereAzureVoiceParameterIdV1({
      voiceName: "en-US-BrianNeural",
      style: "chat",
      styleDegree: "0.90",
      rate: "-4%",
      pitch: "+2%",
      volume: "soft",
      sentenceBreakMs: 180,
      actorKey: "test:actor",
    });
    assert.deepEqual(parseHarthmereAzureVoiceIdV1(voiceId), {
      provider: "azure-speech",
      voiceName: "en-US-BrianNeural",
      style: "chat",
      styleDegree: "0.90",
      role: undefined,
      rate: "-4%",
      pitch: "+2%",
      volume: "soft",
      sentenceBreakMs: 180,
      actorKey: "test:actor",
    });

    assert.deepEqual(parseHarthmereAzureVoiceIdV1("en-US-Iris:MAI-Voice-1"), {
      provider: "azure-speech",
      voiceName: "en-US-Iris:MAI-Voice-1",
      rate: "+0%",
      pitch: "+0%",
      volume: "default",
      sentenceBreakMs: 120,
    });

    assert.equal(parseHarthmereAzureVoiceIdV1(""), undefined);
    assert.equal(
      parseHarthmereAzureVoiceIdV1("MF3mGyEYCl7XYWbV9V6O"),
      undefined
    );
  });

  it("falls back to Azure when legacy non-Azure voice ids are encountered", () => {
    const fallback = "azure-speech-v1|voice=en-US-AvaNeural|actor=fallback";
    assert.equal(
      harthmereAzureVoiceIdOrFallbackV1({
        voiceId: "MF3mGyEYCl7XYWbV9V6O",
        fallbackVoiceId: fallback,
      }),
      fallback
    );
    assert.equal(
      harthmereAzureVoiceIdOrFallbackV1({
        voiceId:
          "azure-speech-v1|voice=en-US-BrandonNeural|rate=-5%25|pitch=-5%25",
        fallbackVoiceId: fallback,
      }),
      "azure-speech-v1|voice=en-US-BrandonNeural|rate=-5%25|pitch=-5%25"
    );
  });
});
