#!/usr/bin/env node
// Smoke render every tab in the BiomesUI module using React's
// renderToStaticMarkup. We verify the markup contains the expected
// data-ui-id attributes — proof that the highlight wiring is intact.

const fs = require("fs");
const path = require("path");
const Module = require("module");

const ROOT = process.argv[2] || process.cwd();
let ts, React, ReactDOMServer;
try {
  ts = require(path.join(ROOT, "node_modules/typescript"));
  React = require(path.join(ROOT, "node_modules/react"));
  ReactDOMServer = require(path.join(ROOT, "node_modules/react-dom/server"));
} catch (e) {
  console.log("SKIP missing deps: " + e.message);
  process.exit(0);
}

function compile(src) {
  return ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;
}

const moduleCache = new Map();
function loadTsModule(abs, fakeRequire) {
  if (moduleCache.has(abs)) return moduleCache.get(abs);
  const raw = fs.readFileSync(abs, "utf8");
  const js = compile(raw);
  const m = new Module(abs);
  m.filename = abs.replace(/\.tsx?$/, ".js");
  m.paths = Module._nodeModulePaths(path.dirname(m.filename));
  m.require = fakeRequire(abs);
  moduleCache.set(abs, m.exports);
  m._compile(js, m.filename);
  return m.exports;
}

const BIOMES_UI = path.join(ROOT, "src/client/components/biomes_ui");

function resolveRelative(fromAbs, request) {
  if (request === "react") return React;
  if (request === "react-dom/server") return ReactDOMServer;
  if (request.endsWith(".css")) return {}; // ignore CSS imports
  if (request.startsWith(".")) {
    let abs = path.resolve(path.dirname(fromAbs), request);
    // try .ts, .tsx
    if (fs.existsSync(abs + ".ts")) abs = abs + ".ts";
    else if (fs.existsSync(abs + ".tsx")) abs = abs + ".tsx";
    else if (fs.existsSync(path.join(abs, "index.ts"))) abs = path.join(abs, "index.ts");
    else if (fs.existsSync(path.join(abs, "index.tsx"))) abs = path.join(abs, "index.tsx");
    return loadTsModule(abs, makeFakeRequire);
  }
  // last resort: node module from root
  return require(path.join(ROOT, "node_modules", request));
}
function makeFakeRequire(fromAbs) {
  return function (req) { return resolveRelative(fromAbs, req); };
}

let ok = true;
function check(label, cond) {
  if (cond) console.log("OK   " + label);
  else { console.log("FAIL " + label); ok = false; }
}

function renderTab(fileName, expectIds) {
  try {
    const abs = path.join(BIOMES_UI, "tabs", fileName);
    const mod = loadTsModule(abs, makeFakeRequire);
    const Component = Object.values(mod).find((v) => typeof v === "function");
    if (!Component) { check(`${fileName}: export found`, false); return; }
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(Component, { adapter: undefined }));
    check(`${fileName}: rendered without throwing`, typeof html === "string" && html.length > 0);
    for (const id of expectIds) {
      check(`${fileName}: emits data-ui-id="${id}"`, html.includes(`data-ui-id="${id}"`));
    }
  } catch (e) {
    check(`${fileName}: rendered without throwing — ${e.message}`, false);
  }
}

renderTab("InventoryTab.tsx", ["inventory.slot.chest", "inventory.slot.legs", "inventory.slot.main_hand"]);
renderTab("AbilitiesTab.tsx", ["abilities.slot_1", "abilities.slot_8"]);
renderTab("SkillsTab.tsx", ["skills.row.sword"]);
renderTab("ClassesTab.tsx", ["classes.card.warrior", "classes.card.mage"]);
renderTab("LandTab.tsx", ["land.plot.plot_grove_alpha"]);
renderTab("LootTab.tsx", ["loot.entry.l_001"]);
renderTab("GuildsTab.tsx", ["guilds.roster", "guilds.rank.leader"]);
renderTab("BankingTab.tsx", ["banking.deposit", "banking.withdraw", "banking.vault.slot_1"]);
renderTab("MapQuestsTab.tsx", ["map.marker.jackie", "map.marker.road_marker"]);
renderTab("CollectionsTab.tsx", []); // dynamic ids, just smoke
renderTab("InboxTab.tsx", []);       // no highlightable ids
renderTab("OptionsTab.tsx", []);     // no highlightable ids

console.log("\nRESULT: " + (ok ? "PASS" : "FAIL"));
process.exit(ok ? 0 : 1);
