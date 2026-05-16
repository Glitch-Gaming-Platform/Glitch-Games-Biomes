#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");
const fs = require("fs");
const { loadTown, makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere visual/readability audit tests v1", root);
const town = loadTown(root);
const visualFiles = ["src/shared/harthmere/visual_readability.ts", "src/client/game/renderers/local_dev/harthmere_visual_readability.ts", "scripts/harthmere/check-harthmere-town-visual-readability-v1.cjs"].map((p) => path.join(root, p));
const existing = visualFiles.filter((p) => fs.existsSync(p));
const src = [town.assetsSrc, ...existing.map((p) => fs.readFileSync(p, "utf8"))].join("\n");
report.check("town audit export exists for runtime object reporting", /HARTHMERE_TOWN_AUDIT_EXPORT_VERSION|__harthmereTownAudit|harthmereTownWalkDebug/i.test(src), "Expected audit/debug reporting hooks");
report.check("visual readability viewpoint list exists", /viewpoint|cameraBookmark|screenshot|readability.*view|service.*view/i.test(src), "Expected named screenshots/viewpoints from gate, market, services, docks, temple, inn, guard yard");
report.check("service entrances have visibility/readability assertions", /entrance.*visible|visible.*entrance|service.*readable|readable.*service|sign.*visible/i.test(src), "Expected visibility checks for service signs/entrances");
report.check("audit can detect visible-blocked mismatch and invisible-collision mismatch", /looks.*blocked|visible.*blocked|walk.*through|invisible.*collision|collision.*mismatch/i.test(src), "Expected mismatch audit for visual/collision disagreement");
report.check("district identity uses signs, landmarks, lighting, banners, and sound/color cues", /sign|landmark|lighting|banner|sound|ambience|colorTheme/i.test(src), "Expected visual identity cues");
report.finish();
