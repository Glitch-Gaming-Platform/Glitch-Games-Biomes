#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const files = {
  mp: path.join(root, "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx"),
  hud: path.join(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx"),
  combat: path.join(root, "src/client/components/challenges/LocalDevHarthmereCombat.tsx"),
  assets: path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"),
  shortcuts: path.join(root, "src/client/components/ShortcutsHUD.tsx"),
};

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  return fs.readFileSync(file, "utf8");
}

const mp = read(files.mp);
const hud = read(files.hud);
const combat = read(files.combat);
const assets = read(files.assets);
const shortcuts = read(files.shortcuts);

const checks = [
  ["primary click owns basic and B is not a combat key", /basic:\s*"Mouse0"/.test(mp) && !/code\s*===\s*["']KeyB["'][\s\S]{0,90}return\s+["']basic["']/.test(mp)],
  ["H maps to heavy", /KeyH[\s\S]{0,320}performHarthmereKeyedAttack\("heavy"\)/.test(mp) || /HARTHMERE_COMBAT_KEY_BINDINGS\.heavy[\s\S]{0,320}performHarthmereKeyedAttack\("heavy"\)/.test(mp)],
  ["L maps to spark", /KeyL[\s\S]{0,320}performHarthmereKeyedAttack\("spark"\)/.test(mp) || /HARTHMERE_COMBAT_KEY_BINDINGS\.spark[\s\S]{0,320}performHarthmereKeyedAttack\("spark"\)/.test(mp)],
  ["Shortcuts reserve H/L but leave B to Bank", !shortcuts.includes('"KeyB"') && shortcuts.includes('"KeyH"') && shortcuts.includes('"KeyL"')],
  ["Combat events include clip priority", combat.includes("attackerClipPriority") && combat.includes("targetClipPriority")],
  ["Renderer consumes clip priority", assets.includes("preferredClipNames") && assets.includes("attackerClipPriority") && assets.includes("targetClipPriority")],
  ["Human clips routed", assets.includes("HeavyAttack") && assets.includes("BasicMagic") && assets.includes("SideSwing")],
  ["Animal clips routed", assets.includes("Bite") && assets.includes("Claw") && assets.includes("Pounce") && assets.includes("TailWhip")],
  ["Menu exposes heavy", mp.includes("HeavyAttack") && hud.includes("HeavyAttack") && combat.includes("Heavy Attack")],
];

let ok = true;
for (const [label, pass] of checks) {
  console.log(`${pass ? "OK" : "FAIL"} ${label}`);
  if (!pass) ok = false;
}
if (!ok) process.exit(1);
console.log("RESULT: PASS");
