#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const playerPath = path.join(root, "src/client/game/util/player_animations.ts");
const hudPath = path.join(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const npcsPath = path.join(root, "src/client/game/resources/npcs.ts");
const suitePath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");

let ok = true;
function check(label, condition, detail) {
  if (condition) console.log(`OK ${label}`);
  else { ok = false; console.error(`FAIL ${label}`); if (detail) console.error(`  - ${detail}`); }
}
const read = (file) => fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
const player = read(playerPath);
const hud = read(hudPath);
const npcs = read(npcsPath);
const suite = read(suitePath);

console.log("== Harthmere body animation / weapon sync tests v5 ==");
console.log(`Root: ${root}\n`);

check("player animation file exists", fs.existsSync(playerPath));
check("HUD bridge file exists", fs.existsSync(hudPath));
check("NPC animation file exists", fs.existsSync(npcsPath));
check("body sync version marker exists", /HARTHMERE_BODY_ANIMATION_SYNC_VERSION_V5/.test(player));
check("body timing profiles cover basic, heavy, ranged, magic, and block", /HARTHMERE_BODY_WEAPON_TIMING_PROFILES_V5[\s\S]*basic[\s\S]*heavy[\s\S]*ranged[\s\S]*magic[\s\S]*block/.test(player));
check("upper body mask includes spine/shoulder/clavicle/finger/weapon tracks", /HARTHMERE_BODY_UPPER_BODY_RE\s*=\s*\/\(\.\*\(arm\|hand\|tool\|chest\|spine\|shoulder\|clavicle\|neck\|head\|finger\|weapon\)/.test(player));
check("attack1 uses aligned body clip with explicit body timeScale contract", /attack1:\s*\{\s*fileAnimationName:\s*"HarthmereBodyWeaponBasic_Aligned_30"[\s\S]{0,220}timeScale:\s*HARTHMERE_BODY_ATTACK_TIME_SCALE_V5\.attack1/.test(player));
check("attack2 uses aligned heavy clip with HeavyAttack/Attack2 fallback and body timeScale", /attack2:\s*\{\s*fileAnimationName:\s*"HarthmereBodyWeaponHeavy_Aligned_30"[\s\S]{0,260}backupFileAnimationNames:\s*\[[^\]]*"HeavyAttack"[^\]]*"Attack2"[\s\S]{0,120}timeScale:\s*HARTHMERE_BODY_ATTACK_TIME_SCALE_V5\.attack2/.test(player));
check("Harthmere combat emotes are handled before generic emote weighting", /getHarthmereWeaponSyncedEmoteWeightsV5\([\s\S]*?if \(weaponSyncedWeights\) \{[\s\S]*?return weaponSyncedWeights/.test(player));
check("weapon-synced body attacks are one-shot clips", /getHarthmereWeaponSyncedEmoteWeightsV5[\s\S]*repeat:\s*\{\s*kind:\s*"once"\s*\}/.test(player));
check("weapon attacks own upper body but preserve lower-body locomotion", /layers:\s*\{[\s\S]*arms:\s*"apply"[\s\S]*notArms:\s*"ifIdle"/.test(player));
check("body attack ease-in is responsive enough for weapon impact timing", /easeInTime:\s*0\.035/.test(player));
check("locomotion dead-zone prevents idle/walk flicker from tiny velocity noise", /HARTHMERE_BODY_LOCOMOTION_DEADZONE_SPEED\s*=\s*0\.08/.test(player) && /getHarthmereStableAnimationVelocityV5/.test(player));
check("velocity-based animation uses stable filtered velocity", /velocity:\s*getHarthmereStableAnimationVelocityV5\(player\.velocity\)/.test(player));
check("animation blend dt is capped to avoid frame-spike jitter", /HARTHMERE_BODY_MAX_BLEND_DT\s*=\s*1\s*\/\s*24/.test(player) && /animationBlendDt\s*=\s*Math\.min\([\s\S]*HARTHMERE_BODY_MAX_BLEND_DT/.test(player));
check("applyAccumulatedActionsToState uses capped animationBlendDt", /applyAccumulatedActionsToState\([\s\S]*accum,[\s\S]*animationState,[\s\S]*animationBlendDt/.test(player));

check("HUD body bridge marker exists", /HARTHMERE_BODY_ANIMATION_GESTURE_BRIDGE_V5/.test(hud));
check("HUD attack event detail reads weapon timing metadata", /HarthmereBodyAnimationGestureDetailV5[\s\S]*windupMs\?: number[\s\S]*impactMs\?: number[\s\S]*recoveryMs\?: number/.test(hud));
check("HUD derives body duration from impact and recovery instead of fixed constants", /harthmereBodyAttackTimingFromWeaponEventV5[\s\S]*duration:\s*Math\.max\(0\.35, \(impactMs \+ recoveryMs\) \/ 1000\)/.test(hud));
check("old hardcoded body durations are removed", !/const duration = attack === "heavy" \? 0\.95 : 0\.58/.test(hud));
check("localPlayer attackInfo uses synced duration", /localPlayer\.attackInfo\s*=\s*\{[\s\S]*duration,[\s\S]*\}/.test(hud));
check("body bridge records sync debug for live tests", /__harthmereBodyAnimationSyncDebug/.test(hud) && /weapon_timing_synced_body_animation/.test(hud));
check("debug record proves upper-body-only and lower-body-preserved contract", /upperBodyOnly:\s*true/.test(hud) && /lowerBodyLocomotionPreserved:\s*true/.test(hud));

check("NPC body sync marker exists", /HARTHMERE_NPC_BODY_ANIMATION_SYNC_VERSION_V5/.test(npcs));
check("NPC attack animation has explicit body timeScale", /attack:\s*\{\s*fileAnimationName:\s*"Attack",\s*timeScale:\s*HARTHMERE_NPC_BODY_ATTACK_TIME_SCALE_V5/.test(npcs));
check("NPC locomotion dead-zone prevents idle/walk flicker", /HARTHMERE_NPC_BODY_LOCOMOTION_DEADZONE_SPEED_V5\s*=\s*0\.06/.test(npcs) && /getHarthmereStableNpcAnimationVelocityV5/.test(npcs));
check("NPC velocity-based animation uses stable filtered velocity", /velocity:\s*getHarthmereStableNpcAnimationVelocityV5\(velocity\)/.test(npcs));
check("NPC animation blend dt is capped to avoid frame-spike jitter", /HARTHMERE_NPC_BODY_MAX_BLEND_DT_V5\s*=\s*1\s*\/\s*24/.test(npcs) && /npcAnimationBlendDt\s*=\s*Math\.min/.test(npcs));
check("NPC applyAccumulatedActionsToState uses capped blend dt", /applyAccumulatedActionsToState\([\s\S]*animAccum,[\s\S]*animationSystemState,[\s\S]*npcAnimationBlendDt/.test(npcs));

check("full suite includes body animation weapon sync test", /test-harthmere-body-animation-weapon-sync-v5\.cjs/.test(suite));

console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}${ok ? "" : " (body animation / weapon sync regressions detected)"}`);
process.exit(ok ? 0 : 1);
