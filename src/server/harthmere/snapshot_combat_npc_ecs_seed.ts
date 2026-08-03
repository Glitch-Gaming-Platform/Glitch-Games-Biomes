import { npcEntity } from "@/server/spawn/spawn_npc";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { EntityDescription } from "@/shared/ecs/gen/components";
import {
  SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS,
  snapshotCombatGroundedPosition,
  snapshotHostileEntityId,
} from "@/shared/harthmere/snapshot_runtime_rules";
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE } from "@/shared/harthmere/snapshot_grove_content";
import { HARTHMERE_NATIVE_NPC_ID_MANIFEST } from "@/shared/harthmere/harthmere_native_id_manifest";
import type { BiomesId } from "@/shared/ids";

function proposedFromChange(change: Change): ProposedChange {
  if (change.kind === "delete") {
    return { kind: "delete", id: change.id };
  }
  if (change.kind === "create") {
    return { kind: "create", entity: change.entity };
  }
  return { kind: "update", entity: change.entity };
}

export function harthmereSnapshotCombatNpcSeedIds() {
  return SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS.map((spawn) =>
    snapshotHostileEntityId(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE, spawn)
  );
}

export function snapshotCombatNativeNpcTypeId(
  profile: "muckling" | "mucker" | "wild_mucker"
): BiomesId {
  switch (profile) {
    case "muckling":
      return HARTHMERE_NATIVE_NPC_ID_MANIFEST.monster_watchtower_muckling;
    case "mucker":
      return HARTHMERE_NATIVE_NPC_ID_MANIFEST.monster_watchtower_clearing_mucker;
    case "wild_mucker":
      return HARTHMERE_NATIVE_NPC_ID_MANIFEST.monster_old_wood_mucker;
  }
}

export function buildHarthmereSnapshotCombatNpcSeedChanges(input: {
  tick: number;
  nowSeconds?: number;
  existingIds?: ReadonlySet<BiomesId>;
}) {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const nowSeconds = input.nowSeconds ?? secondsSinceEpoch();
  return SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS.map((spawn): Change => {
    const id = snapshotHostileEntityId(
      SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE,
      spawn
    );
    const entity = npcEntity(
      {
        id,
        // These imported encounter entities used to borrow dMucker, bypassing
        // the exact native combat profile and its receipt validation. Preserve
        // their stable entity ids while assigning the authored family type.
        typeId: snapshotCombatNativeNpcTypeId(spawn.profile),
        // Preserve the authored wilds Y. Grove civic NPC grounding deliberately
        // targets the raised courtyard and would make hostile bodies float.
        position: snapshotCombatGroundedPosition(spawn.authoredPosition),
        orientation: [0, 0],
        velocity: [0, 0, 0],
        displayName: spawn.displayName,
        defaultDialog: spawn.defaultDialog,
      },
      nowSeconds
    );
    return {
      kind: existingIds.has(id) ? "update" : "create",
      tick: input.tick,
      entity: {
        ...entity,
        entity_description: EntityDescription.create({
          text: `SNAPSHOT_COMBAT_RUNTIME ${spawn.profile} ${spawn.areaId} leash=${spawn.leashRadius}`,
        }),
      },
    };
  });
}

export function buildHarthmereSnapshotCombatNpcSeedProposedChanges(input: {
  nowSeconds?: number;
  existingIds?: ReadonlySet<BiomesId>;
}) {
  return buildHarthmereSnapshotCombatNpcSeedChanges({
    tick: 1,
    nowSeconds: input.nowSeconds,
    existingIds: input.existingIds,
  }).map(proposedFromChange);
}
