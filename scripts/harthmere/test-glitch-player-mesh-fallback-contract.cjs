#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const fallbackUrl =
  "/assets/harthmere/gltf/characters/player_body_variants/harthmere_player_average_earth.gltf";

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function ok(condition, message) {
  if (!condition) fail(message);
  console.log(`OK ${message}`);
}

function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) fail(`missing ${rel}`);
  return fs.readFileSync(full, "utf8");
}

function walk(dir, out = []) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return out;

  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const p = path.join(full, entry.name);
    const rel = path.relative(root, p);

    if (entry.isDirectory()) {
      if (["node_modules", ".next", "dist", ".git"].includes(entry.name)) continue;
      walk(rel, out);
      continue;
    }

    if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(rel);
    }
  }

  return out;
}

const fallbackFile = path.join(root, "public", fallbackUrl.replace(/^\//, ""));
ok(fs.existsSync(fallbackFile), "static Harthmere player fallback file exists");

const sample = fs.readFileSync(fallbackFile).subarray(0, 128).toString("utf8");
ok(
  !sample.includes("version https://git-lfs.github.com/spec/v1"),
  "static Harthmere player fallback is a real asset, not a Git LFS pointer"
);

const apiRouteRel = "src/pages/api/assets/player_mesh.glb.ts";
const apiRoute = read(apiRouteRel);

ok(apiRoute.includes(fallbackUrl), "player_mesh API route knows the static fallback URL");

ok(
  apiRoute.includes("GLITCH_STATIC_PLAYER_MESH_FALLBACK") &&
    !/GLITCH_RUNTIME[\s\S]{0,160}GLITCH_LOCAL_ASSETS/.test(apiRoute),
  "player_mesh static fallback is explicit-only, not automatic for Glitch/local-assets runtime"
);

ok(
  /redirect\s*\(\s*307/.test(apiRoute) ||
    /status\s*\(\s*307/.test(apiRoute) ||
    /statusCode\s*=\s*307/.test(apiRoute),
  "player_mesh API fallback uses a temporary redirect"
);

ok(
  apiRoute.includes("rawUrl.includes") &&
    apiRoute.includes("rawUrl.slice") &&
    apiRoute.includes("indexOf(\"?\")"),
  "player_mesh API fallback preserves query strings"
);

ok(
  apiRoute.includes('"wearables/animated_player_mesh"') &&
    apiRoute.includes("assetExportsServer.build") &&
    apiRoute.includes("parsePlayerMeshUrl"),
  "player_mesh API route builds the voxel wearable mesh locally"
);

const sourceFiles = walk("src");
const clientFiles = sourceFiles.filter((rel) => rel !== apiRouteRel);
const clientSource = clientFiles
  .map((rel) => fs.readFileSync(path.join(root, rel), "utf8"))
  .join("\n");

ok(clientSource.includes(fallbackUrl), "client/player source can use the static fallback URL");

ok(
  clientSource.includes("/api/assets/player_mesh.glb"),
  "client/player source uses dynamic /api/assets/player_mesh.glb for voxel wearable avatars"
);

ok(
  !clientSource.includes("FORCEPLAY_HTTP_INTERCEPT") &&
    !clientSource.includes("forceplay_no_cookie_auth") &&
    !clientSource.includes("PERSISTENT_GUEST_INSTALL"),
  "mesh source patch does not contain runtime forceplay/persistguest hacks"
);

ok(
  !apiRoute.includes("return {};") &&
    !apiRoute.includes("forceplay_no_cookie_auth") &&
    !apiRoute.includes("PERSISTENT_GUEST_INSTALL"),
  "player_mesh API route does not use fake no-op auth/runtime hacks"
);

console.log("Glitch player mesh fallback contract passed.");
