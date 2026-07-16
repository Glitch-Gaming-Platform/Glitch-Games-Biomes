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

for (const file of fs.readdirSync(dist).filter((name) => name.endsWith(".js"))) {
  const source = fs.readFileSync(path.join(dist, file), "utf8");
  for (const match of source.matchAll(/require\(["']([^"']+)["']\)/g)) {
    const name = match[1];
    if (name.startsWith(".") || name.startsWith("/") || builtins.has(name)) {
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
