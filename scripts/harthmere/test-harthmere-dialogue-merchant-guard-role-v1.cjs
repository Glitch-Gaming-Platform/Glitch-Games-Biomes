#!/usr/bin/env node
const { checkFactory, ruleSource } = require("./harthmere-dialogue-rule-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const src = ruleSource(root);
const { check, finish } = checkFactory();
console.log("== Harthmere merchant/guard/role dialogue tests v1 ==");
console.log(`Root: ${root}`);
console.log("");
for (const role of ["merchant", "fence", "guard", "priest", "scholar", "peasant", "noble"]) {
  check(`role menu exists: ${role}`, src.includes(`${role}: [`));
  check(`role greeting pool exists: ${role}`, src.includes(`${role}: [`));
}
check("merchant has goods option", src.includes("Show me your goods."));
check("merchant has repair option", src.includes("Can you repair my equipment?"));
check("guard has directions option", src.includes("Ask for directions."));
check("guard has report crime option", src.includes("Report a crime."));
check("guard has pay fine option", src.includes("Pay fine."));
check("fence has stolen goods language", src.includes("hot goods"));
finish();
