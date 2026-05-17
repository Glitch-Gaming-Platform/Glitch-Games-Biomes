#!/usr/bin/env node
const {
  economySource,
  exists,
  read,
  checkFactory,
} = require("./harthmere-economy-optimization-test-lib-v1.cjs");

const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();

console.log("== test-harthmere-loot-drop-rarity-economy-v1 ==");
console.log(`Root: ${root}`);
console.log("");

const src = exists(root, "src/client/components/challenges/LocalDevHarthmereEconomyOptimizationSystem.tsx")
  ? economySource(root)
  : "";
const suite = exists(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  ? read(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  : "";


for (const rarity of ["common", "uncommon", "rare", "epic", "legendary", "artifact"]) {
  check(`drop rarity includes ${rarity}`, src.includes(`"${rarity}"`));
}
for (const field of ["enemy type", "enemy level", "enemy rank", "region", "faction", "rarity chances", "material drops", "currency drops", "quest drops", "unique drops", "player level restrictions", "daily/weekly lockouts"]) {
  check(`loot table field exists: ${field}`, src.includes(field));
}
check("logical enemy loot examples exist", src.includes("wolf_hide") && src.includes("stolen_ring") && src.includes("grave_dust"));
check("bad loot examples are explicitly rejected", src.includes("rat drops legendary sword") && src.includes("wolf drops plate armor"));
check("binding controls market flooding", src.includes("bindingControlsMarketFlooding: true"));


finish();
