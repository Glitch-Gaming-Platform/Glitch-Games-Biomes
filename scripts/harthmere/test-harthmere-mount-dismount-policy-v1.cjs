#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");
const fs = require("fs");
const { loadTown, makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere mount/dismount policy tests v1", root);
const town = loadTown(root);
const mountFiles = ["src/shared/harthmere/mount_policy.ts", "src/shared/harthmere/town_mount_rules.ts", "src/client/game/resources/harthmere_mount_policy.ts", "src/client/game/renderers/local_dev/harthmere_mount_policy.ts"].map((p) => path.join(root, p));
const existing = mountFiles.filter((p) => fs.existsSync(p));
const src = [town.assetsSrc, ...existing.map((p) => fs.readFileSync(p, "utf8"))].join("\n");
report.check("mount policy module or constants exist", existing.length > 0 || /mount|dismount/i.test(src), "Expected explicit town mount policy");
report.check("main roads and services declare mounted access", /mount.*(main road|service|lane|allowed)|mounted.*clearance|MOUNT_RADIUS/i.test(src), "Expected mounted access rules for main roads/services");
report.check("tight interiors reject mounts or force dismount", /dismount|mount.*interior|interior.*mount|no_mount|mounts? not allowed/i.test(src), "Expected dismount/interior restriction rules");
report.check("stables or travel points support mount approach", /stable|ferry|fast travel|travel.*mount|mount.*stable/i.test(src), "Expected stable/travel mount approach metadata");
report.check("mount policy has stuck prevention/fallback behavior", /mount.*unstuck|unstuck.*mount|mount.*fallback|dismount.*safe|nearest.*dismount/i.test(src), "Expected stuck-prevention for mounted players");
report.finish();
