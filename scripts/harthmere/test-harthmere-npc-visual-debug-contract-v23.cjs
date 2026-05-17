#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const runtimePath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const runtime = fs.readFileSync(runtimePath, "utf8");

let ok = true;
function check(label, condition, detail) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.error(`FAIL ${label}`);
    if (detail) console.error(`     ${detail}`);
  }
}

check("runtime exposes root appearance marker", runtime.includes("harthmereAppearance"));
check("runtime exposes clothing key marker", runtime.includes("harthmereForceProceduralTownspersonClothingKeysV13") || runtime.includes("harthmereForceProceduralTownspersonClothingKeysV12"));
check("runtime exposes outfit color marker", runtime.includes("harthmereRuntimeOutfitColorV17"));
check("runtime exposes weapon slot marker", runtime.includes("harthmereProceduralWeaponSlotV15"));
check("runtime exposes face shape marker through named v15 meshes", runtime.includes("face-shape-wide-jaw-v15") && runtime.includes("face-shape-narrow-chin-v15"));

const browserSnippet = String.raw`
/*
Paste this in the browser console after Harthmere loads to inspect final visual
expression on rendered NPC objects. This is a manual runtime audit helper until
we wire a first-class browser debug bridge.

(() => {
  const roots = [];
  const walk = (obj) => {
    if (!obj) return;
    if (obj.userData?.harthmereAppearance || obj.userData?.harthmereForceProceduralTownspersonClothingV13) {
      roots.push(obj);
    }
    for (const child of obj.children ?? []) walk(child);
  };

  const scene =
    window.__harthmereRuntimeScene ||
    window.__harthmereAssetsRenderer?.scene ||
    window.__harthmereAssetsRenderer?.root ||
    window.__biomesScene;

  walk(scene);

  return roots.map((root) => {
    const meshes = [];
    root.traverse?.((child) => {
      if (child?.isMesh) {
        meshes.push({
          name: child.name,
          visible: child.visible,
          position: child.position?.toArray?.(),
          scale: child.scale?.toArray?.(),
          color: child.material?.color?.getHexString?.(),
          markers: child.userData,
        });
      }
    });

    return {
      name: root.name,
      scale: root.scale?.toArray?.(),
      body: root.userData?.harthmereAppearance?.body,
      face: root.userData?.harthmereAppearance?.face,
      clothing: root.userData?.harthmereAppearance?.clothing,
      clothingKeys: root.userData?.harthmereForceProceduralTownspersonClothingKeysV13,
      outfitColor: root.userData?.harthmereRuntimeOutfitColorV17,
      meshCount: meshes.length,
      clothingMeshCount: meshes.filter((m) => /cloth|tunic|belt|boot|sleeve|weapon|shield|cape|robe|tabard|apron/i.test(m.name)).length,
      meshes,
    };
  });
})()
*/
`;

const docPath = path.join(root, "scripts/harthmere/harthmere-npc-visual-runtime-audit-v23.js.txt");
fs.writeFileSync(docPath, browserSnippet, "utf8");
console.log(`WROTE ${docPath}`);

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
