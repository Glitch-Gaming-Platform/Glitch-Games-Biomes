#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let ok = true;
function assert(c, m) { if (!c) throw new Error(m); }
function check(label, fn) { try { fn(); console.log(`OK ${label}`); } catch (e) { ok = false; console.error(`FAIL ${label}: ${e.message}`); } }
const renderer = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
const shared = fs.readFileSync(path.join(root, "src/shared/harthmere/combat_animation_polish_v1.ts"), "utf8");
check("shared defines hilt/tip axis contract", () => assert(/hiltToTipAxis:\s*"local \+Z"[\s\S]{0,120}hiltLocalZ:\s*-0\.52[\s\S]{0,120}tipLocalZ:\s*0\.98/.test(shared), "missing hilt/tip axis contract"));
check("renderer applies straight pointing quaternion from local +Z to forward", () => assert(/applyHarthmereWeaponStraightPointingV2[\s\S]{0,900}localTipAxis = new THREE\.Vector3\(0, 0, 1\)[\s\S]{0,400}setFromUnitVectors\(localTipAxis, straightForward\)/.test(renderer), "missing straight pointing quaternion"));
check("renderer records hilt and tip world positions", () => assert(/recordHarthmereWeaponTipHiltDirectionV2[\s\S]{0,900}localHilt[\s\S]{0,200}localTip[\s\S]{0,500}hiltWorld[\s\S]{0,300}tipWorld/.test(renderer), "missing hilt/tip recording"));
check("renderer tests hilt-to-tip forward dot", () => assert(/hiltToTipForwardDot[\s\S]{0,280}minimumTipForwardDot[\s\S]{0,220}pointsStraightEnough/.test(renderer), "missing direction dot/budget"));
check("update loop calls straight pointing during run/neutral and attack", () => assert(/applyHarthmereWeaponStraightPointingV2\(sword, handAnchor, harthmerePlayerForwardV18/.test(renderer) && /applyHarthmereWeaponStraightPointingV2\(sword, handAnchor, rawSwingForwardV18/.test(renderer), "straight pointing not called in update and manual swing"));
if (!ok) process.exit(1);
console.log("RESULT: PASS combat animation tip/hilt direction v2");
