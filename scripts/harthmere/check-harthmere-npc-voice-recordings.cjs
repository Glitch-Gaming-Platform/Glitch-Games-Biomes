#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

require("ts-node/register");
require("tsconfig-paths/register");

const {
  npcVoiceAudioCacheKey,
} = require("../../src/server/shared/npc_voice_audio_cache");
const {
  harthmereVoiceProfileForActor,
} = require("../../src/shared/harthmere/npc_voice_profiles");

const root = path.resolve(process.argv[2] || path.join(__dirname, "../.."));
const publicRoot = path.join(root, "public");
const manifestPath = path.join(
  publicRoot,
  "harthmere/voices/generated/current/manifest.json"
);

function fail(message) {
  throw new Error(message);
}

function isGitLfsPointer(filePath) {
  const prefix = fs.readFileSync(filePath).subarray(0, 80).toString("utf8");
  return prefix.startsWith("version https://git-lfs.github.com/spec/v1");
}

function cacheKeysFor(recording) {
  return new Set([recording.cacheKey, ...(recording.cacheKeys || [])]);
}

function main() {
  if (!fs.existsSync(manifestPath)) {
    fail(`Missing NPC voice manifest: ${manifestPath}`);
  }
  const manifestText = fs.readFileSync(manifestPath, "utf8");
  if (/sk_[A-Za-z0-9]{20,}/.test(manifestText)) {
    fail("NPC voice manifest contains an API-key-shaped secret");
  }
  const manifest = JSON.parse(manifestText);
  if (manifest.provider !== "elevenlabs") {
    fail(`Expected ElevenLabs manifest, got ${manifest.provider}`);
  }
  if (!manifest.synthesisIdentity) {
    fail("NPC voice manifest is missing synthesisIdentity");
  }
  if ((manifest.recordings || []).length < 1536) {
    fail(
      `NPC voice manifest is incomplete: ${
        manifest.recordings?.length || 0
      } recordings`
    );
  }

  const paths = new Set();
  let nativeRobotStoryCount = 0;
  for (const recording of manifest.recordings) {
    if (!recording.path || paths.has(recording.path)) {
      fail(`Missing or duplicate voice path: ${recording.path}`);
    }
    paths.add(recording.path);
    const absolutePath = path.join(publicRoot, recording.path);
    if (!fs.existsSync(absolutePath)) {
      fail(`Missing committed voice MP3: ${recording.path}`);
    }
    const size = fs.statSync(absolutePath).size;
    if (size <= 0 || recording.bytes !== size) {
      fail(`Voice MP3 size mismatch: ${recording.path}`);
    }
    if (isGitLfsPointer(absolutePath)) {
      fail(`Voice MP3 is still a Git LFS pointer: ${recording.path}`);
    }
    if (recording.path.includes("/native-robot-story/")) {
      nativeRobotStoryCount += 1;
    }
  }

  for (const questSlug of [
    "the-road-ahead-6193612340426932",
    "busted-7405046529843322",
    "get-the-muck-out-817959262145055",
    "muck-vs-machine-5739496793885069",
  ]) {
    if (
      ![...paths].some((recordingPath) => recordingPath.includes(questSlug))
    ) {
      fail(`Native robot-story audio is missing ${questSlug}`);
    }
  }
  if (nativeRobotStoryCount < 139) {
    fail(
      `Native robot-story audio is incomplete: ${nativeRobotStoryCount} recordings`
    );
  }

  // Reproduce the exact production request from the attached HAR. It must map
  // to committed audio rather than a replica-local runtime filename.
  const jackieVoice = harthmereVoiceProfileForActor({
    source: "runtime_entity",
    entityId: 8997551883502307,
    displayName: "Jackie",
  }).voiceParameterId;
  const harText =
    "The name is Jackie. I'm glad we found ya before the Muckers did.";
  const harCacheKey = npcVoiceAudioCacheKey({
    provider: "elevenlabs",
    synthesisIdentity: manifest.synthesisIdentity,
    text: harText,
    voice: jackieVoice,
    language: "en-US",
  });
  const harRecording = manifest.recordings.find(
    (recording) =>
      recording.path.includes("the-road-ahead-6193612340426932") &&
      cacheKeysFor(recording).has(harCacheKey)
  );
  if (!harRecording) {
    fail("Attached-HAR Jackie line does not resolve to committed voice audio");
  }

  console.log(
    `PASS NPC voice recordings: ${manifest.recordings.length} MP3s, ` +
      `${nativeRobotStoryCount} native robot-story lines, HAR cache hit ${harRecording.path}`
  );
}

try {
  main();
} catch (error) {
  console.error(`FAIL ${error?.message || error}`);
  process.exit(1);
}
