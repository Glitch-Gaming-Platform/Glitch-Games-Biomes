const fs = require('fs');
function ok(cond, msg) { if (!cond) { console.error('FAIL ' + msg); process.exit(1); } console.log('OK ' + msg); }
const shim = fs.readFileSync('src/server/shim/main.ts', 'utf8');
const players = fs.readFileSync('src/server/logic/utils/players.ts', 'utf8');
const renderer = fs.readFileSync('src/client/game/renderers/local_dev/harthmere_assets.ts', 'utf8');
ok(shim.includes('HARTHMERE_EXTRA_TOWN_OFFSET_V1'), 'server shim extra-town offset marker is present');
ok(shim.includes('BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN === "1"'), 'server seed can opt into extra-town mode');
ok(shim.includes('harthmereExtraTownShardOffsetXV1()'), 'terrain shard specs are shifted');
ok(shim.includes('harthmereAuthoredWorldXV1(worldX)'), 'terrain generator maps shifted world X back to authored X');
ok(shim.includes('harthmereAuthoredWorldZV1(worldZ)'), 'terrain generator maps shifted world Z back to authored Z');
ok(shim.includes('position: harthmereWorldPositionV1(npc.position)'), 'NPC positions are shifted');
ok(players.includes('HARTHMERE_EXTRA_TOWN_PLAYER_START_OFFSET_V1'), 'player start offset marker is present');
ok(players.includes('offsetLocalDevStarterTownSpawnV1'), 'explicit Harthmere starts use shifted spawn');
ok(players.includes('return sample(CONFIG.playerStartPositions)!'), 'snapshot start remains default');
ok(renderer.includes('HARTHMERE_RUNTIME_EXTRA_TOWN_OFFSET_V1'), 'client runtime offset marker is present');
ok(renderer.includes('NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN'), 'client reads public extra-town flag');
ok(renderer.includes('shiftHarthmereRuntimePlacementForExtraTownV1'), 'client placements shift');
ok(renderer.includes('extra-town-offset-v1'), 'shifted client placements are tagged');
console.log('harthmere extra-town offset v3 check passed');
