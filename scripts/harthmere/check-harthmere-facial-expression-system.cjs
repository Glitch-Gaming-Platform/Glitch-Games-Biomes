#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const repo = process.argv[2] || process.cwd();
const checks = [];
function read(rel) { return fs.readFileSync(path.join(repo, rel), 'utf8'); }
function ok(name, condition) { checks.push({ name, condition: Boolean(condition) }); console.log(`${condition ? 'OK' : 'FAIL'} ${name}`); }
const shared = read('src/shared/harthmere/voxel_faces.ts');
const player = read('src/client/game/resources/player_mesh.ts');
const runtime = read('src/client/game/renderers/local_dev/harthmere_assets.ts');
ok('shared exports facial expression enum', /HARTHMERE_FACIAL_EXPRESSIONS/.test(shared));
ok('shared exports facial expression event name', /HARTHMERE_FACIAL_EXPRESSION_EVENT/.test(shared));
ok('shared maps expression from affinity', /harthmereFacialExpressionFromAffinity/.test(shared));
ok('shared maps expression from mood', /harthmereFacialExpressionFromMood/.test(shared));
ok('shared creates normalized expression state', /makeHarthmereFacialExpressionState/.test(shared));
ok('shared dispatches facial expression event', /dispatchHarthmereFacialExpressionEvent/.test(shared));
ok('appearance schema includes facial expression state', /facialExpression:\s*HarthmereFacialExpressionState/.test(shared));
ok('appearance normalizer includes facial expression state', /facialExpression:\s*normalizeHarthmereFacialExpressionState/.test(shared));
ok('player imports expression event helpers', /HARTHMERE_FACIAL_EXPRESSION_EVENT/.test(player) && /dispatchHarthmereFacialExpressionEvent/.test(player));
ok('player stores neutral face transforms', /rememberHarthmerePlayerFacePartNeutralTransform/.test(player));
ok('player applies facial expression transforms', /applyHarthmerePlayerFacialExpressionToFaceRoot/.test(player));
ok('player expression bridge is installed', /installHarthmerePlayerFacialExpressionBridge/.test(player));
ok('player exposes console expression helper', /__harthmereSetPlayerFacialExpression/.test(player));
ok('player disposes expression bridge', /disposeExpressionBridge\?\.\(\)/.test(player));
ok('runtime imports expression event helpers', /HARTHMERE_FACIAL_EXPRESSION_EVENT/.test(runtime) && /dispatchHarthmereFacialExpressionEvent/.test(runtime));
ok('runtime stores neutral face transforms', /rememberHarthmereRuntimeFacePartNeutralTransform/.test(runtime));
ok('runtime applies expression transforms', /applyHarthmereRuntimeFacialExpressionToFaceRoot/.test(runtime));
ok('runtime installs expression bridge', /installHarthmereFacialExpressionBridge/.test(runtime));
ok('runtime can find actors by expression target', /findCombatLifeForFacialExpression/.test(runtime));
ok('runtime exposes console expression helper', /__harthmereSetFacialExpression/.test(runtime));
ok('runtime snapshot includes facialExpression metadata', /facialExpression:\s*actor\.object\.userData\.harthmereFacialExpression/.test(runtime));
ok('runtime register applies initial expression', /applyHarthmereRuntimeFacialExpressionToObject\(object, appearance\.facialExpression\)/.test(runtime));
const failed = checks.filter((c) => !c.condition);
console.log(`\nRESULT: ${failed.length ? 'FAIL' : 'PASS'}`);
if (failed.length) process.exit(1);
