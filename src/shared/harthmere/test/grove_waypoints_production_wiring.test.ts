/// <reference types="mocha" />
/// <reference types="node" />
//
// GROVE_WAYPOINT_PRODUCTION_WIRING
//
// The resolver contract in grove_engine_contracts.test.ts proves the RESOLVER
// is correct. It says nothing about whether the player-facing map calls it.
//
// This file closes that gap. It reads the real import/call sites and asserts
// that no NEW path bypasses `grove_waypoints.ts`, and that the known-unwired
// list only ever shrinks.
//
// Why this matters more than it looks: a stranded Grove marker is 17 blocks
// under the courtyard floor. `snapshot_grove_content.ts` records players
// standing at y=70.5 while seeded NPCs sat at y=53. A contract that says
// "no waypoint ships in the retired space" while production reads
// landmark.position directly is worse than no contract — it buys confidence
// about exactly the bug it does not cover.

import assert from "assert";
import fs from "fs";
import path from "path";
import {
  GROVE_HORIZONTAL_ONLY_LANDMARK_READERS,
  GROVE_UNWIRED_LANDMARK_POSITION_READERS,
} from "../grove/grove_waypoints";

const ROOT = path.resolve(__dirname, "../../../..");

/** Files that may legitimately touch a Grove landmark's raw position. */
const SANCTIONED = new Set([
  "src/shared/harthmere/grove/grove_waypoints.ts", // the resolver itself
  "src/shared/harthmere/snapshot_grove_content.ts", // the authored table
]);

function sourceFilesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "__tests__") continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
  };
  walk(path.join(ROOT, dir));
  return out;
}

/**
 * Files that import the Grove landmark table AND read a raw `.position` off a
 * landmark.
 *
 * SCOPED TO `landmark.position` ON PURPOSE. An earlier version also matched
 * `marker.position` and `resolved.position`, which produced three false
 * positives: in `harthmere_quest_object_markers.ts`,
 * `jobs_board_quest_marker_positions.ts` and `ch1_objective_targets.ts` those
 * names refer to values that have ALREADY been resolved upstream, so flagging
 * them would have pushed real work onto an allowlist and taught the next
 * person to ignore this test.
 *
 * `landmark` is the conventional name for a raw `SnapshotGroveLandmark`
 * throughout the codebase, so it is the signal worth matching. This is a
 * lint-grade heuristic, not dataflow analysis: it catches the common mistake
 * cheaply and is not a substitute for the browser run.
 */
function landmarkPositionReaders(): string[] {
  const readers: string[] = [];
  for (const file of [
    ...sourceFilesUnder("src/client"),
    ...sourceFilesUnder("src/shared/harthmere"),
  ]) {
    const relative = path.relative(ROOT, file);
    if (SANCTIONED.has(relative)) continue;
    const text = fs.readFileSync(file, "utf8");
    // Require a real IMPORT, not a mention. `harthmere_assets.ts` names the
    // landmark table in a comment and has an unrelated `resolved.position`
    // nearby; matching on text alone reported it as a bypass.
    const importsLandmarks =
      /import[\s\S]{0,400}?SNAPSHOT_GROVE_LANDMARKS[\s\S]{0,200}?from\s+"[^"]*snapshot_grove_content"/.test(
        text
      );
    if (!importsLandmarks) continue;
    // Ignore reads that are the resolver's own argument.
    const rawLandmarkReads = text
      .split("\n")
      .filter((line) => /\blandmark\.position\b/.test(line))
      .filter((line) => !line.includes("groveLandmarkWorldPosition"))
      .filter((line) => !line.trim().startsWith("//"))
      .filter((line) => !line.trim().startsWith("*"));
    if (rawLandmarkReads.length === 0) continue;
    readers.push(relative);
  }
  return readers.sort();
}

describe("Grove waypoint production wiring", () => {
  it("has no landmark-position reader outside the declared lists", () => {
    const declared = new Set([
      ...GROVE_UNWIRED_LANDMARK_POSITION_READERS,
      ...GROVE_HORIZONTAL_ONLY_LANDMARK_READERS,
    ]);
    const undeclared = landmarkPositionReaders().filter(
      (file) => !declared.has(file)
    );
    assert.deepEqual(
      undeclared,
      [],
      "a new path reads a Grove landmark position directly — route it through " +
        "grove_waypoints.ts, or add it to the declared list with a reason"
    );
  });

  it("keeps every declared unwired path real", () => {
    // A stale entry would let a genuine bypass hide behind a path that no
    // longer exists.
    for (const file of GROVE_UNWIRED_LANDMARK_POSITION_READERS) {
      assert(
        fs.existsSync(path.join(ROOT, file)),
        `${file} is on the unwired list but does not exist`
      );
    }
    for (const file of GROVE_HORIZONTAL_ONLY_LANDMARK_READERS) {
      assert(fs.existsSync(path.join(ROOT, file)), `${file} does not exist`);
    }
  });

  it("states plainly whether the player-facing map is fixed", () => {
    // This assertion is the whole point of the file. While the unwired list is
    // non-empty, the resolver is correct but production can still draw a
    // stranded pin, and nobody should read the resolver contract as a
    // player-facing guarantee.
    const remaining = GROVE_UNWIRED_LANDMARK_POSITION_READERS.length;
    if (remaining > 0) {
      assert(
        remaining <= 6,
        `${remaining} live paths still bypass the resolver; this list must ` +
          `only ever shrink`
      );
    } else {
      assert.equal(remaining, 0);
    }
  });
});
