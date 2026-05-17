#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
let ok = true;
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.log(`FAIL ${label}`); ok = false; } }
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
console.log('== Harthmere Emoji Mart v5 migration tests v1 ==');
console.log(`Root: ${root}\n`);
const compatPath = 'src/client/util/emoji_mart_compat.ts';
check('Emoji Mart compatibility helper exists', fs.existsSync(path.join(root, compatPath)));
const compat = fs.existsSync(path.join(root, compatPath)) ? read(compatPath) : '';
check('compat helper imports @emoji-mart/data', /from "@emoji-mart\/data"/.test(compat));
check('compat helper imports init and SearchIndex from emoji-mart', /import \{ init, SearchIndex \} from "emoji-mart"/.test(compat));
check('compat helper initializes Emoji Mart data once', /init\(\{ data: emojiData \}\)/.test(compat) && /emojiMartInitialized/.test(compat));
check('compat helper exposes async search wrapper', /searchHarthmereEmoji/.test(compat) && /SearchIndex\.search/.test(compat));
check('compat helper exposes native emoji lookup by id', /getHarthmereEmojiNativeById/.test(compat));
const chat = read('src/client/components/ChatHUD.tsx');
check('ChatHUD no longer imports emoji-mart v3 types/index directly', !/from "emoji-mart"/.test(chat));
check('ChatHUD uses Harthmere emoji compat search', /searchHarthmereEmoji/.test(chat));
check('ChatHUD handles async emoji search failure safely', /Failed to search emoji autocomplete/.test(chat));
const team = read('src/client/components/teams/EditTeamActionSheet.tsx');
check('EditTeamActionSheet imports @emoji-mart/react Picker', /from "@emoji-mart\/react"/.test(team));
check('EditTeamActionSheet imports @emoji-mart/data', /from "@emoji-mart\/data"/.test(team));
check('EditTeamActionSheet uses onEmojiSelect instead of old onSelect API', /onEmojiSelect/.test(team) && !/onSelect=\{\(emoji\)/.test(team));
check('EditTeamActionSheet no longer imports emoji-mart/data/all.json', !/emoji-mart\/data\/all\.json/.test(team));
check('EditTeamActionSheet no longer imports Emoji component from emoji-mart v3', !/\bEmoji\b,\s*emojiIndex/.test(team));
console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
