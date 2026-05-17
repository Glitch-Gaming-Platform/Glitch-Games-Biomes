#!/usr/bin/env node
const path = require("path");
const { readQuestModule, check } = require("./harthmere_quest_test_helpers_v46.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const { quests } = readQuestModule(root);
const requiredStates = ["locked","available","active","ready_to_complete","completed","failed","abandoned"];
const requiredTransitions = ["prerequisites_met","accept_or_trigger","objectives_complete","server_grants_rewards_once"];
for (const q of quests) {
  for (const state of requiredStates) check(`${q.id} state ${state}`, q.testContract.states.includes(state));
  const reasons = q.testContract.stateTransitions.map((t) => t[2]);
  for (const reason of requiredTransitions) check(`${q.id} transition ${reason}`, reasons.includes(reason));
  check(`${q.id} progress policy is server/idempotent`, q.testContract.objectiveProgressPolicy === "server_validated_idempotent_objective_events");
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS quest state machine v46");
