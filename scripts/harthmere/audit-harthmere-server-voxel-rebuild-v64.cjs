#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const repo = path.resolve(__dirname, "../..");
const main = fs.readFileSync(path.join(repo, "src/server/shim/main.ts"), "utf8");
const block = main.slice(main.indexOf("HARTHMERE_SERVER_VOXEL_ALL_BUILDINGS_DUNGEONS_VERSION_V64"), main.indexOf("// HARTHMERE_CLEAN_TOWN_REBUILD_V6_END"));
const entries = [...block.matchAll(/name:\s*"([^"]+)"[\s\S]*?district:\s*"([^"]+)"[\s\S]*?profile:\s*"([^"]+)"[\s\S]*?x0:\s*(-?\d+)[\s\S]*?x1:\s*(-?\d+)[\s\S]*?z0:\s*(-?\d+)[\s\S]*?z1:\s*(-?\d+)/g)].map((m) => ({
  name: m[1], district: m[2], profile: m[3], x0: Number(m[4]), x1: Number(m[5]), z0: Number(m[6]), z1: Number(m[7]),
}));
const byProfile = entries.reduce((acc, e) => { acc[e.profile] = (acc[e.profile] || 0) + 1; return acc; }, {});
const byDistrict = entries.reduce((acc, e) => { acc[e.district] = (acc[e.district] || 0) + 1; return acc; }, {});
console.log(JSON.stringify({
  version: "harthmere-server-voxel-all-buildings-dungeons-v64",
  structureCount: entries.length,
  byProfile,
  byDistrict,
  structures: entries,
}, null, 2));
