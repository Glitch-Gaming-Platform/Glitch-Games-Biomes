#!/usr/bin/env node
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

process.env.NODE_ENV ??= "production";
process.env.GLITCH_RUNTIME ??= "1";
process.env.NEXT_PUBLIC_GLITCH_RUNTIME ??= "1";
process.env.GLITCH_DISABLE_GCP ??= "1";
process.env.NEXT_PUBLIC_GLITCH_DISABLE_GCP ??= "1";
process.env.GLITCH_LOCAL_ASSETS ??= "1";
process.env.NEXT_PUBLIC_GLITCH_LOCAL_ASSETS ??= "1";
process.env.GLITCH_SKIP_GOOGLE_SECRETS ??= "1";
process.env.GLITCH_DISABLE_DISCORD ??= "1";
process.env.GLITCH_DISABLE_ASSET_MIRROR ??= "1";
process.env.GLITCH_TITLE_ID ??= "42de534c-600f-4228-af9e-b69faef94cce";
process.env.GLITCH_TITLE_TOKEN ??= "route-import-smoke";
process.env.GLITCH_API_BASE_URL ??= "http://127.0.0.1:3000";
process.env.OPEN_ADMIN_ACCESS ??= "1";
process.env.LOCAL_GCS ??= "1";
process.env.GCS_LOCAL_DISK ??= "1";
process.env.TS_NODE_COMPILER_OPTIONS ??= '{"module":"commonjs"}';

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request === "string" && request.startsWith("/public/")) {
    const mapped = path.join(root, request.slice(1));
    if (fs.existsSync(mapped)) {
      return mapped;
    }
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

for (const ext of [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".glb",
  ".mp3",
  ".wav",
  ".css",
  ".scss",
]) {
  require.extensions[ext] = (module, filename) => {
    module.exports = { src: filename, width: 1, height: 1 };
    module.exports.default = module.exports;
  };
}

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(p));
    } else {
      out.push(p);
    }
  }
  return out;
}

const files = walk(path.join(root, "src/pages/api"))
  .filter((p) => /\.(ts|tsx)$/.test(p))
  .filter((p) => !/\.test\.|\.before-|\.bak|\.orig/.test(p))
  .sort();

const failures = [];
let loaded = 0;
for (const file of files) {
  const rel = path.relative(root, file);
  try {
    const mod = require(file);
    if (typeof mod.default !== "function") {
      failures.push([rel, "default export is not a function"]);
    }
    loaded += 1;
  } catch (error) {
    failures.push([
      rel,
      String(error?.stack ?? error?.message ?? error)
        .split("\n")
        .slice(0, 12)
        .join("\n"),
    ]);
  }
}

console.log(
  `API_ROUTE_IMPORT_SWEEP loaded=${loaded} total=${files.length} failures=${failures.length}`
);
for (const [rel, error] of failures) {
  console.error(`FAIL ${rel}\n${error}`);
}

if (failures.length > 0) {
  process.exit(1);
}
console.log("RESULT: PASS");
