import assert from "assert";
import fs from "fs";
import path from "path";

describe("Harthmere population persistence wiring", () => {
  const shim = fs.readFileSync(
    path.join(process.cwd(), "src/server/shim/main.ts"),
    "utf8"
  );

  it("does not persist customer-only business patrons", () => {
    assert.ok(
      !shim.includes("buildHarthmereBusinessCustomerNpcSeedChanges"),
      "session-only business customers must not be wired into world seeding"
    );
    assert.ok(shim.includes("makeRetiredBusinessCustomerNpcChanges"));
  });

  it("runs the scoped generic-townsperson retirement policy", () => {
    assert.ok(shim.includes("makeRetiredGenericTownspersonChanges"));
    assert.ok(shim.includes("shouldRetireGenericHarthmereTownsperson"));
    assert.ok(shim.includes("HARTHMERE_NPC_POPULATION_POLICY_VERSION"));
  });
});
