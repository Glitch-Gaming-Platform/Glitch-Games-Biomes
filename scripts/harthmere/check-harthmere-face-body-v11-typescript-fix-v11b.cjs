#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const files = {
  assets: path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"),
  player: path.join(root, "src/client/game/scripts/player.ts"),
  registry: path.join(root, "src/shared/harthmere/town_registry.ts"),
};

let failed = false;
const read = (file) => fs.readFileSync(file, "utf8");
const check = (label, ok) => {
  if (ok) {
    console.log(`OK ${label}`);
  } else {
    failed = true;
    console.log(`FAIL ${label}`);
  }
};

for (const [name, file] of Object.entries(files)) {
  check(`${name} file exists`, fs.existsSync(file));
}
if (failed) process.exit(1);

const assets = read(files.assets);
const player = read(files.player);
const registry = read(files.registry);

check("runtime debug vector uses instanceof narrowing", assets.includes("values instanceof THREE.Vector3 ? values.toArray() : values"));
check("runtime debug vector map has typed value", assets.includes("array.map((value: number) => harthmereTownDebugRound(Number(value)))"));
check("debug window has town lod stats type", assets.includes("__harthmereTownLodStats?: Record<string, unknown>;"));
check("debug window has town registry type", assets.includes("__harthmereTownRegistry?: Record<string, unknown>;"));
check("debug window has collision query type", assets.includes("__harthmereTownCollisionQuery?: Record<string, unknown>;"));
check("runtime position map has unknown parameter", assets.includes("runtime.position.map((value: unknown) => Number(value))"));
check("runtime forward map has unknown parameter", assets.includes("runtime.forward.map((value: unknown) => Number(value)).slice(0, 2)"));
check("Box3Helper receives THREE.Color", assets.includes("const color = new THREE.Color(report.flags.length > 0 ? 0xff3333 : 0x33ccff);"));
check("walk debug vec uses instanceof narrowing", assets.includes("const arr: readonly number[] = value instanceof THREE.Vector3 ? value.toArray() : value;"));
check("walk debug vec map has typed entry", assets.includes("arr.map((entry: number) => round(Number(entry)))"));
check("player x velocity uses scalar epsilon comparison", player.includes("Math.abs(townSafePosition[0] - edgeSafePosition[0]) < 0.0001"));
check("player z velocity uses scalar epsilon comparison", player.includes("Math.abs(townSafePosition[2] - edgeSafePosition[2]) < 0.0001"));
check("player no scalar approxEquals misuse", !player.includes("approxEquals(townSafePosition[0], edgeSafePosition[0])") && !player.includes("approxEquals(townSafePosition[2], edgeSafePosition[2])"));
check("town registry tags are string typed", registry.includes("const tags: string[] = [kind, lodTier, districtId];"));
check("old readonly array toArray narrowing is gone", !assets.includes("Array.isArray(values) ? values : values.toArray()") && !assets.includes("Array.isArray(value) ? value : value.toArray()"));

if (failed) {
  console.log("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
