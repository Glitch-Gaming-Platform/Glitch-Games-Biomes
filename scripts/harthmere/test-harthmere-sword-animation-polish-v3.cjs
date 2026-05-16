#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere sword animation polish tests v3", root);

function readRequired(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing ${rel}`);
  return fs.readFileSync(full, "utf8");
}
function sliceBetween(src, start, end) {
  const a = src.indexOf(start);
  if (a < 0) return "";
  const b = end ? src.indexOf(end, a + start.length) : -1;
  return src.slice(a, b < 0 ? src.length : b);
}
function check(label, condition, detail) {
  report.check(label, Boolean(condition), detail);
}
function has(src, re) {
  return re.test(src);
}

const multiplayer = readRequired("src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx");
const renderer = readRequired("src/client/game/renderers/local_dev/harthmere_assets.ts");
const equipmentManifest = readRequired("src/shared/game/medieval/harthmereEquipmentAnimationManifest.generated.ts");
const actionCsv = readRequired("harthmere-animation-actions.csv");

const keyedAttack = sliceBetween(multiplayer, "export function performHarthmereKeyedAttack", "export function simulateHarthmereAllySupport");
const visualEmitter = sliceBetween(multiplayer, "function emitHarthmereWeaponVisualState", "function event()");
const updateSword = sliceBetween(renderer, "private updateHarthmerePlayerSwordVisual", "private registerCombatLife");
const manualSwing = sliceBetween(renderer, "private startHarthmerePlayerSwordManualSwing", "private applyHarthmerePlayerSwordManualSwing");
const debugBridge = sliceBetween(renderer, "private installDebugBridge", "private readonly onCombatEffect");
const combatEffect = sliceBetween(renderer, "private readonly onCombatEffect", "private faceCombatActorToward");
const pulse = sliceBetween(renderer, "private applyCombatPulse", "private async loadAll");
const registerCombatLife = sliceBetween(renderer, "private registerCombatLife", "private findCombatLifeByOffset");

// 1. True bone attachment fallback.
check(
  "player sword prefers real skeletal hand/hip/back bones when exposed",
  has(renderer, /resolveHarthmerePlayerBoneAnchor[\s\S]{0,900}isBone/i) &&
    has(updateSword, /boneHandAnchor[\s\S]{0,800}boneSheatheAnchor[\s\S]{0,800}\?\?\s*this\.getHarthmerePlayerSwordAnchor/) &&
    has(updateSword, /righthand|right_hand|mixamorigRightHand/i),
  "Sword should use real animated bones when available and fall back to the named anchor rig otherwise."
);
check(
  "debug sword state reports whether attachment is bone or fallback anchor rig",
  has(debugBridge, /anchorMode[\s\S]{0,240}harthmereAttachmentMode/) && has(updateSword, /harthmereAttachmentMode\s*=\s*boneHandAnchor|harthmereAttachmentMode[\s\S]{0,80}bone/),
  "Live tests need to know whether the sword is following bones or fallback anchors."
);

// 2. Impact-frame damage timing.
check(
  "combat contract has shared basic/heavy sword timing constants",
  has(multiplayer, /HARTHMERE_SWORD_ATTACK_TIMINGS_V3[\s\S]{0,300}basic[\s\S]{0,120}impactMs[\s\S]{0,240}heavy[\s\S]{0,120}impactMs/),
  "Timing metadata should come from one contract, not duplicated magic numbers."
);
check(
  "visual sword event still carries windup, impact, and recovery timing",
  has(visualEmitter, /harthmereSwordAttackTiming\(attack\)/) && has(visualEmitter, /windupMs|impactMs|recoveryMs/),
  "Renderer and tests must receive the same timing used by damage resolution."
);
check(
  "physical forward-arc damage is scheduled at impactMs instead of resolving directly on keydown",
  has(keyedAttack, /resolveHarthmereSwordImpactFrame[\s\S]{0,180}performHarthmereForwardArcAttack\(attack\)/) &&
    has(keyedAttack, /window\.setTimeout\(resolveHarthmereSwordImpactFrame,\s*timing\.impactMs\)/),
  "Physical sword damage should happen near the visual impact frame."
);
check(
  "impact timing debug log is exposed for live/runtime verification",
  has(multiplayer, /__harthmereSwordImpactTimingDebugLog/) && has(keyedAttack, /phase:\s*["']scheduled["']/) && has(keyedAttack, /phase:\s*["']impact["']/),
  "Debug log should prove scheduled and actual impact phases occurred."
);

// 3. Sword trail / slash arc.
check(
  "renderer creates a transparent sword slash trail mesh",
  has(renderer, /ensureHarthmerePlayerSwordTrail[\s\S]{0,900}TorusGeometry[\s\S]{0,400}transparent:\s*true[\s\S]{0,240}DoubleSide/) ||
    has(renderer, /harthmere-player-sword-slash-trail[\s\S]{0,900}transparent:\s*true/),
  "Basic/heavy attacks should create a short-lived readable slash arc."
);
check(
  "basic and heavy manual swings spawn different slash trails",
  has(renderer, /spawnHarthmerePlayerSwordTrail\(["']basic["']/) && has(renderer, /spawnHarthmerePlayerSwordTrail\(["']heavy["']/) && has(renderer, /attack === ["']heavy["'] \? 230 : 155/),
  "Heavy slash trail should be larger/longer than basic."
);
check(
  "trail fades out over time instead of staying permanently visible",
  has(renderer, /updateHarthmerePlayerSwordTrail[\s\S]{0,700}remaining <= 0[\s\S]{0,500}opacity\s*=\s*0/) && has(updateSword, /updateHarthmerePlayerSwordTrail\(performance\.now\(\)\)/),
  "Slash trail must be short-lived to avoid visual clutter."
);

// 4. Better draw/sheath transition pose.
check(
  "draw/sheath transition uses curved lift instead of straight-only anchor lerp",
  has(updateSword, /curveLift[\s\S]{0,220}Math\.sin\(t \* Math\.PI\)[\s\S]{0,500}sword\.position\.y \+= curveLift/),
  "Draw/sheath should arc out of the sheath instead of linearly sliding."
);
check(
  "draw/sheath transition applies wrist twist rotation",
  has(updateSword, /wristTwist[\s\S]{0,500}sword\.rotateX\(wristTwist\)[\s\S]{0,160}sword\.rotateZ\(wristTwist/),
  "Draw/sheath needs a readable wrist rotation, not just translation."
);

// 5. Hit-stop and recoil.
check(
  "successful player sword hits trigger short hit-stop and attacker recovery",
  has(combatEffect, /renderer\.hit_stop\.impact/) && has(combatEffect, /harthmereHitStopUntil\s*=\s*performance\.now\(\) \+ 65/) && has(combatEffect, /harthmereAttackerRecoveryUntil\s*=\s*performance\.now\(\) \+ 180/),
  "Successful impact should briefly freeze/recoil so hits feel weighty."
);
check(
  "combat pulse honors hit-stop for hit and block reactions",
  has(pulse, /nowMs < this\.harthmereHitStopUntil[\s\S]{0,180}pulse\.kind === ["']hit["'][\s\S]{0,120}pulse\.kind === ["']block["']/),
  "Target hit/block pulse should visibly hold for a few frames at impact."
);
check(
  "attacker recovery offsets attack pulse after impact",
  has(pulse, /recoveryWave[\s\S]{0,180}harthmereAttackerRecoveryUntil[\s\S]{0,260}actor\.object\.position\.y/),
  "The attacker should not feel weightless after a successful hit."
);

// 6. Block contact feedback.
check(
  "block/parry/absorb creates explicit block contact feedback",
  has(renderer, /ensureHarthmereBlockContactFeedback[\s\S]{0,900}harthmere-block-contact-spark/) && has(combatEffect, /targetKind === ["']block["'][\s\S]{0,180}triggerHarthmereBlockContactFeedback/),
  "Blocked hits need sparks/recoil/sound hook instead of looking like normal damage."
);
check(
  "block feedback exposes a metallic sound hook for later audio wiring",
  has(renderer, /soundHook:\s*["']sword_block_clang["']/),
  "The visual event should leave a stable hook for audio implementation."
);

// 7. NPC equipped weapon visuals.
check(
  "renderer maintains NPC equipped weapon visual map",
  has(renderer, /harthmereNpcWeaponVisuals\s*=\s*new Map<THREE\.Object3D, THREE\.Group>/),
  "NPC held weapons need lifecycle tracking."
);
check(
  "NPC combat actors attach a visible main-hand weapon to right-hand anchor",
  has(renderer, /attachHarthmereNpcWeaponVisual[\s\S]{0,1200}harthmere-anchor-right-hand[\s\S]{0,500}anchor\.add\(visual\)/) &&
    has(registerCombatLife, /attachHarthmereNpcWeaponVisual\(this\.combatLifeInstances\[this\.combatLifeInstances\.length - 1\]\)/),
  "NPCs should visibly hold weapons through the same anchor concept as the player."
);
check(
  "NPC attack/hit/death clip support remains available after weapon visual patch",
  has(renderer, /kind === ["']attack["'][\s\S]{0,500}Attack/) && has(actionCsv, /Death/) && has(actionCsv, /HitReact/),
  "Weapon visuals must not replace actual NPC animation pulses."
);

// 8. Screenshot/debug regression contract.
check(
  "debug bridge exposes screenshot regression pose helper",
  has(debugBridge, /swordVisualRegressionPose[\s\S]{0,900}sheathed[\s\S]{0,600}basic_slash[\s\S]{0,600}heavy_slash[\s\S]{0,600}block[\s\S]{0,600}npc_attack/),
  "Live screenshot test needs stable pose hooks."
);
check(
  "debug bridge can set north/east/south/west sword facing",
  has(debugBridge, /setSwordFacing[\s\S]{0,500}north[\s\S]{0,160}east[\s\S]{0,160}south[\s\S]{0,160}west[\s\S]{0,500}bodyForward/),
  "Live screenshot test needs deterministic facing directions."
);
check(
  "debug sword state reports trail, block feedback, impact, and NPC weapon counts",
  has(debugBridge, /trailVisible[\s\S]{0,300}blockFeedbackVisible[\s\S]{0,300}npcWeaponVisualCount[\s\S]{0,300}lastImpactAt/),
  "Debug snapshots should cover the new polish systems."
);

// 9. Asset source remains generated sword equipment.
for (const clip of ["Draw_24", "Sheathe_24", "BasicSlash_24", "HeavySlash_24", "IdleDrawn_24"]) {
  check(`equipment manifest still includes ${clip}`, equipmentManifest.includes(clip), `Missing generated sword clip ${clip}`);
}

report.finish();
