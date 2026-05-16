#!/usr/bin/env node
"use strict";
/* HARTHMERE_DUNGEON_TELEPORT_LIVE_HOOK_SOURCE_TEST_V1 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const playerPath = path.join(root, "src/client/game/scripts/player.ts");
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");

let ok = true;
function pass(label) { console.log(`OK ${label}`); }
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  for (const line of String(detail || "").split("\n").filter(Boolean)) console.log(`  - ${line}`);
}
function check(label, condition, detail) { condition ? pass(label) : fail(label, detail); }

console.log("== Harthmere dungeon teleport live hook source tests v1 ==");
console.log(`Root: ${root}`);
console.log("");

check("player.ts exists", fs.existsSync(playerPath), `Missing ${playerPath}`);
check("harthmere_assets.ts exists", fs.existsSync(assetsPath), `Missing ${assetsPath}`);

const player = fs.existsSync(playerPath) ? fs.readFileSync(playerPath, "utf8") : "";
const assets = fs.existsSync(assetsPath) ? fs.readFileSync(assetsPath, "utf8") : "";

check("player exposes live teleport hook marker", player.includes("HARTHMERE_DUNGEON_TELEPORT_LIVE_PLAYER_HOOK_V1"), "Missing live player hook marker");
check("player exposes __harthmereLivePlayerDebug", player.includes("__harthmereLivePlayerDebug"), "Missing __harthmereLivePlayerDebug");
check("player live hook can consume stored teleport target", player.includes("consumeStoredTeleportTarget") && player.includes("biomes.localDev.harthmere.teleportTarget"), "Missing localStorage consume path");
check("player publishMove installs teleport hook", /publishMove\(player: Player\) \{\s*this\.installHarthmereDungeonTeleportLivePlayerHook\(player\);/s.test(player), "publishMove does not install hook at runtime");

check("renderer teleport helper uses live player hook marker", assets.includes("HARTHMERE_DUNGEON_CONSOLE_TELEPORT_USES_LIVE_PLAYER_HOOK_V1"), "Missing strict live teleport marker");
check("renderer no longer treats stored fallback as success", /ok:\s*false,\s*teleported:\s*false,\s*stored:\s*true/s.test(assets), "Stored fallback should return ok:false/teleported:false");
check("renderer exposes dungeon test global", assets.includes("__harthmereDungeonTest") && assets.includes("teleportToBellwardHalls"), "Missing dungeon test teleport global");

console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
