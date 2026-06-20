#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const src = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.error(`FAIL ${label}`); ok = false; }
}

check("service stair max rise constant exists", src.includes("HARTHMERE_SERVICE_BLOCK_STAIR_MAX_RISE = 0.42"));
check("service stair min tread constant exists", src.includes("HARTHMERE_SERVICE_BLOCK_STAIR_MIN_TREAD = 0.74"));
check("service block stair function exists", src.includes("createHarthmereServiceBlockStairRun"));
check("service stairs are built from stone wall blocks", /createHarthmereServiceBlockStairRun[\s\S]*"arch_wall_stone"/.test(src));
check("service stair label names player npc accessibility", src.includes("player npc accessible"));

const multiStory = [
  "Player Services Hall",
  "Copper Kettle Inn",
  "Reeve Hall",
  "Guard Barracks",
  "Chapel of Saint Verena",
];
for (const name of multiStory) {
  const index = src.indexOf(`name: "${name}"`);
  const block = index >= 0 ? src.slice(index, src.indexOf("}),", index) + 3) : "";
  check(`${name} declares two floors requiring block stairs`, block.includes("floors: 2"));
}
check("generator adds stair run for every non-top floor", /if \(floor < floors\) \{\s*placements\.push\(\.\.\.createHarthmereServiceBlockStairRun/.test(src));

process.exit(ok ? 0 : 1);
