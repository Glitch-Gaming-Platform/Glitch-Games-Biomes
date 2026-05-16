#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");
const fs = require("fs");
const { loadTown, makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere time-of-day schedule tests v1", root);
const town = loadTown(root);
const scheduleFiles = ["src/shared/harthmere/town_schedules.ts", "src/shared/harthmere/npc_schedules.ts", "src/client/game/resources/harthmere_schedules.ts", "src/client/game/renderers/local_dev/harthmere_schedules.ts"].map((p) => path.join(root, p));
const existing = scheduleFiles.filter((p) => fs.existsSync(p));
const src = [town.assetsSrc, ...existing.map((p) => fs.readFileSync(p, "utf8"))].join("\n");
report.check("time-of-day schedule module exists", existing.length > 0 || /HARTHMERE_.*SCHEDULE|timeOfDay|townSchedule|npcSchedule/i.test(src), "Expected Harthmere town schedule definitions");
for (const phase of ["morning", "day", "evening", "night", "rain", "festival", "attack"]) report.check(`schedule covers ${phase} state`, new RegExp(phase, "i").test(src), `Missing ${phase}`);
report.check("shops have open/closed schedule metadata", /shop[^\n]*(open|closed|hours)|hours[^\n]*shop|closed.*shop/i.test(src), "Expected shop hours/open/closed behavior");
report.check("tavern population changes at evening/night", /tavern|copper kettle|inn/i.test(src) && /evening|night/i.test(src) && /crowd|patron|fill|density/i.test(src), "Expected tavern evening/night crowd schedule");
report.check("night guard patrols and criminal activity are modeled", /guard[^\n]*(night|patrol)|night[^\n]*guard/i.test(src) && /thief|criminal|smuggler|outlaw|pickpocket/i.test(src), "Expected night guard/criminal schedule rules");
report.check("lamps/torches have night-state metadata", /lamp|torch|lantern/i.test(src) && /night|evening|lit|lighting/i.test(src), "Expected lighting schedule metadata");
report.finish();
