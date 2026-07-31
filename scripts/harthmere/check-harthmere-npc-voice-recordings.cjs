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
const {
  HARTHMERE_NPC_VOICE_CATALOG,
} = require("../../src/shared/harthmere/npc_voice_catalog");
const {
  ch1VoiceActorForSpeaker,
} = require("../../src/shared/harthmere/ch1_voice");
const {
  CH1_OBJECTIVE_DIALOGUE,
  CH1_COMPLETION_DIALOGUE,
} = require("../../src/server/harthmere/ch1_dialogue");
const {
  SNAPSHOT_GROVE_JACKIE_ENTITY_ID,
} = require("../../src/shared/harthmere/snapshot_grove_ids");

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

function slugForVoicePath(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function expectedChapter1ObjectivePaths() {
  const linesByActor = new Map();
  const sequences = [
    ...Object.values(CH1_OBJECTIVE_DIALOGUE),
    ...Object.values(CH1_COMPLETION_DIALOGUE).flatMap((byChoice) =>
      Object.values(byChoice)
    ),
  ];
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
    return lines.map(
      (_text, index) =>
        `harthmere/voices/generated/current/${actorSlug}/line-${String(
          index + 1
        ).padStart(2, "0")}.mp3`
    );
  });
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
  const expectedCatalogPaths = new Set(
    HARTHMERE_NPC_VOICE_CATALOG.flatMap((entry) =>
      entry.staticLines.map((line) => line.recordingPath)
    )
  );
  const objectivePaths = expectedChapter1ObjectivePaths();
  const expectedMinimum =
    expectedCatalogPaths.size + objectivePaths.length + 139;
  if ((manifest.recordings || []).length < expectedMinimum) {
    fail(
      `NPC voice manifest is incomplete: ${
        manifest.recordings?.length || 0
      } recordings; expected at least ${expectedMinimum}`
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

  // Chapter 1 paths are actor-based rather than line-based so filenames never
  // expose the chapter's protected reveal terms through static asset requests.
  const chapterPaths = [...expectedCatalogPaths].filter((recordingPath) =>
    recordingPath.includes("/chapter-1-identity-")
  );
  if (chapterPaths.length < 63) {
    fail(`Chapter 1 voice catalog is incomplete: ${chapterPaths.length} lines`);
  }
  for (const chapterPath of chapterPaths) {
    if (!paths.has(chapterPath)) {
      fail(`Missing Chapter 1 voice MP3: ${chapterPath}`);
    }
    if (
      /stillwater|riverbed|seven|anchor-zero|anchor_zero|ardan-betrayal/i.test(
        chapterPath
      )
    ) {
      fail(`Chapter 1 voice filename leaks protected lore: ${chapterPath}`);
    }
  }
  for (const objectivePath of objectivePaths) {
    if (!paths.has(objectivePath)) {
      fail(`Missing voiced Chapter 1 objective MP3: ${objectivePath}`);
    }
  }

  // Reproduce the exact production request from the attached HAR. It must map
  // to committed audio rather than a replica-local runtime filename.
  const jackieVoice = harthmereVoiceProfileForActor({
    source: "runtime_entity",
    entityId: SNAPSHOT_GROVE_JACKIE_ENTITY_ID,
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
      `${chapterPaths.length} Chapter 1 cutscene lines, ` +
      `${objectivePaths.length} Chapter 1 objective lines, ` +
      `${nativeRobotStoryCount} native robot-story lines, HAR cache hit ${harRecording.path}`
  );
}

try {
  main();
} catch (error) {
  console.error(`FAIL ${error?.message || error}`);
  process.exit(1);
}
