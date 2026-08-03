import assert from "assert";
import fs from "fs";
import path from "path";

describe("Harthmere additive-town NPC interior anchor wiring", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/server/shim/main.ts"),
    "utf8"
  );

  it("overrides stale street anchors from the collision-checked interior manifest", () => {
    assert.match(source, /HARTHMERE_ADDITIVE_TOWN_INTERIOR_NPC_ANCHORS/);
    assert.match(
      source,
      /for \(const anchor of HARTHMERE_ADDITIVE_TOWN_INTERIOR_NPC_ANCHORS\)[\s\S]*HARTHMERE_NPC_STABLE_ANCHOR\.set\(anchor\.offset, \[\.\.\.anchor\.position\]\)/
    );
    assert.match(source, /additiveTownInteriorsVersion/);
    assert.match(source, /harthmereAdditiveTownInteriorNpcAnchor\(offset\)/);
    assert.match(
      source,
      /interiorAnchor\?\.position\[1\] \?\? HARTHMERE_EXTENSION_FEET_Y/
    );
  });

  it("includes collision and cooking families in production reconciliation", () => {
    const reconciliation = fs.readFileSync(
      path.join(
        process.cwd(),
        "scripts/harthmere/reconcile-production-world-sync.cjs"
      ),
      "utf8"
    );
    assert.match(reconciliation, /Additive-town interior collision proxies/);
    assert.match(reconciliation, /Additive-town native cooking stations/);
  });
});
