import assert from "assert";

import {
  SNAPSHOT_GROVE_AMBIENT_DIALOGUE,
  snapshotGroveAmbientLineForNpc,
} from "@/shared/harthmere/snapshot_grove_ambient_dialogue";
import { SNAPSHOT_GROVE_NPCS } from "@/shared/harthmere/snapshot_grove_content";

describe("Snapshot Grove ambient dialogue", () => {
  it("covers every Grove NPC with globally unique non-quest lines", () => {
    const lines = new Set<string>();
    for (const npc of SNAPSHOT_GROVE_NPCS) {
      const ambient = SNAPSHOT_GROVE_AMBIENT_DIALOGUE[npc.id];
      assert.ok(ambient, `${npc.id} needs ambient dialogue`);
      assert.equal(ambient.length, 3);
      for (const line of ambient) {
        assert.ok(line.length > 65, `${npc.id} ambient line is too short`);
        assert.ok(!lines.has(line), `${npc.id} repeats Grove ambient dialogue`);
        lines.add(line);
        assert.ok(
          !npc.extraLines.includes(line) && npc.line !== line,
          `${npc.id} ambient dialogue must remain separate from quest copy`
        );
      }
    }
    assert.equal(lines.size, SNAPSHOT_GROVE_NPCS.length * 3);
  });

  it("selects warmer ambient lines as likeability rises", () => {
    assert.equal(
      snapshotGroveAmbientLineForNpc("jackie", 0),
      SNAPSHOT_GROVE_AMBIENT_DIALOGUE.jackie[0]
    );
    assert.equal(
      snapshotGroveAmbientLineForNpc("jackie", 1),
      SNAPSHOT_GROVE_AMBIENT_DIALOGUE.jackie[1]
    );
    assert.equal(
      snapshotGroveAmbientLineForNpc("jackie", 2),
      SNAPSHOT_GROVE_AMBIENT_DIALOGUE.jackie[2]
    );
  });
});
