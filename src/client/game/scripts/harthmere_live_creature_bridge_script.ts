// HARTHMERE_LIVE_CREATURE_BRIDGE_SCRIPT_V1
//
// Client tick script that bridges live-creature ECS entities to the renderer.
// The Harthmere renderer's draw() has no table access, so this script (which
// does) scans the table for muck monsters / animals / hexes / quest creatures
// and publishes a compact per-entity record to a window global each tick. The
// renderer then draws one mesh per record, co-located with the entity, so the
// native attack ray hits exactly what you see.
//
// Cost control: the scan is throttled (a few times a second is plenty for
// spawn/despawn/coarse movement; fine-grained motion is handled by the renderer
// interpolating toward the published position).

import type { ClientTable } from "@/client/game/game";
import type { Script } from "@/client/game/scripts/script_controller";
import { NpcMetadataSelector } from "@/shared/ecs/gen/selectors";
import {
  harthmereLiveCreatureBridgeRecordV1,
  publishHarthmereLiveCreatureBridgeV1,
  type HarthmereLiveCreatureBridgeRecordV1,
  type HarthmereLiveCreatureEntityViewV1,
} from "@/shared/harthmere/live_creature_ecs_bridge_v1";

const PUBLISH_INTERVAL_SECONDS = 0.25;

export class HarthmereLiveCreatureBridgeScript implements Script {
  readonly name = "harthmereLiveCreatureBridge";
  private sincePublish = Number.POSITIVE_INFINITY;

  constructor(private readonly table: ClientTable) {}

  tick(dt: number) {
    this.sincePublish += Number.isFinite(dt) ? dt : 0;
    if (this.sincePublish < PUBLISH_INTERVAL_SECONDS) {
      return;
    }
    this.sincePublish = 0;

    const records: HarthmereLiveCreatureBridgeRecordV1[] = [];
    for (const entity of this.table.scan(NpcMetadataSelector.query.all())) {
      const record = harthmereLiveCreatureBridgeRecordV1(
        entity as unknown as HarthmereLiveCreatureEntityViewV1
      );
      if (record) {
        records.push(record);
      }
    }
    publishHarthmereLiveCreatureBridgeV1(records);
  }

  clear() {
    publishHarthmereLiveCreatureBridgeV1([]);
  }
}
