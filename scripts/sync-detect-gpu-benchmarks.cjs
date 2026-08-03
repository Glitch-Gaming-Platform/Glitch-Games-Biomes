#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const packageJsonPath = require.resolve("detect-gpu/package.json", {
  paths: [root],
});
const packageRoot = path.dirname(packageJsonPath);
const { version } = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const sourceDirectory = path.join(packageRoot, "dist", "benchmarks");
const destinationDirectory = path.join(
  root,
  "public",
  "assets",
  "glitch",
  "gpu-benchmarks",
  `detect-gpu-${version}`
);

const files = fs
  .readdirSync(sourceDirectory)
  .filter((file) => file.endsWith(".json"))
  .sort();
if (files.length === 0) {
  throw new Error(`No detect-gpu benchmark files found in ${sourceDirectory}`);
}

fs.mkdirSync(destinationDirectory, { recursive: true });
for (const existing of fs.readdirSync(destinationDirectory)) {
  if (existing.endsWith(".json") && !files.includes(existing)) {
    fs.rmSync(path.join(destinationDirectory, existing));
  }
}
for (const file of files) {
  const source = path.join(sourceDirectory, file);
  const destination = path.join(destinationDirectory, file);
  const contents = JSON.parse(fs.readFileSync(source, "utf8"));
  if (contents[0] !== version || contents.length < 2) {
    throw new Error(`${file} is not a complete detect-gpu ${version} dataset`);
  }
  fs.copyFileSync(source, destination);
}
fs.copyFileSync(
  path.join(packageRoot, "LICENSE"),
  path.join(destinationDirectory, "LICENSE.detect-gpu.txt")
);

console.log(
  `Copied ${files.length} detect-gpu ${version} benchmark files to ${destinationDirectory}`
);
