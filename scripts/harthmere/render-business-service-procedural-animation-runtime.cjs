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
  renderHarthmereBusinessProceduralAnimationRuntimeAuditHtml,
  validateHarthmereBusinessProceduralAnimationRuntimeAudit,
} = require("../../src/shared/harthmere/business_service_procedural_animations");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const outDir = path.join(root, "artifacts", "harthmere");
fs.mkdirSync(outDir, { recursive: true });

const audit = validateHarthmereBusinessProceduralAnimationRuntimeAudit();
if (!audit.ok) {
  console.error(audit.warnings.join("\n"));
  process.exit(1);
}

const html = renderHarthmereBusinessProceduralAnimationRuntimeAuditHtml();
const htmlPath = path.join(outDir, "business-service-procedural-animation-runtime.html");
fs.writeFileSync(htmlPath, html, "utf8");

const summaryPath = path.join(outDir, "business-service-procedural-animation-runtime.json");
fs.writeFileSync(summaryPath, JSON.stringify(audit, null, 2), "utf8");

console.log(JSON.stringify({ htmlPath, summaryPath, audit }, null, 2));
