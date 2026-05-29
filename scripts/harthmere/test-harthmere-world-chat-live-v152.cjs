#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${msg}`);
  }
}

console.log('== Harthmere live world chat v152 ==');
console.log(`Root: ${root}\n`);

const io = read('src/client/game/chat/io.ts');
const manager = read('src/client/components/chat/manager.ts');
const route = read('src/pages/api/chat/message.ts');
const util = read('src/server/shared/chat/util.ts');
const distributor = read('src/server/shared/chat/redis/distribution.ts');
const chatServer = read('src/server/chat/server.ts');
const runWeb = read('scripts/glitch/run-glitch-web.sh');
const runtime = read('src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx');
const overlays = read('src/client/game/scripts/overlays.ts');
const mailman = read('src/client/game/chat/mailman.ts');
const deploy = fs.existsSync(path.join(root, 'scripts/glitch/deploy-production-local-redis-smoke-v1.sh'))
  ? read('scripts/glitch/deploy-production-local-redis-smoke-v1.sh')
  : '';

ok(io.includes('position?: Vec3'), 'ChatIo sendMessage accepts current player position for spatial chat fallback');
ok(io.includes('position,\n            message') || io.includes('position,\r\n            message'), 'ChatIo posts current position to /api/chat/message');
ok(io.includes('spatial: {\n        volume,\n        position') || io.includes('spatial: {\r\n        volume,\r\n        position'), 'optimistic local envelope includes the same spatial position');

ok(route.includes('position: z.tuple([z.number(), z.number(), z.number()]).optional()'), 'chat message API accepts optional client position');
ok(route.includes('position,\n      },\n      message') || route.includes('position,\r\n      },\r\n      message'), 'chat message API forwards optional position into chatApi spatial envelope');

ok(util.includes('const authoritativePosition = await players.copyPosition(envelope.from)'), 'server attempts authoritative ECS/world position first');
ok(/if \(authoritativePosition\) \{[\s\S]*envelope\.spatial\.position = authoritativePosition/.test(util), 'server preserves client position fallback when authoritative position is missing');

ok(manager.includes('currentWorldChatPosition()'), 'ChatManager has a current world chat position helper');
ok(/sendMessage\([\s\S]*"chat"[\s\S]*this\.currentWorldChatPosition\(\)[\s\S]*\)/.test(manager), 'normal Enter chat sends live spatial position');
ok(/sendMessage\([\s\S]*"yell"[\s\S]*this\.currentWorldChatPosition\(\)[\s\S]*\)/.test(manager), '/yell sends live spatial position');
ok(/sendMessage\([\s\S]*"whisper"[\s\S]*kind: "typing"[\s\S]*this\.currentWorldChatPosition\(\)[\s\S]*\)/.test(manager), 'typing indicators are spatial and nearby-only');
ok(!/Unknown command.*input\)[\s\S]*sendMessage\(\s*"chat",\s*\{\s*kind: "text"/.test(manager), 'unknown slash commands still do not leak as public chat');

ok(runtime.includes('Harthmere world chat v152 sends'), 'HUD Chat panel documents real live chat delivery');
ok(runtime.includes('const { chatIo, gardenHose, mailman, reactResources, resources } = useClientContext()'), 'HUD Chat panel is wired to ChatIo, world resources, and errors');
ok(runtime.includes('void chatIo.sendMessage('), 'HUD Chat panel sends through real ChatIo backend');
ok(runtime.includes('channel === "say" ? "chat" : "whisper"'), 'HUD Chat panel maps Say to local chat and Whisper to short-range world speech');
ok(runtime.includes('resources.get("/ecs/c/player_current_team"'), 'HUD Chat panel routes Party messages to current team when available');
ok(runtime.includes('[Trade]'), 'HUD Chat panel maps Trade to a visible trade-prefixed yell');
ok(!runtime.includes('messages do not deliver to other players'), 'stale fake-chat warning is removed from HUD Chat panel');

ok(mailman.includes('recentTexts = new Map<BiomesId, Envelope>()'), 'MailMan tracks recent text envelopes for world speech bubbles');
ok(overlays.includes('this.mailMan.recentTexts.get(entity.id)'), 'overlays render other players recent speech above their heads');
ok(overlays.includes('OVERLAY_TEXT_TIME_MS'), 'world speech bubbles expire instead of staying forever');

ok(distributor.includes('determineSpatialTargets(this.players, envelope)'), 'Redis chat distributor scans spatial targets for nearby world chat');
ok(chatServer.includes('redisChatDistributor.runForever(signal)'), 'chat server runs Redis spatial distributor loop');
ok(runWeb.includes('GLITCH_DISABLE_GCP="${GLITCH_DISABLE_GCP:-1}"'), 'web runtime disables unavailable cloud services by default for embedded chat distributor');
ok(runWeb.includes('GLITCH_SKIP_GOOGLE_SECRETS="${GLITCH_SKIP_GOOGLE_SECRETS:-1}"'), 'web runtime skips Google secrets by default for local production smoke');
ok(runWeb.includes('GLITCH_DISABLE_DISCORD="${GLITCH_DISABLE_DISCORD:-1}"'), 'web runtime disables Discord by default for embedded chat distributor');
ok(runWeb.includes('GLITCH_ENABLE_CHAT_DISTRIBUTOR'), 'single-container Glitch web runtime starts embedded chat distributor by default');
ok(runWeb.includes('src/server/chat/main.ts'), 'embedded distributor starts the real chat server entrypoint');
ok(runWeb.includes('cleanup_children'), 'web runtime cleans up chat distributor on shutdown');

if (deploy) {
  ok(deploy.includes('test-harthmere-world-chat-live-v152.cjs'), 'production deploy guardrails include live world chat test');
}

if (process.exitCode) {
  console.error('\nRESULT: FAIL');
  process.exit(process.exitCode);
}
console.log('\nRESULT: PASS');
