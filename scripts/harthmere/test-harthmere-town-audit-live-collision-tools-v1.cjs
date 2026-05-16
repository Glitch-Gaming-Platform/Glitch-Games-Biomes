#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");
const { loadTown, makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere live town audit collision tooling tests v1", root);
const town = loadTown(root);

report.check("browser audit API/global still exists", /harthmereTownAudit|HarthmereTownAudit|townAudit/i.test(town.assetsSrc), "Expected a browser-visible town audit API");
report.check("audit tooling can export or inspect player blockers", /blocksPlayer|playerObstacle|player obstacle|player blocker/i.test(town.assetsSrc), "Expected audit output to include player blocker/collision data");
report.check("audit tooling can identify uploaded-solid collision classifications", /solid uploaded|uploaded solid|SOLID_UPLOADED_ASSET|uploaded asset/i.test(town.assetsSrc + town.registrySrc), "Expected audit/debug source to name uploaded solid asset collision state");
report.check("audit tooling still has object dump/download workflow", /download|dump|export/i.test(town.assetsSrc) && /object/i.test(town.assetsSrc), "Expected manual dump/download object audit workflow");
report.check("audit tooling has overlap or walk-through suspect detection", /overlap|walk.?through|suspect|massive object|floating/i.test(town.assetsSrc), "Expected live audit to flag overlap/walk-through/floating suspects");

report.finish();
