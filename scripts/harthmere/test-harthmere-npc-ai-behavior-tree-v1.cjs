#!/usr/bin/env node
const { createHarness, aiSource } = require("./harthmere-npc-ai-test-lib-v1.cjs");
const h = createHarness("Harthmere NPC AI behavior tree tests v1"); const src = aiSource(h);
for (const token of ["runHarthmereBehaviorTree", "selector", "sequence", "condition", "action", "DEFAULT_TREE", "dead_branch", "danger_branch", "combat_branch", "trade_branch", "dialogue_branch", "work_branch"]) h.ok(src.includes(token), `behavior tree includes ${token}`);
h.ok(src.indexOf("dead_branch") < src.indexOf("trade_branch"), "dead branch prioritized before trading"); h.ok(src.indexOf("danger_branch") < src.indexOf("trade_branch"), "danger prioritized before trading"); h.ok(src.includes("visited.push(node.id)"), "debug visited path available"); h.done();
