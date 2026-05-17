#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
let makeReporter;
try {
  ({ makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs"));
} catch {
  makeReporter = (title, root) => {
    let failures = 0;
    console.log(`== ${title} ==`);
    console.log(`Root: ${root}\n`);
    return {
      check(label, ok, detail) {
        if (ok) {
          console.log(`OK ${label}`);
        } else {
          failures += 1;
          console.log(`FAIL ${label}`);
          if (detail) console.log(`  - ${detail}`);
        }
      },
      fail(label, detail) {
        failures += 1;
        console.log(`FAIL ${label}`);
        if (detail) console.log(`  - ${detail}`);
      },
      finish() {
        console.log(`\nRESULT: ${failures ? `FAIL (${failures})` : "PASS"}`);
        process.exitCode = failures ? 1 : 0;
      },
    };
  };
}

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere creature/social/death/weapon-handtracking animation tests v9", root);

function read(rel) {
  const p = path.join(root, rel);
  report.check(`${rel} exists`, fs.existsSync(p), `Missing ${rel}`);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

const assets = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const npcs = read("src/client/game/resources/npcs.ts");
const player = read("src/client/game/util/player_animations.ts");
const contract = read("src/shared/harthmere/animation_visual_regression_contracts_v9.ts");
const suite = read("scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");

report.check(
  "v9 shared contract exists for creatures/social/death/handtracking",
  /HARTHMERE_CREATURE_SOCIAL_DEATH_HANDTRACKING_VERSION_V9/.test(contract),
  "Expected shared v9 animation visual regression contract.",
);
report.check(
  "v9 contract covers weapon hand tracking max grip distance",
  /HARTHMERE_WEAPON_HAND_TRACKING_CONTRACT_V9[\s\S]*maxGripDistanceMeters:\s*0\.22/.test(contract),
  "Weapon/hand tests need a concrete max distance, not just an event hook.",
);
report.check(
  "v9 contract covers creature and animal states",
  /HARTHMERE_CREATURE_ANIMAL_ANIMATION_CONTRACT_V9[\s\S]*idle[\s\S]*walk[\s\S]*run[\s\S]*attack[\s\S]*hit[\s\S]*death[\s\S]*flee[\s\S]*turnInPlace[\s\S]*pathVelocitySync/.test(contract),
  "Creature/animal coverage must include locomotion, combat, death, flee, turn smoothing, and velocity sync.",
);
report.check(
  "v9 contract covers social/work NPC states",
  /HARTHMERE_SOCIAL_WORK_NPC_ANIMATION_CONTRACT_V9[\s\S]*vendorIdle[\s\S]*talkGesture[\s\S]*questGesture[\s\S]*sit[\s\S]*eat[\s\S]*drink[\s\S]*sleep[\s\S]*workLoop[\s\S]*smithWork[\s\S]*cookWork[\s\S]*dockWork[\s\S]*healerWork[\s\S]*guardPatrolIdle[\s\S]*crowdEmote/.test(contract),
  "Social/work NPC animations need explicit states tied to town schedules and roles.",
);
report.check(
  "v9 contract prevents instant death disappearance",
  /HARTHMERE_DEATH_RESPAWN_CINEMATIC_CONTRACT_V9[\s\S]*corpseHoldScale:\s*0\.84[\s\S]*npcCorpseShouldRemainVisible:\s*true[\s\S]*playerControlsLockDuringDeath:\s*true/.test(contract),
  "Death/respawn contract must keep corpses visible and define player death cinematic behavior.",
);

report.check(
  "NPC death animation no longer scales corpses to zero",
  /HARTHMERE_NPC_DEATH_CORPSE_HOLD_SCALE_V9\s*=\s*0\.84/.test(npcs) &&
    /HARTHMERE_NPC_DEATH_ANIMATION_DURATION_SECS_V9\s*=\s*1\.25/.test(npcs) &&
    !/ON_DEATH_ANIMATION_DURATION_SECS\s*=\s*0\.2/.test(npcs) &&
    !/onDeathScaleCurve,\s*\n\s*ON_DEATH_ANIMATION_DURATION_SECS,\s*\n\s*0\s*\n\s*\)/.test(npcs),
  "NPCs used to shrink to scale 0 on death; they should hold a visible corpse pose instead.",
);
report.check(
  "NPC death meshes remain visible and expose cinematic metadata",
  /this\.mixedMesh\.three\.visible\s*=\s*true/.test(npcs) && /harthmereDeathRespawnCinematicV9/.test(npcs),
  "Death flow should not visually delete NPCs immediately.",
);
report.check(
  "NPC animation system exposes creature/animal animation states",
  /creatureAttack:[\s\S]*creatureHit:[\s\S]*creatureDeath:[\s\S]*creatureFlee:[\s\S]*creatureTurnInPlace:/.test(npcs),
  "Creature/animal runtime states must be actual animation-system actions.",
);
report.check(
  "NPC animation system exposes social/work animation states",
  /vendorWork:[\s\S]*talkGesture:[\s\S]*questGesture:[\s\S]*sit:[\s\S]*eat:[\s\S]*drink:[\s\S]*sleep:[\s\S]*workLoop:[\s\S]*smithWork:[\s\S]*cookWork:[\s\S]*dockWork:[\s\S]*healerWork:[\s\S]*guardPatrolIdle:[\s\S]*crowdEmote:/.test(npcs),
  "Social/work roles must be animatable, not only placed/static NPCs.",
);
report.check(
  "NPC locomotion anti-jitter remains active for creatures and animals",
  /HARTHMERE_NPC_BODY_LOCOMOTION_DEADZONE_SPEED_V5\s*=\s*0\.06/.test(npcs) && /HARTHMERE_NPC_BODY_MAX_BLEND_DT_V5\s*=\s*1\s*\/\s*24/.test(npcs),
  "Creature locomotion must keep the v5 velocity deadzone and dt cap.",
);

report.check(
  "player runtime still prefers aligned action clips after v9",
  /attack1:\s*\{\s*fileAnimationName:\s*"HarthmereBodyWeaponBasic_Aligned_30"/.test(player) &&
    /attack2:\s*\{\s*fileAnimationName:\s*"HarthmereBodyWeaponHeavy_Aligned_30"/.test(player) &&
    /rangedAim:\s*\{\s*fileAnimationName:\s*"HarthmereBodyRangedDraw_Aligned_30"/.test(player) &&
    /magicCast:\s*\{\s*fileAnimationName:\s*"HarthmereBodyMagicCast_Aligned_30"/.test(player) &&
    /shieldBlock:\s*\{\s*fileAnimationName:\s*"HarthmereBodyWeaponBlock_Aligned_30"/.test(player),
  "Aligned body clips must remain primary for melee/ranged/magic/shield.",
);
report.check(
  "player death/respawn cinematic actions exist",
  /deathCinematic:[\s\S]*respawnCinematic:/.test(player),
  "Player death/respawn needs explicit cinematic animation actions.",
);

report.check(
  "harthmere_assets parser issue from class-body const is fixed",
  !/\nconst HARTHMERE_BODY_WEAPON_VISUAL_COHESION_VERSION_V7\s*=\s*\n\s*"harthmere-body-weapon-visual-cohesion-v7";\s*\n\s*private ensureHarthmerePlayerSword/.test(assets),
  "Do not insert top-level const declarations inside the renderer class body.",
);
report.check(
  "weapon follows current hand/arm anchor during every swing frame",
  /HARTHMERE_WEAPON_HAND_TRACKING_VERSION_V9/.test(assets) &&
    /harthmereWeaponHandTrackingV9CurrentAnchor/.test(assets) &&
    /harthmerePlayerWeaponGripWorldPosition\.copy\(drawnPosition\)/.test(assets) &&
    /harthmerePlayerWeaponGripWorldQuaternion\.copy\(drawnQuaternion\)/.test(assets),
  "The sword cannot only use bodyForward/world offsets; it must sample the current hand anchor each frame.",
);
report.check(
  "manual sword swing no longer copies stale captured basePosition/baseRotation",
  /private applyHarthmerePlayerSwordManualSwing[\s\S]*harthmerePlayerWeaponGripWorldPosition[\s\S]*harthmerePlayerWeaponGripWorldQuaternion/.test(assets) &&
    !/private applyHarthmerePlayerSwordManualSwing[\s\S]*sword\.position\.copy\(swing\.basePosition\)[\s\S]*sword\.rotation\.copy\(swing\.baseRotation\)/.test(assets),
  "Manual swing must be layered over live hand transform, not a stale transform captured at attack start.",
);
report.check(
  "weapon hand tracking has a concrete grip distance budget and samples",
  /HARTHMERE_WEAPON_HAND_GRIP_MAX_DISTANCE_V9\s*=\s*0\.22/.test(assets) && /harthmerePlayerWeaponGripDistanceLast/.test(assets) && /harthmerePlayerWeaponHandTrackingSamplesV9/.test(assets),
  "Need grip distance samples so live tests can catch detached weapon visuals.",
);
report.check(
  "renderer debug bridge exposes hand tracking and creature/social/death audits",
  /weaponHandTracking:\s*\(\)\s*=>/.test(assets) &&
    /creatureAnimationAudit:\s*\(\)\s*=>/.test(assets) &&
    /socialWorkAnimationAudit:\s*\(\)\s*=>/.test(assets) &&
    /deathRespawnCinematicAudit:\s*\(\)\s*=>/.test(assets),
  "Live debug must expose all new animation audit surfaces.",
);
report.check(
  "renderer death pulses keep actors visible and tagged",
  /actor\.object\.visible\s*=\s*true/.test(assets) && /harthmereDeathRespawnCinematicV9/.test(assets),
  "Combat actors should hold a visible death pose instead of disappearing.",
);
report.check(
  "full suite includes v9 animation test",
  /test-harthmere-creature-social-death-handtracking-v9\.cjs/.test(suite),
  "Full suite should include the new animation regression layer.",
);

report.finish();
