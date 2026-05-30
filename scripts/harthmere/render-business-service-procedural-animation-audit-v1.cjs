#!/usr/bin/env node

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
  jsx: "react",
});

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const fs = require("fs");
const path = require("path");

const {
  renderHarthmereBusinessProceduralAnimationVisualAuditHtmlV1,
  validateHarthmereBusinessProceduralAnimationVisualAuditV1,
} = require("../../src/shared/harthmere/business_service_procedural_animations_v1");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const outDir = path.join(root, "artifacts", "harthmere");
fs.mkdirSync(outDir, { recursive: true });

const audit = validateHarthmereBusinessProceduralAnimationVisualAuditV1();
if (!audit.ok) {
  console.error(audit.warnings.join("\n"));
  process.exit(1);
}

const html = renderHarthmereBusinessProceduralAnimationVisualAuditHtmlV1();
const htmlPath = path.join(outDir, "business-service-procedural-animation-audit-v1.html");
fs.writeFileSync(htmlPath, html, "utf8");

const summaryPath = path.join(outDir, "business-service-procedural-animation-audit-v1.json");
fs.writeFileSync(summaryPath, JSON.stringify(audit, null, 2), "utf8");

console.log(JSON.stringify({ htmlPath, summaryPath, audit }, null, 2));
