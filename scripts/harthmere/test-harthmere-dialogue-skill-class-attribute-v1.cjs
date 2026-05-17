#!/usr/bin/env node
const { checkFactory, ruleSource } = require("./harthmere-dialogue-rule-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const src = ruleSource(root);
const { check, finish } = checkFactory();
console.log("== Harthmere dialogue skill/class/attribute tests v1 ==");
console.log(`Root: ${root}`);
console.log("");
check("context includes player class", src.includes("playerClass"));
check("context includes player level", src.includes("playerLevel"));
check("context includes attributes", src.includes("attributes"));
check("validates min level", src.includes("minLevel"));
check("validates class requirement", src.includes("className"));
check("supports attribute choice type", src.includes("attribute_based"));
check("supports class choice type", src.includes("class_specific"));
check("supports fail-forward options", src.includes("failForwardOptions"));
check("detects missing fail-forward on uncertain checks", src.includes("missing_fail_forward"));
finish();
