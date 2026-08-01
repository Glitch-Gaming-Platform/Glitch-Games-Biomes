/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import fs from "fs";
import path from "path";
import {
  canonicalSnapshotGroveNpcEntityId,
  SNAPSHOT_GROVE_CANONICAL_REPLACEMENT_ENTITY_IDS,
  SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS,
} from "@/shared/harthmere/snapshot_grove_ids";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("snapshot Grove quest navigation identity", () => {
  it("maps every deleted snapshot NPC identity to its canonical replacement", () => {
    for (const key of Object.keys(
      SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS
    ) as Array<keyof typeof SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS>) {
      assert.equal(
        canonicalSnapshotGroveNpcEntityId(
          SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS[key]
        ),
        SNAPSHOT_GROVE_CANONICAL_REPLACEMENT_ENTITY_IDS[key]
      );
    }
  });

  it("canonicalizes native quest entity markers before MapManager fetches them", () => {
    const sideEffects = read(
      "src/client/components/challenges/QuestSideEffectHelpers.tsx"
    );
    assert.match(
      sideEffects,
      /id: canonicalSnapshotGroveNpcEntityId\(progress\.navigationAid\.id\)/
    );
    assert.doesNotMatch(
      sideEffects,
      /case "entity":[\s\S]{0,180}id: progress\.navigationAid\.id/
    );
  });
});
