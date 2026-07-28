#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

require("ts-node/register");
require("tsconfig-paths/register");

const root = path.resolve(__dirname, "../..");
// Load the gitignored local secret file when the caller has not already
// supplied deployment environment variables. dotenv never prints the values.
require("dotenv").config({ path: path.join(root, ".env.local") });

const {
  HARTHMERE_NPC_VOICE_CATALOG,
  HARTHMERE_NPC_VOICE_CATALOG_VERSION,
} = require("../../src/shared/harthmere/npc_voice_catalog");
const {
  NATIVE_ROBOT_STORY_QUEST_IDS,
} = require("../../src/shared/harthmere/native_road_ahead_contract");
const {
  harthmereVoiceProfileForActor,
  parseHarthmereAzureVoiceId,
} = require("../../src/shared/harthmere/npc_voice_profiles");
const {
  ch1VoiceActorForSpeaker,
} = require("../../src/shared/harthmere/ch1_voice");
const {
  CH1_OBJECTIVE_DIALOGUE,
  CH1_COMPLETION_DIALOGUE,
} = require("../../src/server/harthmere/ch1_dialogue");
const { iterBackupEntriesFromFile } = require("../../src/server/backup/serde");
const { biscuitToJson } = require("../../src/shared/bikkie/schema/attributes");
const {
  AZURE_SPEECH_SYNTHESIS_POLICY_VERSION,
  synthesizeAzureSpeech,
  azureSpeechConfigFromEnv,
} = require("../../src/server/shared/azure_speech");
const {
  elevenLabsConfigFromEnv,
  elevenLabsSpokenTextForTest,
  elevenLabsSynthesisCacheIdentity,
  synthesizeElevenLabsSpeech,
} = require("../../src/server/shared/elevenlabs");
const {
  NPC_VOICE_AUDIO_CACHE_MANIFEST_VERSION,
  npcVoiceAudioCacheKey,
  npcVoiceTextHash,
} = require("../../src/server/shared/npc_voice_audio_cache");

const publicRoot = path.join(root, "public");
const manifestPath = path.join(
  publicRoot,
  "harthmere/voices/generated/current/manifest.json"
);

const args = new Set(process.argv.slice(2));
const valueArg = (name) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
const dryRun = args.has("--dry-run");
const force = args.has("--force");
const limit = valueArg("limit") ? Number(valueArg("limit")) : Infinity;
const actorFilter = valueArg("actor");
const nativeRobotStoryOnly = args.has("--native-robot-story-only");
const chapter1ObjectiveOnly = args.has("--chapter1-objective-only");
const concurrency = valueArg("concurrency")
  ? Number(valueArg("concurrency"))
  : 4;
const requestedProvider = (valueArg("provider") || "elevenlabs").toLowerCase();
const provider = ["openai", "azure", "azure-speech"].includes(requestedProvider)
  ? "openai"
  : requestedProvider;

function usage() {
  console.log(`Usage:
  node scripts/harthmere/generate-harthmere-npc-voice-recordings.cjs --dry-run
  node scripts/harthmere/generate-harthmere-npc-voice-recordings.cjs --provider=elevenlabs --concurrency=4
  node scripts/harthmere/generate-harthmere-npc-voice-recordings.cjs --provider=openai --limit=25

The script automatically loads server credentials from the gitignored
.env.local file. Explicit environment variables take precedence.

Options:
  --dry-run          Print the planned recordings without calling a provider.
  --provider=NAME    elevenlabs (default) or openai (Azure Speech).
  --concurrency=N    Maximum simultaneous synthesis calls (default: 4).
  --limit=N          Stop after N catalog lines.
  --actor=ID         Generate only one catalog actor id or actor key.
  --native-robot-story-only
                     Generate only Road Ahead through Muck vs. Machine.
  --chapter1-objective-only
                     Generate only voiced Chapter 1 objective dialogue.
  --force            Replace recordings for the current synthesis policy.
`);
}

if (args.has("--help") || args.has("-h")) {
  usage();
  process.exit(0);
}
if (!["elevenlabs", "openai"].includes(provider)) {
  console.error(`Unsupported provider: ${requestedProvider}`);
  usage();
  process.exit(1);
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12) {
  console.error("--concurrency must be an integer from 1 through 12.");
  process.exit(1);
}
if (!(limit > 0)) {
  console.error("--limit must be a positive number.");
  process.exit(1);
}

function slugForVoicePath(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function decodeBikkiePairs(value) {
  // Trigger data is serialized as nested [key, value] pairs. Convert only
  // those pair lists while preserving ordinary arrays such as reward choices.
  if (Array.isArray(value)) {
    if (
      value.every(
        (entry) =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === "string"
      )
    ) {
      return Object.fromEntries(
        value.map(([key, child]) => [key, decodeBikkiePairs(child)])
      );
    }
    return value.map(decodeBikkiePairs);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        decodeBikkiePairs(child),
      ])
    );
  }
  return value;
}

function challengeClaimRewardSteps(value, output = []) {
  if (!value || typeof value !== "object") {
    return output;
  }
  if (
    !Array.isArray(value) &&
    value.kind === "challengeClaimRewards" &&
    String(value.description || "").trim()
  ) {
    output.push(value);
  }
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    challengeClaimRewardSteps(child, output);
  }
  return output;
}

function spokenQuestSegment(text) {
  // Match the live challenge UI: bold markers are visual only and <text>
  // blocks are stage/sound directions intentionally omitted from NPC speech.
  return String(text)
    .replace(/\*\*/g, "")
    .replace(/<text>.*?<\/text>/gi, "")
    .trim();
}

async function nativeRobotStoryRecordings() {
  const snapshotPath = path.join(root, "snapshot_backup.json");
  if (!fs.existsSync(snapshotPath)) {
    console.warn(
      "snapshot_backup.json is absent; skipping native robot-story dialogue."
    );
    return [];
  }

  const questIds = new Set(NATIVE_ROBOT_STORY_QUEST_IDS.map(Number));
  const questSteps = [];
  const targetEntityIds = new Set();
  const targetEntities = new Map();
  for await (const [version, entry] of iterBackupEntriesFromFile(
    snapshotPath
  )) {
    if (version === "bikkie") {
      for (const biscuit of entry.baked.contents.values()) {
        if (!questIds.has(Number(biscuit.id))) {
          continue;
        }
        const quest = decodeBikkiePairs(biscuitToJson(biscuit));
        for (const step of challengeClaimRewardSteps(quest.trigger)) {
          const targetEntityId = Number(step.returnNpcTypeId);
          targetEntityIds.add(targetEntityId);
          questSteps.push({
            questId: Number(biscuit.id),
            questName: String(quest.displayName || quest.name || biscuit.id),
            stepId: Number(step.id),
            targetEntityId,
            description: String(step.description),
          });
        }
      }
    } else if (targetEntityIds.has(Number(entry.id))) {
      targetEntities.set(Number(entry.id), entry);
    }
  }

  const rows = [];
  for (const step of questSteps) {
    const entity = targetEntities.get(step.targetEntityId);
    if (!entity?.label?.text) {
      throw new Error(
        `Native robot-story voice target ${step.targetEntityId} is missing from snapshot_backup.json`
      );
    }
    const profile = harthmereVoiceProfileForActor({
      source: "runtime_entity",
      entityId: step.targetEntityId,
      displayName: entity.label.text,
      background: entity.entity_description?.text,
    });
    // Mirror TalkDialogModalStep: only a parseable provider-neutral descriptor
    // overrides the fallback. Legacy raw provider IDs use this stable profile.
    const selectedVoice = parseHarthmereAzureVoiceId(entity.voice?.voice)
      ? entity.voice.voice
      : profile.voiceParameterId;
    const entry = {
      source: "native_robot_story",
      id: `native-robot-story:${step.questId}:${step.targetEntityId}`,
      displayName: entity.label.text,
      profile: { ...profile, voiceParameterId: selectedVoice },
    };
    const questSlug = slugForVoicePath(`${step.questName}-${step.questId}`);
    for (const [segmentIndex, rawSegment] of step.description
      .split("{break}")
      .entries()) {
      const text = spokenQuestSegment(rawSegment);
      // Player names are substituted at runtime and therefore cannot share one
      // committed content hash. Other segments from the same step remain static.
      if (!text || text.includes("{username}")) {
        continue;
      }
      const lineId = `${step.stepId}-${String(segmentIndex + 1).padStart(
        2,
        "0"
      )}`;
      rows.push({
        entry,
        language: "en-US",
        line: {
          lineId,
          text,
          recordingPath: `harthmere/voices/generated/current/native-robot-story/${questSlug}/${step.targetEntityId}/${lineId}.mp3`,
        },
      });
    }
  }
  return rows;
}

function chapter1ObjectiveRecordings() {
  const sequences = [
    ...Object.values(CH1_OBJECTIVE_DIALOGUE),
    ...Object.values(CH1_COMPLETION_DIALOGUE).flatMap((byChoice) =>
      Object.values(byChoice)
    ),
  ];
  const linesByActor = new Map();
  for (const sequence of sequences) {
    for (const page of sequence.pages) {
      const actor = ch1VoiceActorForSpeaker(page.speaker);
      if (!actor) continue;
      const current = linesByActor.get(actor.profile.actorKey) ?? {
        actor,
        lines: [],
        seen: new Set(),
      };
      const text = String(page.text || "").trim();
      if (text && !current.seen.has(text)) {
        current.seen.add(text);
        current.lines.push(text);
      }
      linesByActor.set(actor.profile.actorKey, current);
    }
  }

  return [...linesByActor.values()].flatMap(({ actor, lines }) => {
    const actorSlug = slugForVoicePath(
      `chapter-1-identity-objective-${actor.id}-${actor.displayName}`
    );
    const entry = {
      source: "chapter_1_identity_objective",
      id: `chapter1-objective:${actor.id}`,
      displayName: actor.displayName,
      profile: actor.profile,
    };
    return lines.map((text, index) => {
      const lineId = `line-${String(index + 1).padStart(2, "0")}`;
      return {
        entry,
        language: "en-US",
        line: {
          lineId,
          text,
          recordingPath: `harthmere/voices/generated/current/${actorSlug}/${lineId}.mp3`,
        },
      };
    });
  });
}

async function plannedRecordings() {
  const rows = [];
  if (!nativeRobotStoryOnly && !chapter1ObjectiveOnly) {
    for (const entry of HARTHMERE_NPC_VOICE_CATALOG) {
      for (const line of entry.staticLines) {
        rows.push({ entry, line, language: "en-US" });
      }
    }
  }
  if (!nativeRobotStoryOnly) {
    rows.push(...chapter1ObjectiveRecordings());
  }
  if (!chapter1ObjectiveOnly) {
    rows.push(...(await nativeRobotStoryRecordings()));
  }
  const filtered = rows.filter(({ entry }) => {
    if (
      actorFilter &&
      entry.id !== actorFilter &&
      entry.profile.actorKey !== actorFilter
    ) {
      return false;
    }
    return true;
  });
  return filtered.slice(0, limit);
}

function readCompatibleManifest(synthesisIdentity) {
  if (force || !fs.existsSync(manifestPath)) {
    return undefined;
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return manifest.provider === provider &&
      manifest.synthesisIdentity === synthesisIdentity
      ? manifest
      : undefined;
  } catch {
    // A prior interrupted manifest write should cause regeneration, not block
    // the complete audio asset pass.
    return undefined;
  }
}

function isRetryable(error) {
  const message = String(error?.message || error);
  return (
    error?.name === "AbortError" ||
    /failed:\s*(408|409|425|429|5\d\d)\b/i.test(message) ||
    /fetch failed|network|socket|timeout/i.test(message)
  );
}

async function withRetry(operation) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === 3) {
        throw error;
      }
      // Back off quickly for account concurrency limits while keeping the
      // one-time batch practical for the complete NPC catalog.
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          1000 * 2 ** attempt + Math.floor(Math.random() * 250)
        )
      );
    }
  }
  throw lastError;
}

async function runWorkers(items, workerCount, work) {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(workerCount, items.length) },
    async () => {
      for (;;) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) {
          return;
        }
        await work(items[index], index);
      }
    }
  );
  await Promise.all(workers);
}

async function main() {
  const rows = await plannedRecordings();
  const elevenLabsConfig =
    provider === "elevenlabs" ? elevenLabsConfigFromEnv() : undefined;
  const azureConfig =
    provider === "openai" ? azureSpeechConfigFromEnv() : undefined;
  const synthesisIdentity = elevenLabsConfig
    ? elevenLabsSynthesisCacheIdentity(elevenLabsConfig)
    : AZURE_SPEECH_SYNTHESIS_POLICY_VERSION;
  console.log(
    `Harthmere ${provider} voice recordings ${HARTHMERE_NPC_VOICE_CATALOG_VERSION}: ${rows.length} planned`
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

  if (provider === "elevenlabs" && !elevenLabsConfig) {
    console.error(
      "Missing ELEVENLABS_API_KEY in the environment or .env.local."
    );
    process.exitCode = 1;
    return;
  }
  if (provider === "openai" && !azureConfig) {
    console.error(
      "Missing AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in the environment or .env.local."
    );
    process.exitCode = 1;
    return;
  }

  const compatibleManifest = readCompatibleManifest(synthesisIdentity);
  const recordsByPath = new Map(
    (compatibleManifest?.recordings || [])
      .filter((recording) =>
        fs.existsSync(path.join(publicRoot, recording.path || ""))
      )
      .map((recording) => [recording.path, recording])
  );
  const reusablePathByCacheKey = new Map();
  for (const recording of recordsByPath.values()) {
    for (const cacheKey of [
      recording.cacheKey,
      ...(recording.cacheKeys || []),
    ]) {
      if (cacheKey) {
        reusablePathByCacheKey.set(cacheKey, recording.path);
      }
    }
  }
  const generationByCacheKey = new Map();
  let written = 0;
  let skipped = 0;
  let reused = 0;
  let failed = 0;
  let completed = 0;

  const writeManifest = () => {
    const manifest = {
      version: NPC_VOICE_AUDIO_CACHE_MANIFEST_VERSION,
      catalogVersion: HARTHMERE_NPC_VOICE_CATALOG_VERSION,
      generatedAt: new Date().toISOString(),
      provider,
      synthesisIdentity,
      ...(elevenLabsConfig
        ? {
            modelId: elevenLabsConfig.modelId,
            outputFormat: elevenLabsConfig.outputFormat,
          }
        : { outputFormat: "audio-48khz-192kbitrate-mono-mp3" }),
      recordings: [...recordsByPath.values()].sort((a, b) =>
        a.path.localeCompare(b.path)
      ),
    };
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    const temporaryPath = `${manifestPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`);
    fs.renameSync(temporaryPath, manifestPath);
  };

  await runWorkers(rows, concurrency, async (row) => {
    const spokenText = elevenLabsConfig
      ? elevenLabsSpokenTextForTest(row.line.text)
      : row.line.text.trim();
    if (!spokenText) {
      skipped += 1;
      completed += 1;
      return;
    }
    // English UI requests may carry en-US or no language depending on the
    // translation toggle. Both hashes safely reuse this same English MP3.
    const cacheKeys = [
      npcVoiceAudioCacheKey({
        provider,
        synthesisIdentity,
        text: spokenText,
        voice: row.entry.profile.voiceParameterId,
        language: row.language,
      }),
      npcVoiceAudioCacheKey({
        provider,
        synthesisIdentity,
        text: spokenText,
        voice: row.entry.profile.voiceParameterId,
      }),
    ].filter((cacheKey, index, values) => values.indexOf(cacheKey) === index);
    const cacheKey = cacheKeys[0];
    const outPath = path.join(publicRoot, row.line.recordingPath);
    const existingRecord = recordsByPath.get(row.line.recordingPath);
    if (
      !force &&
      existingRecord &&
      cacheKeys.includes(existingRecord.cacheKey) &&
      fs.existsSync(outPath)
    ) {
      recordsByPath.set(row.line.recordingPath, {
        ...existingRecord,
        cacheKey,
        cacheKeys,
      });
      skipped += 1;
      completed += 1;
      return;
    }
    // Do not leave a stale manifest entry behind if regeneration fails after a
    // text, provider, voice, or synthesis-policy change.
    recordsByPath.delete(row.line.recordingPath);

    try {
      let generation = generationByCacheKey.get(cacheKey);
      const reusablePath = !force
        ? reusablePathByCacheKey.get(cacheKey)
        : undefined;
      if (!generation) {
        generation = reusablePath
          ? Promise.resolve({
              audio: fs.readFileSync(path.join(publicRoot, reusablePath)),
              voiceId: recordsByPath.get(reusablePath)?.voiceId,
              reused: true,
            })
          : withRetry(async () => {
              const result = elevenLabsConfig
                ? await synthesizeElevenLabsSpeech({
                    config: elevenLabsConfig,
                    // Preserve the runtime path: normalization and entity
                    // decoding happen once inside the ElevenLabs synthesizer.
                    text: row.line.text,
                    voiceProfileId: row.entry.profile.voiceParameterId,
                    language: row.language,
                  })
                : await synthesizeAzureSpeech({
                    config: azureConfig,
                    text: spokenText,
                    voice: row.entry.profile.voiceParameterId,
                    language: row.language,
                  });
              return result
                ? {
                    audio: result.audio,
                    voiceId: result.voiceId,
                    reused: false,
                  }
                : undefined;
            });
        generationByCacheKey.set(cacheKey, generation);
      }
      const result = await generation;
      if (!result) {
        skipped += 1;
        return;
      }
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      const temporaryPath = `${outPath}.${process.pid}.tmp`;
      fs.writeFileSync(temporaryPath, result.audio);
      fs.renameSync(temporaryPath, outPath);
      reusablePathByCacheKey.set(cacheKey, row.line.recordingPath);
      recordsByPath.set(row.line.recordingPath, {
        cacheKey,
        cacheKeys,
        actorKey: row.entry.profile.actorKey,
        actorId: row.entry.id,
        lineId: row.line.lineId,
        path: row.line.recordingPath,
        voice: row.entry.profile.voiceParameterId,
        ...(result.voiceId ? { voiceId: result.voiceId } : {}),
        textHash: npcVoiceTextHash(spokenText),
        bytes: result.audio.length,
      });
      if (result.reused) {
        reused += 1;
        console.log(`REUSED ${row.line.recordingPath}`);
      } else {
        written += 1;
        console.log(`WROTE ${row.line.recordingPath}`);
      }
    } catch (error) {
      failed += 1;
      console.error(
        `FAILED ${row.entry.id} ${row.line.lineId}: ${String(
          error?.message || error
        ).slice(0, 500)}`
      );
    } finally {
      completed += 1;
      // Checkpoint long batches so a process interruption can resume without
      // paying for lines that were already generated successfully.
      if (completed % 25 === 0 || completed === rows.length) {
        writeManifest();
      }
    }
  });

  writeManifest();
  console.log(
    `Done. written=${written} reused=${reused} skipped=${skipped} failed=${failed}`
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
