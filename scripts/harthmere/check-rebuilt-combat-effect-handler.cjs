#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const rendererRel = "src/client/game/renderers/local_dev/harthmere_assets.ts";
const combatRel = "src/client/components/challenges/LocalDevHarthmereCombat.tsx";
const renderer = fs.readFileSync(path.join(root, rendererRel), "utf8");
const combat = fs.readFileSync(path.join(root, combatRel), "utf8");

let ok = true;
function check(label, condition) {
  console.log(`${condition ? "OK" : "FAIL"} ${label}`);
  if (!condition) ok = false;
}

const handlerStart = renderer.indexOf("harthmere-rebuilt-combat-effect-handler-v1");
const handlerEnd = renderer.indexOf("\n  private registerCombatLife(", handlerStart);
const handler = handlerStart >= 0 && handlerEnd > handlerStart ? renderer.slice(handlerStart, handlerEnd) : "";

const targetKindDecl = handler.indexOf("const targetKind: CombatPulseKind");
const targetMatch = handler.indexOf('debugHarthmereRenderer("renderer.combat_event.target_match"');
const targetPulse = handler.indexOf("this.startCombatPulse(target, targetKind");
const attackerDecl = handler.indexOf("const attacker = resolveCombatActor");
const attackerMatch = handler.indexOf('debugHarthmereRenderer("renderer.combat_event.attacker_match"');
const attackerPulse = handler.indexOf('this.startCombatPulse(attacker, "attack"');

check("rebuilt handler marker exists", handlerStart >= 0);
check("handler was found before registerCombatLife", handler.length > 0);
check("targetKind declared before target debug", targetKindDecl >= 0 && targetMatch > targetKindDecl);
check("targetKind declared before target pulse", targetKindDecl >= 0 && targetPulse > targetKindDecl);
check("attacker declared before attacker debug", attackerDecl >= 0 && attackerMatch > attackerDecl);
check("attacker declared before attacker pulse", attackerDecl >= 0 && attackerPulse > attackerDecl);
check("strict offset matching used", handler.includes("return this.findCombatLifeByOffset(offset);") && handler.includes("return this.findCombatLife(name);"));
check("physical effect route debug exists", handler.includes("renderer.combat_event.effect_route"));
check("physical attacks strip magic clips", handler.includes("withoutMagicClips"));
check("Training Dagger Strike-like text routes physical", handler.includes("dagger|strike|slash|swing"));
check("Spark remains explicit magic", handler.includes('String(detail.ability ?? "").toLowerCase() === "spark"'));
check("no this.debugHarthmereRenderer calls remain", !renderer.includes("this.debugHarthmereRenderer("));
check("combat log interface has clip priority fields", combat.includes("attackerClipPriority?: string[];") && combat.includes("targetClipPriority?: string[];"));
check("combat source has robust physical event text helper", combat.includes("isHarthmerePhysicalCombatEventText"));
check("combat source sets physical effectKind from display text", combat.includes('effectKind: isHarthmerePhysicalCombatEventText(`${entry.ability} ${entry.detail}`) ? "physical" : undefined'));

console.log("");
console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
