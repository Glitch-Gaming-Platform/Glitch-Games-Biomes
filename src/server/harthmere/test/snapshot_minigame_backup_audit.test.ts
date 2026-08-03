import { iterBackupEntriesFromFile } from "@/server/backup/serde";
import { buildSnapshotMinigameCatalogSeedChanges } from "@/server/harthmere/snapshot_minigame_ecs_seed";
import { applyProposedChange } from "@/shared/ecs/change";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { Entity } from "@/shared/ecs/gen/entities";
import {
  SNAPSHOT_MINIGAME_CATALOG,
  snapshotMinigameGeneratedElementIds,
} from "@/shared/harthmere/snapshot_minigame_catalog";
import assert from "assert";
import { existsSync } from "fs";
import path from "path";

const auditTest = process.env.SNAPSHOT_MINIGAME_AUDIT === "1" ? it : it.skip;

describe("May 2026 snapshot minigame backup audit", () => {
  auditTest(
    "repairs the exact backup without replacing any working original course",
    async () => {
      const backupPath = path.resolve("snapshot_backup.json");
      assert.ok(existsSync(backupPath), `missing ${backupPath}`);
      const entities: Entity[] = [];
      const reconciled = new Map(entities.map((entity) => [entity.id, entity]));
      for await (const [version, entry] of iterBackupEntriesFromFile(
        backupPath
      )) {
        if (version !== "bikkie") {
          entities.push(entry);
          reconciled.set(entry.id, entry);
        }
      }

      const changes = buildSnapshotMinigameCatalogSeedChanges({
        tick: 1,
        nowSeconds: 1,
        entities,
      });
      const gameChanges = changes.filter(
        (change) => change.kind !== "delete" && change.entity.minigame_component
      );
      assert.equal(gameChanges.length, SNAPSHOT_MINIGAME_CATALOG.length);
      assert.ok(
        gameChanges.every(
          (change) =>
            change.kind !== "delete" &&
            change.entity.minigame_component?.ready === true
        )
      );

      for (const change of changes) {
        const id = change.kind === "delete" ? change.id : change.entity.id;
        const entity =
          change.kind === "delete"
            ? undefined
            : change.kind === "create"
              ? change.entity
              : applyProposedChange(reconciled.get(id), {
                  kind: "update",
                  entity: change.entity,
                });
        if (entity) {
          reconciled.set(id, entity as Entity);
        } else {
          reconciled.delete(id);
        }
      }

      const workingReadyGames = SNAPSHOT_MINIGAME_CATALOG.filter(
        (entry) => entry.snapshotReady && entry.id !== 3469608159111041
      );
      for (const entry of workingReadyGames) {
        const generatedIds = new Set(
          snapshotMinigameGeneratedElementIds(
            SNAPSHOT_MINIGAME_CATALOG.indexOf(entry)
          )
        );
        const generated = changes.filter(
          (change) =>
            change.kind !== "delete" && generatedIds.has(change.entity.id)
        );
        assert.ok(
          generated.every(
            (change) =>
              change.kind !== "delete" &&
              change.entity.placeable_component?.item_id ===
                BikkieIds.minigameLeaderboard
          ),
          `working game ${entry.label ?? entry.id} may add presentation only`
        );
      }

      const brokenReady = SNAPSHOT_MINIGAME_CATALOG.find(
        (entry) => entry.id === 3469608159111041
      )!;
      const brokenGeneratedIds = new Set(
        snapshotMinigameGeneratedElementIds(
          SNAPSHOT_MINIGAME_CATALOG.indexOf(brokenReady)
        )
      );
      assert.ok(
        changes.some(
          (change) =>
            change.kind !== "delete" && brokenGeneratedIds.has(change.entity.id)
        )
      );

      const thawCount = changes.filter(
        (change) => change.kind === "update" && change.entity.iced === null
      ).length;
      const generatedCount = changes.filter(
        (change) =>
          change.kind !== "delete" &&
          Number(change.entity.id) >= 8_810_000_000_040_000 &&
          Number(change.entity.id) < 8_810_000_000_040_999 &&
          change.entity.minigame_element
      ).length;
      assert.ok(thawCount > 0, "abandoned authored elements should be thawed");
      assert.ok(
        generatedCount > 0,
        "definitions with missing steps should receive generated elements"
      );

      for (const entry of SNAPSHOT_MINIGAME_CATALOG) {
        const game = reconciled.get(entry.id);
        assert.ok(game?.minigame_component, `missing game ${entry.id}`);
        assert.equal(game.minigame_component.ready, true);
        assert.equal(game.minigame_component.metadata.kind, entry.kind);
        const elements = [...game.minigame_component.minigame_element_ids].map(
          (id) => reconciled.get(id)
        );
        assert.ok(
          elements.every(
            (element) =>
              element?.minigame_element?.minigame_id === entry.id &&
              element.position?.v &&
              element.placeable_component &&
              !element.iced
          ),
          `game ${entry.label ?? entry.id} has an invalid live element`
        );
        const itemIds = elements.map(
          (element) => element!.placeable_component!.item_id
        );
        switch (entry.kind) {
          case "simple_race":
            assert.ok(itemIds.includes(BikkieIds.simpleRaceStart));
            assert.ok(itemIds.includes(BikkieIds.simpleRaceFinish));
            assert.ok(
              itemIds.includes(BikkieIds.minigameLeaderboard),
              `race ${entry.label ?? entry.id} has no physical leaderboard`
            );
            break;
          case "spleef":
            assert.ok(itemIds.includes(BikkieIds.spleefStart));
            assert.ok(
              itemIds.filter((id) => id === BikkieIds.bboxMarker).length >= 2
            );
            break;
          case "deathmatch":
            assert.ok(itemIds.includes(BikkieIds.deathmatchEnter));
            break;
        }
      }
    }
  );
});
