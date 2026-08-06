#!/usr/bin/env node
"use strict";

// Fast source guard for the live browser test. The rendered gate remains the
// behavioral proof; this prevents it from drifting back to the two assumptions
// invalidated by the asset-loading work: a void fixture and eager music decode.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const runner = fs.readFileSync(
  path.join(
    root,
    "scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs"
  ),
  "utf8"
);

assert(
  runner.includes(
    "focusedCombatPosition = [...HARTHMERE_HILL_COMBAT_BROWSER_FIXTURE_POSITION]"
  ) &&
    runner.includes(
      "The old generic gathering node is not backed by terrain in the retained"
    ),
  "combat-music E2E must start on the production-scanned road surface"
);
assert(
  runner.includes("diagnostics.loadedTracks.length === 1") &&
    runner.includes(
      "diagnostics.loadedTracks[0] === diagnostics.currentTrack"
    ) &&
    runner.includes(
      '"battle music must not be fetched before combat requests it"'
    ),
  "combat-music E2E must require one-track startup residency and no eager battle fetch"
);
assert(
  runner.includes(
    "battle music was selected without a successful on-demand asset response"
  ) &&
    runner.includes("battleMusicEntry.value.loadedTracks.length <= 2") &&
    runner.includes("ambientRestoration.value.loadedTracks.length <= 2") &&
    runner.includes(
      "if (!combatMusicOnly) {\n    const authoritativeChase = await waitFor("
    ),
  "combat-music E2E must prove on-demand battle loading and bounded crossfade residency"
);

console.log(
  "OK combat-music browser contract covers safe terrain, one-track startup, on-demand battle loading, and bounded residency"
);
