#!/usr/bin/env node
// BIOMES_WAKEUP_DISPLAY_NAME_IMPORT
// Regression check for the current naming patch: WakeUpScreen uses shared
// Biomes/Harthmere display-name constants, so it must import them. Without
// this import, the character builder crashes at runtime with:
//   ReferenceError: BIOMES_GAME_NAME is not defined

const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK ${message}`);
}

const wake = read("src/client/components/WakeUpScreen.tsx");
const names = read("src/shared/biomes/display_names.ts");

ok(names.includes('BIOMES_GAME_NAME = "Biomes"'), "shared Biomes game-name constant exists");
ok(names.includes('BIOMES_HARTHMERE_TOWN_NAME = "Harthmere"'), "shared Harthmere town-name constant exists");
ok(wake.includes('from "@/shared/biomes/display_names"'), "WakeUpScreen imports display-name constants");
ok(wake.includes("BIOMES_GAME_NAME"), "WakeUpScreen uses BIOMES_GAME_NAME");
ok(wake.includes("BIOMES_HARTHMERE_TOWN_NAME"), "WakeUpScreen uses BIOMES_HARTHMERE_TOWN_NAME");

if (process.exitCode) process.exit(process.exitCode);
console.log("\nBiomes wake-up display-name current check passed.");
