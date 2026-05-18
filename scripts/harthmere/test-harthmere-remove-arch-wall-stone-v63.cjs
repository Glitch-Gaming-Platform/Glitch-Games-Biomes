#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const file = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(file, "utf8");

function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${message}`);
  }
}

ok(src.includes("HARTHMERE_REMOVE_ARCH_WALL_STONE_RUNTIME_VERSION_V63"), "v63 runtime removal marker exists");
ok(src.includes('return placement.asset === "arch_wall_stone";'), "arch_wall_stone is removed at runtime only");
ok(src.includes("placementsWithoutRemovedAssetsV63"), "runtime placements filter out removed assets before performance filtering");
ok(!src.includes("arch_wall_stone -> mine_stone_01"), "no arch_wall_stone replacement marker exists");
ok(!src.includes("new = new.replace(TARGET, REPLACEMENT)"), "bad global replacement logic is not in source");

if (process.exitCode) process.exit(process.exitCode);
