import type { AttackDestroyDelegateSpec } from "@/client/game/interact/item_types/attack_destroy_delegate_item_spec";
import type { ClickableItemInfo } from "@/client/game/interact/item_types/clickable_item_script";
import type { InteractContext } from "@/client/game/interact/types";
import { emitHarthmereSoundEffect } from "@/shared/harthmere/sound_effect_manifest";

export class TreasureItemSpec implements AttackDestroyDelegateSpec {
  constructor(readonly deps: InteractContext<"resources">) {}
  onPrimaryDown(itemInfo: ClickableItemInfo) {
    this.deps.resources.set("/game_modal", {
      kind: "treasure_reveal",
      ref: itemInfo.itemRef,
    });
    emitHarthmereSoundEffect("treasure_reveal");
    return true;
  }
}
