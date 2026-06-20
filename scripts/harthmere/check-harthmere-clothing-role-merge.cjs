#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const faces = path.join(root, "src/shared/harthmere/voxel_faces.ts");
const text = fs.readFileSync(faces, "utf8");

let ok = true;

function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.log(`FAIL ${label}`);
  }
}

check("current marker exists", text.includes("HARTHMERE_LICENSED_CLOTHING_ROLE_MERGE"));
check("licensed role query imported", text.includes("getHarthmereLicensedClothingForRole"));
check("licensed merge helper exists", text.includes("mergeHarthmereLicensedClothingDefaults"));
check("role normalizer exists", text.includes("normalizeHarthmereLicensedClothingRoleName"));
check("default role clothing factory wrapped", /Base\(/.test(text));
check("licensed asset metadata preserved", text.includes("licenseId") && text.includes("licensedAsset"));
check("reference-only assets excluded by default", text.includes("includeReferenceOnlyAssets: false"));

console.log("");
console.log(`RESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
