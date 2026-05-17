#!/usr/bin/env node
const { checkFactory, ruleSource } = require("./harthmere-dialogue-rule-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const src = ruleSource(root);
const { check, finish } = checkFactory();
console.log("== Harthmere multiplayer party dialogue consent tests v1 ==");
console.log(`Root: ${root}`);
console.log("");
check("choice can require party consent", src.includes("partyConsentRequired"));
check("context lists affected party players", src.includes("partyAffectedPlayerIds"));
check("context stores consent by player", src.includes("partyConsentByPlayerId"));
check("party consent validator exists", src.includes("requiresPartyConsent"));
check("major party choice interruption rule exists", src.includes("partyLeaderMajorChoice"));
check("missing consent prevents processing", src.includes("missing_party_consent"));
finish();
