#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const runtimePath = path.join(root, 'src/client/game/renderers/local_dev/harthmere_assets.ts');
let ok = true;
function expect(condition, label) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    console.log(`FAIL ${label}`);
    ok = false;
  }
}

if (!fs.existsSync(runtimePath)) {
  console.error(`FAIL missing runtime file ${runtimePath}`);
  process.exit(1);
}
const runtime = fs.readFileSync(runtimePath, 'utf8');

expect(runtime.includes('HARTHMERE_NPC_WALL_COLLISION_VERSION'), 'NPC wall collision version exists');
expect(runtime.includes('type HarthmereNpcCollisionObstacle ='), 'collision obstacle type exists');
expect(runtime.includes('HARTHMERE_NPC_COLLISION_RADIUS'), 'NPC collision radius exists');
expect(runtime.includes('harthmereNpcStaticObstacleForPlacement'), 'static placement-to-obstacle builder exists');
expect(runtime.includes('asset.startsWith("arch_wall_")'), 'building shell wall assets become obstacles');
expect(runtime.includes('asset.startsWith("obj_wall_")'), 'fortification wall assets become obstacles');
expect(runtime.includes('asset === "obj_church_iso"'), 'chapel landmark becomes obstacle');
expect(runtime.includes('harthmereNpcObstacleContainsPoint'), 'rotated rectangle point test exists');
expect(runtime.includes('findHarthmereNpcCollisionObstacle'), 'collision lookup exists');
expect(runtime.includes('lastSafePosition?: [number, number, number];'), 'animated instances store last safe position');
expect(runtime.includes('collisionBlockCount?: number;'), 'animated instances track collision block count');
expect(runtime.includes('this.resolveHarthmereNpcWanderPosition('), 'wander movement uses collision resolver');
expect(runtime.includes('private resolveHarthmereNpcWanderPosition('), 'collision resolver method exists');
expect(runtime.includes('private recordHarthmereNpcCollisionBlock('), 'collision debug recorder exists');
expect(runtime.includes('renderer.npc_wall_collision.blocked'), 'collision debug event exists');
expect(runtime.includes('__harthmereNpcCollisionObstacles'), 'debug window exposes collision obstacles');
expect(runtime.includes('__harthmereNpcCollisionStats'), 'debug window exposes collision stats');
expect(runtime.includes('npcWallCollisionObstacles: harthmereNpcCollisionObstacles().length'), 'load summary includes obstacle count');
expect(runtime.includes('lastSafePosition: [...placement.at] as [number, number, number]'), 'animated instances initialize last safe position');

try {
  const ts = require('typescript');
  const sf = ts.createSourceFile(runtimePath, runtime, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const diags = sf.parseDiagnostics || [];
  expect(diags.length === 0, 'runtime TypeScript parse diagnostics are clean');
  for (const d of diags.slice(0, 10)) {
    const pos = sf.getLineAndCharacterOfPosition(d.start || 0);
    console.error(`  ${runtimePath}:${pos.line + 1}:${pos.character + 1} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
  }
} catch (error) {
  console.warn('WARN TypeScript package not available for parse check; structural checks still ran.');
}

console.log('');
if (!ok) {
  console.error('RESULT: FAIL');
  process.exit(1);
}
console.log('RESULT: PASS');
