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

console.log("== Harthmere no-Google NPC text fallback v1 ==");

const generatedChat = read("src/pages/api/npcs/generated_chat.ts");
const talkDialog = read("src/client/components/challenges/TalkToNPCDefaultDialog.tsx");
const voiceRoute = read("src/pages/api/voices/text_to_speech.ts");
const voiceClient = read("src/client/components/system/VoiceChat.tsx");
const deploy = read("scripts/glitch/deploy-production-local-redis-smoke-v1.sh");

ok(
  generatedChat.includes("deterministicGeneratedChatFallbackV1"),
  "generated chat route has a deterministic local fallback"
);
ok(
  generatedChat.includes("snapshotLiveNpcLoreForDialogV79"),
  "generated chat fallback uses the same snapshot live NPC lore as local"
);
ok(
  generatedChat.includes("harthmereFallbackNpcDialogTextV143") &&
    generatedChat.includes("harthmereFallbackNpcOptionsV143"),
  "generated chat fallback uses shared Harthmere text and options"
);
ok(
  generatedChat.indexOf("const [entity, user] = await worldApi.get") <
    generatedChat.indexOf('const key = getSecret("openai-api-key").trim()'),
  "generated chat loads entity context before checking optional OpenAI config"
);
ok(
  !generatedChat.includes('okOrAPIError(key, "killswitched", "OpenAI API key not found!")'),
  "missing OpenAI key no longer returns a production 503"
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
  voiceRoute.includes('return { url: "" };'),
  "voice route returns a silent success when ElevenLabs is intentionally absent"
);
ok(
  voiceClient.includes("if (!res.url)") &&
    voiceClient.includes("return;"),
  "voice client treats empty audio URLs as text-only dialogue"
);
ok(
  deploy.includes("test-harthmere-no-google-npc-text-v1.cjs"),
  "production deploy guardrails include no-Google NPC text fallback test"
);

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS");
