/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";
import { ch1NpcEntityId } from "@/shared/harthmere/ch1_ids";
import {
  CH1_RETIRED_DUPLICATE_TESTIMONY_NPC_IDS,
  CH1_TESTIMONY_NPC_BY_NAME,
  CH1_TESTIMONY_NPC_SEEDS,
  ch1ValidateTestimonyNpcSeeds,
} from "@/shared/harthmere/ch1_testimony_npcs";
import { ch1VoiceActorForSpeaker } from "@/shared/harthmere/ch1_voice";

describe("Chapter 1 testimony NPCs", () => {
  it("gives every witness one canonical native player-like NPC identity", () => {
    assert.equal(CH1_TESTIMONY_NPC_SEEDS.length, 12);
    assert.equal(
      new Set(CH1_TESTIMONY_NPC_SEEDS.map((seed) => Number(seed.entityId)))
        .size,
      12
    );
    assert.deepEqual(ch1ValidateTestimonyNpcSeeds(), []);
    for (const seed of CH1_TESTIMONY_NPC_SEEDS) {
      assert.equal(
        ch1VoiceActorForSpeaker(seed.displayName)?.entityId,
        Number(seed.entityId),
        `${seed.displayName}: voice/expression actor is not the canonical NPC`
      );
    }
  });

  it("promotes snapshot Coretta and retires only the temporary duplicate", () => {
    assert.equal(
      CH1_TESTIMONY_NPC_BY_NAME.get("Coretta")?.entityId,
      ch1NpcEntityId("coretta")
    );
    assert.deepEqual(CH1_RETIRED_DUPLICATE_TESTIMONY_NPC_IDS.map(Number), [
      8_810_000_000_020_511,
    ]);
  });

  it("never borrows the real Emily player entity as an NPC performer", () => {
    assert.notEqual(
      Number(CH1_TESTIMONY_NPC_BY_NAME.get("Emily")?.entityId),
      8_957_584_202_628_667
    );
  });

  it("preserves snapshot cosmetics on promoted witnesses", () => {
    const shim = fs.readFileSync(
      path.join(process.cwd(), "src/server/shim/main.ts"),
      "utf8"
    );
    assert.match(shim, /!seed\.preserveSnapshotAppearance/);
    assert.match(shim, /makeLocalDevChapter1TestimonyNpcChanges/);
    assert.match(shim, /CH1_RETIRED_DUPLICATE_TESTIMONY_NPC_IDS/);
    assert.match(
      shim,
      /!member\.promotesExistingEntity && member\.key !== "marrow"/
    );
  });
});
