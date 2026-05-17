import type { BiomesId } from "@/shared/ids";
import { distSq } from "@/shared/math/linear";
import type { ReadonlyVec3 } from "@/shared/math/types";

export const HARTHMERE_NPC_ANCHOR_SYSTEM_VERSION_V37 =
  "harthmere-npc-anchor-system-v37";

export type HarthmereNpcAnchorType =
  | "stand" | "sit" | "sleep" | "work" | "shop_counter" | "guard_post"
  | "patrol_point" | "conversation" | "eating" | "drinking" | "market_stall"
  | "prayer" | "training" | "animal_grazing" | "creature_den" | "perch"
  | "water_swim" | "flying_zone" | "ambush" | "hidden_thief" | "quest_interaction";

export type HarthmereNpcAnchor = {
  id: BiomesId;
  anchor_type: HarthmereNpcAnchorType | string;
  position: ReadonlyVec3;
  required_animation?: string;
  allowed_roles: string[];
  blocked_if_combat: boolean;
  max_users: number;
};

export class AnchorIndex {
  private anchors = new Map<BiomesId, HarthmereNpcAnchor>();
  private byType = new Map<string, Set<BiomesId>>();
  private occupancy = new Map<BiomesId, number>();

  add(anchor: HarthmereNpcAnchor) {
    this.anchors.set(anchor.id, anchor);
    const set = this.byType.get(anchor.anchor_type) ?? new Set<BiomesId>();
    set.add(anchor.id);
    this.byType.set(anchor.anchor_type, set);
  }

  remove(anchorId: BiomesId) {
    const anchor = this.anchors.get(anchorId);
    if (!anchor) return;
    this.anchors.delete(anchorId);
    this.byType.get(anchor.anchor_type)?.delete(anchorId);
    this.occupancy.delete(anchorId);
  }

  positionOf(anchorId: BiomesId): ReadonlyVec3 | undefined {
    return this.anchors.get(anchorId)?.position;
  }

  findFreeAnchor(opts: {
    type: string;
    near?: ReadonlyVec3;
    role?: string;
    inCombatZone?: boolean;
  }): BiomesId | undefined {
    const candidates = this.byType.get(opts.type);
    if (!candidates) return undefined;
    let best: BiomesId | undefined;
    let bestDist = Infinity;
    for (const id of candidates) {
      const anchor = this.anchors.get(id);
      if (!anchor) continue;
      if (opts.inCombatZone && anchor.blocked_if_combat) continue;
      if (opts.role && anchor.allowed_roles.length > 0 && !anchor.allowed_roles.includes(opts.role)) continue;
      if ((this.occupancy.get(id) ?? 0) >= anchor.max_users) continue;
      if (!opts.near) return id;
      const d = distSq(anchor.position, opts.near);
      if (d < bestDist) {
        bestDist = d;
        best = id;
      }
    }
    return best;
  }

  claim(anchorId: BiomesId) {
    this.occupancy.set(anchorId, (this.occupancy.get(anchorId) ?? 0) + 1);
  }

  release(anchorId: BiomesId) {
    const next = (this.occupancy.get(anchorId) ?? 0) - 1;
    if (next <= 0) this.occupancy.delete(anchorId);
    else this.occupancy.set(anchorId, next);
  }
}
