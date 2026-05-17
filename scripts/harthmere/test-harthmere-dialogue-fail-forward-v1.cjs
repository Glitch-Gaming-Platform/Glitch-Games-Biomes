#!/usr/bin/env node
const { checkFactory, ruleSource } = require("./harthmere-dialogue-rule-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const src = ruleSource(root);
const { check, finish } = checkFactory();
console.log("== Harthmere dialogue fail-forward tests v1 ==");
console.log(`Root: ${root}`);
console.log("");
check("choice type supports persuasion", src.includes("persuasion"));
check("choice type supports bribe", src.includes("bribe"));
check("choice type supports intimidation", src.includes("intimidation"));
check("choices include fail-forward options", src.includes("failForwardOptions"));
check("validator detects missing fail-forward", src.includes("missing_fail_forward"));
check("sample threat choice has a consequence warning", src.includes("threaten_farmer") && src.includes("relationship_consequence"));
check("sample threat choice has fail-forward text", src.includes("He refuses but tells you another farmer may pay for wolf pelts."));
finish();
