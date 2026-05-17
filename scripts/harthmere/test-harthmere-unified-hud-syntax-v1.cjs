#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const hudPath = path.join(
  root,
  "src/client/components/challenges/HarthmereUnifiedHUD.tsx"
);

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

if (!fs.existsSync(hudPath)) {
  fail(`missing ${hudPath}`);
}

let ts;
try {
  ts = require(require.resolve("typescript", { paths: [root, process.cwd()] }));
} catch (error) {
  fail(`typescript package is required for syntax guard: ${error.message}`);
}

const text = fs.readFileSync(hudPath, "utf8");
const sf = ts.createSourceFile(
  hudPath,
  text,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

if (sf.parseDiagnostics && sf.parseDiagnostics.length) {
  for (const diag of sf.parseDiagnostics) {
    const pos = diag.start == null ? { line: 0, character: 0 } : sf.getLineAndCharacterOfPosition(diag.start);
    const msg = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
    console.error(`${path.relative(root, hudPath)}:${pos.line + 1}:${pos.character + 1} ${msg}`);
  }
  fail("HarthmereUnifiedHUD.tsx has TypeScript/TSX syntax errors");
}

if (!/type\s+MenuTab\s*=/.test(text)) {
  fail("MenuTab type is missing");
}

if (!/\|\s*["']dialogue["']/.test(text)) {
  fail("dialogue MenuTab union entry is missing");
}

if (!/\{\s*id:\s*["']dialogue["']\s*,\s*label:\s*["']Dialogue Rules["']\s*\}/.test(text)) {
  fail('MENU_TABS must contain { id: "dialogue", label: "Dialogue Rules" }');
}

if (/id:\s*["']dialogue["'][^\]]*label:\s*["']Dialogue Rules["']\s*,\s*(?:\r?\n\s*)?["']Dialogue["']/s.test(text)) {
  fail("dialogue tab still contains stray string literal after label");
}

console.log("OK HarthmereUnifiedHUD.tsx parses as TSX");
console.log("OK dialogue menu tab is a valid object literal");
console.log("RESULT: PASS");
