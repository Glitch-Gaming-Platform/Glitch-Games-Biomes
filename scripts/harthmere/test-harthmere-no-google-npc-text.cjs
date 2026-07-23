#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${msg}`);
  }
}

console.log("== Harthmere no-Google NPC text fallback current ==");

const generatedChat = read("src/pages/api/npcs/generated_chat.ts");
const talkDialog = read(
  "src/client/components/challenges/TalkToNPCDefaultDialog.tsx"
);
const voiceRoute = read("src/pages/api/voices/text_to_speech.ts");
const speechRoute = read("src/pages/api/voices/speech_to_text.ts");
const speechStatusRoute = read("src/pages/api/voices/speech_status.ts");
const speechButton = read(
  "src/client/components/system/NpcSpeechInputButton.tsx"
);
const voiceClient = read("src/client/components/system/VoiceChat.tsx");
const voiceCache = read("src/server/shared/npc_voice_audio_cache.ts");
const voiceGenerator = read(
  "scripts/harthmere/generate-harthmere-npc-voice-recordings.cjs"
);
const deploy = read("scripts/glitch/deploy-production-local-redis-smoke.sh");

ok(
  generatedChat.includes("deterministicGeneratedChatFallback"),
  "generated chat route has a deterministic local fallback"
);
ok(
  generatedChat.includes("snapshotLiveNpcLoreForDialog"),
  "generated chat fallback uses the same snapshot live NPC lore as local"
);
ok(
  generatedChat.includes("harthmereFallbackNpcDialogText") &&
    generatedChat.includes("harthmereFallbackNpcOptions"),
  "generated chat fallback uses shared Harthmere text and options"
);
ok(
  generatedChat.indexOf("const [entity, user] = await worldApi.get") <
    generatedChat.indexOf("const azureConfig = azureOpenAIConfigFromEnv()"),
  "generated chat loads entity context before checking optional Azure OpenAI config"
);
ok(
  !generatedChat.includes(
    'okOrAPIError(key, "killswitched", "OpenAI API key not found!")'
  ),
  "missing OpenAI key no longer returns a production 503"
);
ok(
  !generatedChat.includes("OpenAIApi") &&
    !generatedChat.includes("gpt-3.5-turbo") &&
    !generatedChat.includes("openai-api-key"),
  "generated chat uses Azure OpenAI env config instead of legacy OpenAI SDK secrets"
);
ok(
  talkDialog.includes("matchedAction?.followUpText ?? fallbackDialogText"),
  "client dialog falls back to useful text if generated chat fails"
);
ok(
  !talkDialog.includes(`setCurrentDialog("That's all folks!")`),
  "client dialog does not collapse failed generated chat to the old dead-end text"
);
ok(
  voiceRoute.includes("azureSpeechConfigFromEnv") &&
    voiceRoute.includes("elevenLabsConfigFromEnv") &&
    voiceRoute.includes("synthesizeAzureSpeech") &&
    voiceRoute.includes("synthesizeElevenLabsSpeech") &&
    voiceRoute.includes('return { url: "" };'),
  "voice route uses configured server-side providers and returns silent success when speech is unavailable"
);
ok(
  voiceClient.includes("if (!res.url)") && voiceClient.includes("return;"),
  "voice client treats empty audio URLs as text-only dialogue"
);
ok(
  voiceRoute.includes("resolveNpcVoiceAudioUrl") &&
    voiceRoute.includes("npcVoiceAudioCacheKey") &&
    voiceCache.includes("runtimeGenerations") &&
    voiceCache.includes("generated/current/manifest.json"),
  "voice route reuses committed and runtime audio while collapsing duplicate provider calls"
);
ok(
  voiceGenerator.includes('provider === "elevenlabs"') &&
    voiceGenerator.includes("NPC_VOICE_AUDIO_CACHE_MANIFEST_VERSION") &&
    voiceGenerator.includes("writeManifest"),
  "all-NPC recording generator writes an ElevenLabs-compatible cache manifest"
);
ok(
  speechRoute.includes("azureSpeechConfigFromEnv") &&
    speechRoute.includes("unavailableReason") &&
    speechRoute.includes('text: ""'),
  "speech-to-text route is optional when Azure Speech is absent"
);
ok(
  speechStatusRoute.includes("azureSpeechConfigFromEnv") &&
    speechStatusRoute.includes("azureOpenAIConfigFromEnv") &&
    speechButton.includes("/api/voices/speech_status") &&
    speechButton.includes("return null"),
  "speech button is hidden unless Azure speech and generated chat are configured"
);
ok(
  speechButton.includes("/api/voices/speech_to_text") &&
    speechButton.includes('size="small"') &&
    talkDialog.includes("handleVoiceTranscript") &&
    talkDialog.includes("activeQuestVoiceContextForNpc") &&
    talkDialog.includes("voiceConversationActive"),
  "NPC dialog has a small Azure speech input wired to quest-aware generated responses"
);
ok(
  deploy.includes("test-harthmere-no-google-npc-text.cjs"),
  "production deploy guardrails include no-Google NPC text fallback test"
);

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
