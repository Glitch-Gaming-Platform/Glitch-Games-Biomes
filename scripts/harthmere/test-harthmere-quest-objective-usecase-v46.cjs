#!/usr/bin/env node
const path = require("path");
const { readQuestModule, check } = require("./harthmere_quest_test_helpers_v46.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const { quests } = readQuestModule(root);
const requiredUseCases = [
  "inactive quest does not expose rewards as granted",
  "available quest exposes giver, location, and offer dialogue",
  "active quest exposes current objectives and map/compass hints",
  "ready-to-complete quest validates objectives before reward grant",
  "completed quest cannot grant rewards twice",
];
for (const q of quests) {
  check(`${q.id} has at least three objectives`, Array.isArray(q.objectives) && q.objectives.length >= 3);
  for (const obj of q.objectives) {
    check(`${q.id}/${obj.id} objective id namespaced`, obj.id.startsWith(q.id));
    check(`${q.id}/${obj.id} objective has type`, typeof obj.type === "string" && obj.type.length > 2);
    check(`${q.id}/${obj.id} objective has label`, typeof obj.label === "string" && obj.label.length >= 8);
    check(`${q.id}/${obj.id} objective has target`, typeof obj.targetId === "string" && typeof obj.targetName === "string");
    check(`${q.id}/${obj.id} objective has location waypoint`, Array.isArray(obj.location?.waypoint) && obj.location.waypoint.length === 3);
    check(`${q.id}/${obj.id} objective server validated`, obj.validation?.serverAuthority === true);
    check(`${q.id}/${obj.id} objective idempotent`, obj.validation?.idempotent === true);
    check(`${q.id}/${obj.id} objective has failure cases`, Array.isArray(obj.failureCases) && obj.failureCases.length >= 3);
  }
  for (const useCase of requiredUseCases) check(`${q.id} use case ${useCase}`, q.testContract.useCases.includes(useCase));
  check(`${q.id} edge cases include inventory/client/time/prereq`,
    q.testContract.edgeCases.includes("inventory_full") && q.testContract.edgeCases.includes("client_reward_spoof") && q.testContract.edgeCases.includes("wrong_time") && q.testContract.edgeCases.includes("missing_prerequisite"));
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS quest objective usecase v46");
