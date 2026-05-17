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

check("release-polish layout marker exists", wake.includes('data-harthmere-builder-layout="v21-release-polish-clothing"'));
check("layout uses modern two-panel responsive grid", wake.includes('lg:grid-cols-[minmax(22rem,30rem)_minmax(0,1fr)]'));
check("builder uses release-grade gradient/surface styling", wake.includes('bg-[radial-gradient') && wake.includes('rounded-[2rem]') && wake.includes('shadow-['));
check("preview panel copy is product-facing", wake.includes('Build a hero that looks ready to enter Harthmere.'));
check("preview is explicitly auto-saved", wake.includes('Auto-saved') && wake.includes('saved before the game starts'));
check("identity section copy references audit/persist behavior", wake.includes('Every option updates the preview, emits an audit event, and persists for runtime.'));
check("clothing panel is present", wake.includes('data-harthmere-builder-clothing-panel="release-clothing-picker"'));
check("starter clothing preset grid is present", wake.includes('data-harthmere-builder-clothing-presets="true"'));
check("per-slot clothing grid is present", wake.includes('data-harthmere-builder-clothing-slots="true"'));
check("mini body preview reflects clothing", wake.includes('data-harthmere-builder-mini-clothing-preview="true"') && wake.includes('clothing={harthmereClothing}'));
check("clothing UI components are split into testable focused components", hasAll(wake, ['const HarthmereClothingPresetCard', 'const HarthmereClothingOptionRow']));
check("interactive cards expose aria pressed state", wake.includes('aria-pressed={selected}'));
check("no Bootstrap button class leaked into new release builder", !wake.includes('btn btn'));

console.log(`RESULT: ${failed === 0 ? "PASS" : "FAIL"}`);
process.exit(failed === 0 ? 0 : 1);
