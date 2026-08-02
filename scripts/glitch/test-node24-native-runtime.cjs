#!/usr/bin/env node

const expectedMajor = 24;
const actualMajor = Number(process.versions.node.split(".")[0]);

if (actualMajor !== expectedMajor) {
  console.error(
    `FAIL Node ${expectedMajor} is required for the fork runtime audit; got ${process.version}`
  );
  process.exit(1);
}

const nativePackages = [
  "@swc/core",
  "esbuild",
  "msgpackr-extract",
  "sharp",
  "bufferutil",
  "utf-8-validate",
  "segfault-raub",
  "uWebSockets.js",
];

let failed = false;
for (const packageName of nativePackages) {
  try {
    require(packageName);
    console.log(`OK Node 24 native runtime loads ${packageName}`);
  } catch (error) {
    failed = true;
    console.error(
      `FAIL Node 24 native runtime cannot load ${packageName}: ${error.message}`
    );
  }
}

try {
  const msgpackr = require("msgpackr");
  if (!msgpackr.isNativeAccelerationEnabled) {
    throw new Error("native acceleration is disabled");
  }
  console.log("OK msgpackr native acceleration is enabled");
} catch (error) {
  failed = true;
  console.error(`FAIL msgpackr native acceleration: ${error.message}`);
}

console.log(`\nRESULT: ${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
