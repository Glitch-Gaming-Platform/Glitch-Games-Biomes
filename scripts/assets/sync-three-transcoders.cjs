#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const sourceDir = path.join(root, "node_modules/three/examples/jsm/libs/basis");
const outputDir = path.join(root, "public/three/basis");
const files = ["basis_transcoder.js", "basis_transcoder.wasm"];

fs.mkdirSync(outputDir, { recursive: true });
for (const file of files) {
  const source = path.join(sourceDir, file);
  const output = path.join(outputDir, file);
  if (!fs.existsSync(source)) {
    throw new Error(
      `Missing Three.js Basis transcoder ${source}; install dependencies first.`
    );
  }
  fs.copyFileSync(source, output);
}

console.log(
  `Synced Three.js Basis transcoder ${files.join(", ")} to ${path.relative(
    root,
    outputDir
  )}`
);
