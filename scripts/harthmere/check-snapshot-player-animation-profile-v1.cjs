#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = process.cwd();
const rel = "src/client/game/util/player_animations.ts";
const src = fs.readFileSync(path.join(repo, rel), "utf8");
let failed = false;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}`);
    failed = true;
  }
}
function bodyOfFunction(name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start < 0) return "";
  const brace = src.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    if (src[i] === "{") depth++;
    if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

ok(src.includes('SNAPSHOT_PLAYER_ANIMATION_COMPAT_VERSION_V1'), "snapshot player animation compatibility marker is present");
ok(src.includes('"snapshot-player-animation-compat-v1"'), "snapshot player animation compatibility version string is present");
ok(src.includes('function getResolvedPlayerAnimationClipNameV1('), "resolved clip-name helper is present");
ok(src.includes('function hasResolvedHarthmereWeaponBodyClipV1('), "Harthmere clip-detection helper is present");
ok(src.includes('/^HarthmereBodyWeapon.*_(Variation|Aligned)_/'), "clip-detection helper recognizes Harthmere variation/aligned clips");

const weaponFn = bodyOfFunction("getHarthmereWeaponSyncedEmoteWeightsV5");
ok(weaponFn.includes('animationState: AnimationSystemState<typeof playerSystem>'), "weapon synced emote resolver receives animationState");
ok(weaponFn.includes('const hasHarthmereWeaponClip = hasResolvedHarthmereWeaponBodyClipV1'), "weapon synced emote resolver checks actual resolved clip");
ok(weaponFn.includes('if (!hasHarthmereWeaponClip)'), "weapon synced emote resolver has snapshot fallback branch");
ok(weaponFn.includes('playerSystem.singleAnimationWeight(emoteType, 1)'), "snapshot fallback uses base attack1/attack2 action keys");
ok(weaponFn.includes('toAnimationTime("snapshotWeaponBody", emoteStartTime)'), "snapshot fallback has its own timing label");
ok(weaponFn.includes('notArms: "apply"'), "snapshot fallback applies Attack/Attack2 to full body");
ok(weaponFn.includes('harthmereVariationEmoteTypeV15 as any') || weaponFn.includes('harthmereVariationEmoteTypeV15 as AnimationName'), "Harthmere branch still uses variation action when Harthmere clips exist");
ok(weaponFn.includes('notArms: "noApply"'), "Harthmere branch keeps upper-body-only visual cohesion");

const emoteFn = bodyOfFunction("getEmoteBasedWeights");
ok(emoteFn.includes('animationState: AnimationSystemState<typeof playerSystem>'), "getEmoteBasedWeights receives animationState");
ok(emoteFn.includes('getHarthmereWeaponSyncedEmoteWeightsV5(\n    animationState,'), "getEmoteBasedWeights passes animationState into weapon resolver");
ok(src.includes('getEmoteBasedWeights(animationState, player, toAnimationTime)'), "syncAnimationsToPlayerState passes animationState into emote resolver");

ok(src.includes('walk: { fileAnimationName: "Walking" }'), "snapshot Walking locomotion clip remains preserved");
ok(src.includes('idle: { fileAnimationName: "Idle" }'), "snapshot Idle clip remains preserved");
ok(src.includes('run: { fileAnimationName: "Running" }'), "snapshot Running locomotion clip remains preserved");
ok(src.includes('attack2: { fileAnimationName: "HarthmereBodyWeaponHeavy_Aligned_30", backupFileAnimationNames: ["HeavyAttack", "Attack2", "Attack"]'), "heavy attack keeps snapshot Attack2 fallback chain");

if (failed) {
  console.error("snapshot player animation profile v1 check failed");
  process.exit(1);
}
console.log("snapshot player animation profile v1 check passed");
