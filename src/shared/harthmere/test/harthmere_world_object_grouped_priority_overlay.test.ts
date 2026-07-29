import assert from "assert";
import fs from "fs";
import path from "path";

describe("grouped native quest-prop overlay priority", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/client/game/scripts/overlays.ts"),
    "utf8"
  );

  it("derives the priority list from the canonical Get the Muck Out inscription contract", () => {
    assert.match(source, /NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_ENTITY_IDS/);
    assert.match(
      source,
      /\.\.\.NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_ENTITY_IDS/
    );
  });

  it("lets exact grouped props use the full interaction radius behind shallow terrain", () => {
    assert.match(
      source,
      /getNearbyPriorityHarthmereObjectInspectableOverlay\(\)/
    );
    assert.match(source, /priorityCandidateIds/);
    assert.match(
      source,
      /priorityRadius:\s*HARTHMERE_WORLD_OBJECT_INSPECT_RADIUS/
    );
  });

  it("does not reject an exact grouped quest prop as occluded by its own parent", () => {
    assert.match(
      source,
      /!selected\.isContainer\s*&&\s*!selected\.isPriority\s*&&/
    );
  });

  it("redirects direct hits on legacy duplicate inscriptions to canonical source ids", () => {
    assert.match(source, /NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_ENTITY_ID_SET/);
    assert.ok(source.includes("/\\binscriptions?\\b/i"));
    assert.match(
      source,
      /getNearbyPriorityHarthmereObjectInspectableOverlay\([\s\S]*NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_ENTITY_ID_SET/
    );
  });
});
