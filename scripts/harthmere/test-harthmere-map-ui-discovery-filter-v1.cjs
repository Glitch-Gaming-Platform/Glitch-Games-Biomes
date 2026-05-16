#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");
const fs = require("fs");
const { loadTown, makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere map UI, discovery, and filter tests v1", root);
const town = loadTown(root);
const requiredIcons = ["gate", "market", "bank", "inn", "crafting", "healer", "town_hall", "ferry", "slums", "guard", "dungeon_hidden", "house", "wilds"];
const missingIcons = requiredIcons.filter((icon) => !new RegExp(`mapIcon:\\s*["']${icon}["']`).test(town.registrySrc));
report.check("registry exposes required map icon categories for all districts", missingIcons.length === 0, missingIcons);
const requiredFilterNames = ["all", "quests", "shops", "crafting", "travel", "guilds", "combat", "services", "housing", "hidden", "criminal"];
const mapFiles = ["src/shared/harthmere/town_map.ts", "src/client/game/resources/harthmere_town_map.ts", "src/client/game/renderers/local_dev/harthmere_town_map.ts", "src/client/game/renderers/local_dev/harthmere_map_ui.ts"].map((p) => path.join(root, p));
const existingMapFiles = mapFiles.filter((p) => fs.existsSync(p));
const mapUiSrc = [town.registrySrc, town.assetsSrc, ...existingMapFiles.map((p) => fs.readFileSync(p, "utf8"))].join("\n");
const missingFilters = requiredFilterNames.filter((name) => !new RegExp(name, "i").test(mapUiSrc));
report.check("map UI defines required filters", missingFilters.length === 0, missingFilters);
report.check("hidden locations are gated by discovery state instead of always shown", /discovered|discovery|rumor|perception|unlock|hidden.*until/i.test(mapUiSrc), "Expected discovery/unlock/range logic for hidden map icons");
report.check("danger zones have a red/warning map presentation", /danger.*(red|warning|color|icon)|red.*danger|warning.*danger/i.test(mapUiSrc), "Expected danger zone warning/color/icon logic");
report.check("nearby vendor/service icons group or declutter when zoomed out", /cluster|group.*zoom|zoom.*group|declutter|overcrowd/i.test(mapUiSrc), "Expected zoom grouping/decluttering for crowded map icons");
report.check("map icons point to reachable interaction anchors rather than decorative shells", /interactionAnchor|serviceAnchor|npcId|interactable|anchorPosition|reachable/i.test(mapUiSrc), "Expected service icon anchor/reachability metadata");
report.finish();
