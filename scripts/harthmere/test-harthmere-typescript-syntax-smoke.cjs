#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let ts;
try {
  ts = require(require.resolve("typescript", { paths: [root, process.cwd()] }));
} catch (error) {
  console.error(`FAIL typescript package is required for syntax smoke test: ${error.message}`);
  process.exit(1);
}

const scanRoots = [
  "src/client/components/challenges",
  "src/client/game/renderers/local_dev",
  "src/client/game/resources",
  "src/shared/harthmere",
].map((p) => path.join(root, p));

const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", "build", "coverage", ".next", ".git"].includes(entry.name)) continue;
      walk(full);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.bak\.|\.backup\.|\.orig\.|~$/.test(entry.name)) continue;
    const rel = path.relative(root, full);
    if (
      /harthmere/i.test(rel) ||
      /Harthmere/.test(entry.name) ||
      rel.startsWith("src/shared/harthmere/")
    ) {
      files.push(full);
    }
  }
}
for (const dir of scanRoots) walk(dir);
files.sort();

let failed = 0;
let parsed = 0;
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  parsed += 1;
  if (sf.parseDiagnostics && sf.parseDiagnostics.length) {
    failed += 1;
    console.error(`FAIL ${path.relative(root, file)}`);
    for (const diag of sf.parseDiagnostics) {
      const pos = diag.start == null ? { line: 0, character: 0 } : sf.getLineAndCharacterOfPosition(diag.start);
      const msg = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
      console.error(`  ${pos.line + 1}:${pos.character + 1} ${msg}`);
    }
  }
}

if (parsed === 0) {
  console.error("FAIL no Harthmere TypeScript/TSX files were discovered for syntax smoke test");
  process.exit(1);
}

if (failed > 0) {
  console.error(`RESULT: FAIL (${failed} files with syntax errors, ${parsed} parsed)`);
  process.exit(1);
}

console.log(`OK parsed ${parsed} Harthmere TypeScript/TSX files`);
console.log("RESULT: PASS");
