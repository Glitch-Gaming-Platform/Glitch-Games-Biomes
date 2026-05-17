#!/usr/bin/env node
const { checkFactory, dialogueFacingSources } = require("./harthmere-dialogue-rule-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();
console.log("== Harthmere dialogue no development/meta text tests v1 ==");
console.log(`Root: ${root}`);
console.log("");

const sources = dialogueFacingSources(root);
check("dialogue-facing sources are discoverable", sources.length >= 3);
const banned = [
  /They keep the conversation practical/i,
  /leave room for you to ask more/i,
  /How do conversations work here\?/i,
  /Dialogue choices are labeled/i,
  /local-dev dialogue memory/i,
  /mission journal/i,
  /Current lead:/i,
  /game mechanics/i,
  /game system/i,
  /overall game status/i,
  /test dialogue/i,
  /debug dialogue/i,
  /development dialogue/i,
  /TDD/i,
];
for (const { rel, text } of sources) {
  for (const pattern of banned) {
    check(`${rel} does not expose banned meta phrase ${pattern}`, !pattern.test(text));
  }
}
finish();
