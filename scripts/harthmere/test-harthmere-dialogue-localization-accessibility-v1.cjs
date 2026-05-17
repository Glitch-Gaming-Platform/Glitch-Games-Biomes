#!/usr/bin/env node
const { checkFactory, ruleSource } = require("./harthmere-dialogue-rule-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const src = ruleSource(root);
const { check, finish } = checkFactory();
console.log("== Harthmere dialogue localization/accessibility tests v1 ==");
console.log(`Root: ${root}`);
console.log("");
for (const token of ["supportsReadableFontSize", "supportsHighContrastText", "supportsScreenReaderLabels", "supportsTextSpeedControl", "supportsKeyboardControllerNavigation", "noColorOnlyChoiceMeaning"]) {
  check(`accessibility contract includes ${token}`, src.includes(token));
}
check("dialogue nodes use ids for data-driven localization", src.includes("nodeId") && src.includes("choiceId"));
check("choice warnings are textual, not color-only", src.includes("warningText"));
finish();
