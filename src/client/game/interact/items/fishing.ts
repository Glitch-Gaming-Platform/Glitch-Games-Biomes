import type { ClientContextSubset } from "@/client/game/context";
import type { AttackDestroyDelegateSpec } from "@/client/game/interact/item_types/attack_destroy_delegate_item_spec";
import type { ClickableItemInfo } from "@/client/game/interact/item_types/clickable_item_script";
import type { FishingInfo } from "@/client/game/util/fishing/state_machine";
import { handleFishAction } from "@/client/game/util/fishing/state_machine";
import { fishingMovementRequiresReset } from "@/shared/game/fishing";
import { OwnedItemReferencesEqual } from "@/shared/game/inventory";
import type { Vec3f } from "@/shared/wasm/types/common";

export class FishingItemSpec implements AttackDestroyDelegateSpec {
  private lastFishingPosition?: Vec3f;

  constructor(
    readonly deps: ClientContextSubset<
      "userId" | "input" | "resources" | "events" | "voxeloo"
    >
  ) {}

  onUnselected() {
    this.fishingInfo = undefined;
    return true;
  }

  allowsPrimaryDelegation() {
    return !this.fishingInfo || this.fishingInfo.state === "ready_to_cast";
  }

  allowsSecondaryDelegation() {
    return !this.fishingInfo || this.fishingInfo.state === "ready_to_cast";
  }

  onPrimaryDown() {
    return true;
  }

  onTick(itemInfo: ClickableItemInfo) {
    if (!this.fishingInfo) {
      this.resetState(itemInfo.itemRef);
    } else if (
      fishingMovementRequiresReset(
        this.lastFishingPosition,
        this.localPlayer.player.position
      ) ||
      !this.fishingInfo.rodItemRef ||
      !OwnedItemReferencesEqual(
        this.fishingInfo.rodItemRef,
        itemInfo.itemRef
      )
    ) {
      this.resetState(itemInfo.itemRef);
    } else {
      this.fishingInfo = handleFishAction(
        this.deps,
        this.deps.input.motion("primary_hold") > 0,
        this.fishingInfo
      );
    }

    return true;
  }

  private resetState(rodItemRef: ClickableItemInfo["itemRef"]) {
    this.fishingInfo = {
      state: "ready_to_cast",
      baitItemRef: this.fishingInfo?.baitItemRef,
      rodItemRef,
      start: 0,
    };
  }

  private get localPlayer() {
    return this.deps.resources.get("/scene/local_player");
  }

  private get fishingInfo() {
    return this.localPlayer.fishingInfo;
  }

  private set fishingInfo(newVal: FishingInfo | undefined) {
    this.deps.resources.update("/scene/local_player", (localPlayer) => {
      localPlayer.fishingInfo = newVal;
    });
    const localPlayer = this.localPlayer;
    if (newVal && newVal.state !== "ready_to_cast") {
      this.lastFishingPosition = [...localPlayer.player.position];
    } else {
      this.lastFishingPosition = undefined;
    }
    if (
      (!newVal || newVal.state === "ready_to_cast") &&
      localPlayer.player.emoteInfo?.richEmoteComponents?.fishing_info
    ) {
      localPlayer.player.eagerCancelEmote(this.deps.events);
    }
  }
}
