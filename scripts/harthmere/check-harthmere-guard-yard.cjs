#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const file = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(file, "utf8");

const checks = [
  ["version constant exists", /HARTHMERE_GUARD_YARD_VERSION/],
  ["base Guard Barracks and core yard remain", /Guard Barracks[\s\S]*Training dummy[\s\S]*Bounty table[\s\S]*Training weapon stand[\s\S]*Training rack/],
  ["Guard Yard wayfinding sign exists", /Guard Yard combat training bounty board wayfinding sign[\s\S]*Training notice supported on Guard Yard sign[\s\S]*Bounty notice supported on Guard Yard sign/],
  ["training lane and three dummies exist", /Packed-earth training lane plank marker[\s\S]*Forward-arc melee training dummy left[\s\S]*Forward-arc melee training dummy center[\s\S]*Forward-arc melee training dummy right/],
  ["training lane boundaries exist", /Training lane west boundary fence[\s\S]*Training lane east boundary fence/],
  ["bounty clerk station has supported props", /Bounty clerk warrant desk[\s\S]*Wolf bounty warrant supported on bounty desk[\s\S]*Bandit bounty warrant supported on bounty desk[\s\S]*Bounty reward coins supported on warrant desk/],
  ["bounty board exists", /Bounty board patrol dailies and road warrants[\s\S]*Pinned road warrant supported on bounty board/],
  ["prisoner holding and escape hook exist", /Prisoner holding cage for escape event[\s\S]*Jail key supported on prisoner cage hook[\s\S]*Confiscated prisoner gear chest on floor[\s\S]*Prisoner transfer note supported on gear chest/],
  ["dueling ring exists", /Dueling ring north rope marker[\s\S]*Dueling ring south rope marker[\s\S]*Dueling ring west rope marker[\s\S]*Dueling ring east rope marker/],
  ["PvP opt-in warning exists", /Dueling ring PvP opt-in warning notice[\s\S]*PvP opt-in warning supported on duel sign/],
  ["alarm bell and watchtower identity exist", /Guard Yard alarm bell invasion rally point[\s\S]*Guard Yard watchtower lookout silhouette[\s\S]*Watchtower stair access for guard roof repair[\s\S]*Red watch banner mounted on Guard Yard tower/],
  ["town defense staging props exist", /Town defense shield barrel stack at yard edge[\s\S]*Defense shield supported on barrel stack[\s\S]*Barricade repair kit crate on floor[\s\S]*Barricade rope supported on repair kit crate/],
  ["quartermaster station has supported props", /Quartermaster armory issue counter[\s\S]*Starter sword supported on quartermaster counter[\s\S]*Training shield supported on quartermaster counter[\s\S]*Quartermaster issue ledger supported on counter/],
  ["inspection roster exists", /Guard inspection roster and drill schedule[\s\S]*Pinned inspection roster supported on drill board/],
  ["prisoner escape alert banner exists", /Prisoner escape event red alert banner/],
  ["Sergeant Bram is placed in Guard Yard", /Sergeant Bram Holt combat onboarding guard faction/],
  ["drill instructor and bounty clerk are placed", /Drill instructor calling training dummy drills[\s\S]*Bounty clerk processing patrol dailies/],
  ["quartermaster and sparring guards are placed", /Guard Yard quartermaster armory service[\s\S]*Sparring guard dueling ring left[\s\S]*Sparring guard dueling ring right/],
  ["prisoner and duel witness are placed", /Captured bandit prisoner escape event hook[\s\S]*Duel challenge guard PvP opt-in witness/],
  ["watchtower sentry and defense runner are placed", /Watchtower stair sentry roof repair lookout[\s\S]*Town defense runner checking barricade kit/],
  ["existing Guard Yard patrol remains", /Guard patrol around yard/],
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
  /Guard Yard[^\n]+Blocked doorway/i,
  /Guard Yard[^\n]+Doorway blocker/i,
  /Guard Yard[^\n]+Entrance blocker/i,
  /Guard Yard[^\n]+Blocks training lane/i,
  /Guard Yard[^\n]+Blocks barracks/i,
];
for (const pattern of forbidden) {
  if (pattern.test(src)) {
    failed += 1;
    console.log("FAIL guard yard patch introduced an explicitly named blocker");
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
