import { npcEntity } from "@/server/spawn/spawn_npc";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import {
  EntityDescription,
  QuestGiver,
  Voice,
} from "@/shared/ecs/gen/components";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1 } from "@/shared/harthmere/business_owner_npc_seed_v1";
import { harthmereBusinessOwnerRoleClothingV1 } from "@/shared/harthmere/business_npc_cosmetics_v1";
import { harthmereVoiceProfileForActorV1 } from "@/shared/harthmere/npc_voice_profiles_v1";
import {
  makeHarthmereNpcAppearanceConfig,
  withHarthmereAppearanceMarker,
  withHarthmereBodyAndFaceMarkers,
} from "@/shared/harthmere/voxel_faces";
import type { BiomesId } from "@/shared/ids";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";

export const HARTHMERE_BUSINESS_OWNER_NPC_SEED_SOURCE_V1 =
  "harthmere-business-owner-npc-seed-v1";

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

export function harthmereBusinessOwnerNpcSeedEntityIdsV1() {
  return HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1.map((seed) => seed.entityId);
}

export function buildHarthmereBusinessOwnerNpcSeedChangesV1(input: {
  tick: number;
  nowSeconds?: number;
  existingIds?: ReadonlySet<BiomesId>;
}): Change[] {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const nowSeconds = input.nowSeconds ?? secondsSinceEpoch();
  const changes: Change[] = [];

  for (const seed of HARTHMERE_BUSINESS_OWNER_NPC_SEEDS_V1) {
    // Deterministic, per-owner appearance — keyed off the stable entity id and
    // the owner's name/role so every shopkeeper looks distinct (same generator
    // the Grove NPCs and player avatars use).
    // HARTHMERE_BUSINESS_OWNER_DISTINCT_LOOK_V1: pass the SAME explicit
    // role-based clothing (with a distinctive hat) that business staff/customers
    // get, instead of letting the generic auto-derived set make owners look
    // bland/hatless. Face + body still vary per entity id, so two owners of the
    // same role share an outfit silhouette but not a face.
    const { role, clothing } = harthmereBusinessOwnerRoleClothingV1({
      businessType: seed.businessType,
      roleTitle: seed.roleTitle,
    });
    const appearance = makeHarthmereNpcAppearanceConfig({
      id: seed.entityId,
      name: seed.displayName,
      role,
      roleHint: `${seed.roleTitle} (${seed.businessType})`,
      clothing,
      forwardAxis: "minusZ",
      source: HARTHMERE_BUSINESS_OWNER_NPC_SEED_SOURCE_V1,
    });
    const base = npcEntity(
      {
        id: seed.entityId,
        typeId: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
        position: seed.position,
        orientation: seed.orientation,
        velocity: [0, 0, 0],
        displayName: seed.displayName,
        defaultDialog: npcDialogV1(seed.line, ...seed.extraLines),
      },
      nowSeconds
    );
    // HARTHMERE_BUSINESS_NPC_PLAYER_AVATAR_PARITY_V199: npcEntity assigns a
    // UNIFORM default appearance_component/wearing for the player-like human
    // type, which made every owner render identically through the player_mesh
    // pipeline. Drop those uniform cosmetics so the renderer's deterministic
    // per-id rich-appearance fallback (snapshotRichNpc*FallbackV69) engages,
    // giving each shopkeeper a distinct, clothed, animated PLAYER/Grove-style
    // avatar — the same design as the player, Grove townsfolk, Billy/Donnie/Max
    // (NOT the blocky voxel NPC design). See makeNpcMesh in
    // client/game/resources/npcs.ts.
    delete (base as { appearance_component?: unknown }).appearance_component;
    delete (base as { wearing?: unknown }).wearing;
    const entity = {
      ...base,
      entity_description: EntityDescription.create({
        text: withHarthmereAppearanceMarker(
          withHarthmereBodyAndFaceMarkers(
            seed.description,
            appearance.face,
            appearance.body
          ),
          appearance
        ),
      }),
      quest_giver: QuestGiver.create({
        concurrent_quests: 1,
        concurrent_quest_dialog: npcDialogV1(seed.line),
      }),
      voice: Voice.create({
        voice: harthmereVoiceProfileForActorV1({
          source: "business_owner_v1",
          id: seed.ownerNpcId,
          entityId: seed.entityId,
          displayName: seed.displayName,
          role: seed.roleTitle,
          kind: "humanoid",
          background: seed.description,
        }).voiceParameterId,
      }),
    };
    changes.push({
      kind: changeKindForSeedV1(seed.entityId, existingIds),
      tick: input.tick,
      entity,
    });
  }

  return changes;
}

export function buildHarthmereBusinessOwnerNpcSeedProposedChangesV1(input: {
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
}): ProposedChange[] {
  return buildHarthmereBusinessOwnerNpcSeedChangesV1({
    tick: 1,
    nowSeconds: input.nowSeconds,
    existingIds: input.existingIds,
  }).map(proposedFromChangeV1);
}
