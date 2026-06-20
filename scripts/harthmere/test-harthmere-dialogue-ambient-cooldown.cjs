#!/usr/bin/env node
const { checkFactory, ruleSource } = require("./harthmere-dialogue-rule-test-lib.cjs");
const root = process.argv[2] || process.cwd();
const src = ruleSource(root);
const { check, finish } = checkFactory();
console.log("== Harthmere dialogue ambient/greeting cooldown tests current ==");
console.log(`Root: ${root}`);
console.log("");
check("greeting cooldown key exists", src.includes("cooldowns"));
check("greeting cooldown ms exists", src.includes("repeatedGreetingCooldownMs"));
check("ambient bark cooldown ms exists", src.includes("ambientBarkCooldownMs"));
check("companion cooldown ms exists", src.includes("companionObservationCooldownMs"));
check("greeting pools have multiple lines", src.includes("HARTHMERE_DIALOGUE_ROLE_GREETING_POOLS"));
check("greeting selector avoids prior lines", src.includes("previousLineIds"));
finish();
