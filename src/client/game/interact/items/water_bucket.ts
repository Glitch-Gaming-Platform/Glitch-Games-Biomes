import { AttackDestroyInteractionError } from "@/client/game/interact/errors";
import {
  changeRadius,
  dumpWater,
  scoopWater,
} from "@/client/game/interact/helpers";
import type { AttackDestroyDelegateSpec } from "@/client/game/interact/item_types/attack_destroy_delegate_item_spec";
import type { ClickableItemInfo } from "@/client/game/interact/item_types/clickable_item_script";
import type { InteractContext } from "@/client/game/interact/types";
import { hitExistingTerrain } from "@/shared/game/spatial";
import { emitHarthmereSoundEffect } from "@/shared/harthmere/sound_effect_manifest";

export class WaterBucketItemSpec implements AttackDestroyDelegateSpec {
  constructor(
    readonly deps: InteractContext<
      | "resources"
      | "permissionsManager"
      | "events"
      | "gardenHose"
      | "userId"
      | "table"
      | "voxeloo"
    >
  ) {}

  onPrimaryDown(itemInfo: ClickableItemInfo) {
    if (!itemInfo.item) {
      return false;
    }

    const { hit } = this.deps.resources.get("/scene/cursor");

    if (!hitExistingTerrain(hit)) {
      return false;
    }

    if (!this.deps.permissionsManager.getPermissionForAction(hit.pos, "dump")) {
      throw new AttackDestroyInteractionError({
        kind: "acl_permission",
        action: "dump",
        pos: hit.pos,
      });
    }

    if (hit.distance <= changeRadius(this.deps.resources)) {
      const scooped = scoopWater(this.deps, hit.distance);
      if (!scooped) {
        dumpWater(this.deps, hit.pos, hit.face);
      }
      const player = this.deps.resources.get("/scene/local_player").player;
      player.eagerEmote(this.deps.events, this.deps.resources, "place");
      emitHarthmereSoundEffect(scooped ? "bucket_scoop" : "bucket_dump", {
        position: hit.pos,
      });
      return true;
    }

    return false;
  }
}
