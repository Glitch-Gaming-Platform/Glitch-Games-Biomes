#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere town rule coverage completeness tests v1", root);
const suitePath = path.join(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs");
const suite = fs.existsSync(suitePath) ? fs.readFileSync(suitePath, "utf8") : "";

const required = [
  "test-harthmere-town-placement-building-design-v1.cjs",
  "test-harthmere-runtime-navigation-collision-v1.cjs",
  "test-harthmere-uploaded-asset-solid-collision-v1.cjs",
  "test-harthmere-interior-room-sanity-v1.cjs",
  "test-harthmere-map-ui-discovery-filter-v1.cjs",
  "test-harthmere-npc-route-graph-v1.cjs",
  "test-harthmere-town-schedules-v1.cjs",
  "test-harthmere-law-restricted-areas-v1.cjs",
  "test-harthmere-danger-zone-communication-v1.cjs",
  "test-harthmere-event-state-mutation-v1.cjs",
  "test-harthmere-visual-readability-audit-v1.cjs",
  "test-harthmere-mount-dismount-policy-v1.cjs",
  "test-harthmere-solid-collision-runtime-parity-v1.cjs",
  "test-harthmere-uploaded-asset-collision-shape-sanity-v1.cjs",
  "test-harthmere-player-spawn-and-district-entry-safety-v1.cjs",
  "test-harthmere-town-audit-live-collision-tools-v1.cjs",
];

const missing = required.filter((file) => !suite.includes(file));
report.check("full suite includes all town rule and live collision regression checks", missing.length === 0, missing);

const scriptsDir = path.join(root, "scripts/harthmere");
const missingFiles = required.filter((file) => !fs.existsSync(path.join(scriptsDir, file)));
report.check("all referenced rule-coverage scripts exist on disk", missingFiles.length === 0, missingFiles);

report.finish();
