#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

const inbox = read('src/client/components/biomes_ui/tabs/InboxTab.tsx');
const adapters = read('src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts');
const clientIo = read('src/client/game/chat/io.ts');
const chatApi = read('src/server/shared/chat/api.ts');
const chatUtil = read('src/server/shared/chat/util.ts');
const redisChat = read('src/server/shared/chat/redis/redis.ts');
const memoryChat = read('src/server/shared/chat/memory.ts');
const deploy = read('scripts/glitch/deploy-production-local-redis-smoke-v1.sh');

let failures = 0;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
}

console.log('== BiomesUI live inbox / direct messaging v151 ==');
console.log(`Root: ${root}`);
console.log('');

ok(exists('src/client/components/biomes_ui/tabs/InboxTab.tsx'), 'BiomesUI Inbox tab exists');
ok(!/const\s+PLACEHOLDER\s*[:=]/.test(inbox), 'Inbox tab no longer uses placeholder/dummy messages');
ok(!/Jackie"|Singularity Bureau|The Stabilizers/.test(inbox), 'Inbox tab does not ship fake sample messages');
ok(/getThreads\?/.test(inbox), 'Inbox adapter supports real direct-message threads');
ok(/resolveUserName\?/.test(inbox), 'Inbox adapter supports username lookup before starting a thread');
ok(/sendDirectMessage\?/.test(inbox), 'Inbox adapter supports sending a direct message');
ok(/No direct message threads yet/.test(inbox), 'Empty state is honest when no real messages exist');
ok(/Player username/.test(inbox), 'Inbox exposes a player username field for starting messages');
ok(/Message \{selectedLabel\}/.test(inbox) || /Message \$\{selectedLabel\}/.test(inbox), 'Inbox compose box targets the selected player');
ok(/sendTo\(selectedRecipient/.test(inbox), 'Inbox submit sends to selected recipient');

ok(/reactResources\.use\("\/dms"\)/.test(adapters), 'Live adapter reads real DM resource /dms');
ok(/reactResources\.use\("\/activity"\)/.test(adapters), 'Live adapter reads real activity notifications');
ok(/const\s+inboxAdapter\s*=/.test(adapters), 'Live adapter creates an inbox adapter');
ok(/inbox:\s*inboxAdapter/.test(adapters), 'BiomesUI receives the live inbox adapter');
ok(/socialManager\.resolveUserName\(username\.trim\(\)\)/.test(adapters), 'Live adapter resolves recipients through SocialManager username lookup');
ok(/chatIo\.sendMessage\("chat",\s*\{\s*kind:\s*"text",\s*content\s*\},\s*toUserId\)/s.test(adapters), 'Live adapter sends direct text through ChatIo with a recipient id');
ok(/envelope\.to === userId \? envelope\.from : envelope\.to/.test(adapters), 'Live adapter threads messages by other participant, not by current user');
ok(/message\?\.kind !== "text"/.test(adapters), 'Live adapter only presents text DMs in BiomesUI messaging threads');

ok(/to\?:\s*BiomesId/.test(clientIo), 'Client ChatIo sendMessage already supports a recipient id');
ok(/jsonPost<SendMessageResponse, SendMessageRequest>\(\s*"\/api\/chat\/message"/.test(clientIo), 'Client ChatIo sends through authenticated /api/chat/message');
ok(/to,\s*\}\s*\)/s.test(clientIo), 'Client ChatIo includes recipient id in request payload');

ok(/to:\s*zBiomesId\.optional\(\)/.test(chatApi), 'Server ChatApi request schema accepts recipient id');
ok(/return channelOverrides \?\? \(to \? "dm" : "chat"\)/.test(chatUtil), 'Server chooses dm channel when recipient id exists');
ok(/targets\.add\(envelope\.to\)/.test(chatUtil), 'Server targets the recipient for direct messages');
ok(/targets\.add\(envelope\.from\)/.test(chatUtil), 'Server echoes direct messages to the sender');
ok(/new PreparedDelivery\(channelName, envelope, "mail"\)/.test(redisChat), 'Redis chat stores prepared DM deliveries');
ok(/this\.storage\.get\(target\)\.accept\(delivery\)/.test(memoryChat), 'In-memory chat stores DM deliveries for tests/dev');
ok(/sendWebPushMessages\(this\.pushContext\.db, target, envelopes\)/.test(read('src/server/shared/chat/redis/distribution.ts')), 'DM channel still participates in push notification distribution');

ok(/test-biomes-ui-inbox-live-messaging-v151\.cjs/.test(deploy), 'Production deploy guardrails include live inbox messaging test');

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log('\nRESULT: PASS');
