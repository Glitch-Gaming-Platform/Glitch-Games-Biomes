#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const file = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(file, "utf8");

const checks = [
  ["version constant exists", /HARTHMERE_NOBLE_RISE_VERSION/],
  ["Reeve Hall building shell remains present", /Reeve Hall/],
  ["raised terrace stair marks elevated district", /Noble Rise raised terrace stair from market road/],
  ["estate pillars mark restricted wealthy approach", /Noble Rise west estate pillar marking restricted approach[\s\S]*Noble Rise east estate pillar marking restricted approach/],
  ["brass approach lamps mark clean noble route", /Noble Rise brass approach lamp west[\s\S]*Noble Rise brass approach lamp east/],
  ["court permit tax sign exists", /Reeve Hall court permit tax office sign/],
  ["green red white banners create noble authority palette", /Clean green shutter banner on Reeve Hall west face[\s\S]*Red town authority banner on Reeve Hall east face[\s\S]*White legal notice cloth under Reeve Hall balcony/],
  ["roof windows and chimney create wealthy skyline variety", /Reeve Hall west roof window for wealthy skyline variety[\s\S]*Reeve Hall east roof window for wealthy skyline variety[\s\S]*Reeve Hall polished chimney top/],
  ["private garden fountain and benches exist", /Noble private garden fountain beside court approach[\s\S]*Noble petition bench beside private garden[\s\S]*Noble waiting bench beside private garden/],
  ["garden and servant side path are readable", /Noble garden clipped hedge north edge[\s\S]*Noble garden clipped hedge south edge[\s\S]*Noble servant side path hedge[\s\S]*Servant entrance and deliveries sign behind Reeve Hall/],
  ["tax protest exterior event anchor exists", /Tax protest assembly notice outside Reeve Hall[\s\S]*Tax protest placard crate on floor outside court[\s\S]*Pinned tax protest placard supported on protest crate/],
  ["balcony remains and has lamps", /Reeve Hall balcony[\s\S]*Reeve Hall balcony fence[\s\S]*Wall lamp mounted beside Reeve Hall balcony west[\s\S]*Wall lamp mounted beside Reeve Hall balcony east/],
  ["petition desk and permit clerk counter are supported", /Petition intake desk centered below Reeve Hall balcony[\s\S]*Petition form supported on intake desk[\s\S]*Permit clerk counter for charters and town papers[\s\S]*Town permit scroll supported on permit counter/],
  ["moneylender table has debt props", /Edrik Vane moneylender debt ledger table[\s\S]*Debt payment coins supported on moneylender table[\s\S]*Debt note supported on Edrik Vane table[\s\S]*Pawn lockbox key supported on moneylender table[\s\S]*Moneylender secured pawn chest on floor beside table/],
  ["legal archive and court docket exist", /Legal archive shelf against Reeve Hall rear wall[\s\S]*Town charter books supported on legal archive shelf[\s\S]*Legal record books supported on legal archive shelf[\s\S]*Court docket and audit notice board/],
  ["audit notice and tax chest details exist", /Distant lord audit notice supported on board[\s\S]*Tax chest key supported on tax chest lid[\s\S]*Loose tax coin supported on tax chest lid/],
  ["tax and merchant compact desks have supported documents", /Tax assessment supported on tax clerk desk[\s\S]*Merchant Compact ledger stack supported on decorated desk[\s\S]*Masked party invitation cloth supported on compact desk/],
  ["interior waiting benches and elite guard wall props exist", /Petitioner waiting bench inside Reeve Hall[\s\S]*Merchant Compact waiting bench inside Reeve Hall[\s\S]*Elite guard ceremonial shield mounted near entrance[\s\S]*Elite guard ceremonial blade mounted near entrance/],
  ["Reeve Caldus Merrow is placed", /Reeve Caldus Merrow balcony petitioner hearing/],
  ["Edrik Vane is placed", /Edrik Vane moneylender debt records/],
  ["permit clerk is placed", /Permit clerk issuing town charters/],
  ["tax collector is placed", /Tax collector checking assessment desk/],
  ["legal archivist is placed", /Legal archivist guarding town records/],
  ["elite guards are placed", /Elite Reeve Hall guard west post[\s\S]*Elite Reeve Hall guard east post/],
  ["petitioner and protest organizer are placed", /Noble petitioner waiting near garden[\s\S]*Tax protest organizer outside Reeve Hall/],
  ["servant delivery runner and audit envoy are placed", /Servant delivery runner on Noble side path[\s\S]*Distant lord audit envoy inspecting records/],
  ["existing noble servant and guard loops remain", /Noble servant walking loop[\s\S]*Noble guard walking post/],
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
  /Noble Rise[^\n]+Blocked doorway/i,
  /Noble Rise[^\n]+Doorway blocker/i,
  /Noble Rise[^\n]+Entrance blocker/i,
];
for (const pattern of forbidden) {
  if (pattern.test(src)) {
    failed += 1;
    console.log("FAIL noble patch introduced an explicitly named doorway blocker");
  }
}

if (failed) {
  console.log(`\nRESULT: FAIL (${failed} checks failed)`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
