#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function ok(label, pass) {
  console.log(`${pass ? "OK" : "FAIL"} ${label}`);
  if (!pass) process.exitCode = 1;
}

const combat = read("src/client/components/challenges/LocalDevHarthmereCombat.tsx");
const renderer = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const quests = read("src/client/components/challenges/LocalDevHarthmereQuests.tsx");
const scenes = read("src/client/game/renderers/scenes.ts");

ok("ruleset revision bumped", combat.includes("harthmere-death-ai-dialog-render-v1"));
ok("death pulse helper exists", combat.includes("shouldHarthmereTargetPlayDeathPulse"));
ok("target reaction considers finalDamage", combat.includes("targetReactionClipPriority(entry.result, entry.targetHpAfter, entry.ability, entry.detail, entry.finalDamage)"));
ok("animation kind uses safe death helper", combat.includes("shouldHarthmereTargetPlayDeathPulse(entry.result, entry.targetHpAfter, entry.finalDamage)"));
ok("combat exports NPC status", combat.includes("export function getHarthmereCombatNpcStatus"));
ok("renderer uses shouldRouteDeathPulse", renderer.includes("shouldRouteDeathPulse"));
ok("renderer avoids placeholder HP death route", renderer.includes("finalDamageForDeathRoute > 0"));
ok("dialog imports combat NPC status", quests.includes("getHarthmereCombatNpcStatus"));
ok("dialog listens to combat changes", quests.includes("biomes:harthmere-combat-changed"));
ok("dead NPC dialogue returns no actions", quests.includes("actions: []") && quests.includes("combatStatus.dead"));
ok("mixed scene warning is throttled", scenes.includes("mixedSceneTypeWarningUuids"));

const mtlPath = path.join(root, "public/assets/harthmere/obj/medieval_voxel/Lamp_Ground_Large.mtl");
if (fs.existsSync(mtlPath)) {
  const mtl = fs.readFileSync(mtlPath, "utf8");
  ok("lamp MTL path no longer points to D drive", !mtl.includes("D:\\\\Descargas") && !mtl.includes("D:/Descargas"));
  ok("lamp MTL uses local texture", mtl.includes("map_Kd Lamp_Ground_Large.png"));
}

if (process.exitCode) {
  console.log("\nRESULT: FAIL");
} else {
  console.log("\nRESULT: PASS");
}
