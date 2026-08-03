// CHAPTER_1_TESTIMONY_NPCS
//
// Canonical native-ECS bodies for the twelve Act 2 witnesses. The May data
// snapshot already contains six player-like NPCs with reviewed appearances;
// preserve those exact entity identities and cosmetics. The remaining six
// labels were lore-only (or, for Emily, belonged to a real player account), so
// Chapter 1 owns stable player-like NPC ids for them instead of rendering a
// ThreeJS stand-in or borrowing a player entity.

import { CH1_TESTIMONIES } from "@/shared/harthmere/ch1_cast";
import {
  CH1_ANCHORS,
  ch1NpcEntityId,
  type Ch1AnchorKey,
} from "@/shared/harthmere/ch1_ids";
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE } from "@/shared/harthmere/snapshot_grove_ids";
import { SNAPSHOT_LIVE_NPC_LORE } from "@/shared/harthmere/snapshot_live_npc_bible";
import type { BiomesId } from "@/shared/ids";

export const CH1_TESTIMONY_NPC_SEED_VERSION =
  "chapter1-testimony-grover-onboarding-clearance-v2" as const;

const TESTIMONY_ANCHORS: Readonly<Record<string, Ch1AnchorKey>> = {
  testimony_alva: "testimony_alva",
  testimony_helsa: "testimony_helsa",
  testimony_grover: "testimony_grover",
  testimony_coretta: "testimony_coretta",
  testimony_emily: "testimony_emily",
  testimony_patsy: "testimony_patsy",
  testimony_richard: "testimony_richard",
  testimony_runna: "testimony_runna",
  testimony_drona: "testimony_drona",
  testimony_gizela: "testimony_gizela",
  testimony_davi: "testimony_davi",
  testimony_allix: "testimony_allix",
};

// Stable entities present in data-snapshot-2026-05-16. These are native NPCs
// with snapshot appearance + wearing components, not procedural ThreeJS cast.
const SNAPSHOT_TESTIMONY_ENTITY_IDS: Readonly<Record<string, BiomesId>> = {
  testimony_helsa: 3_592_267_593_576_780 as BiomesId,
  testimony_coretta: ch1NpcEntityId("coretta"),
  testimony_patsy: 4_000_213_577_717_590 as BiomesId,
  testimony_drona: 6_289_396_954_987_400 as BiomesId,
  testimony_gizela: 8_176_836_229_627_580 as BiomesId,
  testimony_allix: 6_857_902_760_603_846 as BiomesId,
};

const NEW_TESTIMONY_ID_OFFSETS: Readonly<Record<string, number>> = {
  testimony_alva: 10520,
  testimony_grover: 10521,
  testimony_emily: 10522,
  testimony_richard: 10523,
  testimony_runna: 10524,
  testimony_davi: 10525,
};

function testimonyEntityId(testimonyId: string): BiomesId {
  const snapshotId = SNAPSHOT_TESTIMONY_ENTITY_IDS[testimonyId];
  if (snapshotId !== undefined) return snapshotId;
  const offset = NEW_TESTIMONY_ID_OFFSETS[testimonyId];
  if (offset === undefined) {
    throw new Error(`${testimonyId}: no canonical testimony NPC entity id`);
  }
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + offset) as BiomesId;
}

export interface Ch1TestimonyNpcSeed {
  testimonyId: string;
  entityId: BiomesId;
  displayName: string;
  anchor: Ch1AnchorKey;
  position: readonly [number, number, number];
  role: string;
  line: string;
  voiceStyle: string;
  preserveSnapshotAppearance: boolean;
  questGiver: boolean;
}

export const CH1_TESTIMONY_NPC_SEEDS: readonly Ch1TestimonyNpcSeed[] =
  Object.freeze(
    CH1_TESTIMONIES.map((testimony) => {
      const lore = SNAPSHOT_LIVE_NPC_LORE.find(
        (candidate) => candidate.displayName === testimony.npc
      );
      const anchor = TESTIMONY_ANCHORS[testimony.id];
      if (!lore || !anchor) {
        throw new Error(`${testimony.id}: testimony NPC lore/anchor missing`);
      }
      return Object.freeze({
        testimonyId: testimony.id,
        entityId: testimonyEntityId(testimony.id),
        displayName: testimony.npc,
        anchor,
        position: CH1_ANCHORS[anchor],
        role: lore.role,
        line: testimony.line,
        voiceStyle: lore.voice,
        preserveSnapshotAppearance:
          SNAPSHOT_TESTIMONY_ENTITY_IDS[testimony.id] !== undefined,
        questGiver: testimony.id === "testimony_coretta",
      });
    })
  );

export const CH1_TESTIMONY_NPC_BY_NAME = new Map(
  CH1_TESTIMONY_NPC_SEEDS.map((seed) => [seed.displayName, seed] as const)
);

// The first Chapter 1 repair created a second Coretta at the reserved cast id.
// Coretta now promotes the reviewed snapshot player-like NPC instead.
export const CH1_RETIRED_DUPLICATE_TESTIMONY_NPC_IDS = Object.freeze([
  (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + 10511) as BiomesId,
]);

export function ch1ValidateTestimonyNpcSeeds(): string[] {
  const errors: string[] = [];
  const ids = new Set<number>();
  for (const seed of CH1_TESTIMONY_NPC_SEEDS) {
    if (ids.has(Number(seed.entityId))) {
      errors.push(`${seed.displayName}: duplicate entity id ${seed.entityId}`);
    }
    ids.add(Number(seed.entityId));
    if (!seed.position.every(Number.isFinite)) {
      errors.push(`${seed.displayName}: invalid position`);
    }
  }
  return errors;
}
