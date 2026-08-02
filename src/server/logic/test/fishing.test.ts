import { GameEvent } from "@/server/shared/api/game_event";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import {
  addGameUser,
  setItemAtSlotIndex,
  TestLogicApi,
} from "@/server/test/test_helpers";
import {
  MAX_SERVER_FISHING_ATTEMPT_SECONDS,
  validServerFishingAttemptSeconds,
  validServerFishingCatchBag,
} from "@/server/logic/events/handlers/fishing";
import { BikkieIds } from "@/shared/bikkie/ids";
import { BikkieRuntime } from "@/shared/bikkie/active";
import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import { FishingClaimEvent } from "@/shared/ecs/gen/events";
import { countOf, createBag } from "@/shared/game/items";
import { SNAPSHOT_FISHING_RODS } from "@/shared/harthmere/fishing_rods";
import { readHarthmereNativeSkillTotalXp } from "@/shared/harthmere/harthmere_skill_progression";
import { generateTestId } from "@/shared/test_helpers";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";

describe("native fishing authority", () => {
  let voxeloo!: VoxelooModule;
  before(async () => {
    voxeloo = await loadVoxeloo();
    BikkieRuntime.get().registerBiscuits(
      new Map([
        [
          SNAPSHOT_FISHING_RODS[0].id,
          {
            id: SNAPSHOT_FISHING_RODS[0].id,
            name: "Training Rod",
            displayName: "Training Rod",
            action: "fish",
            isTool: true,
            stackable: 1n,
          } as unknown as Biscuit,
        ],
        [
          BikkieIds.koi,
          {
            id: BikkieIds.koi,
            name: "Koi",
            displayName: "Koi",
            stackable: 99n,
            fishConditions: [{} as never],
          } as unknown as Biscuit,
        ],
      ])
    );
  });

  it("accepts a real rod catch, grants the fish, and awards Fishing XP", async () => {
    const logic = new TestLogicApi(voxeloo);
    const playerId = (await addGameUser(logic.world, generateTestId(), {})).id;
    const trainingRod = SNAPSHOT_FISHING_RODS[0].id;
    setItemAtSlotIndex(logic.world, playerId, countOf(trainingRod), 0);

    await logic.publish(
      new GameEvent(
        playerId,
        new FishingClaimEvent({
          id: playerId,
          bag: createBag(countOf(BikkieIds.koi)),
          tool_ref: { kind: "item", idx: 0 },
          catch_time: 12,
        })
      )
    );

    const player = logic.world.table.get(playerId)!;
    assert.ok(
      [
        ...(player.inventory?.hotbar ?? []),
        ...(player.inventory?.items ?? []),
      ].some((slot) => slot?.item.id === BikkieIds.koi),
      "the caught fish should enter native inventory"
    );
    assert.ok(
      readHarthmereNativeSkillTotalXp(player.trigger_state, "fishing") > 0,
      "a validated catch should award Fishing XP"
    );
  });

  it("rejects forged catches and invalid durations at the handler boundary", () => {
    for (const fallbackCatchId of [
      BikkieIds.clownfish,
      BikkieIds.koi,
      BikkieIds.punkfish,
      BikkieIds.spikefish,
      BikkieIds.switchGrass,
    ]) {
      assert.equal(
        validServerFishingCatchBag(createBag(countOf(fallbackCatchId))),
        true,
        `native fishing fallback ${fallbackCatchId} should remain claimable`
      );
    }
    assert.equal(
      validServerFishingCatchBag(createBag(countOf(BikkieIds.axe))),
      false
    );
    assert.equal(
      validServerFishingCatchBag(
        createBag(countOf(BikkieIds.koi), countOf(BikkieIds.clownfish))
      ),
      false
    );
    assert.equal(validServerFishingAttemptSeconds(-1), false);
    assert.equal(validServerFishingAttemptSeconds(Number.NaN), false);
    assert.equal(
      validServerFishingAttemptSeconds(MAX_SERVER_FISHING_ATTEMPT_SECONDS),
      true
    );
    assert.equal(
      validServerFishingAttemptSeconds(MAX_SERVER_FISHING_ATTEMPT_SECONDS + 1),
      false
    );
  });
});
