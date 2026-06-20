import assert from "assert";

import { HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS } from "@/shared/harthmere/business_customer_npc_seed";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS } from "@/shared/harthmere/business_owner_npc_seed";
import { HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS } from "@/shared/harthmere/live_entity_production_seed";
import { HARTHMERE_NAMED_NPCS } from "@/shared/harthmere/npc_compendium";
import { HARTHMERE_REMAINING_NPCS } from "@/shared/harthmere/npc_compendium";
import {
  HARTHMERE_NPC_VOICE_CATALOG,
  HARTHMERE_NPC_VOICE_PROFILE_BY_ACTOR_KEY,
} from "@/shared/harthmere/npc_voice_catalog";
import { harthmereSpeechDeliveryToneForActorForTest } from "@/shared/harthmere/npc_speech_delivery";
import {
  buildHarthmereAzureVoiceParameterId,
  buildAzureSpeechSsml,
  harthmereAzureVoiceIdOrFallback,
  harthmereVoiceProfileForActor,
  parseHarthmereAzureVoiceId,
} from "@/shared/harthmere/npc_voice_profiles";
import { SNAPSHOT_GROVE_NPCS } from "@/shared/harthmere/snapshot_grove_content";
import { SNAPSHOT_LIVE_NPC_LORE } from "@/shared/harthmere/snapshot_live_npc_bible";

describe("Harthmere Azure NPC voice profiles", () => {
  it("builds a profile catalog for authored NPC and living entity sources", () => {
    const expectedMinimum =
      HARTHMERE_NAMED_NPCS.length +
      HARTHMERE_REMAINING_NPCS.length +
      SNAPSHOT_GROVE_NPCS.length +
      SNAPSHOT_LIVE_NPC_LORE.length +
      HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.length +
      HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS.length +
      HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS.length;

    assert.ok(HARTHMERE_NPC_VOICE_CATALOG.length >= expectedMinimum);
    assert.equal(
      HARTHMERE_NPC_VOICE_PROFILE_BY_ACTOR_KEY.size,
      HARTHMERE_NPC_VOICE_CATALOG.length
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

    for (const entry of HARTHMERE_NPC_VOICE_CATALOG) {
      actorKeys.add(entry.profile.actorKey);
      voiceIds.add(entry.profile.voiceParameterId);
      genders.add(entry.profile.inferredGender);
      kinds.add(entry.profile.actorKind);
      const parsed = parseHarthmereAzureVoiceId(
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

    assert.equal(actorKeys.size, HARTHMERE_NPC_VOICE_CATALOG.length);
    assert.equal(voiceIds.size, HARTHMERE_NPC_VOICE_CATALOG.length);
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
    const entriesWithLines = HARTHMERE_NPC_VOICE_CATALOG.filter(
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
    const sergeant = harthmereVoiceProfileForActor({
      source: "test",
      id: "sergeant_bram_holt",
      displayName: "Sergeant Bramwell Holt",
      role: "guard",
      kind: "humanoid",
      background: "Widowed watch sergeant and father of sick Yenna.",
    });
    assert.equal(sergeant.inferredGender, "male");
    assert.equal(sergeant.actorKind, "humanoid");

    const sentinel = harthmereVoiceProfileForActor({
      source: "test",
      id: "robot-sentinel",
      displayName: "Grove Sentinel",
      role: "robot_sentinel",
      kind: "robot_sentinel",
      background: "A robot sentinel protects the Grove.",
    });
    assert.equal(sentinel.inferredGender, "neutral");
    assert.equal(sentinel.actorKind, "robot");

    const explicitlyFemale = harthmereVoiceProfileForActor({
      source: "test",
      id: "female-guard",
      displayName: "Captain Vale",
      sex: "female",
      role: "guard captain",
      kind: "humanoid",
    });
    assert.equal(explicitlyFemale.inferredGender, "female");

    const creature = harthmereVoiceProfileForActor({
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
    const profile = harthmereVoiceProfileForActor({
      source: "test",
      id: "ssml",
      displayName: "Mira & Co",
      role: "designer",
      background: "Says quoted text.",
    });
    const parsed = parseHarthmereAzureVoiceId(profile.voiceParameterId);
    assert.ok(parsed);
    const ssml = buildAzureSpeechSsml({
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
    const voiceId = buildHarthmereAzureVoiceParameterId({
      voiceName: "en-US-LunaNeural",
      style: "conversation",
      styleDegree: "0.95",
      rate: "-3%",
      pitch: "+1%",
      volume: "default",
      sentenceBreakMs: 160,
      actorKey: "test:expressive",
    });
    const parsed = parseHarthmereAzureVoiceId(voiceId);
    assert.ok(parsed);
    const ssml = buildAzureSpeechSsml({
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
    const jackieVoice = parseHarthmereAzureVoiceId(
      buildHarthmereAzureVoiceParameterId({
        voiceName: "en-US-LunaNeural",
        style: "conversation",
        styleDegree: "0.95",
        rate: "-3%",
        pitch: "+1%",
        volume: "default",
        sentenceBreakMs: 150,
        actorKey: "snapshot_grove:jackie:8810000000019301:jackie",
      })
    );
    const docVoice = parseHarthmereAzureVoiceId(
      buildHarthmereAzureVoiceParameterId({
        voiceName: "en-US-DavisNeural",
        style: "chat",
        styleDegree: "0.90",
        rate: "-2%",
        pitch: "+0%",
        volume: "default",
        sentenceBreakMs: 150,
        actorKey: "snapshot_grove:doc:8810000000019309:doc",
      })
    );
    const sentinelVoice = parseHarthmereAzureVoiceId(
      buildHarthmereAzureVoiceParameterId({
        voiceName: "en-US-AlloyTurboMultilingualNeural",
        rate: "-1%",
        pitch: "+0%",
        volume: "default",
        sentenceBreakMs: 120,
        actorKey:
          "live_entity_seed:robot-sentinel-west_muck_breach:8810000000019401:west muck breach sentinel",
      })
    );
    assert.ok(jackieVoice);
    assert.ok(docVoice);
    assert.ok(sentinelVoice);

    const jackieSsml = buildAzureSpeechSsml({
      text: "Talk to me, and I'll mark the next stop.",
      voice: jackieVoice!,
      language: "en-US",
    });
    const docSsml = buildAzureSpeechSsml({
      text: "Heavy muck, more than a few seconds, and your status bar becomes the lesson.",
      voice: docVoice!,
      language: "en-US",
    });
    const sentinelSsml = buildAzureSpeechSsml({
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
      harthmereSpeechDeliveryToneForActorForTest({
        actorKey: "snapshot_grove:jackie:8810000000019301:jackie",
      }),
      "warm_practical"
    );
    assert.equal(
      harthmereSpeechDeliveryToneForActorForTest({
        actorKey: "snapshot_grove:doc:8810000000019309:doc",
      }),
      "clinical_blunt"
    );
    assert.equal(
      harthmereSpeechDeliveryToneForActorForTest({
        text: "My home folded in the night and we got out with each other.",
      }),
      "refugee_weary"
    );
    assert.equal(
      harthmereSpeechDeliveryToneForActorForTest({
        text: "Three blades. Cold steel, no cores. No marks, no ledger.",
      }),
      "shady_clipped"
    );
  });

  it("parses raw Azure short names and full parameter ids", () => {
    assert.deepEqual(parseHarthmereAzureVoiceId("en-US-AvaNeural"), {
      provider: "azure-speech",
      voiceName: "en-US-AvaNeural",
      rate: "+0%",
      pitch: "+0%",
      volume: "default",
      sentenceBreakMs: 120,
    });

    const voiceId = buildHarthmereAzureVoiceParameterId({
      voiceName: "en-US-BrianNeural",
      style: "chat",
      styleDegree: "0.90",
      rate: "-4%",
      pitch: "+2%",
      volume: "soft",
      sentenceBreakMs: 180,
      actorKey: "test:actor",
    });
    assert.deepEqual(parseHarthmereAzureVoiceId(voiceId), {
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

    assert.deepEqual(parseHarthmereAzureVoiceId("en-US-Iris:MAI-Voice-1"), {
      provider: "azure-speech",
      voiceName: "en-US-Iris:MAI-Voice-1",
      rate: "+0%",
      pitch: "+0%",
      volume: "default",
      sentenceBreakMs: 120,
    });

    assert.equal(parseHarthmereAzureVoiceId(""), undefined);
    assert.equal(
      parseHarthmereAzureVoiceId("MF3mGyEYCl7XYWbV9"),
      undefined
    );
  });

  it("falls back to Azure when legacy non-Azure voice ids are encountered", () => {
    const fallback = "azure-speech|voice=en-US-AvaNeural|actor=fallback";
    assert.equal(
      harthmereAzureVoiceIdOrFallback({
        voiceId: "MF3mGyEYCl7XYWbV9",
        fallbackVoiceId: fallback,
      }),
      fallback
    );
    assert.equal(
      harthmereAzureVoiceIdOrFallback({
        voiceId:
          "azure-speech|voice=en-US-BrandonNeural|rate=-5%25|pitch=-5%25",
        fallbackVoiceId: fallback,
      }),
      "azure-speech|voice=en-US-BrandonNeural|rate=-5%25|pitch=-5%25"
    );
  });
});
