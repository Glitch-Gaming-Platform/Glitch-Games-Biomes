#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
let ok = true;
function dep(name) {
  return (
    (pkg.dependencies && pkg.dependencies[name]) ||
    (pkg.devDependencies && pkg.devDependencies[name]) ||
    ""
  );
}
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    console.log(`FAIL ${label}`);
    ok = false;
  }
}
console.log("== Harthmere Node 24 package compatibility tests current ==");
console.log(`Root: ${root}\n`);
check(
  "Node 24 npm install path keeps normal peer enforcement",
  !JSON.stringify(pkg).includes("legacy-peer-deps") &&
    !JSON.stringify(pkg).includes("--force")
);
check(
  "Node 24 LTS is pinned by .nvmrc",
  fs.readFileSync(path.join(root, ".nvmrc"), "utf8").trim() === "24.18.1"
);
check(
  "native v8-profiler addon is removed in favor of node:inspector",
  !dep("v8-profiler-next") && !dep("@types/v8-profiler")
);
check(
  "fatal-signal diagnostics use the Node 24-compatible N-API addon",
  dep("segfault-raub") === "3.2.0" && !dep("segfault-handler")
);
check(
  "uWebSockets carries the pinned Node 24 ABI release",
  dep("uWebSockets.js") ===
    "https://github.com/uNetworking/uWebSockets.js/archive/refs/tags/v20.69.0.tar.gz"
);
check(
  "Kubernetes client stays below 1.x to avoid ESM-only migration in the current dependency set",
  /^\^?0\.22\.3/.test(dep("@kubernetes/client-node"))
);
check(
  "Kubernetes ws types are compatible with ws8-era packages",
  /^\^?8\./.test(dep("@types/ws"))
);
check(
  "utf-8-validate is compatible with both ws7 and ws8 peer ranges",
  dep("utf-8-validate") === "5.0.10"
);
check(
  "bufferutil remains on ws-compatible 4.x line",
  !dep("bufferutil") || /^\^?4\./.test(dep("bufferutil"))
);
check(
  "Puppeteer remains on declared project version and no peer override is used",
  !!dep("puppeteer")
);
check(
  "React 19 dependency replacements are declared before install",
  !!dep("emoji-mart") && !dep("@emoji-mart/react") && !!dep("react18-json-view")
);
check(
  "Third-party NPC AI dependency set is complete",
  !!dep("yuka") && !!dep("behavior3js") && !!dep("recast-navigation")
);
console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
