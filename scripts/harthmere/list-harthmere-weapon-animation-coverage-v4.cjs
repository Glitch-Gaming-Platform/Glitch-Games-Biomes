#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const manifestPath = path.join(root, "public/assets/harthmere/equipment_animations/equipment-animation-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const entries = manifest.entries || [];
const groups = { weapons: [], ranged: [], magic: [], shields: [] };
for (const entry of entries) {
  if (groups[entry.category]) groups[entry.category].push(entry.id);
}
console.log("== Harthmere weapon animation coverage list v4 ==");
console.log(`Root: ${root}`);
for (const [category, ids] of Object.entries(groups)) {
  console.log(`\n${category.toUpperCase()} (${ids.length})`);
  for (const id of ids) console.log(`- ${id}`);
}
console.log(`\nTOTAL WEAPON-LIKE EQUIPMENT: ${Object.values(groups).flat().length}`);
