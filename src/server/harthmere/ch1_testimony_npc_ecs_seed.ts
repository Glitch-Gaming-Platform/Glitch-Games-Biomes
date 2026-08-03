import { prepareHarthmerePlayerLikeNpcForUniqueAppearance } from "@/server/harthmere/player_like_npc_cosmetics";
import { npcEntity } from "@/server/spawn/spawn_npc";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { EntityDescription, QuestGiver } from "@/shared/ecs/gen/components";
import {
  CH1_TESTIMONY_NPC_SEEDS,
  CH1_TESTIMONY_NPC_SEED_VERSION,
} from "@/shared/harthmere/ch1_testimony_npcs";
import type { BiomesId } from "@/shared/ids";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";

function npcDialog(...lines: string[]) {
  return lines.map((line) => `<text>${line}</text>`).join("{break}");
}

function changeKindForSeed(id: BiomesId, existingIds: ReadonlySet<BiomesId>) {
  return existingIds.has(id) ? "update" : "create";
}

function proposedFromChange(change: Change): ProposedChange {
  if (change.kind === "delete") {
    return { kind: "delete", id: change.id };
  }
  if (change.kind === "create") {
    return { kind: "create", entity: change.entity };
  }
  return { kind: "update", entity: change.entity };
}

export function harthmereChapter1TestimonyNpcSeedEntityIds() {
  return CH1_TESTIMONY_NPC_SEEDS.map((seed) => seed.entityId);
}

export function buildHarthmereChapter1TestimonyNpcSeedChanges(input: {
  tick: number;
  nowSeconds?: number;
  existingIds?: ReadonlySet<BiomesId>;
}): Change[] {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const nowSeconds = input.nowSeconds ?? secondsSinceEpoch();

  return CH1_TESTIMONY_NPC_SEEDS.map((seed) => {
    const kind = changeKindForSeed(seed.entityId, existingIds);
    let base = npcEntity(
      {
        id: seed.entityId,
        typeId: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
        position: [...seed.position],
        orientation: [0, Math.PI],
        velocity: [0, 0, 0],
        displayName: seed.displayName,
        defaultDialog: npcDialog(seed.line),
        // Testimony witnesses are authored interaction posts, not an ambient
        // crowd. Their respawn/home position must match the stage route exactly.
        spawnPositionJitterRadius: 0,
      },
      nowSeconds
    );
    if (!seed.preserveSnapshotAppearance) {
      base = prepareHarthmerePlayerLikeNpcForUniqueAppearance(base, kind);
    }
    return {
      kind,
      tick: input.tick,
      entity: {
        ...base,
        entity_description: EntityDescription.create({
          text: `${CH1_TESTIMONY_NPC_SEED_VERSION} grove witness ${seed.role}`,
        }),
        ...(seed.questGiver
          ? {
              quest_giver: QuestGiver.create({
                concurrent_quests: 1,
                concurrent_quest_dialog: npcDialog(seed.line),
              }),
            }
          : {}),
      },
    } as Change;
  });
}

export function buildHarthmereChapter1TestimonyNpcSeedProposedChanges(input: {
  nowSeconds?: number;
  existingIds?: ReadonlySet<BiomesId>;
}): ProposedChange[] {
  return buildHarthmereChapter1TestimonyNpcSeedChanges({
    tick: 1,
    ...input,
  }).map(proposedFromChange);
}
