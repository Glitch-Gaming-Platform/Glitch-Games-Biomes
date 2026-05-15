#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const root = process.argv[2];
if (!root) {
  console.error("Usage: node scripts/harthmere/check-three-rgbformat-v7b.cjs /path/to/biomes-game");
  process.exit(1);
}

const files = [
  path.join(root, "src/client/game/resources/player_mesh.ts"),
  path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"),
];

let failed = false;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    failed = true;
    console.error(`FAIL ${message}`);
  }
}

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const label = file.includes("player_mesh") ? "player" : "runtime";

  ok(!text.includes("THREE.RGBFormat"), `${label} no longer references removed THREE.RGBFormat`);
  ok(text.includes("THREE.RGBAFormat"), `${label} uses supported THREE.RGBAFormat`);
  ok(text.includes("MeshToonMaterial samples this nearest-filtered ramp"), `${label} explains why the toon ramp is RGBA`);
  ok(/new Uint8Array\(\[\s*\d+, \d+, \d+, 255,\s*\d+, \d+, \d+, 255,\s*\d+, \d+, \d+, 255,\s*255, 255, 255, 255,\s*\]\)/s.test(text), `${label} toon ramp has four RGBA pixels`);
  ok(text.includes("new THREE.DataTexture("), `${label} still uses Three.js DataTexture for toon ramp`);
}

for (const file of files) {
  const result = childProcess.spawnSync(
    "node",
    ["-e", `require('typescript').transpileModule(require('fs').readFileSync(${JSON.stringify(file)}, 'utf8'), { compilerOptions: { jsx: require('typescript').JsxEmit.React, target: require('typescript').ScriptTarget.ES2020, module: require('typescript').ModuleKind.CommonJS }, reportDiagnostics: true }).diagnostics?.forEach(d => { if (d.category === 1) { console.error(d.messageText); process.exitCode = 1; } });`],
    { cwd: root, stdio: "inherit" }
  );
  ok(result.status === 0, `${path.basename(file)} TypeScript parse diagnostics are clean`);
}

if (failed) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
