import type { Buff, Item } from "@/shared/ecs/gen/types";
import type { BuffType } from "@/shared/game/buff_specs";
import { anItem } from "@/shared/game/item";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import { clamp, first } from "lodash";

function buffDuration(buff: Buff) {
  const duration = anItem(buff.item_id).duration;
  if (duration === undefined) {
    log.warn(`No duration set for buff where item_id=${buff.item_id}.`);
  }
  return duration ?? 0;
}

export function buffTimeRemaining(buff: Buff, time: number) {
  if (!buff.start_time) {
    return Number.POSITIVE_INFINITY;
  }
  const duration = buffDuration(buff);
  return clamp(buff.start_time + duration - time, 0, duration);
}

export function buffExpirationTime(buff: Buff) {
  if (!buff.start_time) {
    return Number.POSITIVE_INFINITY;
  }
  return buff.start_time + buffDuration(buff);
}

// GLITCH_SNAPSHOT_BUFF_TYPE_COMPAT_V1:
// Snapshot data can contain legacy active buff item ids whose biscuit exists but
// no longer carries the newer Glitch `buffType` field. The HUD/render loop must
// not crash on those old buffs. Keep the hard item lookup for real missing item
// bugs, but make missing buffType a logged compatibility fallback.
const unknownSnapshotBuffTypeWarnings = new Set<BiomesId>();
const UNKNOWN_SNAPSHOT_BUFF_TYPE_FALLBACK: BuffType = "debuff";

function warnUnknownSnapshotBuffType(buff: Buff) {
  if (unknownSnapshotBuffTypeWarnings.has(buff.item_id)) {
    return;
  }
  unknownSnapshotBuffTypeWarnings.add(buff.item_id);
  const item = anItem(buff.item_id);
  log.warn("GLITCH_SNAPSHOT_BUFF_TYPE_COMPAT_V1 unknown buff type fallback", {
    buffItemId: buff.item_id,
    fromId: buff.from_id,
    displayName: item.displayName,
    displayDescription: item.displayDescription,
    fallback: UNKNOWN_SNAPSHOT_BUFF_TYPE_FALLBACK,
  });
}

export function maybeBuffType(buff: Buff): BuffType | undefined {
  return anItem(buff.item_id).buffType;
}

export function buffType(buff: Buff): BuffType {
  const resolvedBuffType = maybeBuffType(buff);
  if (resolvedBuffType) {
    return resolvedBuffType;
  }
  warnUnknownSnapshotBuffType(buff);
  return UNKNOWN_SNAPSHOT_BUFF_TYPE_FALLBACK;
}

export function buffDescription(buffItemId: BiomesId) {
  return (
    anItem(buffItemId).displayDescription || anItem(buffItemId).displayName
  );
}

export function itemBuffWeights(item: Item) {
  return item.buffs ?? [];
}

export function itemBuffType(item: Item) {
  const buffId = first(itemBuffWeights(item))?.[0];
  return buffId
    ? buffType({
        item_id: buffId,
        start_time: 0,
        from_id: undefined,
        is_disabled: undefined,
      })
    : undefined;
}

export function itemBuffSuspicious(item: Item) {
  const buffWeights = itemBuffWeights(item);
  return buffWeights.length > 1;
}

export function itemBuffDescription(
  item: Item
): [string | undefined, BuffType | undefined] {
  const buffWeights = itemBuffWeights(item);
  let description: string | undefined;
  let type: BuffType | undefined;
  if (buffWeights.length === 1) {
    const buffId = buffWeights[0][0];
    description = buffDescription(buffId);
    type = maybeBuffType({
      item_id: buffId,
      start_time: 0,
      from_id: undefined,
      is_disabled: undefined,
    });
  } else if (buffWeights.length > 1) {
    description = `Consume suspicious ${
      item.action === "eat" ? "food" : "drinks"
    } at your own risk`;
    type = "debuff";
  }
  return [description, type];
}
