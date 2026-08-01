import { CH1_ANCHORS } from "@/shared/harthmere/ch1_ids";
import {
  CH1_TESTIMONY_NPC_BY_NAME,
  CH1_RETIRED_DUPLICATE_TESTIMONY_NPC_IDS,
} from "@/shared/harthmere/ch1_testimony_npcs";
import {
  SNAPSHOT_GROVE_RHIAMON_DRY_POSITION,
  SNAPSHOT_GROVE_RHIAMON_ENTITY_ID,
} from "@/shared/harthmere/snapshot_grove_ids";
import assert from "assert";
import fs from "fs";
import path from "path";

describe("snapshot NPC water placement", () => {
  it("keeps Coretta on the canonical Chapter 1 ledger post", () => {
    const coretta = CH1_TESTIMONY_NPC_BY_NAME.get("Coretta");
    assert(coretta, "Coretta testimony seed is missing");
    assert.deepEqual(coretta.position, CH1_ANCHORS.coretta_ledger_desk);
    assert.equal(Number(coretta.entityId), 6_785_547_476_266_196);
    assert(!CH1_RETIRED_DUPLICATE_TESTIMONY_NPC_IDS.includes(coretta.entityId));
  });

  it("moves Rhiamon to a separate dry Grove post without changing identity", () => {
    assert.equal(
      Number(SNAPSHOT_GROVE_RHIAMON_ENTITY_ID),
      5_522_430_940_859_636
    );
    assert.deepEqual(SNAPSHOT_GROVE_RHIAMON_DRY_POSITION, [492, 70, -141]);

    const horizontalDistanceFromJackie = Math.hypot(
      SNAPSHOT_GROVE_RHIAMON_DRY_POSITION[0] -
        CH1_ANCHORS.roadhouse_jackie_post[0],
      SNAPSHOT_GROVE_RHIAMON_DRY_POSITION[2] -
        CH1_ANCHORS.roadhouse_jackie_post[2]
    );
    const horizontalDistanceFromCoretta = Math.hypot(
      SNAPSHOT_GROVE_RHIAMON_DRY_POSITION[0] -
        CH1_ANCHORS.coretta_ledger_desk[0],
      SNAPSHOT_GROVE_RHIAMON_DRY_POSITION[2] -
        CH1_ANCHORS.coretta_ledger_desk[2]
    );
    assert(horizontalDistanceFromJackie >= 12);
    assert(horizontalDistanceFromCoretta >= 12);
  });

  it("repairs Rhiamon position and spawn rather than applying another Y-only patch", () => {
    const shim = fs.readFileSync(
      path.join(process.cwd(), "src/server/shim/main.ts"),
      "utf8"
    );
    assert.match(
      shim,
      /\[SNAPSHOT_GROVE_RHIAMON_ENTITY_ID, SNAPSHOT_GROVE_RHIAMON_DRY_POSITION\]/
    );
    assert.match(shim, /spawn_position: targetPosition/);
    assert.doesNotMatch(shim, /\[5522430940859636 as BiomesId,\s*71\]/);
  });
});
