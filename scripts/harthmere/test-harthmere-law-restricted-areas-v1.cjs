#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");
const fs = require("fs");
const { loadTown, makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere law and restricted-area tests v1", root);
const town = loadTown(root);
const lawFiles = ["src/shared/harthmere/town_law.ts", "src/shared/harthmere/restricted_areas.ts", "src/client/game/resources/harthmere_law.ts", "src/client/game/renderers/local_dev/harthmere_law.ts"].map((p) => path.join(root, p));
const existing = lawFiles.filter((p) => fs.existsSync(p));
const src = [town.registrySrc, town.assetsSrc, ...existing.map((p) => fs.readFileSync(p, "utf8"))].join("\n");
const requiredAreas = ["noble", "guard", "prison", "treasury", "private", "guild", "temple", "black market"];
const missingAreas = requiredAreas.filter((area) => !new RegExp(area, "i").test(src));
report.check("restricted-area vocabulary covers noble, guard, prison, private, guild, temple, and black-market spaces", missingAreas.length === 0, missingAreas);
report.check("restricted areas have visible warning markers", /restricted|private|warning|no entry|guarded|permit/i.test(src), "Expected visible restricted/private/warning markers");
report.check("trespass triggers guard response behavior", /trespass|illegal|crime|legal standing|outlaw|suspicious/i.test(src) && /guard.*(challenge|stop|attack|escort|warn)|challenge.*guard/i.test(src), "Expected guard response to trespassing/outlaws");
report.check("temple crimes carry stronger penalty metadata", /temple|chapel/i.test(src) && /crime|penalty|reputation|sanctuary|sacrilege/i.test(src), "Expected temple crime/reputation penalty rules");
report.check("black-market/criminal services are gated", /black market|fence vendor|smuggler/i.test(src) && /trusted|outlaw|reputation|discovered|hidden|unlock|bribe/i.test(src), "Expected criminal service gating");
report.finish();
