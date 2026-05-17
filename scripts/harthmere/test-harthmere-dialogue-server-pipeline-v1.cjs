#!/usr/bin/env node
const { checkFactory, ruleSource } = require("./harthmere-dialogue-rule-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const src = ruleSource(root);
const { check, finish } = checkFactory();
console.log("== Harthmere dialogue server-authoritative pipeline tests v1 ==");
console.log(`Root: ${root}`);
console.log("");
for (const step of ["server_receives_choice_request", "server_verifies_valid_conversation", "server_verifies_npc_exists_alive_available", "server_verifies_choice_currently_available", "server_checks_requirements", "server_applies_effects_atomically", "server_updates_quest_reputation_faction_inventory_legal_state", "server_records_player_choice", "server_sends_next_node_to_client", "client_updates_ui_journal_map_tracker"]) {
  check(`pipeline includes ${step}`, src.includes(step));
}
check("request id maker exists", src.includes("makeHarthmereDialogueRequestId"));
check("choice processor has idempotency", src.includes("processedRequestIds") && src.includes("duplicate"));
check("choice processor validates current choice", src.includes("choice_not_available"));
check("choice processor revalidates requirements", src.includes("validateHarthmereDialogueChoiceSelection"));
finish();
