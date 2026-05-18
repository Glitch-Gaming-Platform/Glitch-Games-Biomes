#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const rel = "src/shared/harthmere/town_registry.ts";
const file = path.join(root, rel);
let text = fs.readFileSync(file, "utf8");

const marker = "HARTHMERE_WALKABLE_BRIDGE_COLLISION_V54";
const bridgeCollisionSnippet = `

  // HARTHMERE_WALKABLE_BRIDGE_COLLISION_V54
  // Bridge decks are an approved road/checkpoint exception. They must be
  // walkable floor/road surfaces, while the parapets remain blocking rails.
  if (/HARTHMERE_WALKABLE_BRIDGE_V54|HARTHMERE_WILDS_THORNBRIDGE_V54|walkable bridge deck|old bridge pedestrian lane|bridge crack inspection lane/i.test(label)) {
    return { category: "none", blocksNpc: false, blocksPlayer: false, reason: "v54 walkable bridge deck is a road/floor surface, not an obstacle" }; // HARTHMERE_BRIDGE_LABEL_TDZ_FIX_V55
  }
  if (/HARTHMERE_BRIDGE_PARAPET_V54|bridge parapet|parapet rail/i.test(label)) {
    return { category: "playerBlocker", halfX: scaled(3.2, scale), halfZ: scaled(0.34, scale), padding: 0.12, blocksNpc: true, blocksPlayer: true, reason: "v54 bridge parapet blocks bridge edges while preserving the central walkable lane" };
  }
`;

// Remove every previous v54 bridge collision block first. The bad v54 patch put
// this block in inferHarthmereLodTier, before label/scale were declared. It also
// returned a collision object from a function whose return type is a LOD string.
const blockRe = /\n\s*\/\/ HARTHMERE_WALKABLE_BRIDGE_COLLISION_V54[\s\S]*?reason: "v54 bridge parapet blocks bridge edges while preserving the central walkable lane" \};\n\s*\}\n/g;
const beforeCount = (text.match(new RegExp(marker, "g")) || []).length;
text = text.replace(blockRe, "\n");
const removedCount = beforeCount - ((text.match(new RegExp(marker, "g")) || []).length);

const lodStart = text.indexOf("export function inferHarthmereLodTier");
const scaledStart = text.indexOf("function scaled", lodStart);
if (lodStart < 0 || scaledStart < 0) {
  throw new Error("Could not locate inferHarthmereLodTier/function scaled boundaries in town_registry.ts");
}
const lodBlock = text.slice(lodStart, scaledStart);
if (lodBlock.includes(marker)) {
  throw new Error("Safety check failed: bridge collision marker is still inside inferHarthmereLodTier after removal");
}

const collisionStart = text.indexOf("export function collisionFromHarthmerePlacement");
if (collisionStart < 0) {
  throw new Error("Could not locate collisionFromHarthmerePlacement in town_registry.ts");
}
const collisionEndCandidates = [
  text.indexOf("export function makeHarthmerePropMetadata", collisionStart),
  text.indexOf("export function makeHarthmereActorMetadata", collisionStart),
  text.indexOf("export function", collisionStart + 10),
].filter((x) => x > collisionStart);
const collisionEnd = Math.min(...collisionEndCandidates);
if (!Number.isFinite(collisionEnd)) {
  throw new Error("Could not locate end of collisionFromHarthmerePlacement in town_registry.ts");
}
let collisionBlock = text.slice(collisionStart, collisionEnd);

if (!collisionBlock.includes(marker)) {
  const declRe = /(export function collisionFromHarthmerePlacement\([\s\S]*?\): HarthmereCollisionConfig \{\n\s*const asset = input\.asset;\n\s*const label = `\$\{asset\} \$\{input\.name \?\? ""\}`;\n\s*const scale = input\.scale \?\? 1;\n\s*const kind = input\.kind \?\? inferHarthmerePlacementKind\(input\);)/;
  if (!declRe.test(collisionBlock)) {
    throw new Error("Could not find initialized asset/label/scale/kind declarations in collisionFromHarthmerePlacement");
  }
  collisionBlock = collisionBlock.replace(declRe, `$1${bridgeCollisionSnippet}`);
  text = text.slice(0, collisionStart) + collisionBlock + text.slice(collisionEnd);
}

// Final guardrails: exactly one bridge collision policy, not in the LOD function,
// and it appears after the label/scale/kind declarations inside collisionFrom.
const finalCount = (text.match(new RegExp(marker, "g")) || []).length;
if (finalCount !== 1) {
  throw new Error(`Expected exactly one ${marker} block after v55 repair, found ${finalCount}`);
}
const finalLodBlock = text.slice(text.indexOf("export function inferHarthmereLodTier"), text.indexOf("function scaled", text.indexOf("export function inferHarthmereLodTier")));
if (finalLodBlock.includes(marker)) {
  throw new Error("Bridge collision policy is still inside inferHarthmereLodTier");
}
const finalCollisionStart = text.indexOf("export function collisionFromHarthmerePlacement");
const finalMarker = text.indexOf(marker, finalCollisionStart);
const finalLabel = text.indexOf("const label = `${asset} ${input.name ?? \"\"}`;", finalCollisionStart);
const finalScale = text.indexOf("const scale = input.scale ?? 1;", finalCollisionStart);
const finalKind = text.indexOf("const kind = input.kind ?? inferHarthmerePlacementKind(input);", finalCollisionStart);
if (!(finalCollisionStart >= 0 && finalLabel > finalCollisionStart && finalScale > finalLabel && finalKind > finalScale && finalMarker > finalKind)) {
  throw new Error("Bridge collision policy is not safely placed after asset/label/scale/kind declarations");
}

fs.writeFileSync(file, text);
console.log(`PATCHED ${rel} bridge label TDZ fix v55 (removed ${removedCount} bad block${removedCount === 1 ? "" : "s"})`);
