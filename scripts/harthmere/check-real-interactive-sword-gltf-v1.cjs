#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
let failed = false;
function check(ok, label) {
  if (ok) console.log(`OK ${label}`);
  else { failed = true; console.error(`FAIL ${label}`); }
}
const renderer = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const manifest = read("src/shared/game/medieval/harthmereEquipmentAnimationManifest.generated.ts");
check(manifest.includes("sword_1handed"), "equipment manifest contains sword_1handed");
check(manifest.includes("BasicSlash_24") && manifest.includes("HeavySlash_24"), "equipment manifest contains sword slash clips");
check(renderer.includes("getHarthmereEquipmentAnimation"), "renderer imports equipment manifest lookup");
check(renderer.includes("HARTHMERE_PLAYER_SWORD_EQUIPMENT_IDS"), "renderer has sword manifest id priority list");
check(renderer.includes("loadHarthmerePlayerSwordGltf"), "renderer loads real sword GLTF");
check(renderer.includes("normalizeHarthmerePlayerSwordGltfScale"), "renderer normalizes imported sword scale");
check(renderer.includes("playHarthmerePlayerSwordClip"), "renderer can play sword animation clips");
check(renderer.includes("Draw_24") && renderer.includes("Sheathe_24"), "renderer references draw/sheath clips");
check(renderer.includes("BasicSlash_24") && renderer.includes("HeavySlash_24"), "renderer references basic/heavy sword clips");
check(renderer.includes("this.harthmerePlayerSwordMixer?.update(dt);"), "renderer ticks sword animation mixer");
check(renderer.includes("this.harthmerePlayerSwordUsingGltf ? 0 :"), "procedural fallback swing does not double-swing GLTF");
check(renderer.includes("renderer.player_sword.gltf_loaded"), "renderer logs GLTF sword load success");
check(renderer.includes("renderer.player_sword.gltf_failed"), "renderer logs GLTF sword load failure");
check(hud.includes('const itemId = "iron_longsword"'), "HUD pins sword visual to longsword for current renderer");
check(!hud.includes('itemId: selectedItem?.id ?? "iron_longsword"'), "HUD no longer lets selected dagger override sword visual");
if (failed) { console.error("\nRESULT: FAIL"); process.exit(1); }
console.log("\nRESULT: PASS");
