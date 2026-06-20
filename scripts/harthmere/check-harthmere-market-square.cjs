#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const file = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(file, "utf8");

const checks = [
  ["version constant exists", /HARTHMERE_MARKET_SQUARE_IDENTITY_VERSION/],
  ["fountain detail asset is registered", /gltf\("fountain_round_detail"/],
  ["fountain center asset is registered", /gltf\("fountain_center"/],
  ["stall stool asset is registered", /gltf\("stall_stool"/],
  ["cheese market food asset is registered", /obj\("cheese"/],
  ["Bridge Fountain detail is placed", /Bridge Fountain carved rim detail/],
  ["Bridge Fountain center marker is placed", /Bridge Fountain center stone marker/],
  ["fountain social benches are placed", /Fountain social bench west[\s\S]*Fountain social bench east[\s\S]*Fountain social bench south/],
  ["harvest fair banners are placed", /Harvest Fair red plaza banner[\s\S]*Harvest Fair green plaza banner[\s\S]*Harvest Fair yellow plaza banner/],
  ["produce stall has supported tabletop samples", /Apple sample supported on produce table[\s\S]*Green apple sample supported on produce table[\s\S]*Carrot sample supported on produce table/],
  ["food samples are on valid market surfaces", /Bread sample supported on market table[\s\S]*Cheese sample supported on market table/],
  ["butcher shelf reinforces market food identity", /Butcher shelf beside food stall with supported meat/],
  ["cloth stall has category display", /Cloth and dye display counter[\s\S]*Blue cloth bolt supported on display counter[\s\S]*White cloth bolt supported on display counter[\s\S]*Brown cloth bolt supported on display counter/],
  ["travel goods stall has category display", /Travel goods display counter[\s\S]*Rope coil supported on travel goods counter[\s\S]*Lantern supported on travel goods counter/],
  ["livestock pen is at market edge", /Livestock pen west rail at market edge[\s\S]*Livestock pen east rail at market edge[\s\S]*Livestock pen north rail at market edge/],
  ["public stocks marker is present", /Public stocks and justice event marker/],
  ["puppet show performance platform is present", /Puppet show performance platform/],
  ["merchant dispute and price riot anchor is present", /Merchant dispute and price riot event notice/],
  ["harvest fair overflow props are present", /Harvest Fair overflow supply crate[\s\S]*Seasonal market booth supply crate/],
  ["town crier is placed", /Town crier at Bridge Fountain/],
  ["market performer is placed", /Market performer puppet show/],
  ["pickpocket child route is placed", /Pickpocket child chase route/],
  ["three category merchants are placed", /Produce vendor behind stall[\s\S]*Cloth merchant behind stall[\s\S]*Travel goods merchant behind stall/],
  ["market livestock animals are placed", /Market livestock chicken[\s\S]*Market livestock sheep/],
  ["Mara Thistle remains in Market Square", /Mara Thistle market guide/],
  ["market guard remains in Market Square", /Market square guard patrol/],
  ["market notice kiosk remains in Market Square", /Quest and notice kiosk/],
];

let failed = 0;
for (const [label, pattern] of checks) {
  if (pattern.test(src)) {
    console.log(`OK ${label}`);
  } else {
    failed += 1;
    console.log(`FAIL ${label}`);
  }
}

const forbiddenBlockingNames = [
  /P\([^\n]+"Market Square"[^\n]+"Blocked main market lane/i,
  /P\([^\n]+"Market Square"[^\n]+"Doorway blocker/i,
];
for (const pattern of forbiddenBlockingNames) {
  if (pattern.test(src)) {
    failed += 1;
    console.log("FAIL market patch introduced an explicitly named blocker");
  }
}

if (failed) {
  console.log(`\nRESULT: FAIL (${failed} checks failed)`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
