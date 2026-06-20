import { npcEntity } from "@/server/spawn/spawn_npc";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import {
  EntityDescription,
  QuestGiver,
  Voice,
} from "@/shared/ecs/gen/components";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID, isNpcTypeId } from "@/shared/npc/bikkie";
import {
  SNAPSHOT_GROVE_NPCS,
  SNAPSHOT_GROVE_NPC_GROUNDING_VERSION,
  snapshotGroveGroundedPosition,
  snapshotGroveNpcEntityId,
} from "@/shared/harthmere/snapshot_grove_content";
import { harthmereVoiceProfileForActor } from "@/shared/harthmere/npc_voice_profiles";
import {
  makeHarthmereNpcAppearanceConfig,
  withHarthmereAppearanceMarker,
  withHarthmereBodyAndFaceMarkers,
} from "@/shared/harthmere/voxel_faces";
import type { BiomesId } from "@/shared/ids";

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

export function harthmereSnapshotGroveNpcSeedIds() {
  return SNAPSHOT_GROVE_NPCS.filter((npc) => npc.seedServerNpc).map((npc) =>
    snapshotGroveNpcEntityId(npc)
  );
}

export function buildHarthmereSnapshotGroveNpcSeedChanges(input: {
  tick: number;
  nowSeconds?: number;
  existingIds?: ReadonlySet<BiomesId>;
}) {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const nowSeconds = input.nowSeconds ?? secondsSinceEpoch();
  const changes: Change[] = [];

  for (const npc of SNAPSHOT_GROVE_NPCS) {
    if (!npc.seedServerNpc) {
      continue;
    }
    const id = snapshotGroveNpcEntityId(npc);
    const typeId =
      npc.id === "mucked_robot" && isNpcTypeId(BikkieIds.dMucker)
        ? BikkieIds.dMucker
        : LOCAL_DEV_HUMAN_NPC_TYPE_ID;
    const description = `${SNAPSHOT_GROVE_NPC_GROUNDING_VERSION} ${npc.shortDescription} ${npc.role}`;
    const appearance = makeHarthmereNpcAppearanceConfig({
      id,
      name: npc.displayName,
      roleHint: npc.role,
      forwardAxis: "minusZ",
      source: "snapshot-grove-npc-seed",
    });
    const entity = {
      ...npcEntity(
        {
          id,
          typeId,
          position: snapshotGroveGroundedPosition(npc.authoredPosition),
          orientation: npc.orientation ?? [0, 3.14],
          velocity: [0, 0, 0],
          displayName: npc.displayName,
          defaultDialog: npcDialog(npc.line, ...npc.extraLines),
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
        concurrent_quest_dialog: npcDialog(npc.line),
      }),
      voice: Voice.create({
        voice: harthmereVoiceProfileForActor({
          source: "snapshot_grove",
          id: npc.id,
          entityId: id,
          displayName: npc.displayName,
          role: npc.role,
          kind: "humanoid",
          background: npc.background,
        }).voiceParameterId,
      }),
    };
    changes.push({
      kind: changeKindForSeed(id, existingIds),
      tick: input.tick,
      entity,
    });
  }

  return changes;
}

export function buildHarthmereSnapshotGroveNpcSeedProposedChanges(input: {
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
}) {
  return buildHarthmereSnapshotGroveNpcSeedChanges({
    tick: 1,
    nowSeconds: input.nowSeconds,
    existingIds: input.existingIds,
  }).map(proposedFromChange);
}
