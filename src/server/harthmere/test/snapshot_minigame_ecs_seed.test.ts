import { newPlaceable } from "@/server/logic/utils/placeables";
import { buildSnapshotMinigameCatalogSeedChanges } from "@/server/harthmere/snapshot_minigame_ecs_seed";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  CreatedBy,
  Iced,
  MinigameComponent,
  MinigameElement,
} from "@/shared/ecs/gen/components";
import type { Entity } from "@/shared/ecs/gen/entities";
import { anItem } from "@/shared/game/item";
import {
  SNAPSHOT_MINIGAME_CATALOG,
  SNAPSHOT_MINIGAME_CATALOG_MARKER_ID,
  SNAPSHOT_MINIGAME_CATALOG_SEED_VERSION,
  SNAPSHOT_MINIGAME_QUEST_BINDINGS,
  snapshotMinigameGeneratedElementId,
  snapshotMinigameGeneratedElementIds,
} from "@/shared/harthmere/snapshot_minigame_catalog";
import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";
import assert from "assert";

function element(
  gameId: BiomesId,
  id: BiomesId,
  itemId: BiomesId,
  position: Vec3,
  iced = false
): Entity {
  return {
    ...newPlaceable({
      id,
      creatorId: gameId,
      position,
      orientation: [0, 0],
      item: anItem(itemId),
      timestamp: 1,
    }),
    minigame_element: MinigameElement.create({ minigame_id: gameId }),
    ...(iced ? { iced: Iced.create() } : {}),
  };
}

function game(
  id: BiomesId,
  metadata: MinigameComponent["metadata"],
  elementIds: BiomesId[],
  ready: boolean
): Entity {
  return {
    id,
    created_by: CreatedBy.create({ id, created_at: 1 }),
    minigame_component: MinigameComponent.create({
      metadata,
      minigame_element_ids: new Set(elementIds),
      ready,
      minigame_settings: Buffer.from([1, 2, 3]),
    }),
  };
}

function entityMap(
  changes: ReturnType<typeof buildSnapshotMinigameCatalogSeedChanges>
) {
  return new Map(
    changes.flatMap((change) =>
      change.kind === "delete" ? [] : [[change.entity.id, change.entity]]
    )
  );
}

describe("snapshot minigame ECS seed", () => {
  it("materializes every non-fishing snapshot game through the three shared engines", () => {
    const changes = buildSnapshotMinigameCatalogSeedChanges({
      tick: 7,
      nowSeconds: 100,
    });
    const byId = entityMap(changes);

    assert.equal(SNAPSHOT_MINIGAME_CATALOG.length, 74);
    assert.deepEqual(
      Object.fromEntries(
        ["simple_race", "spleef", "deathmatch"].map((kind) => [
          kind,
          SNAPSHOT_MINIGAME_CATALOG.filter((entry) => entry.kind === kind)
            .length,
        ])
      ),
      { simple_race: 47, spleef: 19, deathmatch: 8 }
    );
    assert.equal(
      byId.get(SNAPSHOT_MINIGAME_CATALOG_MARKER_ID)?.entity_description?.text,
      SNAPSHOT_MINIGAME_CATALOG_SEED_VERSION
    );

    for (const entry of SNAPSHOT_MINIGAME_CATALOG) {
      const seeded = byId.get(entry.id);
      assert.ok(seeded?.minigame_component, `missing game ${entry.id}`);
      assert.equal(seeded.minigame_component.ready, true);
      assert.equal(seeded.minigame_component.metadata.kind, entry.kind);
      assert.ok(seeded.label?.text.trim());
      for (const elementId of seeded.minigame_component.minigame_element_ids) {
        const seededElement = byId.get(elementId);
        assert.ok(
          seededElement,
          `missing element ${elementId} for ${entry.id}`
        );
        assert.equal(seededElement.minigame_element?.minigame_id, entry.id);
        assert.ok(seededElement.position?.v);
        assert.ok(seededElement.placeable_component);
      }
      const metadata = seeded.minigame_component.metadata;
      switch (metadata.kind) {
        case "simple_race":
          assert.ok(metadata.start_ids.size > 0);
          assert.ok(metadata.end_ids.size > 0);
          break;
        case "spleef":
          assert.ok(metadata.start_ids.size > 0);
          assert.ok(metadata.arena_marker_ids.size >= 2);
          break;
        case "deathmatch":
          assert.ok(metadata.start_ids.size > 0);
          break;
      }
    }
  });

  it("repairs metadata without moving a working original course", () => {
    const entry = SNAPSHOT_MINIGAME_CATALOG.find(
      (candidate) => candidate.id === (4102889171670264 as BiomesId)
    )!;
    const [startId, checkpointId, leaderboardId, , finishId] =
      entry.legacyElementIds;
    const settings = Buffer.from([1, 2, 3]);
    const existingGame = game(
      entry.id,
      {
        kind: "simple_race",
        start_ids: new Set(),
        checkpoint_ids: new Set(),
        end_ids: new Set(),
      },
      [startId, checkpointId, leaderboardId, finishId],
      true
    );
    existingGame.minigame_component!.minigame_settings = settings;
    const entities = [
      existingGame,
      element(entry.id, startId, BikkieIds.simpleRaceStart, [10, 20, 30]),
      element(
        entry.id,
        checkpointId,
        BikkieIds.simpleRaceCheckpoint,
        [20, 20, 30]
      ),
      element(
        entry.id,
        leaderboardId,
        BikkieIds.minigameLeaderboard,
        [8, 20, 28]
      ),
      element(entry.id, finishId, BikkieIds.simpleRaceFinish, [30, 20, 30]),
    ];
    const changes = buildSnapshotMinigameCatalogSeedChanges({
      tick: 8,
      nowSeconds: 200,
      entities,
    });
    const gameChange = changes.find(
      (change) => change.kind !== "delete" && change.entity.id === entry.id
    );
    assert.ok(gameChange && gameChange.kind === "update");
    const component = gameChange.entity.minigame_component!;
    assert.deepEqual(component.minigame_settings, settings);
    assert.equal(component.metadata.kind, "simple_race");
    if (component.metadata.kind !== "simple_race") {
      assert.fail("expected simple race metadata");
    }
    assert.deepEqual([...component.metadata.start_ids], [startId]);
    assert.deepEqual([...component.metadata.checkpoint_ids], [checkpointId]);
    assert.deepEqual([...component.metadata.end_ids], [finishId]);
    const catalogIndex = SNAPSHOT_MINIGAME_CATALOG.indexOf(entry);
    assert.equal(
      changes.some(
        (change) =>
          change.kind !== "delete" &&
          [1, 2, 3, 4, 5, 6].some(
            (offset) =>
              change.entity.id ===
              snapshotMinigameGeneratedElementId(catalogIndex, offset)
          )
      ),
      false
    );
  });

  it("adds only a physical leaderboard when a ready race shipped without one", () => {
    const entry = SNAPSHOT_MINIGAME_CATALOG.find(
      (candidate) => candidate.id === (5578936972423542 as BiomesId)
    )!;
    const [startId, finishId] = entry.legacyElementIds;
    const entities = [
      game(
        entry.id,
        {
          kind: "simple_race",
          start_ids: new Set([startId]),
          checkpoint_ids: new Set(),
          end_ids: new Set([finishId]),
        },
        [startId, finishId],
        true
      ),
      element(entry.id, startId, BikkieIds.simpleRaceStart, [10, 20, 30]),
      element(entry.id, finishId, BikkieIds.simpleRaceFinish, [30, 20, 30]),
    ];
    const changes = buildSnapshotMinigameCatalogSeedChanges({
      tick: 9,
      nowSeconds: 300,
      entities,
    });
    const catalogIndex = SNAPSHOT_MINIGAME_CATALOG.indexOf(entry);
    const generated = changes.filter(
      (
        change
      ): change is Exclude<(typeof changes)[number], { kind: "delete" }> =>
        change.kind !== "delete" &&
        snapshotMinigameGeneratedElementIds(catalogIndex).includes(
          change.entity.id
        )
    );
    assert.deepEqual(
      generated.map((change) => change.entity.id),
      [snapshotMinigameGeneratedElementId(catalogIndex, 6)]
    );
    const [leaderboardChange] = generated;
    assert.ok(leaderboardChange);
    assert.equal(
      leaderboardChange.entity.placeable_component?.item_id,
      BikkieIds.minigameLeaderboard
    );
  });

  it("thaws an abandoned authored course and adds only its missing presentation", () => {
    const entry = SNAPSHOT_MINIGAME_CATALOG.find(
      (candidate) => candidate.id === (403811396479583 as BiomesId)
    )!;
    const [startId, finishId] = entry.legacyElementIds;
    const changes = buildSnapshotMinigameCatalogSeedChanges({
      tick: 9,
      nowSeconds: 300,
      entities: [
        game(
          entry.id,
          {
            kind: "simple_race",
            start_ids: new Set(),
            checkpoint_ids: new Set(),
            end_ids: new Set(),
          },
          [],
          false
        ),
        element(
          entry.id,
          startId,
          BikkieIds.simpleRaceStart,
          [100, 50, 100],
          true
        ),
        element(
          entry.id,
          finishId,
          BikkieIds.simpleRaceFinish,
          [120, 50, 100],
          true
        ),
      ],
    });
    const thaws = changes.filter(
      (
        change
      ): change is Extract<(typeof changes)[number], { kind: "update" }> =>
        change.kind === "update" &&
        (change.entity.id === startId || change.entity.id === finishId)
    );
    assert.equal(thaws.length, 2);
    assert.ok(thaws.every((change) => change.entity.iced === null));
    assert.ok(
      changes.some(
        (change) =>
          change.kind !== "delete" &&
          change.entity.id === snapshotMinigameGeneratedElementId(4, 6)
      ),
      "the restored draft should receive a leaderboard"
    );
  });

  it("keeps every quest-bound race on its original minigame id", () => {
    const catalogIds = new Set(
      SNAPSHOT_MINIGAME_CATALOG.map((entry) => entry.id)
    );
    assert.equal(SNAPSHOT_MINIGAME_QUEST_BINDINGS.length, 7);
    for (const binding of SNAPSHOT_MINIGAME_QUEST_BINDINGS) {
      assert.ok(catalogIds.has(binding.minigameId), binding.label);
    }
  });
});
