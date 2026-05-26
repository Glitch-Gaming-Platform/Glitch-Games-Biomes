#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function check(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  }
}

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const logicPath = path.join(root, "src/shared/npc/logic.ts");
const chasePath = path.join(root, "src/shared/npc/behavior/chase_attack.ts");

console.log("== Harthmere attacked NPC retaliation v1 ==");

check(fs.existsSync(logicPath), "NPC tick logic exists");
check(fs.existsSync(chasePath), "chase attack behavior exists");

const logic = fs.readFileSync(logicPath, "utf8");
const chase = fs.readFileSync(chasePath, "utf8");

check(
  logic.includes("ATTACKED_NPC_RETALIATION_FALLBACK_V1"),
  "retaliation fallback is versioned"
);
check(
  logic.includes("if (behavior.chaseAttack)") &&
    logic.includes("return behavior.chaseAttack"),
  "authored proactive aggression remains authoritative"
);
check(
  logic.includes('aggroTrigger: { kind: "onlyIfAttacked" }'),
  "fallback only retaliates after attack"
);
check(
  logic.includes("behavior.damageable?.attackable !== true"),
  "fallback only applies to attackable NPCs"
);
check(
  logic.includes('npc.health.lastDamageSource?.kind !== "attack"') &&
    logic.includes("npc.health.lastDamageTime === undefined"),
  "fallback requires a real recent attack source"
);
check(
  logic.includes("updateAttackTarget(env, npc, chaseAttack)") &&
    logic.includes("chaseAttackTargetTick(") &&
    logic.includes("chaseAttack")
    ,
  "effective chaseAttack params drive target selection and attack ticks"
);
check(
  !logic.includes("npc.label") && !logic.includes("displayName"),
  "retaliation is not limited to a name whitelist"
);
check(
  chase.includes('kind === "onlyIfAttacked"') &&
    chase.includes("lastDamageSource.attacker"),
  "existing chase behavior resolves the last attacker for retaliation"
);

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}

console.log("\nRESULT: PASS");
