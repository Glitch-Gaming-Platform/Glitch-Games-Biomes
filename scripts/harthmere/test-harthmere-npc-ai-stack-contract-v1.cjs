#!/usr/bin/env node
const { createHarness, aiSource, npcSystemSource, assertAiModuleBasics } = require("./harthmere-npc-ai-test-lib-v1.cjs");
const h = createHarness("Harthmere NPC AI stack contract tests v1");
assertAiModuleBasics(h); const src = aiSource(h);
h.ok(/HARTHMERE_NPC_AI_STACK:\s*HarthmereNpcAiStackLayer\[\]/.test(src), "AI stack is explicit typed layer array");
for (const token of ["NavMesh plus A* route planning", "grid A* fallback", "Behavior Tree", "Hierarchical finite state machine", "Utility AI scorer", "GOAP planner", "Perception and memory", "resetHarthmereNpcAiLocalDevState", "__harthmereNpcAi"]) h.ok(src.includes(token), `AI stack includes ${token}`);
h.ok(npcSystemSource(h).includes("chooseHarthmereNpcAiDecision"), "NPC runtime path calls AI decision helper");
h.ok(!/neural network|reinforcement learning|LLM/i.test(src), "AI implementation remains deterministic/testable");
h.done();
