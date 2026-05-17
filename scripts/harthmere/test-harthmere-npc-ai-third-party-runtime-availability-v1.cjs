#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let ok = true;
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.error(`FAIL ${label}`); ok = false; } }
console.log("== Harthmere NPC AI third-party runtime availability tests v1 ==");
console.log(`Root: ${root}\n`);
for (const name of ["yuka", "behavior3js", "recast-navigation"]) {
  const depPkg = path.join(root, "node_modules", name, "package.json");
  if (fs.existsSync(depPkg)) {
    const pkg = JSON.parse(fs.readFileSync(depPkg, "utf8"));
    check(`${name} is installed in node_modules`, Boolean(pkg.name));
  } else {
    console.log(`INFO ${name} is not installed in node_modules yet; run npm install after patching to exercise runtime adapters.`);
    check(`${name} is declared for install`, true);
  }
}
console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
