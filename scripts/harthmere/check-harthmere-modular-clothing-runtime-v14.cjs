#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
const files = {
  faces: path.join(root, 'src/shared/harthmere/voxel_faces.ts'),
  player: path.join(root, 'src/client/game/resources/player_mesh.ts'),
  npcs: path.join(root, 'src/client/game/resources/npcs.ts'),
  assets: path.join(root, 'src/client/game/renderers/local_dev/harthmere_assets.ts'),
};
let failed = false;
function read(name) {
  if (!fs.existsSync(files[name])) {
    console.log(`FAIL ${name} file exists`);
    failed = true;
    return '';
  }
  console.log(`OK ${name} file exists`);
  return fs.readFileSync(files[name], 'utf8');
}
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.log(`FAIL ${label}`); failed = true; }
}
const faces = read('faces');
const player = read('player');
const npcs = read('npcs');
const assets = read('assets');
check('shared clothing slots exist', faces.includes('HARTHMERE_CLOTHING_SLOTS'));
check('shared clothing item type supports modelUrl', /type HarthmereClothingItem[\s\S]*modelUrl\?: string/.test(faces));
check('shared appearance has clothing field', faces.includes('clothing: HarthmereCharacterClothing;'));
check('default role clothing factory exists', faces.includes('defaultHarthmereClothingForRole'));
check('normalize appearance writes clothing', faces.includes('const clothing = normalizeHarthmereClothing(') && faces.includes('clothing,'));
check('player imports clothing types', player.includes('type HarthmereCharacterClothing') && player.includes('type HarthmereClothingItem'));
check('player cache key includes clothing', player.includes('`cl:${Object.entries(appearance.clothing)'));
check('player awaits modular clothing runtime', player.includes('await addHarthmerePlayerModularClothingRuntime('));
check('player clothing runtime version exists', player.includes('harthmere-modular-clothing-runtime-v14'));
check('player finds clothing anchors by bone patterns', player.includes('harthmerePlayerClothingAnchor') && player.includes('rightHand') && player.includes('leftHand'));
check('player can load modular GLB clothing model', player.includes('loadHarthmerePlayerClothingModel') && player.includes('loadGltf(item.modelUrl)'));
check('player binds skinned clothing to body skeleton', player.includes('bindHarthmereSkinnedClothingToBodySkeleton') && player.includes('child.bind(bodySkinnedMesh.skeleton'));
check('player uses SkeletonUtils.clone for clothing GLB', player.includes('SkeletonUtils.clone(gltfToThree(gltf))'));
check('player falls back to procedural clothing proxies', player.includes('addHarthmerePlayerProceduralClothingProxy'));
check('player records hidden body zones', player.includes('harthmereHiddenBodyZones'));
check('ECS NPC imports clothing types', npcs.includes('type HarthmereCharacterClothing') && npcs.includes('type HarthmereClothingSlot'));
check('ECS NPC modular clothing helper exists', npcs.includes('addLocalDevNpcModularClothingDetails'));
check('ECS NPC helper is called', npcs.includes('addLocalDevNpcModularClothingDetails(root, appearance.clothing, palette, body);'));
check('ECS NPC adds v14 clothing meshes', npcs.includes('harthmere-npc-clothing-torso-v14') && npcs.includes('harthmere-npc-clothing-left-boot-v14'));
check('runtime cosmetics bumped to v14', assets.includes('harthmere-unique-npc-cosmetics-v14-modular-clothing'));
check('runtime stores modular clothing metadata', assets.includes('harthmereModularClothingRuntime') && assets.includes('harthmereClothingSlots'));
check('runtime adds v14 clothing overlays', assets.includes('townsperson-clothing-torso-v14') && assets.includes('townsperson-clothing-left-boot-v14'));
if (failed) {
  console.log('\nRESULT: FAIL');
  process.exit(1);
}
console.log('\nRESULT: PASS');
