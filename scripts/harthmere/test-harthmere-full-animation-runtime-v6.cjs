#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const paths = {
  contract: path.join(root, "src/shared/harthmere/animation_runtime_contracts_v6.ts"),
  player: path.join(root, "src/client/game/util/player_animations.ts"),
  hud: path.join(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx"),
  npcs: path.join(root, "src/client/game/resources/npcs.ts"),
  renderer: path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"),
  multi: path.join(root, "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx"),
  suite: path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs"),
};
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const files = Object.fromEntries(Object.entries(paths).map(([k, p]) => [k, read(p)]));
let ok = true;
function check(label, condition, detail) {
  if (condition) console.log(`OK ${label}`);
  else { ok = false; console.error(`FAIL ${label}`); if (detail) console.error(`  - ${detail}`); }
}
function hasAll(text, terms) { return terms.every((term) => text.includes(term)); }
console.log("== Harthmere full animation runtime tests v6 ==");
console.log(`Root: ${root}\n`);
for (const [name, p] of Object.entries(paths)) {
  if (name !== "suite") check(`${name} file exists`, fs.existsSync(p), p);
}
const families = ["creature", "mount", "ranged", "magic", "shield", "dodge", "airborne", "gathering", "crafting", "building", "social", "deathRespawn", "boss", "screenshot"];
check("shared contract exposes full animation runtime version", files.contract.includes("HARTHMERE_FULL_ANIMATION_RUNTIME_VERSION_V6"));
check("shared contract covers every remaining animation family", hasAll(files.contract, families));
check("creature/animal contract covers locomotion, attack, hit, death, flee, and turn-in-place", hasAll(files.contract, ["turnInPlace", "flee", "Bite", "HitReact", "Death"]));
check("mount/rider contract covers mount, dismount, rider seat, start/stop, and locomotion", hasAll(files.contract, ["mountIdle", "mountWalk", "mountRun", "mountStart", "mountStop", "dismount", "riderSeat"]));
check("ranged contract covers draw/hold/release/reload/quiver/projectile spawn", hasAll(files.contract, ["aimDraw", "holdAim", "release", "reload", "quiverDraw", "projectileSpawn"]));
check("magic contract covers focus equip/channel/release/vfx/interruption", hasAll(files.contract, ["equipFocus", "castStart", "channel", "castRelease", "interrupt", "vfxSpawn"]));
check("shield contract covers guard locomotion/parry/bash/recoil", hasAll(files.contract, ["walkGuard", "turnGuard", "bash", "parry", "recoil", "lower"]));
check("dodge disruption contract covers evade/stagger/knockback/knockdown/get-up", hasAll(files.contract, ["evade", "stagger", "knockback", "knockdown", "getUp", "interruptWindow"]));
check("airborne contract covers jump/fall/land/hard-land/armed and blocking jumps", hasAll(files.contract, ["jumpStart", "fallLoop", "hardLand", "armedJump", "blockingJump"]));
check("gathering/crafting/building contracts cover impact-frame tool work", hasAll(files.contract, ["mine", "woodcut", "fishCast", "blacksmithHammer", "placeConfirm", "hammerImpact"]));
check("social contract covers vendor/talk/quest/sit/eat/drink/sleep/work/crowd loops", hasAll(files.contract, ["vendorIdle", "talkGesture", "questGesture", "sleep", "workLoop", "crowdEmote"]));
check("death/respawn contract covers controls lock/revive/corpse/despawn", hasAll(files.contract, ["playerDeath", "controlsLocked", "revive", "respawn", "corpseHold", "despawn"]));
check("boss contract covers telegraph/phase/area/summon/enrage/reset/death", hasAll(files.contract, ["telegraph", "phaseTransition", "areaAttack", "summon", "enrage", "wipeReset", "bossDeath"]));
check("screenshot baseline contract includes all requested visual regression poses", hasAll(files.contract, ["facing_north", "facing_east", "facing_south", "facing_west", "boss_telegraph", "mount_rider_idle", "magic_channel", "shield_parry"]));
check("player system exposes full body animation v6 marker", files.player.includes("HARTHMERE_FULL_BODY_ANIMATION_RUNTIME_VERSION_V6"));
check("player system has ranged body animation entries", hasAll(files.player, ["rangedAim", "rangedRelease", "rangedReload"]));
check("player system has magic casting animation entries", hasAll(files.player, ["magicCast", "magicChannel"]));
check("player system has shield blocking animation entries", hasAll(files.player, ["shieldBlock", "shieldBash"]));
check("player system has dodge/stagger/knockdown/get-up entries", hasAll(files.player, ["dodge", "evade", "stagger", "knockdown", "getUp"]));
check("player system has airborne landing entries", hasAll(files.player, ["land", "hardLand"]));
check("player system has mount/rider body entries", hasAll(files.player, ["mountRideIdle", "mountRideWalk", "mountRideRun", "mountDismount"]));
check("player system has gathering/crafting/building body entries", hasAll(files.player, ["mineImpact", "woodcutImpact", "foragePickup", "craftStationUse", "repairImpact", "buildPlace"]));
check("player system has social/death/respawn/boss entries", hasAll(files.player, ["socialTalk", "vendorWork", "questGesture", "sleep", "death", "respawn", "bossTelegraph", "bossPhaseTransition"]));
check("player new entries use fallback clips so old GLTFs do not break", hasAll(files.player, ["backupFileAnimationNames", "BowDraw", "ShieldBlock", "BossTelegraph"]));
const helperStart = files.player.indexOf("function getHarthmereWeaponSyncedEmoteWeightsV5");
const helperEnd = files.player.indexOf("function getHarthmereStableAnimationVelocityV5");
const helperBody = helperStart >= 0 && helperEnd > helperStart ? files.player.slice(helperStart, helperEnd) : "";
check("weapon-synced body helper no longer recursively calls itself", !helperBody.includes("const weaponSyncedWeights = getHarthmereWeaponSyncedEmoteWeightsV5"), "Self-recursion here would cause runtime stack overflow and jitter.");
const emoteStart = files.player.indexOf("function getEmoteBasedWeights");
const emoteEnd = files.player.indexOf("function getCameraModeWeights");
const emoteBody = emoteStart >= 0 && emoteEnd > emoteStart ? files.player.slice(emoteStart, emoteEnd) : "";
check("getEmoteBasedWeights applies weapon-synced body weights once", emoteBody.includes("getHarthmereWeaponSyncedEmoteWeightsV5"));
check("body animation still preserves lower-body locomotion for upper-body actions", hasAll(files.player, ["notArms: \"ifIdle\"", "HARTHMERE_FULL_BODY_POSE_LAYER_RULES_V6"]));
check("HUD installs comprehensive animation runtime bridge", hasAll(files.hud, ["HARTHMERE_FULL_ANIMATION_RUNTIME_BRIDGE_VERSION_V6", "useHarthmereComprehensiveAnimationRuntimeBridgeV6();"]));
check("HUD bridge exposes browser debug API", hasAll(files.hud, ["__harthmereAnimationRuntimeV6", "record:", "request:", "snapshot:"]));
check("HUD bridge records every family with timing metadata", hasAll(files.hud, families) && hasAll(files.hud, ["windupMs", "impactMs", "recoveryMs", "lowerBodyLocomotionPreserved", "fullBodyAuthoritative"]));
check("HUD bridge listens for animation request events", hasAll(files.hud, ["biomes:harthmere-animation-request-v6", "addEventListener(HARTHMERE_FULL_ANIMATION_REQUEST_EVENT_V6"]));
check("NPC system exposes full animation runtime marker", files.npcs.includes("HARTHMERE_NPC_FULL_ANIMATION_RUNTIME_VERSION_V6"));
check("NPC system covers creature/social/boss state families", hasAll(files.npcs, ["HARTHMERE_NPC_CREATURE_ANIMATION_STATES_V6", "HARTHMERE_NPC_SOCIAL_ANIMATION_STATES_V6", "HARTHMERE_NPC_BOSS_ANIMATION_STATES_V6"]));
check("NPC creature states include flee and turn-in-place", hasAll(files.npcs, ["flee", "turnInPlace"]));
check("NPC social states include shop/work/crowd loops", hasAll(files.npcs, ["vendorIdle", "workLoop", "crowdEmote"]));
check("NPC boss states include telegraph/phase/enrage/reset", hasAll(files.npcs, ["telegraph", "phaseTransition", "enrage", "wipeReset"]));
check("renderer exposes full animation runtime debug marker", files.renderer.includes("HARTHMERE_RENDERER_FULL_ANIMATION_RUNTIME_VERSION_V6"));
check("renderer exposes pose catalog for all families", hasAll(files.renderer, families) && files.renderer.includes("HARTHMERE_RENDERER_ANIMATION_DEBUG_POSES_V6"));
check("renderer exposes screenshot regression baselines", hasAll(files.renderer, ["__harthmereRendererAnimationRuntimeV6", "screenshotBaselines", "facing_north", "facing_east", "facing_south", "facing_west"]));
check("multiplayer combat emits full animation request events", hasAll(files.multi, ["HARTHMERE_FULL_ANIMATION_REQUEST_EVENT_V6", "emitHarthmereFullAnimationRequestV6"]));
check("spark routes to magic animation family", files.multi.includes('family: "magic"'));
check("physical attack routes through full animation request family", files.multi.includes('family: "ranged"') || files.multi.includes('family: "melee"'));
check("full placement suite includes v6 animation runtime test", files.suite.includes("test-harthmere-full-animation-runtime-v6.cjs"));
console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
