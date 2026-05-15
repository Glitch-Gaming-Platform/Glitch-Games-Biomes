#!/usr/bin/env node
const fs = require('fs');
const path = process.argv[2];
if (!path) {
  console.error('Usage: node check-harthmere-unique-npc-cosmetics-v10.cjs /path/to/repo');
  process.exit(1);
}
const runtime = fs.readFileSync(`${path}/src/client/game/renderers/local_dev/harthmere_assets.ts`, 'utf8');
let ok = true;
function expect(cond, msg) {
  if (cond) {
    console.log(`OK ${msg}`);
  } else {
    console.log(`FAIL ${msg}`);
    ok = false;
  }
}
expect(runtime.includes('HARTHMERE_UNIQUE_NPC_COSMETICS_VERSION'), 'unique NPC cosmetics version exists');
expect(runtime.includes('makeHarthmereNpcBodyConfig'), 'runtime imports makeHarthmereNpcBodyConfig');
expect(runtime.includes('makeHarthmereNpcFaceConfig'), 'runtime imports makeHarthmereNpcFaceConfig');
expect(runtime.includes('function uniqueTownspersonPalette('), 'runtime defines uniqueTownspersonPalette');
expect(runtime.includes('function addUniqueNpcGear('), 'runtime defines addUniqueNpcGear');
expect(runtime.includes('function applyUniqueNpcVisualDecorations('), 'runtime defines applyUniqueNpcVisualDecorations');
expect(runtime.includes('root.userData.harthmereNpcCosmetics'), 'runtime stores npc cosmetics metadata');
expect(runtime.includes('applyUniqueNpcVisualDecorations(placement, clone);'), 'runtime decorates cloned townsperson prototypes');
expect(runtime.includes('applyUniqueNpcVisualDecorations(placement, root);'), 'runtime decorates procedural townspersons');
expect(runtime.includes('npc-guard-tabard'), 'guard-specific cosmetics exist');
expect(runtime.includes('npc-courier-satchel'), 'courier-specific cosmetics exist');
expect(runtime.includes('npc-farmer-hat'), 'farmer-specific cosmetics exist');
expect(runtime.includes('npc-clergy-stole-left'), 'clergy-specific cosmetics exist');
expect(runtime.includes('npc-hunter-quiver'), 'hunter-specific cosmetics exist');
expect(runtime.includes('npc-bandit-mask'), 'bandit/smuggler-specific cosmetics exist');
expect(runtime.includes('npc-undead-tatter-left'), 'undead-specific cosmetics exist');
expect(runtime.includes('setMeshColorByName(root, ["hair", "brow", "beard"], palette.hair);'), 'mesh recolor pass exists');
console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
