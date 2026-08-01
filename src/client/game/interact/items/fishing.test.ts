import { FishingItemSpec } from "@/client/game/interact/items/fishing";
import type { FishingInfo } from "@/client/game/util/fishing/state_machine";
import type { OwnedItemReference } from "@/shared/ecs/gen/types";
import assert from "assert";

function fixture(initial?: FishingInfo) {
  const localPlayer = {
    fishingInfo: initial,
    player: {
      position: [0, 0, 0],
      emoteInfo: undefined,
      eagerCancelEmote: () => undefined,
    },
  };
  const resources = {
    get(path: string) {
      assert.equal(path, "/scene/local_player");
      return localPlayer;
    },
    update(path: string, update: (value: typeof localPlayer) => void) {
      assert.equal(path, "/scene/local_player");
      update(localPlayer);
    },
  };
  return {
    localPlayer,
    spec: new FishingItemSpec({
      resources,
      events: {},
      input: {},
      userId: 1,
      voxeloo: {},
    } as any),
  };
}

describe("FishingItemSpec rod ownership", () => {
  const rodRef: OwnedItemReference = { kind: "hotbar", idx: 0 };

  it("initializes ready-to-cast with the selected native rod reference", () => {
    const { localPlayer, spec } = fixture();

    spec.onTick({ itemRef: rodRef });

    assert.deepEqual(localPlayer.fishingInfo, {
      state: "ready_to_cast",
      baitItemRef: undefined,
      rodItemRef: rodRef,
      start: 0,
    });
  });

  it("repairs a stale ready state without relying on a rendered overlay", () => {
    const staleRef: OwnedItemReference = { kind: "hotbar", idx: 4 };
    const { localPlayer, spec } = fixture({
      state: "ready_to_cast",
      baitItemRef: undefined,
      rodItemRef: staleRef,
      start: 12,
    });

    spec.onTick({ itemRef: rodRef });

    assert.deepEqual(localPlayer.fishingInfo?.rodItemRef, rodRef);
    assert.equal(localPlayer.fishingInfo?.state, "ready_to_cast");
  });
});
