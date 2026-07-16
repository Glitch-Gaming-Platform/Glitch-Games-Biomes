#!/usr/bin/env node
const fs = require("fs");
const Module = require("module");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const dist = path.join(root, "dist");
const builtins = new Set(
  Module.builtinModules.flatMap((name) => [name, `node:${name}`])
);
const requiredBy = new Map();
const optionalExternals = new Set([
  // Next includes this guarded integration even when nextScriptWorkers is disabled.
  "@builder.io/partytown/integration",
]);

function collectJavaScriptFiles(directory, files = []) {
  if (!fs.existsSync(directory)) {
    return files;
  }
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectJavaScriptFiles(absolute, files);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(absolute);
    }
  }
  return files;
}

const serverFiles = [
  ...collectJavaScriptFiles(dist),
  ...collectJavaScriptFiles(path.join(root, ".next/server")),
];

for (const absolute of serverFiles) {
  const file = path.relative(root, absolute).split(path.sep).join("/");
  const source = fs.readFileSync(absolute, "utf8");
  for (const match of source.matchAll(/require\(["']([^"']+)["']\)/g)) {
    const name = match[1];
    if (
      name.startsWith(".") ||
      name.startsWith("/") ||
      builtins.has(name) ||
      optionalExternals.has(name)
    ) {
      continue;
    }
    const files = requiredBy.get(name) || new Set();
    files.add(file);
    requiredBy.set(name, files);
  }
}

const missing = [];
for (const [name, files] of [...requiredBy].sort(([a], [b]) =>
  a.localeCompare(b)
)) {
  try {
    require.resolve(name, { paths: [root] });
  } catch {
    missing.push(`${name} (${[...files].sort().join(", ")})`);
  }
}

if (missing.length) {
  console.error("Missing production runtime dependencies after npm prune:");
  for (const detail of missing) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

console.log(
  `OK production runtime dependencies resolved (${requiredBy.size} external imports)`
);
