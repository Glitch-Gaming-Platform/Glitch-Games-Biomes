import { BikkieIds } from "@/shared/bikkie/ids";
import { ch1NpcEntityId, type Ch1NpcKey } from "@/shared/harthmere/ch1_ids";
import { CH1_SERGEANT_HOLT } from "@/shared/harthmere/ch1_returning_npcs";
import type { BiomesId } from "@/shared/ids";

export const CH1_CAST_VISUALS_VERSION = "ch1-cast-authored-visuals-v2" as const;

export interface Ch1CastVisualSpec {
  key: Ch1NpcKey | "sergeant_bram_holt";
  entityId: BiomesId;
  route:
    | "snapshot_asset"
    | "snapshot_player_like"
    | "player_like"
    | "robot"
    | "animal";
  asset?: string;
  /** Applied only when synchronized appearance/wearing is unavailable. */
  fallbackWearables?: readonly (readonly [BiomesId, BiomesId])[];
  design: string;
}

const human = (
  key: Ch1NpcKey,
  design: string,
  input: {
    top: BiomesId;
    bottoms: BiomesId;
    outerwear?: BiomesId;
    hat?: BiomesId;
    route?: "snapshot_player_like" | "player_like";
  }
): Ch1CastVisualSpec => ({
  key,
  entityId: ch1NpcEntityId(key),
  route: input.route ?? "player_like",
  fallbackWearables: [
    [BikkieIds.top, input.top],
    [BikkieIds.bottoms, input.bottoms],
    [BikkieIds.feet, BikkieIds.boots],
    ...(input.outerwear
      ? ([[BikkieIds.outerwear, input.outerwear]] as const)
      : []),
    ...(input.hat ? ([[BikkieIds.hat, input.hat]] as const) : []),
  ],
  design,
});

/**
 * Stable art direction for every Chapter One story actor. Existing snapshot
 * appearance components still win; these outfits are the deterministic
 * fallback used by seeded actors and off-subscription per-player puppets.
 */
export const CH1_CAST_VISUALS: Readonly<Record<Ch1NpcKey, Ch1CastVisualSpec>> =
  Object.freeze({
    jackie: {
      key: "jackie",
      entityId: ch1NpcEntityId("jackie"),
      route: "snapshot_asset",
      asset: "npcs/jackie",
      design:
        "Original snapshot Jackie model and road-ready clothes; never replaced by a generic player avatar.",
    },
    lou_ardan: human(
      "lou_ardan",
      "Clean clinical layers: pale work shirt, tailored trousers, practical boots.",
      { top: BikkieIds.pjTop, bottoms: BikkieIds.bellBottoms }
    ),
    cressa_vane: human(
      "cressa_vane",
      "Formal civil-arbiter silhouette with a structured outer layer and no novelty accessories.",
      {
        top: BikkieIds.ogTShirt,
        bottoms: BikkieIds.bellBottoms,
        outerwear: BikkieIds.poncho,
      }
    ),
    halden_rook: human(
      "halden_rook",
      "Weathered bridge-warden layers with a travel cloak and field boots.",
      {
        top: BikkieIds.grassyTop,
        bottoms: BikkieIds.bellBottoms,
        outerwear: BikkieIds.poncho,
      }
    ),
    nadia_sorrel: human(
      "nadia_sorrel",
      "Field-research clothing: light work shirt, durable trousers, protective travel layer.",
      {
        top: BikkieIds.pjTop,
        bottoms: BikkieIds.bellBottoms,
        outerwear: BikkieIds.poncho,
      }
    ),
    iris_fen: human(
      "iris_fen",
      "Simple child-sized sleepwear and boots; no adult uniform, armor, or novelty hat.",
      { top: BikkieIds.pjTop, bottoms: BikkieIds.pjBottoms }
    ),
    teak_morrow: human(
      "teak_morrow",
      "Scuffed courier layers with a patched travel cloak and practical boots.",
      {
        top: BikkieIds.tatteredTop,
        bottoms: BikkieIds.bellBottoms,
        outerwear: BikkieIds.poncho,
      }
    ),
    augur9: {
      key: "augur9",
      entityId: ch1NpcEntityId("augur9"),
      route: "robot",
      asset: "npcs/helping_robot",
      design:
        "The canonical Mucked Robot/AUGUR-9 body; never a human or second robot.",
    },
    wen_halloway: human(
      "wen_halloway",
      "Containment-works clerk clothing with an industrial protective cap.",
      {
        top: BikkieIds.ogTShirt,
        bottoms: BikkieIds.bellBottoms,
        hat: BikkieIds.aviatorHat,
      }
    ),
    marrow: {
      key: "marrow",
      entityId: ch1NpcEntityId("marrow"),
      route: "animal",
      asset: "npcs/dog_1",
      design: "Canonical dog body; never a player-like human fallback.",
    },
    hallr_ironmouth: human(
      "hallr_ironmouth",
      "Heavy winter-leader layers with a cloak and grounded work boots.",
      {
        top: BikkieIds.grassyTop,
        bottoms: BikkieIds.grassyBottom,
        outerwear: BikkieIds.poncho,
      }
    ),
    coretta: human(
      "coretta",
      "Ledger-keeper work clothes; synchronized reviewed snapshot cosmetics take priority.",
      {
        top: BikkieIds.ogTShirt,
        bottoms: BikkieIds.bellBottoms,
        route: "snapshot_player_like",
      }
    ),
    calla_ashe: human(
      "calla_ashe",
      "Containment foreman workwear with a protective industrial cap.",
      {
        top: BikkieIds.grassyTop,
        bottoms: BikkieIds.bellBottoms,
        hat: BikkieIds.aviatorHat,
      }
    ),
  });

/** Returning story actors retain their canonical identity but need an authored
 * off-subscription fallback while a per-player projection brings them into the
 * Grove. */
export const CH1_RETURNING_NPC_VISUALS: readonly Ch1CastVisualSpec[] =
  Object.freeze([
    {
      key: "sergeant_bram_holt",
      entityId: CH1_SERGEANT_HOLT.entityId,
      route: "player_like",
      fallbackWearables: [
        [BikkieIds.top, BikkieIds.grassyTop],
        [BikkieIds.bottoms, BikkieIds.bellBottoms],
        [BikkieIds.feet, BikkieIds.boots],
        [BikkieIds.outerwear, BikkieIds.poncho],
      ],
      design:
        "North Gate watch-sergeant field uniform with a weathered cloak and no novelty accessories.",
    },
  ]);

const VISUAL_BY_ENTITY_ID = new Map<number, Ch1CastVisualSpec>(
  [...Object.values(CH1_CAST_VISUALS), ...CH1_RETURNING_NPC_VISUALS].map(
    (visual) => [Number(visual.entityId), visual]
  )
);

export function ch1CastVisualForEntity(
  entityId: BiomesId | number
): Ch1CastVisualSpec | undefined {
  return VISUAL_BY_ENTITY_ID.get(Number(entityId));
}

/** Apply a Chapter One role outfit over a generic fallback assignment. */
export function applyCh1CastFallbackWearables<T>(
  entityId: BiomesId | number,
  items: Map<BiomesId, T>,
  resolve: (itemId: BiomesId) => T
): Map<BiomesId, T> {
  const visual = ch1CastVisualForEntity(entityId);
  if (!visual?.fallbackWearables) return items;
  items.delete(BikkieIds.hat);
  items.delete(BikkieIds.outerwear);
  for (const [slot, itemId] of visual.fallbackWearables) {
    items.set(slot, resolve(itemId));
  }
  return items;
}
