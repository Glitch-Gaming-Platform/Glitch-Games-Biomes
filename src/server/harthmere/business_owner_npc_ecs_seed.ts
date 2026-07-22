import { npcEntity } from "@/server/spawn/spawn_npc";
import { prepareHarthmerePlayerLikeNpcForUniqueAppearance } from "@/server/harthmere/player_like_npc_cosmetics";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import {
  EntityDescription,
  QuestGiver,
  Voice,
} from "@/shared/ecs/gen/components";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS } from "@/shared/harthmere/business_owner_npc_seed";
import { harthmereBusinessOwnerRoleClothing } from "@/shared/harthmere/business_npc_cosmetics";
import { harthmereVoiceProfileForActor } from "@/shared/harthmere/npc_voice_profiles";
import {
  makeHarthmereNpcAppearanceConfig,
  withHarthmereAppearanceMarker,
  withHarthmereBodyAndFaceMarkers,
} from "@/shared/harthmere/voxel_faces";
import type { BiomesId } from "@/shared/ids";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";

export const HARTHMERE_BUSINESS_OWNER_NPC_SEED_SOURCE =
  "harthmere-business-owner-npc-seed";

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

export function harthmereBusinessOwnerNpcSeedEntityIds() {
  return HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.map((seed) => seed.entityId);
}

export function buildHarthmereBusinessOwnerNpcSeedChanges(input: {
  tick: number;
  nowSeconds?: number;
  existingIds?: ReadonlySet<BiomesId>;
}): Change[] {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const nowSeconds = input.nowSeconds ?? secondsSinceEpoch();
  const changes: Change[] = [];

  for (const seed of HARTHMERE_BUSINESS_OWNER_NPC_SEEDS) {
    const kind = changeKindForSeed(seed.entityId, existingIds);
    // Deterministic, per-owner appearance — keyed off the stable entity id and
    // the owner's name/role so every shopkeeper looks distinct (same generator
    // the Grove NPCs and player avatars use).
    // HARTHMERE_BUSINESS_OWNER_DISTINCT_LOOK: pass the SAME explicit
    // role-based clothing (with a distinctive hat) that business staff/customers
    // get, instead of letting the generic auto-derived set make owners look
    // bland/hatless. Face + body still vary per entity id, so two owners of the
    // same role share an outfit silhouette but not a face.
    const { role, clothing } = harthmereBusinessOwnerRoleClothing({
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
      source: HARTHMERE_BUSINESS_OWNER_NPC_SEED_SOURCE,
    });
    const base = prepareHarthmerePlayerLikeNpcForUniqueAppearance(
      npcEntity(
        {
          id: seed.entityId,
          typeId: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
          position: seed.position,
          orientation: seed.orientation,
          velocity: [0, 0, 0],
          displayName: seed.displayName,
          // Casual talk contains identity, business, and local conditions only.
          // Job offers are attached to quest_giver below.
          defaultDialog: npcDialog(seed.line, ...seed.ambientLines),
        },
        nowSeconds
      ),
      kind
    );
    // HARTHMERE_BUSINESS_NPC_PLAYER_AVATAR_PARITY: npcEntity assigns a
    // UNIFORM default appearance_component/wearing for the player-like human
    // type, which made every owner render identically through the player_mesh
    // pipeline. The helper omits them on create and writes explicit nulls on
    // update so old production rows cannot retain the shared defaults and skip
    // the deterministic per-id rich-appearance fallback.
    // giving each shopkeeper a distinct, clothed, animated PLAYER/Grove-style
    // avatar — the same design as the player, Grove townsfolk, Billy/Donnie/Max
    // (NOT the blocky voxel NPC design). See makeNpcMesh in
    // client/game/resources/npcs.ts.
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
        // Preserve authored work offers without forcing them into every chat.
        concurrent_quest_dialog: npcDialog(seed.line, ...seed.extraLines),
      }),
      voice: Voice.create({
        voice: harthmereVoiceProfileForActor({
          source: "business_owner",
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
      kind,
      tick: input.tick,
      entity,
    });
  }

  return changes;
}

export function buildHarthmereBusinessOwnerNpcSeedProposedChanges(input: {
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
}): ProposedChange[] {
  return buildHarthmereBusinessOwnerNpcSeedChanges({
    tick: 1,
    nowSeconds: input.nowSeconds,
    existingIds: input.existingIds,
  }).map(proposedFromChange);
}
