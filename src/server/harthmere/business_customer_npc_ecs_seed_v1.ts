import { npcEntity } from "@/server/spawn/spawn_npc";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { EntityDescription } from "@/shared/ecs/gen/components";
import { HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1 } from "@/shared/harthmere/business_customer_npc_seed_v1";
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

export const HARTHMERE_BUSINESS_CUSTOMER_NPC_SEED_SOURCE_V1 =
  "harthmere-business-customer-npc-seed-v1";

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

export function harthmereBusinessCustomerNpcSeedEntityIdsV1() {
  return HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1.map((seed) => seed.entityId);
}

export function buildHarthmereBusinessCustomerNpcSeedChangesV1(input: {
  tick: number;
  nowSeconds?: number;
  existingIds?: ReadonlySet<BiomesId>;
}): Change[] {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const nowSeconds = input.nowSeconds ?? secondsSinceEpoch();
  const changes: Change[] = [];

  for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS_V1) {
    const appearance = makeHarthmereNpcAppearanceConfig({
      id: seed.entityId,
      name: seed.displayName,
      roleHint: `${seed.roleTitle} (${seed.faction})`,
      forwardAxis: "minusZ",
      source: HARTHMERE_BUSINESS_CUSTOMER_NPC_SEED_SOURCE_V1,
    });
    const entity = {
      ...npcEntity(
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
      ),
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
    };
    changes.push({
      kind: changeKindForSeedV1(seed.entityId, existingIds),
      tick: input.tick,
      entity,
    });
  }

  return changes;
}

export function buildHarthmereBusinessCustomerNpcSeedProposedChangesV1(input: {
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
}): ProposedChange[] {
  return buildHarthmereBusinessCustomerNpcSeedChangesV1({
    tick: 1,
    nowSeconds: input.nowSeconds,
    existingIds: input.existingIds,
  }).map(proposedFromChangeV1);
}
