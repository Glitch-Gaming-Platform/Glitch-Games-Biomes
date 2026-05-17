#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const wakePath = path.join(root, "src/client/components/WakeUpScreen.tsx");
const voxelPath = path.join(root, "src/shared/harthmere/voxel_faces.ts");
const playerMeshPath = path.join(root, "src/client/game/resources/player_mesh.ts");
function read(file) {
  if (!fs.existsSync(file)) {
    console.error(`FAIL missing ${path.relative(root, file)}`);
    process.exit(1);
  }
  return fs.readFileSync(file, "utf8");
}
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    console.log(`FAIL ${label}`);
    failed += 1;
  }
}
function hasAll(text, values) {
  return values.every((value) => text.includes(value));
}
let failed = 0;

const wake = read(wakePath);
const voxel = read(voxelPath);

check("load clothing falls back when browser storage is unavailable", voxel.includes("if (!isBrowserStorageAvailable())") && voxel.includes("return fallback;"));
check("load clothing tolerates corrupt JSON", voxel.includes("JSON.parse(raw)") && voxel.includes("catch") && voxel.includes("return fallback;"));
check("anonymous clothing is migrated to real user once", hasAll(voxel, [
  "anonymousClothingKey",
  "userClothingKey",
  "anonymousClothing",
  "window.localStorage.setItem(userClothingKey, anonymousClothing)",
]));
check("old customization cleanup keeps/removes clothing keys with face/body", voxel.includes("HARTHMERE_PLAYER_CLOTHING_KEY_PREFIX") && voxel.includes("HARTHMERE_PLAYER_CUSTOMIZATION_KEY_PREFIXES"));
check("optional clothing slots can be deleted rather than saved as bad null items", wake.includes("delete next[slot]") && wake.includes("item?.id ?? \"none\""));
check("only minimum required starter slots are auto-filled", voxel.includes('const requiredSlots: readonly HarthmereClothingSlot[] = ["torso", "legs", "feet", "belt"]'));
check("optional slots include head/face/hands/back/weapon/shield", hasAll(wake, [
  '"head"',
  '"face"',
  '"hands"',
  '"back"',
  '"weapon"',
  '"shield"',
]));
check("custom pronouns are included only when custom is active", wake.includes('expectedField !== "customPronouns" || result.face.pronouns === "custom"'));
check("coverage report remains no-storage to avoid QuotaExceededError", wake.includes("window.__harthmereBuilderCoverageReport") && wake.includes("DOM") || wake.includes("safe to run repeatedly") || wake.includes("no-storage"));
check("clothing audit exposes expected slots for full click-through tests", wake.includes("expectedClothingSlots: HARTHMERE_BUILDER_CLOTHING_SLOTS"));

console.log(`RESULT: ${failed === 0 ? "PASS" : "FAIL"}`);
process.exit(failed === 0 ? 0 : 1);
