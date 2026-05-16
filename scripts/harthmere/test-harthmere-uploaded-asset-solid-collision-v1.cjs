#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { loadTown, makeReporter, isSolidUploadedAsset, collisionBlocksPlayerLikeRegistry } = require("./harthmere-town-rule-test-utils-v1.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere uploaded asset solid collision tests v1", root);
const town = loadTown(root);
const harthmereDir = path.join(root, "public/assets/harthmere");
report.check("public/assets/harthmere folder exists", fs.existsSync(harthmereDir), harthmereDir);
report.check("runtime asset manifest exists for uploaded Harthmere assets", fs.existsSync(path.join(harthmereDir, "manifest/harthmere-runtime-assets.json")) || fs.existsSync(path.join(harthmereDir, "manifest/harthmere-runtime-assets.txt")), "Expected public/assets/harthmere/manifest/harthmere-runtime-assets.json or .txt");
report.check("assets file references imported Harthmere runtime assets", town.assets.size > 40, `parsed ${town.assets.size} assets`);
const missingFiles = [];
for (const asset of town.assets.values()) { const rel = String(asset.path).replace(/^\/assets\/harthmere\/?/, ""); const candidates = [path.join(harthmereDir, rel), path.join(harthmereDir, `${rel}.obj`), path.join(harthmereDir, `${rel}.glb`), path.join(harthmereDir, `${rel}.gltf`)]; if (!candidates.some((full) => fs.existsSync(full))) missingFiles.push(`${asset.key} -> ${asset.path}`); }
report.check("every registered Harthmere runtime asset file exists on disk", missingFiles.length === 0, missingFiles);
const solidPlacements = town.placements.filter((p) => isSolidUploadedAsset(town.assets.get(p.asset), p));
report.check("solid uploaded asset placements are detected for collision auditing", solidPlacements.length >= 80, `detected ${solidPlacements.length}`);
const walkThroughSolid = solidPlacements.filter((p) => !collisionBlocksPlayerLikeRegistry(p)).map((p) => `${p.name || p.asset} (${p.asset}) ${p.district || "Unknown"} line ${p.line}`);
report.check("solid uploaded asset placements block the player instead of being walk-through", walkThroughSolid.length === 0, walkThroughSolid);
const blockerSourceRequired = ["table", "bench", "bed", "cabinet", "bookcase", "shelf", "workbench", "anvil", "dummy", "cage", "chest", "crate", "barrel", "keg", "fence", "hedge", "rock", "tree"];
const registryMissing = blockerSourceRequired.filter((word) => { const re = new RegExp(`${word}[^\\n]+blocksPlayer:\\s*true|blocksPlayer:\\s*true[^\\n]+${word}`, "i"); return !re.test(town.registrySrc); });
report.check("collision registry explicitly treats common solid uploaded asset families as player blockers", registryMissing.length === 0, registryMissing.map((word) => `Missing explicit player-blocking collision rule for ${word}`));
report.finish();
