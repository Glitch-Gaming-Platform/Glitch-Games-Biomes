#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const rel = "src/client/game/renderers/local_dev/harthmere_assets.ts";
const full = path.join(root, rel);

const text = fs.readFileSync(full, "utf8");

let ok = true;

function check(label, condition) {
  console.log(`${condition ? "OK" : "FAIL"} ${label}`);
  if (!condition) ok = false;
}

check("fix marker exists", text.includes("harthmere-fix-debug-renderer-call-v1"));
check("no this.debugHarthmereRenderer calls remain", !text.includes("this.debugHarthmereRenderer("));
check("standalone debugHarthmereRenderer call exists", text.includes("debugHarthmereRenderer("));
check("physical sanitize debug still present", text.includes("renderer.combat_event.physical_sanitize"));

console.log("");
console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
