#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const files = {
  faces: path.join(root, "src/shared/harthmere/voxel_faces.ts"),
  player: path.join(root, "src/client/game/resources/player_mesh.ts"),
  npcs: path.join(root, "src/client/game/resources/npcs.ts"),
  assets: path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"),
};
let ok = true;
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    console.log(`FAIL ${label}`);
    ok = false;
  }
}
function read(file) {
  if (!fs.existsSync(file)) {
    console.log(`FAIL missing file ${file}`);
    ok = false;
    return "";
  }
  return fs.readFileSync(file, "utf8");
}
const faces = read(files.faces);
const player = read(files.player);
const npcs = read(files.npcs);
const assets = read(files.assets);

check("shared clothing render mode type exists", /HarthmereClothingRenderMode/.test(faces));
check("shared clothing fit mode type exists", /HarthmereClothingFitMode/.test(faces));
check("clothing items support renderMode", /renderMode\?: HarthmereClothingRenderMode/.test(faces));
check("clothing items support body fit mode", /fitMode\?: HarthmereClothingFitMode/.test(faces));
check("normalizer defaults body-fitted slots", /normalizedSlot === "torso"[\s\S]*\? "body"/.test(faces));
check("defaults prefer threejs renderer", /renderMode: "threejs"/.test(faces));
check("defaults set fitMode body", /fitMode: "body"/.test(faces));
check("player v15 runtime version exists", /harthmere-modular-clothing-runtime-v15-body-fit/.test(player));
check("player has clothing renderer storage key", /biomes\.localDev\.harthmere\.clothingRenderer/.test(player));
check("player computes body fit metrics from body customization", /function harthmerePlayerClothingFitMetrics/.test(player) && /body\.bodyType/.test(player) && /body\.shoulderWidth/.test(player) && /body\.legLength/.test(player));
check("player has threejs renderer resolver", /function harthmerePlayerClothingRenderMode/.test(player));
check("player can force threejs without GLB", /renderMode !== "threejs"/.test(player));
check("player fits GLB clothing to body target", /function fitHarthmerePlayerClothingObjectToBody/.test(player) && /harthmereClothingBodyFitTarget/.test(player));
check("player procedural clothing is body-fitted", /harthmere-threejs-clothing-v15-body-fit/.test(player));
check("player stores body fitted slots", /harthmereBodyFittedClothingSlots/.test(player));
check("player stores gltf and threejs slots", /harthmereGltfClothingSlots/.test(player) && /harthmereThreeJsClothingSlots/.test(player));
check("ECS NPC clothing runtime bumped to v15", /harthmere-modular-clothing-runtime-v15-body-fit/.test(npcs));
check("ECS NPC stores clothing fit metrics", /harthmereClothingFitMetrics = body/.test(npcs));
check("runtime clothing runtime bumped to v15", /harthmere-modular-clothing-runtime-v15-body-fit/.test(assets));
check("runtime stores clothing fit metrics", /harthmereClothingFitMetrics = body/.test(assets));
check("runtime NPC cosmetics bumped to body-fit version", /harthmere-unique-npc-cosmetics-v15-body-fit-clothing/.test(assets));

console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
