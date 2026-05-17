#!/usr/bin/env node
const { checkFactory, ruleSource } = require("./harthmere-dialogue-rule-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const src = ruleSource(root);
const { check, finish } = checkFactory();
console.log("== Harthmere dialogue sheet coverage tests v1 ==");
console.log(`Root: ${root}`);
console.log("");
check("dialogue rule module exists", src.includes("HARTHMERE_DIALOGUE_RULE_SYSTEM_VERSION"));
check("keeps most dialogue short", src.includes("mostDialogueParagraphLimit"));
check("puts important information first", src.includes("importantInformationFirst"));
check("separates required info from optional lore", src.includes("requiredInformationSeparateFromOptionalLore"));
check("requires clean exit", src.includes("cleanExitRequired"));
check("prevents repeated greetings", src.includes("repeatedGreetingCooldownMs"));
check("service buttons appear quickly", src.includes("serviceButtonsAppearImmediately"));
check("consequence warnings required", src.includes("consequenceWarningsRequiredForMajorChoices"));
check("no development or system dialogue rule exists", src.includes("noDevelopmentOrGameSystemDialogue"));
check("dialogue UI contract covers name role portrait choices history", src.includes("showsNpcName") && src.includes("showsNpcRoleOrTitle") && src.includes("showsPortraitOrModel") && src.includes("showsDialogueHistoryButton"));
finish();
