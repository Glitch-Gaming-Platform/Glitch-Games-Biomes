/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import fs from "fs";
import path from "path";

// HARTHMERE_GROUNDING_SINGLE_SOURCE:
// Guard that EVERY world-placed Harthmere thing (NPCs incl. cows/sheep/hexes/
// muckers/owners, dropped & quest items, gather/quest-object markers) grounds
// through the ONE shared grounding module so nothing ever floats or buries and
// everything is always visible. If a new renderer places things in the world it
// must import this module too — add it here.

const ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");

const GROUNDING_MODULE = "@/client/game/util/harthmere_entity_grounding";

// Files that position something in the Harthmere world and therefore must use
// the shared grounder.
const WORLD_PLACEMENT_FILES = [
  "src/client/game/resources/npcs.ts",
  "src/client/game/resources/drops.ts",
  "src/client/game/renderers/local_dev/harthmere_quest_object_markers.ts",
  "src/client/game/renderers/local_dev/harthmere_gathering_node_markers.ts",
];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("HARTHMERE_GROUNDING_SINGLE_SOURCE", () => {
  it("every world-placement renderer imports the shared grounding module", () => {
    for (const rel of WORLD_PLACEMENT_FILES) {
      const src = read(rel);
      assert.ok(
        src.includes(GROUNDING_MODULE),
        `${rel} must ground via ${GROUNDING_MODULE} (no parallel grounding)`
      );
    }
  });

  it("no world-placement renderer reimplements the low-level ground scan", () => {
    // The terrain scan lives ONLY in the shared module/shared math. A renderer
    // defining its own findHarthmereGroundFeetY* would be a parallel system.
    for (const rel of WORLD_PLACEMENT_FILES) {
      const src = read(rel);
      assert.ok(
        !/function\s+findHarthmereGroundFeetY/.test(src),
        `${rel} must not reimplement the ground scan`
      );
    }
  });

  it("the shared module exposes the single 'with memory' entrypoint", () => {
    const src = read("src/client/game/util/harthmere_entity_grounding.ts");
    assert.ok(src.includes("export function harthmereGroundedFeetYWithMemory"));
    assert.ok(src.includes("export const resolveHarthmereGroundedFeetY"));
  });
});
