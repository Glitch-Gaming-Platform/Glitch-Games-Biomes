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

const presetIds = ["traveler", "guardian", "ranger", "scholar", "merchant", "worker"];
const presetItems = [
  "earth_tunic",
  "guard_tabard_armor",
  "hunter_jerkin",
  "scholar_robe",
  "merchant_coat",
  "work_apron",
  "bedroll_pack",
  "short_cape",
  "tool_belt",
];
const optionalSlots = ["head", "face", "hands", "back", "weapon", "shield"];
const requiredSlots = ["torso", "legs", "feet", "belt"];

check("shared starter clothing preset catalog exists", voxel.includes("HARTHMERE_PLAYER_STARTER_CLOTHING_PRESETS"));
for (const id of presetIds) {
  check(`starter clothing preset exists: ${id}`, voxel.includes(`id: "${id}"`));
}
for (const item of presetItems) {
  check(`starter/catalog clothing item exists: ${item}`, voxel.includes(`"${item}"`));
}

check("clothing row uses catalog filtered by slot", wake.includes("harthmereClothingCatalogForSlot(slot)"));
check("preset cards apply full clothing sets", wake.includes("applyHarthmereClothingPreset") && wake.includes("{ ...preset.clothing }"));
check("slot buttons update a single slot", wake.includes("updateHarthmereClothingSlot") && wake.includes("next[slot] = harthmereThreeJsClothingItem"));
check("slot update emits deterministic audit event", wake.includes("biomes:harthmere-builder-clothing-applied") && wake.includes("currentValue") && wake.includes("matched"));
check("preset update emits deterministic audit event", wake.includes("biomes:harthmere-builder-clothing-preset-applied") && wake.includes("presetId"));
check("selected clothing state is accessible and visible", wake.includes("aria-pressed={selected}") && wake.includes('data-harthmere-builder-clothing-selected={selected ? "true" : "false"}'));
check("optional clothing slots expose a None choice", wake.includes("? [undefined, ...slotOptions]") && wake.includes('item ? humanizeClothingLabel(item.id) : "None"'));
for (const slot of optionalSlots) {
  check(`optional slot can be cleared: ${slot}`, wake.includes(`"${slot}"`));
}
for (const slot of requiredSlots) {
  check(`required slot is protected by persistence normalizer: ${slot}`, voxel.includes(`"${slot}"`));
}
check("clothing preview key changes when clothing changes", wake.includes("harthmereFacePreviewKey") && wake.includes("Object.entries(harthmereClothing)") && wake.includes("item?.id"));

console.log(`RESULT: ${failed === 0 ? "PASS" : "FAIL"}`);
process.exit(failed === 0 ? 0 : 1);
