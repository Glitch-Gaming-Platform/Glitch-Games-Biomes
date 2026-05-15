#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = path.resolve(process.argv[2] || process.cwd());
const renderer = path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const combat = path.join(repo, "src/client/components/challenges/LocalDevHarthmereCombat.tsx");

function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${msg}`);
  }
}

const r = fs.readFileSync(renderer, "utf8");
const c = fs.existsSync(combat) ? fs.readFileSync(combat, "utf8") : "";

ok(r.includes("resolveHarthmereSwordObject3D"), "renderer has Object3D resolver guard");
ok(r.includes("typeof maybeObject.traverse === \"function\""), "resolver checks traverse function");
ok(r.includes("maybeObject.scene") && r.includes("maybeObject.scene.traverse"), "resolver accepts GLTF scene wrapper");
ok(r.includes("private sanitizeHarthmereSwordTextures(value: unknown)"), "sanitize accepts unknown");
ok(r.includes("const object = this.resolveHarthmereSwordObject3D(value);"), "sanitize resolves Object3D before traverse");
ok(r.includes("object.traverse((child)"), "sanitize traverses resolved Object3D");
ok(r.includes("private normalizeHarthmerePlayerSwordGltfScale(value: unknown)"), "normalizer accepts unknown");
ok(r.includes("getHarthmerePlayerSwordObjectForManualSwing"), "renderer has sword object lookup for manual swing");
ok(r.includes("startHarthmerePlayerSwordManualSwing"), "renderer has manual swing starter");
ok(r.includes("applyHarthmerePlayerSwordManualSwing"), "renderer has manual swing applier");
ok(r.includes("renderer.player_sword.manual_swing_start"), "renderer logs manual swing start");
ok(r.includes("renderer.player_sword.manual_swing_done"), "renderer logs manual swing done");
ok(r.includes("basePosition: sword.position.clone()"), "manual swing captures absolute base position");
ok(r.includes("baseRotation: sword.rotation.clone()"), "manual swing captures absolute base rotation");
ok(r.includes("sword.position.copy(swing.basePosition)"), "manual swing reapplies absolute base position");
ok(r.includes("sword.rotation.copy(swing.baseRotation)"), "manual swing reapplies absolute base rotation");
ok(r.includes("BasicSlash_24") && r.includes("startHarthmerePlayerSwordManualSwing(\"basic\")"), "basic slash starts manual swing");
ok(r.includes("HeavySlash_24") && r.includes("startHarthmerePlayerSwordManualSwing(\"heavy\")"), "heavy slash starts manual swing");
ok(c.includes("Iron Longsword Slash"), "combat labels basic sword attack as longsword");
ok(c.includes("Heavy Iron Longsword Slash"), "combat labels heavy sword attack as longsword");
ok(!c.includes("Training Dagger Strike"), "combat no longer labels B attack as training dagger strike");
ok(!c.includes("Heavy Training Dagger Strike"), "combat no longer labels N attack as heavy training dagger strike");

if (!process.exitCode) {
  console.log("\nRESULT: PASS");
}
