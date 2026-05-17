#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let ok = true;
function assert(c, m) { if (!c) throw new Error(m); }
function check(label, fn) { try { fn(); console.log(`OK ${label}`); } catch (e) { ok = false; console.error(`FAIL ${label}: ${e.message}`); } }
const sharedPath = path.join(root, "src/shared/harthmere/combat_animation_polish_v1.ts");
const rendererPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const shared = fs.readFileSync(sharedPath, "utf8");
const renderer = fs.existsSync(rendererPath) ? fs.readFileSync(rendererPath, "utf8") : "";
function finish(name) { if (!ok) process.exit(1); console.log(`RESULT: PASS ${name}`); }

check("impact window is locked to readable 12-15 frame range", () => {
  assert(/HARTHMERE_COMBAT_ANIMATION_IMPACT_FRAME_WINDOW_V1\s*=\s*\[12,\s*15\]/.test(shared), "impact window should be [12, 15]");
});
check("all declared attack impact frames fall inside the hit window", () => {
  const frames = [...shared.matchAll(/impactFrame:\s*(\d+)/g)].map((m) => Number(m[1]));
  assert(frames.length >= 18, "expected weapon and magic impact frames");
  const bad = frames.filter((f) => f < 12 || f > 15);
  assert(bad.length === 0, `impact frames outside 12-15: ${bad.join(",")}`);
});
check("visual impact, damage, trail, and VFX sync rules are explicit", () => {
  for (const key of ["damageEventMustBeInsideVisualImpactWindow", "trailPeakFrameBeforeOrAtImpact", "impactVfxMustSpawnInWindow", "visualRecoveryMustNotStartBeforeImpact"]) {
    assert(shared.includes(key), `missing ${key}`);
  }
});
finish("combat animation impact-frame sync v3");
