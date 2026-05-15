#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = process.argv[2];
if (!repo) {
  console.error("Usage: node check-harthmere-asset-server-python-v8c.cjs /path/to/biomes-game");
  process.exit(1);
}

const serverPath = path.join(repo, "src/galois/js/server/server.ts");
const text = fs.readFileSync(serverPath, "utf8");

let ok = true;
function check(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    ok = false;
    console.error(`FAIL ${message}`);
  }
}

check(text.includes('import { existsSync } from "fs";'), "asset server imports existsSync");
check(text.includes("function resolveAssetPythonBuildCommand(execDir: string): string"), "asset server has Python resolver");
check(text.includes("BIOMES_ASSET_PYTHON"), "asset server supports BIOMES_ASSET_PYTHON override");
check(text.includes("VIRTUAL_ENV"), "asset server checks active virtualenv");
check(text.includes('join(cwd, ".venv"'), "asset server checks repo .venv");
check(text.includes('"bin/python"'), "asset server checks POSIX venv python");
check(text.includes('"Scripts/python.exe"'), "asset server checks Windows venv python");
check(text.includes("py/assets/build.py"), "asset server still runs py/assets/build.py");
check(text.includes("buildCommand?: string"), "BatchAssetServer buildCommand is optional");
check(!text.includes('buildCommand = "python py/assets/build.py"'), "BatchAssetServer no longer defaults to plain shell python");
check(text.includes("const resolvedBuildCommand"), "BatchAssetServer resolves build command before spawning");
check(text.includes("spawn(\n      resolvedBuildCommand,"), "BatchAssetServer spawns resolved build command");
check(text.includes("Falling back to shell python for Galois assets"), "fallback warning explains import failure risk");

const venvPython = path.join(repo, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
check(fs.existsSync(venvPython), `repo venv Python exists: ${venvPython}`);

if (!ok) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
