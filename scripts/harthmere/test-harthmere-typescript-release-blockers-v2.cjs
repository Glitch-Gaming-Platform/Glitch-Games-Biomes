#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
let ok = true;
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.error(`FAIL ${label}`); ok = false; }
}

const wake = read('src/client/components/WakeUpScreen.tsx');
check('WakeUpScreen guards optional clothing.back before cape test', wake.includes('const backClothingId = clothing?.back?.id ?? "";'));
check('WakeUpScreen no longer dereferences clothing.back.id directly', !wake.includes('clothing.back.id'));

const adminJson = read('src/client/components/admin/AdminReactJSON.tsx');
check('AdminReactJSON uses supported react18-json-view theme', adminJson.includes('theme="github"'));
check('AdminReactJSON theme prop is not broad unknown', !adminJson.includes('theme?: unknown'));

const cval = read('src/client/components/CvalHUD.tsx');
check('CvalHUD uses supported react18-json-view theme string', cval.includes('theme="vscode"'));
check('CvalHUD no longer passes base16 object theme to react18-json-view', !cval.includes('base00:'));

for (const rel of [
  'src/client/components/challenges/LocalDevHarthmereBuildingSystem.tsx',
  'src/client/components/challenges/LocalDevHarthmereEconomySystem.tsx',
  'src/client/components/challenges/LocalDevHarthmereGuildSystem.tsx',
]) {
  const src = read(rel);
  const bad = [...src.matchAll(/at:\s*Date\.now\(\),\n([\s\S]{0,220}?action:)/g)]
    .filter((m) => !m[1].includes('system: "inventory"') || !m[1].includes('actorId: "local-player"') || !m[1].includes('success:'));
  check(`${rel} inventory log entries include required typed fields`, bad.length === 0);
}

check('Storage mail recovery log keeps literal system type', read('src/client/components/challenges/LocalDevHarthmereStorageMailRecoverySystem.tsx').includes('system: "storage_mail_recovery" as const'));
check('Trade auction log keeps literal system type', read('src/client/components/challenges/LocalDevHarthmereTradeAuctionSystem.tsx').includes('system: "trade_auction" as const'));

const renderer = read('src/client/game/renderers/local_dev/harthmere_assets.ts');
check('Renderer imports combat impact frame window constant', renderer.includes('HARTHMERE_COMBAT_ANIMATION_IMPACT_FRAME_WINDOW_V1,'));
check('Renderer no longer references out-of-scope weapon variable', !renderer.includes('realVisualV18: weapon?.'));
check('Renderer no longer references missing combatPolishManualSwing member', !renderer.includes('harthmereCombatPolishManualSwingV1'));
check('Renderer preserves V10 weapon tracking without duplicate object key', renderer.includes('weaponHandTrackingV10:'));
check('Renderer renames legacy weapon tracking debug method', renderer.includes('weaponHandTrackingLegacy:'));
check('Renderer guards optional object results before reading asset/name/district', renderer.includes('if (!object) return false;'));

check('Player animation variation call is explicitly cast for typed animation registry', read('src/client/game/util/player_animations.ts').includes('singleAnimationWeight(harthmereVariationEmoteTypeV15 as any, 1)'));

const ecs = read('src/pages/admin/ecs/[id].tsx');
check('Admin ECS delete coerces field names to string', ecs.includes('field: String(field.name),'));
check('Admin ECS update path coerces namespace/name to strings', ecs.includes('.map(String);'));

check('Combat progression ability union includes movement_spell', read('src/shared/harthmere/complete_combat_progression_v1.ts').includes('"movement_spell"'));

const ai = read('src/shared/harthmere/third_party_combat_ai_v1.ts');
check('Third-party combat AI catalogs are const typed', ai.includes('} as const;'));
check('Third-party combat AI exports action key type', ai.includes('export type HarthmereCombatAIActionIdV1'));
check('Third-party combat AI clamp has typed parameters', ai.includes('clampV1(value: unknown, min: number, max: number)'));
check('Third-party combat AI blackboard input is typed', ai.includes('createHarthmereCombatAIBlackboardV1(input: HarthmereCombatAIInputV1 = {})'));
check('Third-party combat AI action scoring accepts typed inputs', ai.includes('scoreHarthmereCombatAIActionV1(actionId: string'));
check('Third-party combat AI normalizes dynamic action ids before indexing', ai.includes('normalizeCombatAIActionIdV1(actionId)'));

if (!ok) {
  console.error('RESULT: FAIL');
  process.exit(1);
}
console.log('RESULT: PASS');
