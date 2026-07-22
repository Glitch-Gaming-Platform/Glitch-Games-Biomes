import { npcEntity } from "@/server/spawn/spawn_npc";
import { prepareHarthmerePlayerLikeNpcForUniqueAppearance } from "@/server/harthmere/player_like_npc_cosmetics";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { EntityDescription, Voice } from "@/shared/ecs/gen/components";
import { HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS } from "@/shared/harthmere/business_customer_npc_seed";
import { harthmereVoiceProfileForActor } from "@/shared/harthmere/npc_voice_profiles";
import {
  makeHarthmereNpcAppearanceConfig,
  withHarthmereAppearanceMarker,
  withHarthmereBodyAndFaceMarkers,
} from "@/shared/harthmere/voxel_faces";
import type { BiomesId } from "@/shared/ids";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";

// Standing CUSTOMER NPCs inside each business (the patrons; the owner is seeded
// separately at the counter). UNLIKE owners, customers are NOT quest_givers —
// they are talkable flavor NPCs with default dialog only. Same deterministic
// appearance generator the owners / Grove NPCs / player avatars use, so each one
// is visually distinct.

export const HARTHMERE_BUSINESS_CUSTOMER_NPC_SEED_SOURCE =
  "harthmere-business-customer-npc-seed";

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

export function harthmereBusinessCustomerNpcSeedEntityIds() {
  return HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS.map((seed) => seed.entityId);
}

export function buildHarthmereBusinessCustomerNpcSeedChanges(input: {
  tick: number;
  nowSeconds?: number;
  existingIds?: ReadonlySet<BiomesId>;
}): Change[] {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const nowSeconds = input.nowSeconds ?? secondsSinceEpoch();
  const changes: Change[] = [];

  for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS) {
    const kind = changeKindForSeed(seed.entityId, existingIds);
    const appearance = makeHarthmereNpcAppearanceConfig({
      id: seed.entityId,
      name: seed.displayName,
      roleHint: `${seed.roleTitle} (${seed.faction})`,
      forwardAxis: "minusZ",
      source: HARTHMERE_BUSINESS_CUSTOMER_NPC_SEED_SOURCE,
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
          defaultDialog: npcDialog(seed.line, ...seed.extraLines),
        },
        nowSeconds
      ),
      kind
    );
    // HARTHMERE_BUSINESS_NPC_PLAYER_AVATAR_PARITY: drop the uniform default
    // appearance_component/wearing npcEntity assigns to the player-like human.
    // Explicit nulls on updates repair already-seeded customers; omission alone
    // only works for brand-new entities. Each customer then renders from per-id
    // rich-appearance fallback (snapshotRichNpc*Fallback) — a distinct,
    // clothed, animated PLAYER/Grove-style avatar matching the rest of the cast,
    // instead of an identical default avatar (or the wrong voxel NPC design).
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
      voice: Voice.create({
        voice: harthmereVoiceProfileForActor({
          source: "business_customer",
          id: seed.customerNpcId,
          entityId: seed.entityId,
          displayName: seed.displayName,
          role: seed.roleTitle,
          kind: "humanoid",
          background: seed.background,
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

export function buildHarthmereBusinessCustomerNpcSeedProposedChanges(input: {
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
}): ProposedChange[] {
  return buildHarthmereBusinessCustomerNpcSeedChanges({
    tick: 1,
    nowSeconds: input.nowSeconds,
    existingIds: input.existingIds,
  }).map(proposedFromChange);
}
