#!/usr/bin/env node
const { checkFactory, ruleSource } = require("./harthmere-dialogue-rule-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const src = ruleSource(root);
const { check, finish } = checkFactory();
console.log("== Harthmere non-annoying dialogue pacing tests v1 ==");
console.log(`Root: ${root}`);
console.log("");
check("validates paragraph count", src.includes("too_many_paragraphs_for_normal_dialogue"));
check("validates important info first", src.includes("important_information_not_first"));
check("validates clean exit", src.includes("missing_clean_exit_choice"));
check("validates too many choices", src.includes("too_many_choices_without_categories"));
check("validates unclear tone", src.includes("unclear_choice_tone"));
check("supports short version / summary through journal summary", src.includes("summarizeHarthmereDialogueForJournal"));
check("supports skip", src.includes("allowSkip"));
check("supports fast forward", src.includes("allowFastForward"));
check("supports history review", src.includes("allowHistoryReview"));
finish();
