#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const file = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(file, "utf8");

const checks = [
  ["version constant exists", /HARTHMERE_PLAYER_SERVICES_PLAZA_VERSION/],
  ["Player Services Hall remains present", /Player Services Hall/],
  ["service signpost names all core utilities", /Player Services bank mail auction storage signpost/],
  ["bank and storage banner is placed", /Bank and storage green service banner/],
  ["auction and guild banner is placed", /Auction and guild blue service banner/],
  ["entrance lamps are placed without blocking doorway", /Player Services entrance lamp west[\s\S]*Player Services entrance lamp east/],
  ["bank counter has supported ledger/key/coin props", /Bank ledger supported on bank teller counter[\s\S]*Vault key ring supported on bank teller counter[\s\S]*Second coin pile supported on bank teller counter/],
  ["bank vault has reinforced lockbox identity", /Reinforced vault chest behind bank line[\s\S]*Vault spare key supported on vault desk/],
  ["storage steward service anchor exists", /Storage steward counter[\s\S]*Storage claim book supported on steward counter[\s\S]*Storage upgrade chest beside steward/],
  ["mail sorting service anchor exists", /Mail sorting counter[\s\S]*Courier mailbox parcel wall[\s\S]*Outgoing mail crate on floor/],
  ["mail paperwork is on supported surface", /Sealed letter supported on mail sorting counter[\s\S]*Courier manifest supported on mail sorting counter/],
  ["auction trade board service anchor exists", /Auction trade board with listing notices[\s\S]*Market ledger supported on auction clerk desk[\s\S]*Auction listing fee coin supported on clerk desk/],
  ["auction escrow lockbox is placed", /Auction escrow lockbox on floor/],
  ["guild registrar service anchor exists", /Guild registrar counter[\s\S]*Guild creation charter book supported on registrar counter[\s\S]*Guild charter parchment supported on registrar counter/],
  ["cosmetic wardrobe service anchor exists", /Cosmetic wardrobe mirror polished shield frame[\s\S]*Cosmetic wardrobe station cabinet[\s\S]*Wardrobe dye and outfit chest/],
  ["wardrobe sample item is supported", /Wardrobe sample cloak supported on outfit chest/],
  ["queue ropes reserve a safe customer lane", /Queue rope west of services plaza[\s\S]*Queue rope east of services plaza/],
  ["Courier Anwen remains placed", /Courier Anwen mail loop/],
  ["Banker Merl Voss is placed", /Banker Merl Voss bank access/],
  ["Auction Clerk Pell is placed", /Auction Clerk Pell trade board/],
  ["Storage Steward is placed", /Storage Steward account storage/],
  ["Guild Registrar is placed", /Guild Registrar guild creation/],
  ["Cosmetic Wardrobe Attendant is placed", /Cosmetic Wardrobe Attendant outfit station/],
  ["Services plaza guard remains placed", /Services plaza guard/],
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
  /P\([^\n]+"Player Services"[^\n]+"Blocked service doorway/i,
  /P\([^\n]+"Player Services"[^\n]+"Doorway blocker/i,
  /A\([^\n]+"Player Services"[^\n]+"Blocking service entrance/i,
];
for (const pattern of forbiddenBlockingNames) {
  if (pattern.test(src)) {
    failed += 1;
    console.log("FAIL player services patch introduced an explicitly named blocker");
  }
}

if (failed) {
  console.log(`\nRESULT: FAIL (${failed} checks failed)`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
