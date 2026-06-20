#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const tsFile = path.join(root, "src/shared/game/medieval/harthmereEquipmentAnimationManifest.generated.ts");
const genFile = path.join(root, "scripts/harthmere/generate-equipment-animation-manifest.cjs");

let failures = 0;
function ok(name, pass) {
  if (pass) {
    console.log(`OK ${name}`);
  } else {
    console.log(`FAIL ${name}`);
    failures += 1;
  }
}

function hasBadDirectRecordCast(text) {
  // This catches the problematic lookup cast while allowing the intentional
  // `as unknown as Record<...>` form.
  return /\)\s+as\s+Record<string,\s*HarthmereEquipmentAnimationManifestEntry>/.test(text);
}

const ts = fs.readFileSync(tsFile, "utf8");
ok("manifest animations type is readonly", ts.includes("animations: readonly string[];"));
ok("manifest does not expose mutable animation array", !ts.includes("animations: string[];"));
ok("manifest lookup table casts through unknown", ts.includes("as unknown as Record<string, HarthmereEquipmentAnimationManifestEntry>"));
ok("manifest has no direct Object.fromEntries Record cast", !hasBadDirectRecordCast(ts));
ok("manifest keeps const literal data", ts.includes("as const satisfies readonly HarthmereEquipmentAnimationManifestEntry[]"));

const gen = fs.readFileSync(genFile, "utf8");
ok("generator emits readonly animation arrays", gen.includes("animations: readonly string[];"));
ok("generator emits unknown lookup cast", gen.includes("as unknown as Record<string, HarthmereEquipmentAnimationManifestEntry>"));
ok("generator has no direct Object.fromEntries Record cast", !hasBadDirectRecordCast(gen));

if (failures) {
  console.log(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
