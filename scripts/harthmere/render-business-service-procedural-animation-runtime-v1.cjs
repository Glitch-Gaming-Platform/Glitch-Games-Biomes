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
  renderHarthmereBusinessProceduralAnimationRuntimeAuditHtmlV1,
  validateHarthmereBusinessProceduralAnimationRuntimeAuditV1,
} = require("../../src/shared/harthmere/business_service_procedural_animations_v1");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const outDir = path.join(root, "artifacts", "harthmere");
fs.mkdirSync(outDir, { recursive: true });

const audit = validateHarthmereBusinessProceduralAnimationRuntimeAuditV1();
if (!audit.ok) {
  console.error(audit.warnings.join("\n"));
  process.exit(1);
}

const html = renderHarthmereBusinessProceduralAnimationRuntimeAuditHtmlV1();
const htmlPath = path.join(outDir, "business-service-procedural-animation-runtime-v1.html");
fs.writeFileSync(htmlPath, html, "utf8");

const summaryPath = path.join(outDir, "business-service-procedural-animation-runtime-v1.json");
fs.writeFileSync(summaryPath, JSON.stringify(audit, null, 2), "utf8");

console.log(JSON.stringify({ htmlPath, summaryPath, audit }, null, 2));
