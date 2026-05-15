#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const file = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(file, "utf8");

const checks = [
  ["version constant exists", /HARTHMERE_COPPER_KETTLE_INN_VERSION/],
  ["Copper Kettle building shell remains present", /Copper Kettle Inn/],
  ["exterior sign advertises room rental", /Copper Kettle Inn signpost with room rental and food notices/],
  ["copper kettle sign symbol exists", /Copper kettle hanging sign symbol supported below inn sign/],
  ["warm entrance lamps are placed", /Warm inn entrance lamp west of door[\s\S]*Warm inn entrance lamp east of door/],
  ["chimney smoke marker reinforces inn silhouette", /Copper Kettle roof chimney smoke marker/],
  ["hearth has kettle fire water and firewood support", /Copper kettle resting over hearth on floor stones[\s\S]*Wall-mounted hearth fire bracket[\s\S]*Hearth water bucket on floor[\s\S]*Firewood stack beside hearth/],
  ["lighting includes chandelier and wall lanterns", /Main tavern chandelier hanging from ceiling beam[\s\S]*Wall-mounted lantern by tavern room stairs[\s\S]*Wall-mounted lantern behind tavern bar/],
  ["rumor/group finder board exists", /Rumor board and group finder flavor board beside hearth[\s\S]*Pinned rumor note supported on rumor board shelf[\s\S]*Group finder contract supported on rumor board shelf/],
  ["bard stage is playable and readable", /Raised bard stage platform along tavern wall[\s\S]*Bard stool supported on stage platform[\s\S]*Stage mug supported on bard platform/],
  ["first dining table has supported food and dishes", /Plate supported on first dining table[\s\S]*Mug supported on first dining table[\s\S]*Cake supported on first dining table[\s\S]*Knife supported on first dining table/],
  ["second dining table has supported food and dishes", /Plate supported on second dining table[\s\S]*Full mug supported on second dining table[\s\S]*Bread loaf supported on second dining table[\s\S]*Spoon supported on second dining table/],
  ["dice table has wagering details", /Dice wager coin supported on dice table[\s\S]*Empty mug supported on dice table[\s\S]*House dice ledger supported on dice table/],
  ["rented room supports bind/rested XP", /Rented room bed for rested XP[\s\S]*Rented room nightstand beside bed[\s\S]*Rested XP candle supported on rented room nightstand[\s\S]*Room rental storage chest on floor[\s\S]*Bind point room rental cloth marker supported over chest/],
  ["cellar mystery hook exists", /Locked Copper Kettle cellar door for secret meetings[\s\S]*Cellar supply crate beside locked door[\s\S]*Cellar ale barrel holder against wall/],
  ["audience/social seating exists", /Audience bench facing bard stage[\s\S]*Loose tavern stool facing bard stage/],
  ["secret/fugitive story hook exists", /Fugitive hiding chest beside back wall[\s\S]*Secret meeting note supported on fugitive chest/],
  ["Elowen is explicitly the innkeeper/service NPC", /Elowen Pike innkeeper bind point rested XP tavern loop/],
  ["bard NPC is placed", /Copper Kettle bard stage performer/],
  ["cook NPC is placed", /Copper Kettle cook serving food buffs/],
  ["server NPC is placed", /Copper Kettle server carrying drinks/],
  ["dice gambler NPC is placed", /Dice gambler at Copper Kettle table/],
  ["traveling quest NPC is placed", /Traveling quest NPC reading rumor board/],
  ["tavern patron NPC is placed", /Tavern patron listening to bard/],
  ["tavern cat remains placed", /Tavern cat/],
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
  /P\([^\n]+"Copper Kettle"[^\n]+"Blocked inn doorway/i,
  /P\([^\n]+"Copper Kettle"[^\n]+"Doorway blocker/i,
  /A\([^\n]+"Copper Kettle"[^\n]+"Blocking inn entrance/i,
];
for (const pattern of forbiddenBlockingNames) {
  if (pattern.test(src)) {
    failed += 1;
    console.log("FAIL copper kettle patch introduced an explicitly named blocker");
  }
}

if (failed) {
  console.log(`\nRESULT: FAIL (${failed} checks failed)`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
