#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

require("ts-node/register");
require("tsconfig-paths/register");

const {
  HARTHMERE_NPC_VOICE_CATALOG_V1,
  HARTHMERE_NPC_VOICE_CATALOG_VERSION_V1,
} = require("../../src/shared/harthmere/npc_voice_catalog_v1");
const {
  synthesizeAzureSpeechV1,
  azureSpeechConfigFromEnvV1,
} = require("../../src/server/shared/azure_speech");

const root = path.resolve(__dirname, "../..");
const publicRoot = path.join(root, "public");
const manifestPath = path.join(
  publicRoot,
  "harthmere/voices/generated/v1/manifest.json"
);

const args = new Set(process.argv.slice(2));
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const actorArg = process.argv.find((arg) => arg.startsWith("--actor="));
const dryRun = args.has("--dry-run");
const force = args.has("--force");
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const actorFilter = actorArg ? actorArg.split("=")[1] : undefined;

function usage() {
  console.log(`Usage:
  node scripts/harthmere/generate-harthmere-npc-voice-recordings-v1.cjs --dry-run
  AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=eastus2 node scripts/harthmere/generate-harthmere-npc-voice-recordings-v1.cjs --limit=25

Options:
  --dry-run        Print the planned recordings without calling Azure Speech.
  --limit=N        Stop after N recordings.
  --actor=ID       Generate only one catalog actor id.
  --force          Replace existing mp3 files.
`);
}

if (args.has("--help") || args.has("-h")) {
  usage();
  process.exit(0);
}

function plannedRecordings() {
  const rows = [];
  for (const entry of HARTHMERE_NPC_VOICE_CATALOG_V1) {
    if (
      actorFilter &&
      entry.id !== actorFilter &&
      entry.profile.actorKey !== actorFilter
    ) {
      continue;
    }
    for (const line of entry.staticLines) {
      rows.push({ entry, line });
    }
  }
  return rows.slice(0, limit);
}

async function main() {
  const rows = plannedRecordings();
  console.log(
    `Harthmere Azure voice recordings ${HARTHMERE_NPC_VOICE_CATALOG_VERSION_V1}: ${rows.length} planned`
  );

  if (dryRun) {
    for (const row of rows.slice(0, 20)) {
      console.log(
        `${row.entry.id} ${row.entry.profile.azureVoiceName} -> ${row.line.recordingPath}`
      );
    }
    if (rows.length > 20) {
      console.log(`... ${rows.length - 20} more`);
    }
    return;
  }

  const config = azureSpeechConfigFromEnvV1();
  if (!config) {
    console.error(
      "Missing Azure Speech config. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION."
    );
    process.exit(1);
  }

  const manifest = {
    version: HARTHMERE_NPC_VOICE_CATALOG_VERSION_V1,
    generatedAt: new Date().toISOString(),
    provider: "azure-speech",
    recordings: [],
  };

  let written = 0;
  let skipped = 0;
  for (const row of rows) {
    const outPath = path.join(publicRoot, row.line.recordingPath);
    if (!force && fs.existsSync(outPath)) {
      skipped += 1;
      manifest.recordings.push({
        actorKey: row.entry.profile.actorKey,
        actorId: row.entry.id,
        lineId: row.line.lineId,
        path: row.line.recordingPath,
        skippedExisting: true,
      });
      continue;
    }
    const audio = await synthesizeAzureSpeechV1({
      config,
      text: row.line.text,
      voice: row.entry.profile.voiceParameterId,
      language: "en-US",
    });
    if (!audio) {
      skipped += 1;
      continue;
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, audio.audio);
    written += 1;
    manifest.recordings.push({
      actorKey: row.entry.profile.actorKey,
      actorId: row.entry.id,
      lineId: row.line.lineId,
      path: row.line.recordingPath,
      voice: row.entry.profile.voiceParameterId,
    });
    console.log(`WROTE ${row.line.recordingPath}`);
  }

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Done. written=${written} skipped=${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
