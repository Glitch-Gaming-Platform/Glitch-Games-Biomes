import assert from "assert";
import fs from "fs";
import path from "path";

describe("Harthmere population persistence wiring", () => {
  const shim = fs.readFileSync(
    path.join(process.cwd(), "src/server/shim/main.ts"),
    "utf8"
  );

  it("persists stationary ambient business patrons separately from shift customers", () => {
    assert.ok(shim.includes("buildHarthmereBusinessCustomerNpcSeedChanges"));
    assert.ok(shim.includes("...localDevBusinessCustomerNpcIds()"));
    assert.ok(
      !shim.includes("makeRetiredBusinessCustomerNpcChanges"),
      "v2 patron_wandering NPCs must not be retired as session-only customers"
    );
    assert.ok(
      shim.includes("candidateIds.every((id) => existingIds.has(id))"),
      "a current runtime marker must still self-heal missing patrons"
    );
  });

  it("runs the scoped generic-townsperson retirement policy", () => {
    assert.ok(shim.includes("makeRetiredGenericTownspersonChanges"));
    assert.ok(shim.includes("shouldRetireGenericHarthmereTownsperson"));
    assert.ok(shim.includes("HARTHMERE_NPC_POPULATION_POLICY_VERSION"));
  });
});
