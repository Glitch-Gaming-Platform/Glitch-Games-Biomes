#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const content = read('src/shared/harthmere/snapshot_grove_content.ts');
const runtime = read('src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx');
const dialog = read('src/client/components/challenges/TalkToNPCDefaultDialog.tsx');
const shim = read('src/server/shim/main.ts');

let failures = 0;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
}
function blockFor(id) {
  const re = new RegExp(`\\{\\n\\s*id: "${id}",[\\s\\S]*?\\n\\s*\\},`);
  const match = content.match(re);
  return match ? match[0] : '';
}
function questBlock(id) {
  const re = new RegExp(`\\{\\n\\s*id: "${id}",[\\s\\S]*?\\n\\s*\\},`);
  const match = content.match(re);
  return match ? match[0] : '';
}

const jackie = blockFor('jackie');
const rosalyn = blockFor('rosalyn');
const taye = blockFor('taye');
const nia = blockFor('guild_clerk_nia');

ok(/seedServerNpc:\s*true/.test(jackie), 'Jackie is a server-seeded talkable Grove fountain NPC');
ok(/authoredPosition:\s*snapshotGroveFountainPosition\(0,\s*0\)/.test(jackie), 'Jackie is placed back at the live Grove fountain center');
ok(/seedServerNpc:\s*true/.test(rosalyn), 'Rosalyn is promoted from decorative/lore-only into a server-seeded talkable fountain NPC');
ok(/seedServerNpc:\s*true/.test(taye), 'Taye is a server-seeded talkable Grove fountain NPC');
ok(/seedServerNpc:\s*true/.test(nia), 'Nia is a server-seeded talkable Grove fountain NPC');
ok(/authoredPosition:\s*snapshotGroveFountainPosition\(3,\s*-2\)/.test(rosalyn), 'Rosalyn is placed at the live y=70 fountain cluster, not off in an old road/decorative location');
ok(/authoredPosition:\s*snapshotGroveFountainPosition\(-5,\s*2\)/.test(taye), 'Taye is placed inside the live fountain lesson cluster');
ok(/authoredPosition:\s*snapshotGroveFountainPosition\(6,\s*3\)/.test(nia), 'Nia is placed inside the live fountain lesson cluster');

const roadReady = questBlock('road_ready_bag_check');
const lostFound = questBlock('lost_found_and_mail');
const sparring = questBlock('safe_sparring_not_pvp');
const ready = questBlock('ready_check_at_fountain');
ok(/giverNpcId:\s*"rosalyn"/.test(roadReady), 'Road-ready tutorial is assigned to Rosalyn');
ok(/"npc_rosalyn"/.test(roadReady), 'Road-ready tutorial returns to Rosalyn, not Alexis');
ok(!/Talk to Alexis|Return to Alexis/.test(roadReady), 'Road-ready tutorial has production Rosalyn copy, not stale Alexis copy');
ok(/giverNpcId:\s*"rosalyn"/.test(lostFound), 'Lost-and-found/mail tutorial is assigned to Rosalyn');
ok(/"npc_rosalyn"/.test(lostFound), 'Lost-and-found/mail tutorial returns to Rosalyn, not Alexis');
ok(!/Talk to Alexis|Return to Alexis/.test(lostFound), 'Lost-and-found/mail tutorial has production Rosalyn copy, not stale Alexis copy');
ok(/giverNpcId:\s*"guild_clerk_nia"/.test(sparring), 'Sparring tutorial is assigned to Nia profile');
ok(/giverNpcId:\s*"guild_clerk_nia"/.test(ready), 'Ready-check tutorial is assigned to Nia profile');

ok(runtime.includes('snapshotGroveNpcIdForDialogLabel'), 'Grove dialog exports a real label/profile resolver for talkability');
ok(runtime.includes('nina: "guild_clerk_nia"'), 'Visible Nina/Nia label typo resolves to the Nia tutorial profile instead of woof-only default bark');
ok(runtime.includes('entityDescription?.text') && runtime.includes('defaultDialog'), 'Grove dialog resolver checks label, entity description, and default dialog');
ok(dialog.includes('snapshotGroveNpcIdForDialogLabel'), 'Talk prompt visibility uses the Grove tutorial resolver before live lore fallback');
ok(/quest_giver:\s*QuestGiver\.create/.test(shim), 'Server-seeded Grove tutorial NPCs receive quest_giver components and therefore expose Talk');
ok(shim.includes('displayName: npc.displayName'), 'Server-seeded Grove tutorial NPCs use the production NPC display names');

if (failures) {
  console.error(`current Grove fountain tutorial talkability check failed: ${failures}`);
  process.exit(1);
}
console.log('current Grove fountain tutorial talkability check passed');
