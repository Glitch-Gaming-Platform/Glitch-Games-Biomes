import { npcEntity } from "@/server/spawn/spawn_npc";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { EntityDescription, QuestGiver } from "@/shared/ecs/gen/components";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID, isNpcTypeId } from "@/shared/npc/bikkie";
import {
  SNAPSHOT_GROVE_NPCS_V75,
  SNAPSHOT_GROVE_NPC_GROUNDING_VERSION_V75,
  snapshotGroveGroundedPositionV75,
  snapshotGroveNpcEntityIdV75,
} from "@/shared/harthmere/snapshot_grove_content_v75";
import {
  makeHarthmereNpcAppearanceConfig,
  withHarthmereAppearanceMarker,
  withHarthmereBodyAndFaceMarkers,
} from "@/shared/harthmere/voxel_faces";
import type { BiomesId } from "@/shared/ids";

function npcDialogV1(...lines: string[]) {
  return lines.map((line) => `<text>${line}</text>`).join("{break}");
}

function changeKindForSeedV1(id: BiomesId, existingIds: ReadonlySet<BiomesId>) {
  return existingIds.has(id) ? "update" : "create";
}

function proposedFromChangeV1(change: Change): ProposedChange {
  if (change.kind === "delete") {
    return { kind: "delete", id: change.id };
  }
  if (change.kind === "create") {
    return { kind: "create", entity: change.entity };
  }
  return { kind: "update", entity: change.entity };
}

export function harthmereSnapshotGroveNpcSeedIdsV1() {
  return SNAPSHOT_GROVE_NPCS_V75.filter((npc) => npc.seedServerNpc).map((npc) =>
    snapshotGroveNpcEntityIdV75(npc)
  );
}

export function buildHarthmereSnapshotGroveNpcSeedChangesV1(input: {
  tick: number;
  nowSeconds?: number;
  existingIds?: ReadonlySet<BiomesId>;
}) {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const nowSeconds = input.nowSeconds ?? secondsSinceEpoch();
  const changes: Change[] = [];

  for (const npc of SNAPSHOT_GROVE_NPCS_V75) {
    if (!npc.seedServerNpc) {
      continue;
    }
    const id = snapshotGroveNpcEntityIdV75(npc);
    const typeId =
      npc.id === "mucked_robot" && isNpcTypeId(BikkieIds.dMucker)
        ? BikkieIds.dMucker
        : LOCAL_DEV_HUMAN_NPC_TYPE_ID;
    const description = `${SNAPSHOT_GROVE_NPC_GROUNDING_VERSION_V75} ${npc.shortDescription} ${npc.role}`;
    const appearance = makeHarthmereNpcAppearanceConfig({
      id,
      name: npc.displayName,
      roleHint: npc.role,
      forwardAxis: "minusZ",
      source: "snapshot-grove-npc-seed-v135",
    });
    const entity = {
      ...npcEntity(
        {
          id,
          typeId,
          position: snapshotGroveGroundedPositionV75(npc.authoredPosition),
          orientation: npc.orientation ?? [0, 3.14],
          velocity: [0, 0, 0],
          displayName: npc.displayName,
          defaultDialog: npcDialogV1(npc.line, ...npc.extraLines),
        },
        nowSeconds
      ),
      entity_description: EntityDescription.create({
        text: withHarthmereAppearanceMarker(
          withHarthmereBodyAndFaceMarkers(
            description,
            appearance.face,
            appearance.body
          ),
          appearance
        ),
      }),
      quest_giver: QuestGiver.create({
        concurrent_quests: 1,
        concurrent_quest_dialog: npcDialogV1(npc.line),
      }),
    };
    changes.push({
      kind: changeKindForSeedV1(id, existingIds),
      tick: input.tick,
      entity,
    });
  }

  return changes;
}

export function buildHarthmereSnapshotGroveNpcSeedProposedChangesV1(input: {
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
}) {
  return buildHarthmereSnapshotGroveNpcSeedChangesV1({
    tick: 1,
    nowSeconds: input.nowSeconds,
    existingIds: input.existingIds,
  }).map(proposedFromChangeV1);
}
