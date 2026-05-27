#!/usr/bin/env node
// Standalone runtime smoke for HighlightRegistry.
// We strip the TypeScript types and require the result so this works
// without a build step (mirroring the existing harthmere test scripts).

const fs = require("fs");
const path = require("path");
const Module = require("module");

const ROOT = process.argv[2] || process.cwd();
const REGISTRY_PATH = path.join(ROOT, "src/client/components/biomes_ui/highlight/HighlightRegistry.ts");

// Use TypeScript's transpileModule (already in devDependencies) to strip
// types. This is the same approach ts-node uses.
let ts;
try { ts = require(path.join(ROOT, "node_modules/typescript")); }
catch (e) {
  console.log("SKIP typescript not installed at " + ROOT + "/node_modules/typescript — run `npm install` to enable this test");
  process.exit(0);
}
const raw = fs.readFileSync(REGISTRY_PATH, "utf8");
const transpiled = ts.transpileModule(raw, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const js = transpiled;

// Compile in an isolated module
const m = new Module("biomes-ui-highlight-registry");
m.filename = REGISTRY_PATH.replace(/\.ts$/, ".js");
m.paths = Module._nodeModulePaths(path.dirname(m.filename));
try {
  m._compile(js, m.filename);
} catch (e) {
  console.log("FAIL to compile registry: " + e.message);
  process.exit(1);
}
// transpileModule emits exports as `exports.foo = ...`. Bridge to our test API:
const R = {
  registerHighlightTarget: m.exports.registerHighlightTarget,
  requestHighlight: m.exports.requestHighlight,
  clearHighlight: m.exports.clearHighlight,
  clearAllHighlights: m.exports.clearAllHighlights,
  subscribeHighlights: m.exports.subscribeHighlights,
  _resetHighlightRegistryForTest: m.exports._resetHighlightRegistryForTest,
  _internalsForTest: m.exports._internalsForTest,
};

let ok = true;
function check(label, cond) {
  if (cond) console.log("OK   " + label);
  else { console.log("FAIL " + label); ok = false; }
}

R._resetHighlightRegistryForTest();

// Test 1: register -> request -> deliver
let calls1 = 0;
R.registerHighlightTarget({ uniqueId: "tab.inv", element: null,
  onHighlight: () => { calls1++; }, onClear: () => {} });
R.requestHighlight({ uniqueId: "tab.inv" });
check("register -> request delivers", calls1 === 1);

// Test 2: request before register -> queued
R._resetHighlightRegistryForTest();
R.requestHighlight({ uniqueId: "tab.late" });
let calls2 = 0;
R.registerHighlightTarget({ uniqueId: "tab.late", element: null,
  onHighlight: () => { calls2++; }, onClear: () => {} });
check("queued request fires on later register", calls2 === 1);

// Test 3: multiple targets all receive
R._resetHighlightRegistryForTest();
let c3a = 0, c3b = 0;
R.registerHighlightTarget({ uniqueId: "slot.1", element: null, onHighlight: () => { c3a++; }, onClear: () => {} });
R.registerHighlightTarget({ uniqueId: "slot.1", element: null, onHighlight: () => { c3b++; }, onClear: () => {} });
R.requestHighlight({ uniqueId: "slot.1" });
check("multiple targets under same id all fire", c3a === 1 && c3b === 1);

// Test 4: clear removes active state and calls onClear
R._resetHighlightRegistryForTest();
let clears = 0;
R.registerHighlightTarget({ uniqueId: "tab.map", element: null, onHighlight: () => {}, onClear: () => { clears++; } });
R.requestHighlight({ uniqueId: "tab.map", durationMs: 0 });
R.clearHighlight("tab.map");
check("clearHighlight calls onClear", clears === 1);
check("clearHighlight removes from active map", !R._internalsForTest().activeHighlights.has("tab.map"));

// Test 5: clearAll wipes queued + active
R._resetHighlightRegistryForTest();
R.requestHighlight({ uniqueId: "queued.only" });
R.clearAllHighlights();
check("clearAll wipes queued", R._internalsForTest().queued.size === 0);

// Test 6: thrown listener does not break the loop
R._resetHighlightRegistryForTest();
R.registerHighlightTarget({ uniqueId: "boom", element: null, onHighlight: () => { throw new Error("x"); }, onClear: () => {} });
let okFired = 0;
R.registerHighlightTarget({ uniqueId: "boom", element: null, onHighlight: () => { okFired++; }, onClear: () => {} });
try { R.requestHighlight({ uniqueId: "boom" }); }
catch (e) { ok = false; console.log("FAIL request threw: " + e.message); }
check("thrown listener does not block other targets", okFired === 1);

// Test 7: subscribe sees updates
R._resetHighlightRegistryForTest();
let lastSize = -1;
const unsub = R.subscribeHighlights((m) => { lastSize = m.size; });
check("subscribe initial size = 0", lastSize === 0);
R.requestHighlight({ uniqueId: "tab.bank", durationMs: 0 });
check("subscribe sees request", lastSize === 1);
R.clearHighlight("tab.bank");
check("subscribe sees clear", lastSize === 0);
unsub();

console.log("\nRESULT: " + (ok ? "PASS" : "FAIL"));
process.exit(ok ? 0 : 1);
