#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let ok = true;
function read(rel){ return fs.readFileSync(path.join(root, rel), "utf8"); }
function check(label, cond){ if(cond){ console.log(`OK ${label}`);} else { console.error(`FAIL ${label}`); ok=false; } }

const returnHome = read("src/shared/npc/behavior/return_home.ts");
check("return_home uses sane angle epsilon", /const ANGLE_EPSILON = 0\.01/.test(returnHome));
check("return_home walks while rotating instead of forwardSpeed zero gate", /keep walking while rotateTargetTick catches up/.test(returnHome) && !/wait until we are[\s\S]{0,240}forwardSpeed: 0/.test(returnHome));

const bikkie = read("src/shared/npc/bikkie.ts");
check("local dev human has explicit rotate speed", /rotateSpeed:\s*200/.test(bikkie));

const modify = read("src/shared/npc/modify_health.ts");
check("persistent NPC respawn enqueue exists", /setNpcRespawnEnqueue/.test(modify) && /scheduleNpcRespawnIfPersistent/.test(modify));
check("corpse linger and respawn delay exist", /NPC_CORPSE_LINGER_SECS\s*=\s*90/.test(modify) && /NPC_DEFAULT_RESPAWN_SECS\s*=\s*5\s*\*\s*60/.test(modify));
check("threat is recorded from damage", /recordThreatFromDamage/.test(modify) && /THREAT_PER_DAMAGE_DEALT/.test(modify));

const respawn = read("src/server/spawn/respawn_service.ts");
check("respawn service creates NPCs from queued deaths", /class NpcRespawnService/.test(respawn) && /makeSpawnChangeToApply/.test(respawn) && /worldApi\.apply/.test(respawn));
const logicMain = read("src/server/logic/main.ts");
check("logic server starts respawn service in same process as death handling", /new NpcRespawnService/.test(logicMain) && /npcRespawnService\.start/.test(logicMain));

const npcs = read("src/client/game/resources/npcs.ts");
check("corpse animation falls over", /fallProgress/.test(npcs) && /rotation\.z\s*=\s*-Math\.PI \* 0\.5/.test(npcs));
check("corpse fade helper exists", /applyHarthmereNpcCorpseOpacityV37/.test(npcs) && /HARTHMERE_NPC_DEATH_FADE_LAST_SECS_V37/.test(npcs));

const spawn = read("src/server/spawn/spawn_service.ts");
check("spawn validation checks headroom", /isSpawnPositionPhysicallyValid/.test(spawn) && /hasHeadroom/.test(spawn));
check("spawn validation checks solid footing", /footProbeAabb/.test(spawn) && /hasFooting/.test(spawn));
check("spawn validation rejects NPC capsule overlap", /npc_selector\.scanAabb/.test(spawn) && /overlapping NPC/.test(spawn));

const chase = read("src/shared/npc/behavior/chase_attack.ts");
check("chase uses A* pathfinding", /AStarPathfinder/.test(chase) && /nextChasePathTarget/.test(chase) && /findNextTargetOnPath/.test(chase));
check("chase pathfinding state is serialized", /pathfinding:\s*zPathfindingComponent\.optional/.test(chase));

const meander = read("src/shared/npc/behavior/meander.ts");
check("meander uses destination pathfinding", /chooseMeanderDestination/.test(meander) && /findPathToMeanderDestination/.test(meander) && /AStarPathfinder/.test(meander));
check("meander no longer wall-clock marches by id modulo", !/Math\.floor\(now \/ walkTime\)/.test(meander));

const logic = read("src/shared/npc/logic.ts");
check("civilians flee before idle/social behaviors", /fleeFromThreatTick/.test(logic) && /else if \(fleeOutput\)/.test(logic));

const serde = read("src/shared/npc/serde.ts");
check("npc state includes memory threat schedule patrol", /zNpcMemoryComponent/.test(serde) && /zThreatTableComponent/.test(serde) && /zNpcScheduleComponent/.test(serde) && /zPatrolComponent/.test(serde));

for (const rel of [
  "src/shared/npc/anchor_system.ts",
  "src/shared/npc/npc_reaction.ts",
  "src/shared/npc/dialog.ts",
  "src/shared/npc/threat.ts",
  "src/shared/npc/behavior/schedule.ts",
  "src/shared/npc/behavior/patrol.ts",
]) {
  check(`${rel} exists`, fs.existsSync(path.join(root, rel)));
}

const attrs = read("src/shared/bikkie/schema/attributes.ts");
for (const name of ["persistent", "respawnAfterSecs", "role", "factionId", "personality", "socialClass", "preferredAnchorType", "patrolRouteId"]) {
  check(`bikkie attribute ${name} exists`, new RegExp(`name:\\s*"${name}"`).test(attrs) && new RegExp(`readonly ${name}`).test(attrs));
}

if (!ok) process.exit(1);
console.log("\nRESULT: PASS");
