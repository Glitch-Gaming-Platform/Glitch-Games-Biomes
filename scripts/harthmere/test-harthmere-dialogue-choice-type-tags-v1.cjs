#!/usr/bin/env node
const { checkFactory, ruleSource } = require("./harthmere-dialogue-rule-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const src = ruleSource(root);
const { check, finish } = checkFactory();
console.log("== Harthmere dialogue choice type/tag tests v1 ==");
console.log(`Root: ${root}`);
console.log("");
for (const type of ["flavor", "information", "quest", "moral", "faction", "combat", "trade", "persuasion", "intimidation", "bribe", "lie", "truth", "class_specific", "attribute_based", "reputation_based", "secret_unlocked", "leave"]) {
  check(`choice type exists: ${type}`, src.includes(`\"${type}\"`));
}
for (const tag of ["Friendly", "Rude", "Lie", "Truth", "Threaten", "Persuade", "Bribe", "Intimidate", "Ask", "Accept", "Refuse", "Attack", "Leave", "Trade", "Quest", "Class", "Attribute", "Reputation", "Illegal", "Permanent"]) {
  check(`choice tag exists: ${tag}`, src.includes(`\"${tag}\"`));
}
finish();
