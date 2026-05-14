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

const handlerStart = text.indexOf("harthmere-rebuilt-combat-effect-handler-v1");
const handlerEnd = text.indexOf("\n  private registerCombatLife(", handlerStart);
const handler = handlerStart >= 0 && handlerEnd > handlerStart
  ? text.slice(handlerStart, handlerEnd)
  : "";

check("rebuilt combat effect handler exists", handler.length > 0);
check("safe training dummy proxy marker exists", text.includes("harthmere-training-dummy-visual-proxy-v2"));
check("proxy handles only offset 9001", handler.includes("if (offset === 9001)"));
check("proxy uses existing guard-yard actor", handler.includes('this.findCombatLife("Guard patrol around yard")'));
check("strict offset matching remains for all other offsets", handler.includes("return this.findCombatLifeByOffset(offset);"));
check("old inserted 9001 placement marker removed", !text.includes("harthmere-training-dummy-combat-actor-v1"));
check("old inserted Guard Yard Training Dummy placement removed", !/A\("townsperson_guard"[\s\S]*?"Guard Yard Training Dummy"[\s\S]*?9001\)/.test(text));
check("target debug reports trainingDummyProxy", text.includes("trainingDummyProxy"));
check("physical routing remains", handler.includes("harthmereNoSparkBasic") && handler.includes("withoutMagicClips"));
check("Spark remains explicit magic", handler.includes('String(detail.ability ?? "").toLowerCase() === "spark"'));
check("no this.debugHarthmereRenderer calls remain", !text.includes("this.debugHarthmereRenderer("));

console.log("");
console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
