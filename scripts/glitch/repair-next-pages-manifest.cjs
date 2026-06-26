#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || ".");
const pagesDir = path.join(root, ".next", "server", "pages");
const manifestPath = path.join(root, ".next", "server", "pages-manifest.json");

const requiredRoutes = [
  "/",
  "/at/[[...slug]]",
  "/api/assets/player_mesh.glb",
  "/api/glitch/harthmere",
  "/api/glitch/runtime_environment",
  "/api/harthmere/live_mode",
  "/api/harthmere/live_mode_jobs_board_state",
  "/api/harthmere/live_mode_player_status_state",
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, out);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      out.push(abs);
    }
  }
  return out;
}

function routeForPageFile(abs) {
  const rel = path
    .relative(pagesDir, abs)
    .split(path.sep)
    .join("/")
    .replace(/[.]js$/, "");
  if (rel === "index") {
    return "/";
  }
  if (rel.endsWith("/index")) {
    return `/${rel.slice(0, -"/index".length)}`;
  }
  return `/${rel}`;
}

function manifestValueForPageFile(abs) {
  return path
    .relative(path.join(root, ".next", "server"), abs)
    .split(path.sep)
    .join("/");
}

function readExistingManifest() {
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return {};
  }
}

function stableManifestFromFiles(files) {
  const entries = files
    .map((abs) => [routeForPageFile(abs), manifestValueForPageFile(abs)])
    .sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

if (!fs.existsSync(pagesDir)) {
  console.error(`ERROR missing Next pages directory: ${pagesDir}`);
  process.exit(1);
}

const files = walk(pagesDir);
const repaired = stableManifestFromFiles(files);
const existing = readExistingManifest();
const missingRoutes = Object.keys(repaired).filter((route) => !existing[route]);
const staleRoutes = Object.entries(repaired).filter(
  ([route, file]) => existing[route] && existing[route] !== file
);

if (missingRoutes.length || staleRoutes.length) {
  fs.writeFileSync(manifestPath, `${JSON.stringify(repaired, null, 2)}\n`);
  console.log(
    `Repaired Next pages manifest: ${Object.keys(existing).length} -> ${Object.keys(repaired).length} routes`
  );
} else {
  console.log(
    `Next pages manifest already covers ${Object.keys(existing).length} routes`
  );
}

let failed = false;
for (const route of requiredRoutes) {
  if (!repaired[route]) {
    failed = true;
    console.error(`FAIL required Next route missing from pages manifest: ${route}`);
  } else {
    console.log(`OK Next pages manifest includes ${route}`);
  }
}

if (failed) {
  process.exit(1);
}
