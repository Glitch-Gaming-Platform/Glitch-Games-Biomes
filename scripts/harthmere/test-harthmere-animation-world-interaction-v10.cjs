#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const combatPath = path.join(root, "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx");
const actionManifestPath = path.join(root, "public/assets/harthmere/action_object_animations/harthmere-action-object-animation-manifest.json");
const suitePath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");

const assets = fs.existsSync(assetsPath) ? fs.readFileSync(assetsPath, "utf8") : "";
const combat = fs.existsSync(combatPath) ? fs.readFileSync(combatPath, "utf8") : "";
const suite = fs.existsSync(suitePath) ? fs.readFileSync(suitePath, "utf8") : "";

let failed = 0;
function check(label, condition, detail = "") {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
    if (detail) console.error(`  - ${detail}`);
  }
}

console.log("== Harthmere animation/world interaction tests v10 ==");
console.log(`Root: ${root}\n`);

check("renderer has v10 object effect range contract", /HARTHMERE_OBJECT_EFFECT_RANGE_VERSION_V10/.test(assets));
check("renderer has v10 resource hit telegraph contract", /HARTHMERE_RESOURCE_HIT_TELEGRAPH_VERSION_V10/.test(assets));
check("renderer has v10 weapon hand-tracking contract", /HARTHMERE_WEAPON_HAND_TRACKING_VERSION_V10/.test(assets));

for (const kind of ["dirt", "grass", "rock", "ore", "tree", "crop", "water", "generic_resource"]) {
  const re = new RegExp(`${kind}:\\s*\\{[\\s\\S]{0,950}maxDistanceMeters[\\s\\S]{0,950}radiusMeters[\\s\\S]{0,950}coneAngleDegrees[\\s\\S]{0,950}requiresLineOfSight`, "m");
  check(`effect range exists for ${kind}`, re.test(assets), `${kind} needs max distance, radius, cone angle, and LOS rules`);
}

check("resource effect rules include vertical/height and cooldown/debounce constraints", /heightMeters/.test(assets) && /cooldownMs/.test(assets) && /debounceMs/.test(assets), "effect range must be 3D, not only a flat radius");

for (const edge of ["out_of_range","wrong_tool","blocked_line_of_sight","behind_player","steep_angle","depleted_resource","tiny_resource","large_resource","overlapping_resources","moving_player","cooldown_or_debounce","airborne_player","underwater_target","terrain_slope","resource_inside_collision","network_prediction_mismatch"]) {
  check(`resource interaction edge case is represented: ${edge}`, assets.includes(edge), `${edge} must be tested/handled`);
}

check("resource hits expose obvious visual telegraph", /rangeRing/.test(assets) && /reticle/.test(assets) && /toolTipLine/.test(assets) && /surfaceDecal/.test(assets) && /particles/.test(assets) && /failedReason/.test(assets), "gathering needs range ring, surface reticle, hand/tool-tip line, impact decal, particles, and failed reason");
check("resource hit telegraph is impact-frame aware", /impactFrameMs/.test(assets) || /impactMs/.test(assets), "visual/resource application must line up with tool impact frame");

check("gathering combat/action contract validates target before applying effect", /checksDistance/.test(combat) && /checksEffectRadius/.test(combat) && /checksConeAngle/.test(combat) && /checksLineOfSight/.test(combat) && /rejectsBehindPlayer/.test(combat) && /rejectsWrongTool/.test(combat) && /resolvesOverlappingResourcesByNearestImpactPoint/.test(combat), "gathering hit must reject invalid targets and resolve overlapping resources predictably");

check("weapon follows current hand every frame during swing", /currentHandPosition/.test(assets) && /handAnchor\.getWorldPosition/.test(assets) && /sword\.position\.copy\(currentHandPosition\)/.test(assets) && /followsCurrentHandEveryFrame:\s*true/.test(assets), "the weapon cannot use stale captured transform while the hand/arm swipes");
check("weapon grip budget is explicit and small enough for blocky character scale", /maxGripDistanceMeters:\s*0\.22/.test(assets) && /gripDistanceMeters/.test(assets), "tests need a measurable hand-to-weapon grip distance");
check("debug bridge exposes hand tracking and world interaction probes", /weaponHandTracking/.test(assets) && /objectEffectRangeAudit/.test(assets) && /resourceHitTelegraphState/.test(assets) && /simulateResourceHitTelegraph/.test(assets), "live tests need debug probes for weapon grip and resource-hit telegraphs");

if (fs.existsSync(actionManifestPath)) {
  const manifest = fs.readFileSync(actionManifestPath, "utf8");
  check("action object manifest still has visible tool impact clips", /Use_24/.test(manifest) && /HeavyUse_24/.test(manifest), "tool use clips must exist");
  check("tool/action animations keep 24 fps/frame metadata", /24/.test(manifest) && /fps|frameCount|frame_count/i.test(manifest), "tool clips should preserve 24-frame/24fps contract");
} else {
  check("action object animation manifest exists", false, actionManifestPath);
}

check("full suite includes animation/world interaction v10 test", /test-harthmere-animation-world-interaction-v10\.cjs/.test(suite));

if (failed) {
  console.error(`\nRESULT: FAIL (${failed})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
