#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const files = {
  assets: path.join(root, 'src/client/game/renderers/local_dev/harthmere_assets.ts'),
  npcs: path.join(root, 'src/client/game/resources/npcs.ts'),
  wake: path.join(root, 'src/client/components/WakeUpScreen.tsx'),
  faces: path.join(root, 'src/shared/harthmere/voxel_faces.ts'),
  css: path.join(root, 'src/client/styles/edit_character.css'),
};

let failures = 0;
function ok(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
}
function read(file) {
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}

const assets = read(files.assets);
const npcs = read(files.npcs);
const wake = read(files.wake);
const faces = read(files.faces);
const css = read(files.css);

ok('faces file exists', !!faces);
ok('wake file exists', !!wake);
ok('assets file exists', !!assets);
ok('npcs file exists', !!npcs);
ok('css file exists', !!css);

ok('storage cleanup export exists', /export function clearHarthmereOtherCustomizationSessionsForUser/.test(faces));
ok('storage cleanup keeps current user keys', /const keepKeys = new Set<string>/.test(faces) && /HARTHMERE_PLAYER_FACE_KEY_PREFIX/.test(faces));
ok('storage cleanup removes stale localStorage keys', /window\.localStorage\.removeItem\(key\)/.test(faces));
ok('storage cleanup clears anonymous session owner', /sessionStorage\?\.removeItem\(HARTHMERE_ANONYMOUS_CUSTOMIZATION_SESSION_KEY\)/.test(faces));
ok('storage cleanup dispatches audit event', /biomes:harthmere-customization-sessions-cleared/.test(faces));

ok('wake imports cleanup function', /clearHarthmereOtherCustomizationSessionsForUser/.test(wake));
ok('wake calls cleanup after migration', /migrateHarthmereAnonymousCustomizationToUser\(userId\);\s*const cleanup = clearHarthmereOtherCustomizationSessionsForUser\(userId\);/s.test(wake));
ok('builder hero class exists', /harthmere-wakeup-character-builder/.test(wake));
ok('builder uses larger two-column layout', /xl:grid-cols-\[minmax\(30rem,42rem\)_minmax\(0,1fr\)\]/.test(wake));
ok('builder has large preview container', /min-h-\[28rem\]/.test(wake));
ok('builder zooms camera closer', /new Spherical\(\s*2\.25,/s.test(wake));
ok('builder sets camera FOV', /cameraFOV=\{32\}/.test(wake));
ok('option row uses polished cards', /rounded-2xl border border-white\/10 bg-white\/\[0\.035\] p-2\.5/.test(wake));
ok('css scoped builder polish exists', /harthmere-wakeup-character-builder \.avatar-viewer/.test(css));

ok('runtime NPC cosmetics bumped to v12', /harthmere-unique-npc-cosmetics-v12-distinct-crowd/.test(assets));
ok('runtime NPC unique shoulder cloak exists', /npc-unique-shoulder-cloak-v12/.test(assets));
ok('runtime NPC unique hair streak exists', /npc-unique-hair-streak-v12/.test(assets));
ok('runtime NPC unique bandolier exists', /npc-unique-bandolier-v12/.test(assets));
ok('runtime NPC unique bedroll exists', /npc-unique-bedroll-v12/.test(assets));
ok('runtime NPC stores distinct seed', /distinctSeed: seed/.test(assets));

ok('ECS NPC v12 helper exists', /function addLocalDevNpcUniqueEnhancementDetails/.test(npcs));
ok('ECS NPC helper is called', /addLocalDevNpcUniqueEnhancementDetails\(root, id, label, palette, body, appearance\);/.test(npcs));
ok('ECS NPC unique shoulder cloak exists', /harthmere-npc-unique-shoulder-cloak-v12/.test(npcs));
ok('ECS NPC role-specific details exist', /harthmere-npc-unique-guard-medal-v12/.test(npcs) && /harthmere-npc-unique-red-sash-knot-v12/.test(npcs));
ok('ECS NPC stores v12 visual version', /harthmereNpcUniqueVisualVersion = "harthmere-unique-npc-cosmetics-v12-distinct-crowd"/.test(npcs));

if (failures) {
  console.log(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log('\nRESULT: PASS');
