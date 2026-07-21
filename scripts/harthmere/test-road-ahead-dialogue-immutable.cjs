#!/usr/bin/env node
/* eslint-disable no-console */

// The dialogue pass must never rewrite Snapshot Grove's existing tutorial and
// Road Ahead copy. This hashes only authored dialogue-bearing fields, so layout
// or unrelated mission implementation changes do not create false failures.

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const crypto = require("crypto");
const {
  SNAPSHOT_GROVE_NPCS,
} = require("../../src/shared/harthmere/snapshot_grove_content.ts");
const {
  SNAPSHOT_ROAD_AHEAD_MISSION,
} = require("../../src/shared/harthmere/snapshot_complete_port.ts");

const protectedDialogue = {
  // Hash semantic dialogue fields rather than entire source files. Comments,
  // formatting, and unrelated mechanics may change without weakening the
  // player-facing Road Ahead guarantee.
  npcs: SNAPSHOT_GROVE_NPCS.map(({ id, line, extraLines }) => ({
    id,
    line,
    extraLines,
  })),
  steps: SNAPSHOT_ROAD_AHEAD_MISSION.steps.map(
    ({
      id,
      jackieLine,
      title,
      objective,
      challengeTitle,
      challengeObjective,
      completion,
    }) => ({
      id,
      jackieLine,
      title,
      objective,
      challengeTitle,
      challengeObjective,
      completion,
    })
  ),
};

const actual = crypto
  .createHash("sha256")
  .update(JSON.stringify(protectedDialogue))
  .digest("hex");
const expected =
  "c8c910b2a7a924efacbb409e5a3789f67eb68e1a3e5709c304373f4a50942e30";

if (actual !== expected) {
  throw new Error(
    `Road Ahead dialogue changed: expected ${expected}, received ${actual}`
  );
}

console.log(`RESULT: PASS Road Ahead dialogue remains unchanged (${actual})`);
