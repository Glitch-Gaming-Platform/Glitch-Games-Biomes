import { newPlaceable } from "@/server/logic/utils/placeables";
import { isSimpleRaceCheckpointItemId } from "@/server/shared/minigames/simple_race/items";
import type { WorldApi } from "@/server/shared/world/api";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import {
  CreatedBy,
  EntityDescription,
  MinigameComponent,
  MinigameElement,
  Size,
} from "@/shared/ecs/gen/components";
import type { Entity, ReadonlyEntity } from "@/shared/ecs/gen/entities";
import type { MinigameMetadata, MinigameType } from "@/shared/ecs/gen/types";
import { anItem } from "@/shared/game/item";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import type { Vec2, Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_MINIGAME_CATALOG,
  SNAPSHOT_MINIGAME_CATALOG_MARKER_ID,
  SNAPSHOT_MINIGAME_CATALOG_SEED_VERSION,
  snapshotMinigameCatalogEntityIds,
  snapshotMinigameGeneratedElementId,
  type SnapshotMinigameCatalogEntry,
} from "@/shared/harthmere/snapshot_minigame_catalog";
import { compact, chunk } from "lodash";

type MinigameElementRole =
  | "start"
  | "checkpoint"
  | "finish"
  | "leaderboard"
  | "spawn"
  | "marker"
  | "entry";

interface SeedElement {
  id: BiomesId;
  role: MinigameElementRole;
  itemId: BiomesId;
  position: Vec3;
  orientation: Vec2;
  entity?: ReadonlyEntity;
  generated: boolean;
}

function proposedFromChange(change: Change): ProposedChange {
  switch (change.kind) {
    case "create":
      return { kind: "create", entity: change.entity };
    case "update":
      return { kind: "update", entity: change.entity };
    case "delete":
      return { kind: "delete", id: change.id };
  }
}

function roleForElement(
  kind: MinigameType,
  entity: ReadonlyEntity
): MinigameElementRole | undefined {
  const itemId = entity.placeable_component?.item_id;
  if (!itemId) {
    return;
  }
  switch (kind) {
    case "simple_race":
      if (itemId === BikkieIds.simpleRaceStart) return "start";
      if (itemId === BikkieIds.simpleRaceFinish) return "finish";
      if (itemId === BikkieIds.minigameLeaderboard) return "leaderboard";
      if (isSimpleRaceCheckpointItemId(itemId)) return "checkpoint";
      return;
    case "spleef":
      if (itemId === BikkieIds.spleefStart) return "start";
      if (itemId === BikkieIds.spleefSpawn) return "spawn";
      if (itemId === BikkieIds.bboxMarker) return "marker";
      return;
    case "deathmatch":
      return itemId === BikkieIds.deathmatchEnter ? "entry" : undefined;
  }
}

function validLegacyElement(
  entry: SnapshotMinigameCatalogEntry,
  entity: ReadonlyEntity | undefined
): SeedElement | undefined {
  if (
    !entity?.minigame_element ||
    entity.minigame_element.minigame_id !== entry.id ||
    !entity.position?.v ||
    !entity.placeable_component
  ) {
    return;
  }
  const role = roleForElement(entry.kind, entity);
  if (!role) {
    return;
  }
  return {
    id: entity.id,
    role,
    itemId: entity.placeable_component.item_id,
    position: [...entity.position.v],
    orientation: entity.orientation?.v ? [...entity.orientation.v] : [0, 0],
    entity,
    generated: false,
  };
}

function structurallyComplete(kind: MinigameType, elements: SeedElement[]) {
  const has = (role: MinigameElementRole) =>
    elements.some((element) => element.role === role);
  switch (kind) {
    case "simple_race":
      return has("start") && has("finish");
    case "spleef":
      return (
        has("start") &&
        elements.filter((element) => element.role === "marker").length >= 2
      );
    case "deathmatch":
      return has("entry");
  }
}

function preservationArcadeAnchor(catalogIndex: number): Vec3 {
  // Flat additive Harthmere near-wilds, north of the authored town districts.
  // Ten compact columns keep the complete fallback catalogue in a 154x122 m
  // band while leaving room between independent arena clipboards.
  const column = catalogIndex % 10;
  const row = Math.floor(catalogIndex / 10);
  return [2284 + column * 16, 53, -560 + row * 16];
}

function anchorForElements(catalogIndex: number, elements: SeedElement[]) {
  const preferred =
    elements.find((element) =>
      ["start", "entry", "spawn", "marker"].includes(element.role)
    ) ?? elements[0];
  return preferred
    ? ([...preferred.position] as Vec3)
    : preservationArcadeAnchor(catalogIndex);
}

function generatedElement(
  catalogIndex: number,
  offset: number,
  role: MinigameElementRole,
  itemId: BiomesId,
  position: Vec3,
  orientation: Vec2 = [0, 0]
): SeedElement {
  return {
    id: snapshotMinigameGeneratedElementId(catalogIndex, offset),
    role,
    itemId,
    position,
    orientation,
    generated: true,
  };
}

function generatedElementsFor(
  entry: SnapshotMinigameCatalogEntry,
  catalogIndex: number,
  legacy: SeedElement[]
) {
  const [x, y, z] = anchorForElements(catalogIndex, legacy);
  const generated: SeedElement[] = [];
  const count = (role: MinigameElementRole) =>
    legacy.filter((element) => element.role === role).length;

  switch (entry.kind) {
    case "simple_race": {
      const missingRequired = count("start") === 0 || count("finish") === 0;
      if (count("start") === 0) {
        generated.push(
          generatedElement(
            catalogIndex,
            1,
            "start",
            BikkieIds.simpleRaceStart,
            [x, y, z],
            [0, Math.PI / 2]
          )
        );
      }
      if (missingRequired && count("checkpoint") === 0) {
        generated.push(
          generatedElement(
            catalogIndex,
            2,
            "checkpoint",
            BikkieIds.simpleRaceCheckpoint,
            [x + 4, y, z]
          ),
          generatedElement(
            catalogIndex,
            3,
            "checkpoint",
            BikkieIds.simpleRaceCheckpoint,
            [x + 8, y, z + 4],
            [0, Math.PI / 2]
          ),
          generatedElement(
            catalogIndex,
            4,
            "checkpoint",
            BikkieIds.simpleRaceCheckpoint,
            [x + 4, y, z + 8],
            [0, Math.PI]
          )
        );
      }
      if (count("finish") === 0) {
        generated.push(
          generatedElement(
            catalogIndex,
            5,
            "finish",
            BikkieIds.simpleRaceFinish,
            [x, y, z + 8],
            [0, -Math.PI / 2]
          )
        );
      }
      // Every race needs a physical leaderboard surface. The start overlay
      // deliberately owns only Play/Configure because a second typed action
      // steals the global G shortcut. Two otherwise-working snapshot races
      // shipped without a leaderboard, so add only this presentation element
      // without moving or replacing any authored course step.
      if (count("leaderboard") === 0) {
        generated.push(
          generatedElement(
            catalogIndex,
            6,
            "leaderboard",
            BikkieIds.minigameLeaderboard,
            [x - 2, y, z - 2],
            [0, Math.PI / 4]
          )
        );
      }
      break;
    }
    case "spleef": {
      if (count("start") === 0) {
        generated.push(
          generatedElement(
            catalogIndex,
            1,
            "start",
            BikkieIds.spleefStart,
            [x - 2, y, z + 5],
            [0, Math.PI / 2]
          )
        );
      }
      if (count("spawn") < 1) {
        generated.push(
          generatedElement(catalogIndex, 2, "spawn", BikkieIds.spleefSpawn, [
            x + 3,
            y,
            z + 3,
          ])
        );
      }
      if (count("spawn") < 2) {
        generated.push(
          generatedElement(
            catalogIndex,
            3,
            "spawn",
            BikkieIds.spleefSpawn,
            [x + 7, y, z + 7],
            [0, Math.PI]
          )
        );
      }
      if (count("marker") < 1) {
        generated.push(
          generatedElement(catalogIndex, 4, "marker", BikkieIds.bboxMarker, [
            x,
            y - 1,
            z,
          ])
        );
      }
      if (count("marker") < 2) {
        generated.push(
          generatedElement(catalogIndex, 5, "marker", BikkieIds.bboxMarker, [
            x + 10,
            y + 4,
            z + 10,
          ])
        );
      }
      break;
    }
    case "deathmatch":
      if (count("entry") === 0) {
        generated.push(
          generatedElement(
            catalogIndex,
            1,
            "entry",
            BikkieIds.deathmatchEnter,
            [x, y, z]
          )
        );
      }
      break;
  }
  return generated;
}

function metadataFor(
  kind: MinigameType,
  elements: SeedElement[]
): MinigameMetadata {
  const ids = (role: MinigameElementRole) =>
    new Set(
      elements
        .filter((element) => element.role === role)
        .map((element) => element.id)
    );
  switch (kind) {
    case "simple_race":
      return {
        kind,
        checkpoint_ids: ids("checkpoint"),
        start_ids: ids("start"),
        end_ids: ids("finish"),
      };
    case "spleef":
      return {
        kind,
        start_ids: ids("start"),
        arena_marker_ids: ids("marker"),
      };
    case "deathmatch":
      return { kind, start_ids: ids("entry") };
  }
}

function restoredLabel(entry: SnapshotMinigameCatalogEntry, ordinal: number) {
  const existing = entry.label?.trim();
  if (existing) {
    return existing;
  }
  switch (entry.kind) {
    case "simple_race":
      return `Restored Race ${ordinal}`;
    case "spleef":
      return `Restored Spleef ${ordinal}`;
    case "deathmatch":
      return `Restored Deathmatch ${ordinal}`;
  }
}

function elementEntity(
  entry: SnapshotMinigameCatalogEntry,
  element: SeedElement,
  nowSeconds: number
): Entity {
  const placeable = newPlaceable({
    id: element.id,
    creatorId: entry.id,
    position: element.position,
    orientation: element.orientation,
    item: anItem(element.itemId),
    timestamp: nowSeconds,
  });
  return {
    ...placeable,
    size: placeable.size ?? Size.create({ v: [1, 0.2, 1] }),
    minigame_element: MinigameElement.create({ minigame_id: entry.id }),
  };
}

export function buildSnapshotMinigameCatalogSeedChanges(input: {
  tick: number;
  nowSeconds: number;
  entities?: Iterable<ReadonlyEntity>;
}) {
  const entities = new Map<BiomesId, ReadonlyEntity>();
  for (const entity of input.entities ?? []) {
    entities.set(entity.id, entity);
  }

  const changes: Change[] = [];
  const ordinals = new Map<MinigameType, number>();
  for (const [catalogIndex, entry] of SNAPSHOT_MINIGAME_CATALOG.entries()) {
    const ordinal = (ordinals.get(entry.kind) ?? 0) + 1;
    ordinals.set(entry.kind, ordinal);
    const existingGame = entities.get(entry.id);
    const allLegacy = compact(
      entry.legacyElementIds.map((id) =>
        validLegacyElement(entry, entities.get(id))
      )
    );
    const liveLegacy = allLegacy.filter((element) => !element.entity?.iced);
    const preserveWorkingSnapshot =
      entry.snapshotReady &&
      existingGame?.minigame_component?.ready === true &&
      structurallyComplete(entry.kind, liveLegacy);
    const selectedLegacy = preserveWorkingSnapshot ? liveLegacy : allLegacy;
    const generatedCandidates = generatedElementsFor(
      entry,
      catalogIndex,
      selectedLegacy
    );
    const generated = preserveWorkingSnapshot
      ? generatedCandidates.filter((element) => element.role === "leaderboard")
      : generatedCandidates;
    const selected = [...selectedLegacy, ...generated];

    if (!structurallyComplete(entry.kind, selected)) {
      throw new Error(`Unable to restore snapshot minigame ${entry.id}`);
    }

    for (const element of selectedLegacy) {
      if (!preserveWorkingSnapshot && element.entity?.iced) {
        changes.push({
          kind: "update",
          tick: input.tick,
          entity: {
            id: element.id,
            iced: null,
            minigame_element: MinigameElement.create({
              minigame_id: entry.id,
            }),
          },
        });
      }
    }
    for (const element of generated) {
      changes.push({
        kind: entities.has(element.id) ? "update" : "create",
        tick: input.tick,
        entity: elementEntity(entry, element, input.nowSeconds),
      });
    }

    const component = MinigameComponent.clone(existingGame?.minigame_component);
    component.metadata = metadataFor(entry.kind, selected);
    component.minigame_element_ids = new Set(
      selected.map((element) => element.id)
    );
    component.ready = true;
    component.game_modified_at = input.nowSeconds;
    changes.push({
      kind: existingGame ? "update" : "create",
      tick: input.tick,
      entity: {
        id: entry.id,
        label: { text: restoredLabel(entry, ordinal) },
        ...(!existingGame
          ? {
              created_by: CreatedBy.create({
                id: entry.id,
                created_at: input.nowSeconds,
              }),
            }
          : {}),
        minigame_component: component,
      },
    });
  }

  const marker = entities.get(SNAPSHOT_MINIGAME_CATALOG_MARKER_ID);
  changes.push({
    kind: marker ? "update" : "create",
    tick: input.tick,
    entity: {
      id: SNAPSHOT_MINIGAME_CATALOG_MARKER_ID,
      entity_description: EntityDescription.create({
        text: SNAPSHOT_MINIGAME_CATALOG_SEED_VERSION,
      }),
    },
  });
  return changes;
}

export function buildSnapshotMinigameCatalogSeedProposedChanges(input: {
  nowSeconds: number;
  entities?: Iterable<ReadonlyEntity>;
}) {
  return buildSnapshotMinigameCatalogSeedChanges({
    tick: 1,
    nowSeconds: input.nowSeconds,
    entities: input.entities,
  }).map(proposedFromChange);
}

export function snapshotMinigameCatalogEmptyWorldSeedIds() {
  return buildSnapshotMinigameCatalogSeedChanges({
    tick: 1,
    nowSeconds: 0,
  }).flatMap((change) => (change.kind === "delete" ? [] : [change.entity.id]));
}

export async function reconcileSnapshotMinigameCatalog(worldApi: WorldApi) {
  const marker = await worldApi.get(SNAPSHOT_MINIGAME_CATALOG_MARKER_ID);
  if (
    marker?.entityDescription()?.text === SNAPSHOT_MINIGAME_CATALOG_SEED_VERSION
  ) {
    return { applied: false, changes: 0 };
  }

  const loaded = compact(
    await worldApi.get(snapshotMinigameCatalogEntityIds())
  );
  const changes = buildSnapshotMinigameCatalogSeedProposedChanges({
    nowSeconds: Date.now() / 1000,
    entities: loaded.map((entity) => entity.materialize()),
  });
  for (const batch of chunk(changes, CONFIG.redisMaxKeysPerBatch - 1)) {
    const result = await worldApi.apply({ changes: batch });
    if (result.outcome !== "success") {
      throw new Error(
        `Snapshot minigame reconciliation failed: ${result.outcome}`
      );
    }
  }
  log.info("Reconciled the May 2026 snapshot minigame catalogue", {
    version: SNAPSHOT_MINIGAME_CATALOG_SEED_VERSION,
    games: SNAPSHOT_MINIGAME_CATALOG.length,
    changes: changes.length,
  });
  return { applied: true, changes: changes.length };
}
