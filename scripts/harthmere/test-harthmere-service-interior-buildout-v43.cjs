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

const requiredInteriorLabels = [
  "bakery oven/counter supported on stone floor",
  "provision goods shelf against stone wall",
  "bank auction mail counter supported on stone floor",
  "smithy anvil on stone forge floor",
  "carpenter tailor workbench supported on stone floor",
  "apothecary mortar mixing counter on stone floor",
  "magic spellbook case against west stone wall",
  "inn dining table supported on stone floor",
  "reeve legal desk supported on stone civic floor",
  "dock cargo crate on warehouse floor",
  "mudden sleeping pallet on stone floor",
  "wash house bucket on stone floor",
  "residential cottage bed against wall",
  "barracks bunk one against wall",
  "stable ledger desk on stone floor",
  "chapel pulpit altar supported on stone floor",
];
for (const label of requiredInteriorLabels) {
  check(`interior buildout includes ${label}`, src.includes(label));
}

check("interior builder switch covers bakery", /case "bakery":/.test(src));
check("interior builder switch covers chapel", /case "chapel":/.test(src));
check("all service interior props are routed through block-built v43 label", src.includes("block-built v43 service interior"));

process.exit(ok ? 0 : 1);
