#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

require("ts-node/register");
require("tsconfig-paths/register");

const {
  elevenLabsDeliveryTextForTest,
  elevenLabsKnownVoiceGenderForTest,
  elevenLabsNaturalVoiceSettingsForTest,
} = require("../../src/server/shared/elevenlabs");
const {
  HARTHMERE_NPC_VOICE_CATALOG,
} = require("../../src/shared/harthmere/npc_voice_catalog");
const {
  harthmereStrongVoiceGenderForNameForTest,
  parseHarthmereAzureVoiceId,
} = require("../../src/shared/harthmere/npc_voice_profiles");

const root = path.resolve(process.argv[2] || path.join(__dirname, "../.."));
const manifestPath = path.join(
  root,
  "public/harthmere/voices/generated/current/manifest.json"
);

function fail(message) {
  throw new Error(message);
}

function displayNameFromActorKey(actorKey) {
  return (
    String(actorKey || "")
      .split(":")
      .at(-1)
      ?.trim() || "Unknown"
  );
}

function robotIdentityText(recording, displayName) {
  // actorId may say "native-robot-story" for human quest speakers. Audit the
  // actor's own identity and static path components instead of that quest tag.
  const actorId = String(recording.actorId || "").replace(
    /^native-robot-story:/,
    ""
  );
  return `${recording.actorKey || ""} ${actorId} ${displayName}`.toLowerCase();
}

function main() {
  if (!fs.existsSync(manifestPath)) {
    fail(`Missing NPC voice manifest: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.provider !== "elevenlabs") {
    fail(`Expected ElevenLabs manifest, got ${manifest.provider}`);
  }

  const catalogNameByActorKey = new Map(
    HARTHMERE_NPC_VOICE_CATALOG.map((entry) => [
      entry.profile.actorKey,
      entry.displayName,
    ])
  );
  const actors = new Map();
  for (const recording of manifest.recordings || []) {
    const actorKey = recording.actorKey || recording.actorId;
    const parsed = parseHarthmereAzureVoiceId(recording.voice);
    if (!parsed) {
      fail(`Unparseable voice descriptor for ${actorKey}`);
    }
    const displayName =
      catalogNameByActorKey.get(recording.actorKey) ||
      displayNameFromActorKey(recording.actorKey);
    let actor = actors.get(actorKey);
    if (!actor) {
      actor = {
        actorKey,
        displayName,
        gender: parsed.gender,
        kind: parsed.actorKind,
        voiceIds: new Set(),
        recordings: 0,
      };
      actors.set(actorKey, actor);
    }
    if (actor.gender !== parsed.gender || actor.kind !== parsed.actorKind) {
      fail(`Actor ${actorKey} changes presentation across recordings`);
    }
    actor.recordings += 1;
    if (recording.voiceId) {
      actor.voiceIds.add(recording.voiceId);
    }

    const expectedGender =
      harthmereStrongVoiceGenderForNameForTest(displayName);
    if (
      parsed.actorKind === "humanoid" &&
      expectedGender &&
      parsed.gender !== expectedGender
    ) {
      fail(
        `${displayName} is ${expectedGender} by authored identity but uses ${parsed.gender}`
      );
    }
    if (parsed.actorKind !== "humanoid" && parsed.gender !== "neutral") {
      fail(`${displayName} is ${parsed.actorKind} but is not neutral-cast`);
    }

    const providerGender = elevenLabsKnownVoiceGenderForTest(recording.voiceId);
    if (
      parsed.actorKind === "humanoid" &&
      providerGender &&
      providerGender !== parsed.gender
    ) {
      fail(
        `${displayName} requests ${parsed.gender} but MP3 uses a ${providerGender} ElevenLabs voice`
      );
    }

    const robotNamed =
      /\b(robot|sentinel|automaton|construct|augur-?\d+)\b/.test(
        robotIdentityText(recording, displayName)
      );
    if (robotNamed && parsed.actorKind !== "robot") {
      fail(
        `${displayName} looks like a robot identity but uses ${parsed.actorKind}`
      );
    }
  }

  const robotActors = [...actors.values()].filter(
    (actor) => actor.kind === "robot"
  );
  if (robotActors.length === 0) {
    fail("Voice manifest contains no robot actors");
  }
  const robotPrompt = elevenLabsDeliveryTextForTest({
    text: "SYSTEM READY.",
    actorKind: "robot",
    modelId: manifest.modelId,
  });
  if (!/^\[robotic,/i.test(robotPrompt)) {
    fail("ElevenLabs v3 robot delivery prompt is missing");
  }
  const robotSettings = elevenLabsNaturalVoiceSettingsForTest({
    actorKind: "robot",
    rate: "+0%",
  });
  if (robotSettings.stability < 0.6) {
    fail("Robot delivery stability is too low for precise synthetic speech");
  }

  const summary = {
    manifestRecordings: manifest.recordings.length,
    uniqueActors: actors.size,
    humanoidFemaleActors: [...actors.values()].filter(
      (actor) => actor.kind === "humanoid" && actor.gender === "female"
    ).length,
    humanoidMaleActors: [...actors.values()].filter(
      (actor) => actor.kind === "humanoid" && actor.gender === "male"
    ).length,
    robotActors: robotActors.length,
    robotRecordings: robotActors.reduce(
      (total, actor) => total + actor.recordings,
      0
    ),
    knownProviderGenderChecks: (manifest.recordings || []).filter(
      (recording) =>
        elevenLabsKnownVoiceGenderForTest(recording.voiceId) !== undefined
    ).length,
  };
  console.log(`PASS NPC voice casting audit: ${JSON.stringify(summary)}`);
}

try {
  main();
} catch (error) {
  console.error(`FAIL ${error?.message || error}`);
  process.exit(1);
}
