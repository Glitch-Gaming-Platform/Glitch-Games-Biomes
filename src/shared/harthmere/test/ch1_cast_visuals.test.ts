/// <reference types="mocha" />

import assert from "assert";
import { BikkieIds } from "@/shared/bikkie/ids";
import { CH1_NEW_CAST } from "@/shared/harthmere/ch1_cast";
import {
  CH1_CAST_VISUALS,
  CH1_RETURNING_NPC_VISUALS,
  applyCh1CastFallbackWearables,
  ch1CastVisualForEntity,
} from "@/shared/harthmere/ch1_cast_visuals";

describe("Chapter One cast visuals", () => {
  it("assigns one authored visual route to every canonical cast identity", () => {
    assert.deepEqual(
      Object.keys(CH1_CAST_VISUALS).sort(),
      CH1_NEW_CAST.map((member) => member.key).sort()
    );
    for (const member of CH1_NEW_CAST) {
      const visual = ch1CastVisualForEntity(member.entityId);
      assert.ok(visual, `${member.key}: missing visual`);
      assert.equal(visual.key, member.key);
      assert.equal(visual.entityId, member.entityId);
      assert.ok(visual.design.length > 20, `${member.key}: no art direction`);
    }
  });

  it("keeps non-human identities on their authored model families", () => {
    assert.deepEqual(
      ["snapshot_asset", CH1_CAST_VISUALS.jackie.asset],
      ["snapshot_asset", "npcs/jackie"]
    );
    assert.deepEqual(
      [CH1_CAST_VISUALS.augur9.route, CH1_CAST_VISUALS.augur9.asset],
      ["robot", "npcs/helping_robot"]
    );
    assert.deepEqual(
      [CH1_CAST_VISUALS.marrow.route, CH1_CAST_VISUALS.marrow.asset],
      ["animal", "npcs/dog_1"]
    );
  });

  it("gives every player-like fallback a complete, role-authored outfit", () => {
    for (const visual of [
      ...Object.values(CH1_CAST_VISUALS),
      ...CH1_RETURNING_NPC_VISUALS,
    ]) {
      if (!visual.route.includes("player_like")) continue;
      const slots = new Map(visual.fallbackWearables);
      assert.ok(slots.get(BikkieIds.top), `${visual.key}: missing top`);
      assert.ok(slots.get(BikkieIds.bottoms), `${visual.key}: missing bottoms`);
      assert.equal(
        slots.get(BikkieIds.feet),
        BikkieIds.boots,
        `${visual.key}: missing practical boots`
      );
      for (const novelty of [
        BikkieIds.sombrero,
        BikkieIds.flowerCrown,
        BikkieIds.beanieWithSpinner,
      ]) {
        assert.ok(
          ![...slots.values()].includes(novelty),
          `${visual.key}: serious story cast received novelty clothing`
        );
      }
    }
  });

  it("gives returning Holt a deterministic watch-sergeant presentation", () => {
    const [holt] = CH1_RETURNING_NPC_VISUALS;
    assert.equal(holt.key, "sergeant_bram_holt");
    assert.equal(ch1CastVisualForEntity(holt.entityId), holt);
    const slots = new Map(holt.fallbackWearables);
    assert.equal(slots.get(BikkieIds.top), BikkieIds.grassyTop);
    assert.equal(slots.get(BikkieIds.outerwear), BikkieIds.poncho);
    assert.equal(slots.has(BikkieIds.hat), false);
  });

  it("removes random costume layers before applying an authored role outfit", () => {
    const lou = CH1_NEW_CAST.find((member) => member.key === "lou_ardan")!;
    const items = applyCh1CastFallbackWearables(
      lou.entityId,
      new Map([
        [BikkieIds.hat, BikkieIds.sombrero],
        [BikkieIds.outerwear, BikkieIds.poncho],
      ]),
      (itemId) => itemId
    );
    assert.equal(items.has(BikkieIds.hat), false);
    assert.equal(items.has(BikkieIds.outerwear), false);
    assert.equal(items.get(BikkieIds.top), BikkieIds.pjTop);
    assert.equal(items.get(BikkieIds.bottoms), BikkieIds.bellBottoms);
    assert.equal(items.get(BikkieIds.feet), BikkieIds.boots);
  });
});
