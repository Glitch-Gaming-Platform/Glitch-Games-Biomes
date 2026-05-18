#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, "../..");
const structureManifest = JSON.parse(fs.readFileSync(path.join(root, "public/harthmere-debug/harthmere-server-voxel-structure-manifest-v65.json"), "utf8"));
const housingManifest = JSON.parse(fs.readFileSync(path.join(root, "public/harthmere-debug/harthmere-npc-housing-v65.json"), "utf8"));
const byDistrict = {};
for (const s of structureManifest.structures) byDistrict[s.district] = (byDistrict[s.district] || 0) + 1;
const housingByBuilding = {};
for (const r of housingManifest.rooms) housingByBuilding[r.buildingId] = (housingByBuilding[r.buildingId] || 0) + 1;
console.log(JSON.stringify({
  version: "harthmere-server-voxel-occupancy-v65",
  structureCount: structureManifest.structureCount,
  byDistrict,
  namedNpcHousing: {
    npcCount: housingManifest.npcCount,
    housingCount: housingManifest.housingCount,
    allNamedNpcsHaveHousing: housingManifest.allNamedNpcsHaveHousing,
    housingByBuilding,
  },
  backendVoxelTrees: structureManifest.backendVoxelTrees,
}, null, 2));
