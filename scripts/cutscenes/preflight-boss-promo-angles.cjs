#!/usr/bin/env node
"use strict";

/**
 * Pure, no-browser boss promo camera preflight.
 *
 * This deliberately does not claim terrain acceptance. It rejects cheap
 * geometry mistakes first, then writes exact named candidates for the live
 * cutscene generator to test one at a time against streamed terrain.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
require("ts-node/register");
require("tsconfig-paths/register");

const { bossPromoCameraPlan, preflightBossPromoCamera } = require(
  path.join(ROOT, "src/shared/cutscene/boss_promo_camera.ts")
);
const { HARTHMERE_BOSS_PROMO_SPECS, bossFrameFocus } = require(
  path.join(ROOT, "src/shared/cutscene/promo_scenes.ts")
);
const { preflightBossPromoDungeonCamera } = require(
  path.join(ROOT, "src/shared/cutscene/boss_promo_dungeon_preflight.ts")
);
const { HARTHMERE_BOSS_VISUAL_ASSETS } = require(
  path.join(ROOT, "src/shared/harthmere/boss_visual_assets.ts")
);

const PRESETS = [
  "baseline",
  "three-quarter-left",
  "three-quarter-right",
  "environment-wide",
  "reverse-inward",
];

function parseArgs(argv) {
  const result = {
    bosses: [],
    presets: [],
    output: undefined,
    strict: false,
    recommended: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--boss") result.bosses.push(argv[++index]);
    else if (arg === "--preset") result.presets.push(argv[++index]);
    else if (arg === "--output") result.output = argv[++index];
    else if (arg === "--strict") result.strict = true;
    else if (arg === "--recommended") result.recommended = true;
    else if (arg === "--help") {
      console.log(
        "Usage: preflight-boss-promo-angles.cjs [--boss id] [--preset name] " +
          "[--recommended] [--output file.json] [--strict]\n\n" +
          `Presets: ${PRESETS.join(", ")}`
      );
      process.exit(0);
    }
  }
  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const wantedBosses = new Set(args.bosses);
  const requestedPresets = args.presets.length > 0 ? args.presets : PRESETS;
  for (const preset of requestedPresets) {
    if (!PRESETS.includes(preset)) {
      throw new Error(`unknown camera preset ${preset}`);
    }
  }

  const rows = [];
  for (const spec of HARTHMERE_BOSS_PROMO_SPECS) {
    if (
      wantedBosses.size > 0 &&
      !wantedBosses.has(spec.id) &&
      !wantedBosses.has(`boss-${spec.id.replaceAll("_", "-")}`)
    ) {
      continue;
    }
    const visual = HARTHMERE_BOSS_VISUAL_ASSETS.find(
      (candidate) => candidate.id === spec.id
    );
    if (!visual) throw new Error(`missing visual bounds for ${spec.id}`);
    const input = {
      stage: spec.stage,
      cameraFar: spec.cameraFar,
      cameraNear: spec.cameraNear,
      fov: spec.fov,
      worldSize: visual.worldSize,
    };
    const wantedPresets = args.recommended
      ? [spec.cameraPresetPriority[0]]
      : requestedPresets;
    for (const preset of wantedPresets) {
      const plan = bossPromoCameraPlan(input, preset);
      const preflight = preflightBossPromoCamera(input, plan);
      const dungeonPreflight = spec.dungeonId
        ? preflightBossPromoDungeonCamera({
            dungeonId: spec.dungeonId,
            cameraFar: plan.cameraFar,
            cameraNear: plan.cameraNear,
            target: bossFrameFocus({ ...spec, ...plan }, visual),
            bossBodyRadius: preflight.bodyRadius,
          })
        : undefined;
      rows.push({
        scene: `boss-${spec.id.replaceAll("_", "-")}`,
        bossId: spec.id,
        area: spec.area,
        stage: spec.stage,
        worldSize: visual.worldSize,
        preset,
        cameraFar: plan.cameraFar,
        cameraNear: plan.cameraNear,
        fov: plan.fov,
        recommendationRank:
          spec.cameraPresetPriority.indexOf(preset) >= 0
            ? spec.cameraPresetPriority.indexOf(preset) + 1
            : undefined,
        sampledCaptureCamera: preflight.capturePosition,
        bodyRadius: Number(preflight.bodyRadius.toFixed(3)),
        minimumDollyDistance: Number(preflight.minimumDollyDistance.toFixed(3)),
        dungeonId: spec.dungeonId,
        dungeonCameraHits: dungeonPreflight?.cameraHits ?? [],
        dungeonSightlineHits: dungeonPreflight?.sightlineHits ?? [],
        issues: [...preflight.issues, ...(dungeonPreflight?.issues ?? [])],
        liveChecksRequired: [
          "actor support surface",
          "all dolly samples clear of terrain and architecture",
          "recognizable encounter scenery",
          "full readable silhouette and visible contact shadow",
        ],
      });
    }
  }

  if (rows.length === 0) {
    throw new Error("no bosses matched the requested filters");
  }
  for (const row of rows) {
    console.log(
      `${row.scene} ${row.preset}: ${row.issues.length ? "FAIL" : "PASS"} ` +
        `FOV=${row.fov} camera=${JSON.stringify(row.cameraFar)} -> ` +
        `${JSON.stringify(row.cameraNear)} sampled=${JSON.stringify(
          row.sampledCaptureCamera
        )}`
    );
    for (const issue of row.issues) console.log(`  - ${issue}`);
  }

  if (args.output) {
    const output = path.resolve(ROOT, args.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(
      output,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          kind: "boss-promo-camera-preflight",
          note: "Geometry-only. Live terrain and visual review remain mandatory.",
          recommendedFirstAttempts: Object.fromEntries(
            HARTHMERE_BOSS_PROMO_SPECS.map((spec) => [
              spec.id,
              spec.cameraPresetPriority[0],
            ])
          ),
          rows,
        },
        null,
        2
      )}\n`
    );
    console.log(`wrote ${path.relative(ROOT, output)}`);
  }

  if (args.strict && rows.some((row) => row.issues.length > 0)) {
    process.exitCode = 1;
  }
}

main();
