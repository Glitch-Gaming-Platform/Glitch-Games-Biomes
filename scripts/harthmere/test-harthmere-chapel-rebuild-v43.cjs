#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const src = fs.readFileSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts"), "utf8");
let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.error(`FAIL ${label}`); ok = false; }
}

check("chapel block-built placement exists", /createHarthmereBlockBuiltServiceBuildingV43\(\{[^}]*name: "Chapel of Saint Verena"[^}]*profile: "chapel"/s.test(src));
check("chapel is two-story accessible", /name: "Chapel of Saint Verena"[^}]*floors: 2/s.test(src));
check("chapel old iso body removed", !src.includes('P("obj_church_iso"'));
check("chapel old direct roof removed", !src.includes('P("obj_church_roof_blue"'));
check("chapel has rebuilt bell arch support label", src.includes("rebuilt stone chapel bell arch"));
check("chapel interior pews exist", src.includes("chapel pew row west on stone floor") && src.includes("chapel pew row east on stone floor"));
check("chapel altar exists", src.includes("chapel pulpit altar supported on stone floor"));
check("chapel archive exists", src.includes("chapel archive bookcase against rebuilt stone wall"));

process.exit(ok ? 0 : 1);
