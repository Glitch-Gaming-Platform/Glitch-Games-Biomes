#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = path.resolve(process.argv[2] || process.cwd());
const combat = path.join(repo, "src/client/components/challenges/LocalDevHarthmereCombat.tsx");

function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${msg}`);
  }
}

const text = fs.readFileSync(combat, "utf8");

ok(text.includes("Iron Longsword Slash"), "combat labels basic sword attack as longsword");
ok(text.includes("Heavy Iron Longsword Slash"), "combat labels heavy sword attack as longsword");
ok(!text.includes("Training Dagger Strike"), "combat no longer labels B attack as training dagger strike");
ok(!text.includes("Heavy Training Dagger Strike"), "combat no longer labels N attack as heavy training dagger strike");
ok(text.includes("normalizeHarthmereVisibleAttackLabel"), "combat has visible attack label normalizer");
ok(text.includes("display-label normalization only"), "future-dev comment explains label-only normalization");

if (!process.exitCode) {
  console.log("\nRESULT: PASS");
}
