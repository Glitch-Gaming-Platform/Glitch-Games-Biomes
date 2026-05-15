#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = process.argv[2] || process.cwd();
const file = path.join(repo, "public/harthmere-debug/harthmere-collision-mapper-v1.js");
let ok = true;
function check(label, cond) {
  if (cond) console.log(`OK ${label}`);
  else { console.error(`FAIL ${label}`); ok = false; }
}

check("collision mapper JS exists", fs.existsSync(file));
const src = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
check("version marker exists", src.includes("harthmere-collision-mapper-v1"));
check("nearest distance helper exists", src.includes("function nearest"));
check("auto stop sampler exists", src.includes("auto-stop:"));
check("HUD helper exists", src.includes("showHud"));
check("download helper exists", src.includes("download"));
check("global helper exists", src.includes("window.__harthmereCollisionMapper"));

console.log();
if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
