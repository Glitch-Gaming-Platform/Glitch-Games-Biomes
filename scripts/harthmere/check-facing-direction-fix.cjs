#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const files = {
  combat: read("src/client/components/challenges/LocalDevHarthmereCombat.tsx"),
  hud: read("src/client/components/challenges/HarthmereUnifiedHUD.tsx"),
  renderer: read("src/client/game/renderers/local_dev/harthmere_assets.ts"),
  multi: read("src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx"),
};

const checks = [
  ["B binding is still KeyB", /basic:\s*"KeyB"/.test(files.multi)],
  ["N binding is still KeyN", /heavy:\s*"KeyN"/.test(files.multi)],
  ["L binding is still KeyL", /spark:\s*"KeyL"/.test(files.multi)],
  ["Forward runtime samples live local-player facing", /harthmere-facing-runtime-v3/.test(files.combat) && /setInterval\(writeSnapshot, 50\)/.test(files.combat)],
  ["Body-facing vector uses visible model yaw", /harthmereBodyForwardFromYaw/.test(files.combat) && /Math\.sin\(yaw\), Math\.cos\(yaw\)/.test(files.combat)],
  ["ViewDir vector is kept as opposite debug vector", /harthmereViewForwardFromYaw/.test(files.combat) && /-Math\.sin\(yaw\), -Math\.cos\(yaw\)/.test(files.combat)],
  ["Forward arc prefers bodyForward", /normalizeHarthmereForward2\(runtime\?\.bodyForward\)[\s\S]{0,140}normalizeHarthmereForward2\(runtime\?\.forward\)/.test(files.combat)],
  ["Selected fallback rejects targets behind body facing", /forward_arc\.selected_rejected/.test(files.combat) && /selected target is behind body facing/.test(files.combat)],
  ["Forward swing effect receives candidateOffsets correctly", /emitHarthmereForwardArcSwingEffect\(\s*ability,\s*arc\.origin,\s*arc\.forward,\s*hitOffsets,\s*arc\.candidateOffsets,\s*\)/m.test(files.combat)],
  ["HUD bridge uses native startAttack path", /localPlayer\.startAttack\(/.test(files.hud) && /native_startAttack_plus_harthmere_emote/.test(files.hud)],
  ["HUD bridge still maps basic/heavy to attack1/attack2", /attack === "heavy" \? "attack2" : "attack1"/.test(files.hud)],
  ["Renderer tracks actor forward axis", /type HarthmereModelForwardAxis/.test(files.renderer) && /forwardAxis: HarthmereModelForwardAxis/.test(files.renderer)],
  ["Renderer wander faces movement without authored rot offset", /harthmereYawForWorldForward\(\s*velocityX,\s*velocityZ,\s*instance\.forwardAxis/.test(files.renderer) && !/instance\.rot \+ Math\.atan2\(-velocityX, -velocityZ\)/.test(files.renderer)],
  ["Renderer can face combat actors toward targets", /private faceCombatActorToward/.test(files.renderer) && /renderer\.facing\.actor_toward/.test(files.renderer)],
  ["Renderer can face combat actors along swing direction", /private faceCombatActorAlong/.test(files.renderer) && /renderer\.facing\.actor_along/.test(files.renderer)],
  ["No missing debug method call", !/this\.debugHarthmereRenderer\(/.test(files.renderer)],
];

let ok = true;
for (const [label, pass] of checks) {
  console.log(`${pass ? "OK" : "FAIL"} ${label}`);
  if (!pass) ok = false;
}
console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
