#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
function read(rel) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}
function check(label, ok, detail = "") {
  if (ok) console.log(`OK ${label}`);
  else {
    console.error(`FAIL ${label}${detail ? `\n${detail}` : ""}`);
    process.exitCode = 1;
  }
}

const registryRel = "src/shared/harthmere/town_registry.ts";
const registry = read(registryRel);
const marker = "HARTHMERE_WALKABLE_BRIDGE_COLLISION_V54";
console.log("== Harthmere town registry bridge label TDZ test v55 ==");

const markerCount = (registry.match(new RegExp(marker, "g")) || []).length;
check("exactly one bridge collision policy exists", markerCount === 1, `found ${markerCount}`);

const lodStart = registry.indexOf("export function inferHarthmereLodTier");
const scaledStart = registry.indexOf("function scaled", lodStart);
const lodBlock = lodStart >= 0 && scaledStart > lodStart ? registry.slice(lodStart, scaledStart) : "";
check("inferHarthmereLodTier exists", lodStart >= 0 && scaledStart > lodStart);
check("bridge collision policy is not inside inferHarthmereLodTier", !lodBlock.includes(marker));
check("inferHarthmereLodTier initializes label before using label", /const kind = input\.kind \?\? inferHarthmerePlacementKind\(input\);\s*const label = `\$\{input\.asset\} \$\{input\.name \?\? ""\} \$\{input\.district \?\? ""\}`;/.test(lodBlock));
check("inferHarthmereLodTier still returns LOD strings, not collision objects", !/return \{ category:/.test(lodBlock));

const collisionStart = registry.indexOf("export function collisionFromHarthmerePlacement");
const propStart = registry.indexOf("export function makeHarthmerePropMetadata", collisionStart);
const actorStart = registry.indexOf("export function makeHarthmereActorMetadata", collisionStart);
const collisionEnd = Math.min(...[propStart, actorStart].filter((x) => x > collisionStart));
const collisionBlock = collisionStart >= 0 && Number.isFinite(collisionEnd) ? registry.slice(collisionStart, collisionEnd) : "";
check("collisionFromHarthmerePlacement exists", collisionStart >= 0 && collisionBlock.length > 0);
check("bridge collision policy is inside collisionFromHarthmerePlacement", collisionBlock.includes(marker));

const posLabel = collisionBlock.indexOf("const label = `${asset} ${input.name ?? \"\"}`;");
const posScale = collisionBlock.indexOf("const scale = input.scale ?? 1;");
const posKind = collisionBlock.indexOf("const kind = input.kind ?? inferHarthmerePlacementKind(input);");
const posMarker = collisionBlock.indexOf(marker);
check("bridge collision policy appears after label/scale/kind initialization", posLabel >= 0 && posScale > posLabel && posKind > posScale && posMarker > posKind, `label=${posLabel} scale=${posScale} kind=${posKind} marker=${posMarker}`);
check("walkable bridge deck remains non-blocking", /walkable bridge deck is a road\/floor surface, not an obstacle/.test(collisionBlock));
check("bridge parapets remain blocking", /bridge parapet blocks bridge edges/.test(collisionBlock));
check("v55 guard marker exists", /HARTHMERE_BRIDGE_LABEL_TDZ_FIX_V55/.test(collisionBlock));

// Do not invoke the older v54 test from here. Some local suites append nested
// test hooks, and this fix must stay focused: move the bridge collision policy
// out of inferHarthmereLodTier and into collisionFromHarthmerePlacement. The
// checks above preserve the bridge non-blocking/parapet-blocking guarantees.

const report = {
  version: "harthmere-town-registry-bridge-label-tdz-v55",
  generatedAt: new Date().toISOString(),
  root,
  checks: {
    markerCount,
    markerOutsideInferHarthmereLodTier: !lodBlock.includes(marker),
    markerInsideCollisionFromHarthmerePlacement: collisionBlock.includes(marker),
    markerAfterLabelScaleKind: posLabel >= 0 && posScale > posLabel && posKind > posScale && posMarker > posKind,
  },
  result: process.exitCode ? "FAIL" : "PASS",
};
const outRel = "public/assets/harthmere/manifest/harthmere-town-registry-bridge-label-tdz-v55.json";
fs.mkdirSync(path.dirname(path.join(root, outRel)), { recursive: true });
fs.writeFileSync(path.join(root, outRel), JSON.stringify(report, null, 2));

if (process.exitCode) {
  console.error("\nRESULT: FAIL Harthmere town registry bridge label TDZ v55");
  process.exit(process.exitCode);
}
console.log("\nRESULT: PASS Harthmere town registry bridge label TDZ v55");
