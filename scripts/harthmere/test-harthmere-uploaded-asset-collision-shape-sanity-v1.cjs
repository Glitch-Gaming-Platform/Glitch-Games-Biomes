#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");
const {
  loadTown,
  makeReporter,
  isSolidUploadedAsset,
  collisionBlocksPlayerLikeRegistry,
  isTinyAsset,
  isVisualOnly,
} = require("./harthmere-town-rule-test-utils-v1.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere uploaded asset collision shape sanity tests v1", root);
const town = loadTown(root);

const solidPlacements = town.placements.filter((p) => isSolidUploadedAsset(town.assets.get(p.asset), p));
report.check("solid uploaded placement sample is large enough for meaningful collision coverage", solidPlacements.length >= 100, `found ${solidPlacements.length}`);

const walkThrough = solidPlacements
  .filter((p) => !collisionBlocksPlayerLikeRegistry(p))
  .map((p) => `${p.name || p.asset} (${p.asset}) ${p.district || "Unknown"} line ${p.line}`);
report.check("every solid uploaded placement remains player-blocking", walkThrough.length === 0, walkThrough);

const absurdScales = solidPlacements
  .filter((p) => p.scale !== undefined && (!Number.isFinite(p.scale) || p.scale <= 0 || p.scale > 12))
  .map((p) => `${p.name || p.asset} (${p.asset}) scale=${p.scale} line ${p.line}`);
report.check("solid uploaded blockers use sane authored scale values", absurdScales.length === 0, absurdScales);

const suspiciousVisualBlockers = solidPlacements
  .filter((p) => isVisualOnly(p.asset, p.name) || isTinyAsset(p.asset, p.name))
  .map((p) => `${p.name || p.asset} (${p.asset}) line ${p.line}`);
report.check("visual/tiny uploads are not accidentally classified as hard solid blockers", suspiciousVisualBlockers.length === 0, suspiciousVisualBlockers);

const blockingButNamedDecorative = solidPlacements
  .filter((p) => /visual only|display only|breadcrumb|signage only|marker only|nonblocking|pass[- ]?through/i.test(`${p.name} ${p.raw || ""}`))
  .map((p) => `${p.name || p.asset} (${p.asset}) line ${p.line}`);
report.check("assets named as decorative/pass-through are not also classified as solid blockers", blockingButNamedDecorative.length === 0, blockingButNamedDecorative);

report.finish();
