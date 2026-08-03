import { newPlaceable } from "@/server/logic/utils/placeables";
import { newPlayer } from "@/server/logic/utils/players";
import { GameEvent } from "@/server/shared/api/game_event";
import { editEntity } from "@/server/test/test_helpers";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import { TestLogicApi } from "@/server/test/test_helpers";
import { BikkieIds } from "@/shared/bikkie/ids";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import {
  Iced,
  MinigameComponent,
  MinigameElement,
  MinigameInstance,
  MinigameInstanceTickInfo,
  Position,
  Stashed,
} from "@/shared/ecs/gen/components";
import {
  FinishSimpleRaceMinigameEvent,
  JoinDeathmatchEvent,
  MinigameInstanceTickEvent,
  QuitMinigameEvent,
  ReachCheckpointSimpleRaceMinigameEvent,
  ReachStartSimpleRaceMinigameEvent,
  TagMinigameHitPlayerEvent,
  UpdatePlayerHealthEvent,
} from "@/shared/ecs/gen/events";
import { anItem } from "@/shared/game/item";
import {
  writeHarthmereNativeCombatProgression,
} from "@/shared/harthmere/harthmere_native_combat";
import type { BiomesId } from "@/shared/ids";
import type { VoxelooModule } from "@/shared/wasm/types";
import { zrpcSerialize } from "@/shared/zrpc/serde";
import assert from "assert";

const ID_A = 41 as BiomesId;
const ID_B = 42 as BiomesId;
const ID_C = 43 as BiomesId;
const ID_D = 44 as BiomesId;

function minigamePlaceable(
  minigameId: BiomesId,
  id: BiomesId,
  itemId: BiomesId,
  position: [number, number, number]
) {
  return {
    ...newPlaceable({
      id,
      creatorId: minigameId,
      position,
      orientation: [0, 0],
      item: anItem(itemId),
      timestamp: secondsSinceEpoch(),
    }),
    minigame_element: MinigameElement.create({ minigame_id: minigameId }),
  };
}

describe("Minigames", () => {
  let voxeloo!: VoxelooModule;
  before(async () => {
    voxeloo = await loadVoxeloo();
  });

  let logic: TestLogicApi;
  beforeEach(async () => {
    logic = new TestLogicApi(voxeloo);
  });

  it("Should be able to quit a game", async () => {
    const table = logic.world;
    table.writeableTable.apply([
      {
        kind: "create",
        tick: 1,
        entity: {
          ...newPlayer(ID_A, "Alice"),
          position: { v: [0, 0, 0] },
          playing_minigame: {
            minigame_id: ID_B,
            minigame_instance_id: ID_D,
            minigame_type: "simple_race",
          },
          iced: Iced.create(),
        },
      },
      {
        kind: "create",
        tick: 1,
        entity: {
          id: ID_B,
          created_by: {
            created_at: secondsSinceEpoch(),
            id: ID_A,
          },
          minigame_component: MinigameComponent.create({
            metadata: {
              kind: "simple_race",
              checkpoint_ids: new Set(),
              end_ids: new Set(),
              start_ids: new Set(),
            },
          }),
        },
      },
      {
        kind: "create",
        tick: 1,
        entity: {
          id: ID_C,
          stashed: Stashed.create({}),
        },
      },
      {
        kind: "create",
        tick: 1,
        entity: {
          id: ID_D,
          created_by: {
            created_at: secondsSinceEpoch(),
            id: ID_B,
          },
          minigame_instance: MinigameInstance.create({
            minigame_id: ID_B,
            finished: false,
            active_players: new Map([
              [
                ID_A,
                {
                  entry_stash_id: ID_C,
                  entry_position: [0, 0, 0],
                  entry_warped_to: undefined,
                  entry_time: secondsSinceEpoch(),
                },
              ],
            ]),
            state: {
              kind: "simple_race",
              reached_checkpoints: new Map(),
              player_state: "waiting",
              deaths: 10,
              started_at: secondsSinceEpoch(),
              finished_at: undefined,
            },
          }),
        },
      },
    ]);

    await logic.publish(
      new GameEvent(
        ID_A,
        new QuitMinigameEvent({
          id: ID_A,
          minigame_id: ID_B,
          minigame_instance_id: ID_D,
        })
      )
    );

    const player = table.table.get(ID_A);
    assert.ok(player?.playing_minigame === undefined);

    const gameInstance = table.table.get(ID_D);
    assert.ok(gameInstance?.minigame_instance);
    assert.ok(gameInstance.minigame_instance.finished);

    assert.equal(0, gameInstance.minigame_instance.active_players.size);
  });

  it("runs a server-authoritative race lifecycle and rejects forged steps", async () => {
    const START = 45 as BiomesId;
    const CHECKPOINT_A = 46 as BiomesId;
    const CHECKPOINT_B = 47 as BiomesId;
    const FINISH = 48 as BiomesId;
    const FOREIGN = 49 as BiomesId;
    logic.world.writeableTable.apply([
      {
        kind: "create",
        tick: 1,
        entity: {
          ...newPlayer(ID_A, "Alice"),
          position: Position.create({ v: [0, 0, 0] }),
          playing_minigame: {
            minigame_id: ID_B,
            minigame_instance_id: ID_D,
            minigame_type: "simple_race",
          },
        },
      },
      {
        kind: "create",
        tick: 1,
        entity: {
          id: ID_B,
          created_by: { id: ID_A, created_at: secondsSinceEpoch() },
          minigame_component: MinigameComponent.create({
            metadata: {
              kind: "simple_race",
              start_ids: new Set([START]),
              checkpoint_ids: new Set([CHECKPOINT_A, CHECKPOINT_B]),
              end_ids: new Set([FINISH]),
            },
            minigame_element_ids: new Set([
              START,
              CHECKPOINT_A,
              CHECKPOINT_B,
              FINISH,
            ]),
            ready: true,
          }),
        },
      },
      {
        kind: "create",
        tick: 1,
        entity: { id: ID_C, stashed: Stashed.create({}) },
      },
      {
        kind: "create",
        tick: 1,
        entity: {
          id: ID_D,
          created_by: { id: ID_B, created_at: secondsSinceEpoch() },
          minigame_instance: MinigameInstance.create({
            minigame_id: ID_B,
            active_players: new Map([
              [
                ID_A,
                {
                  entry_stash_id: ID_C,
                  entry_position: [0, 0, 0],
                  entry_warped_to: undefined,
                  entry_time: secondsSinceEpoch(),
                },
              ],
            ]),
            state: {
              kind: "simple_race",
              player_state: "waiting",
              reached_checkpoints: new Map(),
              deaths: 0,
              started_at: 0,
              finished_at: undefined,
            },
          }),
        },
      },
      {
        kind: "create",
        tick: 1,
        entity: minigamePlaceable(
          ID_B,
          START,
          BikkieIds.simpleRaceStart,
          [0, 0, 0]
        ),
      },
      {
        kind: "create",
        tick: 1,
        entity: minigamePlaceable(
          ID_B,
          CHECKPOINT_A,
          BikkieIds.simpleRaceCheckpoint,
          [10, 0, 0]
        ),
      },
      {
        kind: "create",
        tick: 1,
        entity: minigamePlaceable(
          ID_B,
          CHECKPOINT_B,
          BikkieIds.simpleRaceCheckpoint,
          [20, 0, 0]
        ),
      },
      {
        kind: "create",
        tick: 1,
        entity: minigamePlaceable(
          ID_B,
          FINISH,
          BikkieIds.simpleRaceFinish,
          [30, 0, 0]
        ),
      },
      {
        kind: "create",
        tick: 1,
        entity: minigamePlaceable(
          999 as BiomesId,
          FOREIGN,
          BikkieIds.simpleRaceCheckpoint,
          [10, 0, 0]
        ),
      },
    ]);

    await logic.publish(
      new GameEvent(
        ID_A,
        new ReachStartSimpleRaceMinigameEvent({
          id: ID_A,
          minigame_id: ID_B,
          minigame_instance_id: ID_D,
          minigame_element_id: START,
        })
      )
    );
    const startedRaceState =
      logic.world.table.get(ID_D)?.minigame_instance?.state;
    assert.equal(startedRaceState?.kind, "simple_race");
    assert.equal(
      startedRaceState?.kind === "simple_race"
        ? startedRaceState.player_state
        : undefined,
      "racing"
    );

    editEntity(logic.world, ID_A, (player) =>
      player.setPosition(Position.create({ v: [10, 0, 0] }))
    );
    await logic.publish(
      new GameEvent(
        ID_A,
        new ReachCheckpointSimpleRaceMinigameEvent({
          id: ID_A,
          minigame_id: ID_B,
          minigame_instance_id: ID_D,
          minigame_element_id: CHECKPOINT_A,
        })
      )
    );
    await logic.publish(
      new GameEvent(
        ID_A,
        new ReachCheckpointSimpleRaceMinigameEvent({
          id: ID_A,
          minigame_id: ID_B,
          minigame_instance_id: ID_D,
          minigame_element_id: FOREIGN,
        })
      )
    );
    const afterForgery = logic.world.table.get(ID_D)?.minigame_instance;
    assert.ok(afterForgery?.state.kind === "simple_race");
    assert.deepEqual(
      [...afterForgery.state.reached_checkpoints.keys()],
      [CHECKPOINT_A]
    );

    editEntity(logic.world, ID_A, (player) =>
      player.setPosition(Position.create({ v: [30, 0, 0] }))
    );
    await logic.publish(
      new GameEvent(
        ID_A,
        new FinishSimpleRaceMinigameEvent({
          id: ID_A,
          minigame_id: ID_B,
          minigame_instance_id: ID_D,
          minigame_element_id: FINISH,
        })
      )
    );
    assert.ok(logic.world.table.get(ID_A)?.playing_minigame);

    editEntity(logic.world, ID_A, (player) =>
      player.setPosition(Position.create({ v: [20, 0, 0] }))
    );
    await logic.publish(
      new GameEvent(
        ID_A,
        new ReachCheckpointSimpleRaceMinigameEvent({
          id: ID_A,
          minigame_id: ID_B,
          minigame_instance_id: ID_D,
          minigame_element_id: CHECKPOINT_B,
        })
      )
    );
    editEntity(logic.world, ID_A, (player) =>
      player.setPosition(Position.create({ v: [30, 0, 0] }))
    );
    await logic.publish(
      new GameEvent(
        ID_A,
        new FinishSimpleRaceMinigameEvent({
          id: ID_A,
          minigame_id: ID_B,
          minigame_instance_id: ID_D,
          minigame_element_id: FINISH,
        })
      )
    );
    assert.equal(logic.world.table.get(ID_A)?.playing_minigame, undefined);
    assert.equal(
      logic.world.table.get(ID_D)?.minigame_instance?.finished,
      true
    );
  });

  it("rejects remote Spleef tags and accepts a real collision-range tag", async () => {
    const gameId = 60 as BiomesId;
    const instanceId = 61 as BiomesId;
    const playerA = 62 as BiomesId;
    const playerB = 63 as BiomesId;
    logic.world.writeableTable.apply([
      {
        kind: "create",
        tick: 1,
        entity: {
          ...newPlayer(playerA, "Tagger"),
          position: Position.create({ v: [0, 0, 0] }),
          playing_minigame: {
            minigame_id: gameId,
            minigame_instance_id: instanceId,
            minigame_type: "spleef",
          },
        },
      },
      {
        kind: "create",
        tick: 1,
        entity: {
          ...newPlayer(playerB, "Target"),
          position: Position.create({ v: [100, 0, 0] }),
          playing_minigame: {
            minigame_id: gameId,
            minigame_instance_id: instanceId,
            minigame_type: "spleef",
          },
        },
      },
      {
        kind: "create",
        tick: 1,
        entity: {
          id: gameId,
          created_by: { id: playerA, created_at: 1 },
          minigame_component: MinigameComponent.create({
            metadata: {
              kind: "spleef",
              start_ids: new Set(),
              arena_marker_ids: new Set(),
            },
          }),
        },
      },
      {
        kind: "create",
        tick: 1,
        entity: {
          id: instanceId,
          created_by: { id: gameId, created_at: 1 },
          minigame_instance: MinigameInstance.create({
            minigame_id: gameId,
            active_players: new Map([
              [
                playerA,
                {
                  entry_stash_id: 64 as BiomesId,
                  entry_position: [0, 0, 0],
                  entry_warped_to: undefined,
                  entry_time: 1,
                },
              ],
              [
                playerB,
                {
                  entry_stash_id: 65 as BiomesId,
                  entry_position: [1, 0, 0],
                  entry_warped_to: undefined,
                  entry_time: 1,
                },
              ],
            ]),
            state: {
              kind: "spleef",
              round_number: 1,
              observer_spawn_points: [],
              player_stats: new Map([
                [playerA, { playerId: playerA, rounds_won: 0 }],
                [playerB, { playerId: playerB, rounds_won: 0 }],
              ]),
              instance_state: {
                kind: "playing_round",
                round_expires: secondsSinceEpoch() + 60,
                alive_round_players: new Set([playerA, playerB]),
                tag_round_state: { it_player: playerA },
              },
            },
          }),
        },
      },
    ]);
    const tag = () =>
      logic.publish(
        new GameEvent(
          playerA,
          new TagMinigameHitPlayerEvent({
            id: playerA,
            minigame_id: gameId,
            minigame_instance_id: instanceId,
            hit_player_id: playerB,
          })
        )
      );
    const startingHp = logic.world.table.get(playerB)?.health?.hp;
    await tag();
    assert.equal(logic.world.table.get(playerB)?.health?.hp, startingHp);
    editEntity(logic.world, playerB, (player) =>
      player.setPosition(Position.create({ v: [1, 0, 0] }))
    );
    await tag();
    assert.equal(logic.world.table.get(playerB)?.health?.hp, 0);
  });

  it("waits for two Deathmatch players, starts once, and equips the shared loadout", async () => {
    const gameId = 70 as BiomesId;
    const startId = 71 as BiomesId;
    const playerA = 72 as BiomesId;
    const playerB = 73 as BiomesId;
    logic.world.writeableTable.apply([
      {
        kind: "create",
        tick: 1,
        entity: { ...newPlayer(playerA, "Alice"), position: { v: [0, 0, 0] } },
      },
      {
        kind: "create",
        tick: 1,
        entity: { ...newPlayer(playerB, "Bob"), position: { v: [0, 0, 0] } },
      },
      {
        kind: "create",
        tick: 1,
        entity: {
          id: gameId,
          created_by: { id: playerA, created_at: 1 },
          minigame_component: MinigameComponent.create({
            metadata: { kind: "deathmatch", start_ids: new Set([startId]) },
            minigame_element_ids: new Set([startId]),
            ready: true,
            minigame_settings: zrpcSerialize({
              minPlayers: 2,
              countdownSeconds: 0,
              roundLengthSeconds: 10,
              loadOut: [[BikkieIds.megaAxe, 1]],
            }),
          }),
        },
      },
      {
        kind: "create",
        tick: 1,
        entity: minigamePlaceable(
          gameId,
          startId,
          BikkieIds.deathmatchEnter,
          [0, 0, 0]
        ),
      },
    ]);

    await logic.publish(
      new GameEvent(
        playerA,
        new JoinDeathmatchEvent({ id: playerA, minigame_id: gameId })
      )
    );
    const gameAfterFirst = logic.world.table.get(gameId)?.minigame_component;
    assert.equal(gameAfterFirst?.active_instance_ids.size, 1);
    const [instanceId] = [...gameAfterFirst!.active_instance_ids];
    const firstState = logic.world.table.get(instanceId)?.minigame_instance;
    assert.ok(firstState?.state.kind === "deathmatch");
    assert.equal(firstState.state.instance_state?.kind, "waiting_for_players");

    await logic.publish(
      new GameEvent(
        playerB,
        new JoinDeathmatchEvent({
          id: playerB,
          minigame_id: gameId,
          minigame_instance_id: instanceId,
        })
      )
    );
    const countdown = logic.world.table.get(instanceId)?.minigame_instance;
    assert.ok(countdown?.state.kind === "deathmatch");
    assert.equal(countdown.state.instance_state?.kind, "play_countdown");

    await logic.publish(
      new GameEvent(
        playerA,
        new MinigameInstanceTickEvent({
          minigame_id: gameId,
          minigame_instance_id: instanceId,
        })
      )
    );
    const playing = logic.world.table.get(instanceId)?.minigame_instance;
    assert.ok(playing?.state.kind === "deathmatch");
    assert.equal(playing.state.instance_state?.kind, "playing");
    for (const playerId of [playerA, playerB]) {
      assert.equal(
        logic.world.table.get(playerId)?.inventory?.hotbar[0]?.item.id,
        BikkieIds.megaAxe
      );
    }

    editEntity(logic.world, playerA, (player) => {
      writeHarthmereNativeCombatProgression(player.mutableTriggerState(), {
        migrationVersion: 4,
        lastAttackMs: 0,
      });
    });
    editEntity(logic.world, playerB, (player) => {
      player.mutableHealth().hp = 1;
    });
    await logic.publish(
      new GameEvent(
        playerB,
        new UpdatePlayerHealthEvent({
          id: playerB,
          hpDelta: -999,
          damageSource: {
            kind: "attack",
            attacker: playerA,
            dir: [1, 0, 0],
          },
        })
      )
    );
    assert.equal(logic.world.table.get(playerB)?.health?.hp, 0);
    const scored = logic.world.table.get(instanceId)?.minigame_instance;
    assert.ok(scored?.state.kind === "deathmatch");
    assert.equal(scored.state.player_states.get(playerA)?.kills, 1);
    assert.equal(scored.state.player_states.get(playerB)?.deaths, 1);

    editEntity(logic.world, instanceId, (instance) => {
      const mutable = instance.mutableMinigameInstance();
      assert.equal(mutable.state.kind, "deathmatch");
      if (mutable.state.kind === "deathmatch") {
        mutable.state.instance_state = {
          kind: "playing",
          round_end: secondsSinceEpoch() - 1,
        };
      }
      instance.setMinigameInstanceTickInfo(
        MinigameInstanceTickInfo.create({
          trigger_at: secondsSinceEpoch(),
          last_tick: secondsSinceEpoch() - 10,
        })
      );
    });
    await logic.publish(
      new GameEvent(
        playerA,
        new MinigameInstanceTickEvent({
          minigame_id: gameId,
          minigame_instance_id: instanceId,
        })
      )
    );
    const finished = logic.world.table.get(instanceId)?.minigame_instance;
    assert.ok(finished?.state.kind === "deathmatch");
    assert.equal(finished.state.instance_state?.kind, "finished");
  });
});
