#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.cwd();
const gltfpack = path.join(root, ".cache/biomes-tools/gltfpack/1.2/gltfpack");
const assets = [
  "mossy_mucker",
  "tree_mucker",
  "stone_mucker",
  "jugger_mucker",
  "seedy_muckling",
  "brown_hexer",
  "purple_hexer",
  "cow",
  "sheep",
  "rabbit",
];
const expectedFrames = new Map([
  ["StaggerLight", 10],
  ["StaggerMedium", 23],
  ["StaggerHeavy", 52],
]);

function parseGlb(filePath) {
  const bytes = fs.readFileSync(filePath);
  assert.equal(bytes.toString("ascii", 0, 4), "glTF", `${filePath} magic`);
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(
    bytes.toString("utf8", 20, 20 + jsonLength).replace(/\0+$/g, "")
  );
}

function duration(document, animation) {
  return Math.max(
    ...animation.samplers.map(
      ({ input }) => document.accessors[input]?.max?.[0] ?? 0
    )
  );
}

assert.ok(fs.existsSync(gltfpack), `Missing pinned gltfpack: ${gltfpack}`);
const destinationRoot = path.join(
  root,
  "public/assets/harthmere/glb/creatures/stagger"
);
fs.mkdirSync(destinationRoot, { recursive: true });

for (const asset of assets) {
  const source = path.join(root, `src/galois/data/exports/npcs/${asset}.gltf`);
  const destination = path.join(destinationRoot, `${asset}.glb`);
  assert.ok(fs.existsSync(source), `Missing materialized NPC asset: ${source}`);
  const result = spawnSync(
    gltfpack,
    ["-af", "24", "-i", source, "-o", destination],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(
      `gltfpack failed for ${asset}: ${result.stderr || result.stdout}`
    );
  }
  const document = parseGlb(destination);
  const animations = new Map(
    (document.animations ?? []).map((animation) => [animation.name, animation])
  );
  for (const [name, frames] of expectedFrames) {
    const animation = animations.get(name);
    assert.ok(animation, `${asset} missing ${name}`);
    assert.ok(
      Math.abs(duration(document, animation) - frames / 24) < 0.002,
      `${asset} ${name} duration`
    );
  }
  console.log(
    `Synced ${asset}: ${animations.size} clips -> ${path.relative(
      root,
      destination
    )}`
  );
}
