#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = process.argv[2] || process.cwd();
const assetsPath = path.join(repo, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const text = fs.readFileSync(assetsPath, "utf8");

let failures = 0;
const ok = (msg) => console.log(`OK ${msg}`);
const fail = (msg) => { console.log(`FAIL ${msg}`); failures += 1; };
const has = (needle, msg) => text.includes(needle) ? ok(msg) : fail(msg);
const notRe = (re, msg) => re.test(text) ? fail(msg) : ok(msg);
const hasRe = (re, msg) => re.test(text) ? ok(msg) : fail(msg);

has('harthmere-syntax-repair-after-pattern-fixes-v1', 'syntax repair marker exists');
has('this.playHarthmerePlayerSwordClip(HARTHMERE_PLAYER_SWORD_CLIPS.idle, true);', 'finished listener restores idle sword clip');
notRe(/this\.\s*\n\s*private\s+debugHarthmerePlayerSwordManualSwing/, 'no dangling this before debugHarthmerePlayerSwordManualSwing');
hasRe(/this\.harthmerePlayerSwordMixer\.addEventListener\("finished",\s*\(\)\s*=>\s*\{[\s\S]*?this\.playHarthmerePlayerSwordClip\(HARTHMERE_PLAYER_SWORD_CLIPS\.idle,\s*true\);[\s\S]*?\}\s*\}\);/, 'finished listener block is syntactically complete');

if (failures) {
  console.log(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
