#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere animation action-chain tests v1", root);

function readRequired(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing ${rel}`);
  return fs.readFileSync(full, "utf8");
}

function indexOfOrEnd(src, pattern, start = 0) {
  const index = typeof pattern === "string" ? src.indexOf(pattern, start) : src.search(pattern);
  return index < 0 ? src.length : index;
}

const multiplayerPath = "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx";
const combatPath = "src/client/components/challenges/LocalDevHarthmereCombat.tsx";
const hudPath = "src/client/components/challenges/HarthmereUnifiedHUD.tsx";
const playerAnimationsPath = "src/client/game/util/player_animations.ts";
const playerMeshPath = "src/client/game/resources/player_mesh.ts";
const npcPath = "src/client/game/resources/npcs.ts";
const rendererPath = "src/client/game/renderers/local_dev/harthmere_assets.ts";

const multiplayer = readRequired(multiplayerPath);
const combat = readRequired(combatPath);
const hud = readRequired(hudPath);
const playerAnimations = readRequired(playerAnimationsPath);
const playerMesh = readRequired(playerMeshPath);
const npcs = readRequired(npcPath);
const renderer = readRequired(rendererPath);

report.check("B/N/L hard key router exists", /HARTHMERE_HARD_COMBAT_KEY_ROUTER_VERSION/.test(multiplayer) && /installHarthmereHardCombatKeyRouter\(\)/.test(multiplayer), "Expected module-load hard key router");
report.check("KeyB maps only to basic physical attack", /code\s*===\s*["']KeyB["'][\s\S]{0,90}return\s+["']basic["']/.test(multiplayer), "Expected KeyB -> basic");
report.check("KeyN maps to heavy and KeyL maps to spark", /code\s*===\s*["']KeyN["'][\s\S]{0,90}return\s+["']heavy["']/.test(multiplayer) && /code\s*===\s*["']KeyL["'][\s\S]{0,90}return\s+["']spark["']/.test(multiplayer), "Expected KeyN -> heavy and KeyL -> spark");
report.check("hard router blocks older handlers from stealing B/N/L", /preventDefault\(\)[\s\S]{0,160}stopPropagation\(\)[\s\S]{0,160}stopImmediatePropagation\(\)/.test(multiplayer), "Expected preventDefault + stopPropagation + stopImmediatePropagation before routing");
report.check("hard router calls performHarthmereKeyedAttack", /performHarthmereKeyedAttack\(action\)/.test(multiplayer), "Expected hard router route(action) -> performHarthmereKeyedAttack(action)");

const keyedStart = multiplayer.indexOf("export function performHarthmereKeyedAttack");
const keyedEnd = indexOfOrEnd(multiplayer, "export function simulateHarthmereAllySupport", keyedStart);
const keyedBody = multiplayer.slice(keyedStart, keyedEnd);
const physicalStart = keyedBody.indexOf("} else {");
const physicalEnd = indexOfOrEnd(keyedBody, "const cooldownSeconds", Math.max(0, physicalStart));
const physicalBranch = physicalStart >= 0 ? keyedBody.slice(physicalStart, physicalEnd) : "";

report.check("performHarthmereKeyedAttack emits attack-animation event after validation", /emitAttackAnimation\(attack\)/.test(keyedBody), "Expected attack animation event in keyed attack path");
report.check("physical B/N attacks run the forward-arc attack path", /performHarthmereForwardArcAttack\(attack\)/.test(physicalBranch), "Expected B/N physical attacks to call performHarthmereForwardArcAttack(attack)");
report.check("physical B/N attacks dispatch the visible sword attack animation event outside debug-only logging", /emitHarthmereWeaponVisualState\(\s*["']attack["']\s*,\s*true\s*,\s*attack\s*\)/.test(physicalBranch), "Expected physical branch to emit biomes:harthmere-player-sword-visual action=attack before/with forward arc; do not rely on combatDebug logging");

report.check("attack-animation event is a named exported event", /export\s+const\s+HARTHMERE_ATTACK_ANIMATION_EVENT\s*=\s*["']biomes:harthmere-attack-animation["']/.test(multiplayer), "Expected exported attack animation event");
report.check("emitAttackAnimation dispatches a CustomEvent carrying attack detail", /new\s+CustomEvent\(\s*HARTHMERE_ATTACK_ANIMATION_EVENT[\s\S]{0,220}detail\s*:\s*\{\s*attack/.test(multiplayer), "Expected event detail.attack");

report.check("HUD listens for HARTHMERE_ATTACK_ANIMATION_EVENT", /addEventListener\(\s*HARTHMERE_ATTACK_ANIMATION_EVENT\s*,\s*handler\s*\)/.test(hud), "Expected HUD attack gesture bridge listener");
report.check("HUD maps basic to attack1 and heavy to attack2", /attack\s*===\s*["']heavy["']\s*\?\s*["']attack2["']\s*:\s*["']attack1["']/.test(hud), "Expected deterministic emote mapping");
report.check("HUD calls eagerEmote with the chosen emote type", /\.eagerEmote\(\s*events\s*,\s*resources\s*,\s*emoteType\s*\)/.test(hud), "Expected player.eagerEmote(events, resources, emoteType)");

report.check("player animation system maps attack1 to aligned basic with Attack fallback", /attack1\s*:\s*\{\s*fileAnimationName\s*:\s*["']HarthmereBodyWeaponBasic_Aligned_30["'][\s\S]{0,180}backupFileAnimationNames\s*:\s*\[[^\]]*["']Attack["']/.test(playerAnimations), "Expected attack1 -> aligned basic, fallback Attack");
report.check("player animation system maps attack2 to aligned heavy with HeavyAttack/Attack2 fallback", /attack2\s*:\s*\{\s*fileAnimationName\s*:\s*["']HarthmereBodyWeaponHeavy_Aligned_30["'][\s\S]{0,220}backupFileAnimationNames\s*:\s*\[[^\]]*["']HeavyAttack["'][^\]]*["']Attack2["']/.test(playerAnimations), "Expected attack2 -> aligned heavy, fallback HeavyAttack/Attack2");
report.check("player mesh normalizes Walk/Run aliases to Walking/Running", /clip\.name\s*===\s*["']Walk["'][\s\S]{0,120}clone\.name\s*=\s*["']Walking["']/.test(playerMesh) && /clip\.name\s*===\s*["']Run["'][\s\S]{0,120}clone\.name\s*=\s*["']Running["']/.test(playerMesh), "Expected Harthmere player variants to alias Walk/Run into Biomes animation names");
report.check("player mesh keeps HeavyAttack distinct from Attack2 fallback", /HeavyAttack/.test(playerMesh) && /Attack2/.test(playerMesh) && /Do not create Attack2 from Attack/.test(playerMesh), "Expected HeavyAttack and Attack2 alias logic");

report.check("NPC animation resource consumes attack emotes", /emote\?\.emote_type\s*===\s*["']attack1["']/.test(npcs), "Expected NPC attack emote animation path");
report.check("NPC animation resource combines attack action with velocity movement", /getAttackAnimationAction[\s\S]{0,260}getVelocityBasedWeights/.test(npcs), "Expected attack animation plus walk/run movement weights");

report.check("forward-arc runtime writes bodyForward from local player body yaw", /bodyForward\s*=\s*harthmereBodyForwardFromYaw\(yaw\)/.test(combat) && /source\s*:\s*["']local_player_body_facing["']/.test(combat), "Expected body-facing runtime source");
report.check("forward-arc attack prioritizes bodyForward over camera/view/movement", /normalizeHarthmereForward2\(runtime\?\.bodyForward\)[\s\S]{0,180}normalizeHarthmereForward2\(runtime\?\.forward\)[\s\S]{0,180}normalizeHarthmereForward2\(runtime\?\.movementForward\)/.test(combat), "Expected bodyForward first in melee basis");
report.check("forward-arc swing event carries swingOrigin and swingForward", /visualKind\s*:\s*["']player_swing["'][\s\S]{0,900}swingOrigin[\s\S]{0,220}swingForward/.test(combat), "Expected melee event to expose swing direction for renderer/tests");

report.check("renderer routes player_swing as physical, not spark/magic", /isPlayerSwingEvent[\s\S]{0,2200}visualKind\s*=\s*isPlayerSwingEvent\s*\?\s*["']player_swing["']\s*:\s*["']physical["']/.test(renderer), "Expected player_swing classified physical");
report.check("renderer faces NPC attackers/targets before playing combat pulses", /faceCombatActorToward\(attacker[\s\S]{0,900}startCombatPulse\(attacker\s*,\s*["']attack["']/.test(renderer), "Expected actor facing correction before attack pulse");
report.check("renderer can face a combat actor along swingForward", /faceCombatActorAlong\([\s\S]{0,900}harthmereYawForWorldForward/.test(renderer) && /swingForward/.test(renderer), "Expected swingForward direction to control attack-facing yaw");
report.check("renderer combat pulse can select attack/block/hit/death clips", /function\s+bestCombatClip/.test(renderer) && /startCombatPulse/.test(renderer) && ["Attack", "HeavyAttack", "ShieldBlock", "HitReact", "Death"].every((name) => renderer.includes(name)), "Expected combat clip fallback coverage");

report.finish();
