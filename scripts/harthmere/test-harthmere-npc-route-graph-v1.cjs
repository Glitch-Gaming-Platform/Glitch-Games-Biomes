#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");
const fs = require("fs");
const { loadTown, makeReporter, normalizeDistrict } = require("./harthmere-town-rule-test-utils-v1.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere NPC route graph tests v1", root);
const town = loadTown(root);
const routeFiles = ["src/shared/harthmere/town_routes.ts", "src/shared/harthmere/npc_routes.ts", "src/client/game/renderers/local_dev/harthmere_routes.ts", "src/client/game/resources/harthmere_town_routes.ts"].map((p) => path.join(root, p));
const existing = routeFiles.filter((p) => fs.existsSync(p));
const routeSrc = [town.assetsSrc, ...existing.map((p) => fs.readFileSync(p, "utf8"))].join("\n");
report.check("route graph module exists for town NPC pathing", existing.length > 0 || /HARTHMERE_.*ROUTE_GRAPH|routeGraph|patrolRoute|navRoute/i.test(routeSrc), "Expected town route graph or route constants");
report.check("town actor wander is no longer disabled as a substitute for route graphs", !/authored wander is frozen|keep authored wander only outside town|Until Harthmere has real\s+route graphs/i.test(town.assetsSrc), "Current code says route graphs do not exist yet");
const requiredRoles = ["guard", "market", "clergy", "courier", "mudden"];
const missingRoles = requiredRoles.filter((role) => !new RegExp(`${role}[^\\n]{0,80}(route|patrol|loop|anchor)|(?:route|patrol|loop|anchor)[^\\n]{0,80}${role}`, "i").test(routeSrc));
report.check("route graph covers major NPC roles", missingRoles.length === 0, missingRoles.map((role) => `Missing ${role} route/patrol/loop`));
const districtsWithActors = new Set(town.placements.filter((p) => p.kind === "A").map((p) => normalizeDistrict(p.district)).filter((d) => d !== "wilds" && d !== "unknown"));
const missingDistrictRoutes = [...districtsWithActors].filter((d) => !new RegExp(d.replace(/_/g, "[_ -]"), "i").test(routeSrc));
report.check("every town district with actors has at least one route graph anchor", missingDistrictRoutes.length === 0, missingDistrictRoutes);
report.check("route graph has invalid-route fallback anchors", /fallback|safeAnchor|unstuck|nearest.*valid|resolve.*spawn|nav.*fallback/i.test(routeSrc), "Expected fallback anchor logic for invalid NPC routes");
report.check("route graph validates against hard blockers", /collision|blocker|obstacle|sweep|navmesh|avoid/i.test(routeSrc), "Expected route validation against collision/obstacles");
report.finish();
