#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const playerPath = path.join(root, "src/client/game/resources/player_mesh.ts");
const runtimePath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const player = fs.readFileSync(playerPath, "utf8");
const runtime = fs.readFileSync(runtimePath, "utf8");

let failed = false;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    failed = true;
    console.error(`FAIL ${message}`);
  }
}

ok(player.includes('RoundedBoxGeometry'), 'player imports Three.js RoundedBoxGeometry addon');
ok(runtime.includes('RoundedBoxGeometry'), 'runtime imports Three.js RoundedBoxGeometry addon');
ok(player.includes('MeshToonMaterial'), 'player uses Three.js MeshToonMaterial');
ok(runtime.includes('MeshToonMaterial'), 'runtime uses Three.js MeshToonMaterial');
ok(player.includes('getHarthmerePlayerToonGradientMap'), 'player has library-backed toon gradient helper');
ok(runtime.includes('getHarthmereRuntimeToonGradientMap'), 'runtime has library-backed toon gradient helper');
ok(player.includes('makeHarthmerePlayerRoundedVoxelGeometry'), 'player has rounded voxel geometry helper');
ok(runtime.includes('makeHarthmereRuntimeRoundedVoxelGeometry'), 'runtime has rounded voxel geometry helper');
ok(player.includes('harthmereThirdPartyVisualPolish'), 'player annotates third-party visual polish metadata');
ok(runtime.includes('harthmereThirdPartyVisualPolish'), 'runtime annotates third-party visual polish metadata');
ok(runtime.includes('makeHarthmereRuntimeRoundedVoxelGeometry([0.075, 0.075, 1.22])'), 'fallback sword blade uses rounded geometry');
ok(runtime.includes('makeHarthmereRuntimeRoundedVoxelGeometry([0.46, 0.095, 0.075])'), 'fallback sword guard uses rounded geometry');
ok(runtime.includes('animalMaterial(0xcfd7df)'), 'fallback sword blade uses toon material helper');
ok(!runtime.includes('new THREE.BoxGeometry(0.075, 0.075, 1.22)'), 'fallback sword no longer uses raw BoxGeometry blade');
ok(player.includes('This is intentionally centralized so future artists can tune radius/segments'), 'player has future-artist tuning comment');
ok(runtime.includes('The cache is important: Harthmere can place hundreds'), 'runtime has performance/cache comment');
ok((player.match(/RoundedBoxGeometry/g) || []).length >= 3, 'player uses rounded geometry in more than import only');
ok((runtime.match(/RoundedBoxGeometry/g) || []).length >= 3, 'runtime uses rounded geometry in more than import only');

if (failed) {
  console.error('\nRESULT: FAIL');
  process.exit(1);
}
console.log('\nRESULT: PASS');
