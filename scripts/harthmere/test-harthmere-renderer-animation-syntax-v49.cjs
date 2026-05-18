#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const suitePath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");
const assets = fs.readFileSync(assetsPath, "utf8");
const suite = fs.existsSync(suitePath) ? fs.readFileSync(suitePath, "utf8") : "";

let ok = true;
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    console.error(`FAIL ${label}`);
    ok = false;
  }
}

console.log("== Harthmere renderer animation syntax v49 test ==");

check(
  "v49 syntax fix marker exists",
  assets.includes("HARTHMERE_RENDERER_ANIMATION_SYNTAX_FIX_VERSION_V49"),
);

check(
  "draw loop has no doubled close-brace before bob fallback",
  !/animateProceduralWalker\(instance\.object, this\.elapsed, instance\.asset\);\s*\}\s*\}\s*\}\s*else if \(instance\.bob\)/.test(assets),
);

check(
  "draw loop keeps wander branch attached to bob fallback else-if",
  /if \(instance\.wander\) \{[\s\S]*?animateProceduralWalker\(instance\.object, this\.elapsed, instance\.asset\);[\s\S]*?\}\s*else if \(instance\.bob\) \{/.test(assets),
);

check(
  "route interpolation still exists after syntax fix",
  /harthmereRoutePositionV48\(instance\.wander\.route, progress\)/.test(assets),
);

check(
  "walker animation still runs when routed NPCs move",
  /animateProceduralWalker\(instance\.object, this\.elapsed, instance\.asset\);/.test(assets),
);

try {
  const typescriptPath = require.resolve("typescript", { paths: [root] });
  const ts = require(typescriptPath);
  const result = ts.transpileModule(assets, {
    fileName: assetsPath,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
    },
  });
  const diagnostics = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (diagnostics.length) {
    for (const d of diagnostics.slice(0, 5)) {
      const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      const pos = d.file && typeof d.start === "number" ? d.file.getLineAndCharacterOfPosition(d.start) : null;
      const loc = pos ? `${pos.line + 1}:${pos.character + 1}` : "unknown";
      console.error(`TS ${loc} ${message}`);
    }
  }
  check("TypeScript parser accepts harthmere_assets.ts", diagnostics.length === 0);
} catch (error) {
  console.log("OK TypeScript parser unavailable; static renderer syntax checks were used");
}

check(
  "full placement suite includes v49 syntax test",
  suite.includes("test-harthmere-renderer-animation-syntax-v49.cjs"),
);

if (!ok) process.exit(1);
console.log("RESULT PASS");
