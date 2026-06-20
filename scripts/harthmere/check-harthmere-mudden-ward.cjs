#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const file = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(file, "utf8");

const checks = [
  ["version constant exists", /HARTHMERE_MUDDEN_WARD_VERSION/],
  ["base Mudden homes remain", /Mudden Lean-To Home[\s\S]*Mudden Wash House/],
  ["patched roof identity exists", /Mudden patched lean-to roof left scrap[\s\S]*Mudden patched lean-to roof right scrap[\s\S]*Canvas roof patch tied over Mudden lean-to/],
  ["leaning support and broken wall identity exist", /Leaning broken wall brace beside Mudden lean-to[\s\S]*Crooked timber post supporting sagging alley line/],
  ["laundry line and wash house detail exist", /Laundry line tied between Mudden houses[\s\S]*Washed cloth hanging from Mudden laundry line[\s\S]*Back-alley laundry rope tied to wash house[\s\S]*Pale laundry sheet hanging in wash-house lane/],
  ["mud, smoke, and poor-house props exist", /Small smoky cookfire at Mudden alley edge[\s\S]*Water bucket beside smoky cookfire[\s\S]*Dark mud puddle proxy in low alley[\s\S]*Rain puddle proxy beside wash house/],
  ["warning and healer boards exist", /Mudden Ward warning sign poverty flood disease[\s\S]*Eviction notice pinned to Mudden warning sign[\s\S]*Washerwomen work board and cheap healer notice/],
  ["hidden tunnel route exists", /Hidden tunnel access under broken laundry cart[\s\S]*Broken laundry cart hiding tunnel edge[\s\S]*Dim underways marker torch near Mudden tunnel[\s\S]*Old carved drain stone beside hidden tunnel/],
  ["cheap healer station has supported props", /Cheap healer street table[\s\S]*Cheap healer fever tonic supported on table[\s\S]*Cheap healer green bottle supported on table[\s\S]*Sick traveler cot in Mudden cheap healer corner/],
  ["fence vendor station has supported props", /Fence vendor hidden deal table[\s\S]*Fence vendor coin pile supported on hidden table[\s\S]*Illegal blade supported on fence vendor table[\s\S]*Stolen key supported on fence vendor table[\s\S]*Fence vendor lockbox on floor/],
  ["rat-catcher content exists", /Rat-catcher live cage on floor[\s\S]*Second rat-catcher cage beside drain[\s\S]*Rat bait cheese on floor near trap/],
  ["washerwoman station exists", /Washerwoman rinse bucket on floor[\s\S]*Washerwoman rain barrel on floor[\s\S]*Washerwoman folding table[\s\S]*Folded laundry cloth supported on table/],
  ["orphan and Mudden Kin content exist", /Orphan blanket bundle on floor[\s\S]*Half meal beside orphan blanket[\s\S]*Mudden Kin reputation stash chest[\s\S]*Mudden Kin favor list supported on stash chest[\s\S]*Mudden Kin hidden reputation vendor mark/],
  ["flood rescue event anchor exists", /Flood rescue barrel stack kept against wall[\s\S]*Flood rescue rope supported on barrel stack[\s\S]*Flood bucket-line bucket on floor[\s\S]*Flood rescue muster notice/],
  ["missing children and witch accusation event anchor exists", /Witch accusation and missing children notice[\s\S]*Missing children notice supported on accusation board[\s\S]*Small vigil candle beside missing children notice/],
  ["stealth route readability exists", /Stealth trainer crate step to back route[\s\S]*Back-route rope showing climbable shortcut/],
  ["existing Nessa and guard remain", /Mudden Ward foot patrol[\s\S]*Nessa Crowe alley loop/],
  ["cheap healer and fence vendor actors are placed", /Mudden cheap healer tending fever cot[\s\S]*Mudden fence vendor hidden table/],
  ["rat catcher, washerwoman, orphan actors are placed", /Mudden rat-catcher checking cages[\s\S]*Mudden washerwoman working wash line[\s\S]*Mudden orphan child blanket corner/],
  ["Mudden Kin, debt collector, flood volunteer are placed", /Mudden Kin reputation vendor at stash[\s\S]*Debt collector serving eviction notice[\s\S]*Flood rescue volunteer by bucket line/],
  ["Mudden animals add life and threat readability", /Mudden rat swarm near cages[\s\S]*Mudden alley cat watching laundry/],
  ["Old Well drain breadcrumb remains", /Old drain iron hatch[\s\S]*Mounted Underways warning torch[\s\S]*Old drain marker/],
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

const forbidden = [
  /Mudden Ward[^\n]+Blocked doorway/i,
  /Mudden Ward[^\n]+Doorway blocker/i,
  /Mudden Ward[^\n]+Entrance blocker/i,
  /Mudden Ward[^\n]+Blocks alley spine/i,
];
for (const pattern of forbidden) {
  if (pattern.test(src)) {
    failed += 1;
    console.log("FAIL mudden ward patch introduced an explicitly named blocker");
  }
}

const usedAssets = Array.from(src.matchAll(/\b[PA]\(\s*"([^"]+)"/g)).map((m) => m[1]);
const registered = new Set(Array.from(src.matchAll(/\b(?:gltf|fbx|obj)\(\s*"([^"]+)"/g)).map((m) => m[1]));
const missing = Array.from(new Set(usedAssets.filter((asset) => !registered.has(asset)))).sort();
if (missing.length) {
  failed += 1;
  console.log(`FAIL unregistered placement assets: ${missing.join(", ")}`);
}

if (failed) {
  console.log(`\nRESULT: FAIL (${failed} checks failed)`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
