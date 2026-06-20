#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { makeReporter } = require("./harthmere-town-rule-test-utils.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere town rule coverage completeness tests current", root);
const suitePath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite.cjs");
const suite = fs.existsSync(suitePath) ? fs.readFileSync(suitePath, "utf8") : "";

const required = [
  "test-harthmere-town-placement-building-design.cjs",
  "test-harthmere-runtime-navigation-collision.cjs",
  "test-harthmere-uploaded-asset-solid-collision.cjs",
  "test-harthmere-interior-room-sanity.cjs",
  "test-harthmere-map-ui-discovery-filter.cjs",
  "test-harthmere-npc-route-graph.cjs",
  "test-harthmere-town-schedules.cjs",
  "test-harthmere-law-restricted-areas.cjs",
  "test-harthmere-danger-zone-communication.cjs",
  "test-harthmere-event-state-mutation.cjs",
  "test-harthmere-visual-readability-audit.cjs",
  "test-harthmere-mount-dismount-policy.cjs",
  "test-harthmere-solid-collision-runtime-parity.cjs",
  "test-harthmere-uploaded-asset-collision-shape-sanity.cjs",
  "test-harthmere-player-spawn-and-district-entry-safety.cjs",
  "test-harthmere-town-audit-live-collision-tools.cjs",
];

const missing = required.filter((file) => !suite.includes(file));
report.check("full suite includes all town rule and live collision regression checks", missing.length === 0, missing);

const scriptsDir = path.join(root, "scripts/harthmere");
const missingFiles = required.filter((file) => !fs.existsSync(path.join(scriptsDir, file)));
report.check("all referenced rule-coverage scripts exist on disk", missingFiles.length === 0, missingFiles);

report.finish();
