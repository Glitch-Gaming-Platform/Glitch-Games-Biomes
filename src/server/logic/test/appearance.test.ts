import { buildAvatarMutationEventsV1 } from "@/client/components/biomes_ui/avatarEditorMutations";
import { createLogicTable } from "@/server/logic/ecs";
import { EventBatchContext } from "@/server/logic/events/context/batch_context";
import { LogicVersionedEntitySource } from "@/server/logic/events/context/versioned_entity_source";
import { allAppearanceEventHandlers } from "@/server/logic/events/handlers/appearance";
import type { WorkByHandler } from "@/server/logic/events/grouping";
import { newPlayer } from "@/server/logic/utils/players";
import { IdPoolGenerator, IdPoolLoan } from "@/server/shared/ids/pool";
import { TestIdGenerator } from "@/server/shared/ids/test_helpers";
import { bootstrapGlobalConfig } from "@/server/shared/config";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import { BikkieRuntime } from "@/shared/bikkie/active";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { ProposedUpdate } from "@/shared/ecs/change";
import type { EventSet } from "@/shared/ecs/gen/events";
import {
  AppearanceChangeEvent,
  HairTransplantEvent,
} from "@/shared/ecs/gen/events";
import type { Appearance } from "@/shared/ecs/gen/types";
import { anItem } from "@/shared/game/item";
import { generateTestId } from "@/shared/test_helpers";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";

const [appearanceChangeEventHandler, hairTransplantEventHandler] =
  allAppearanceEventHandlers;

describe("Appearance events E2E", () => {
  const idPool = new IdPoolGenerator(new TestIdGenerator(), () => 10);
  const PLAYER_ID = generateTestId();
  const HAIR_ID = generateTestId();

  let voxeloo!: VoxelooModule;
  before(async () => {
    process.env.MOCHA_TEST = "1";
    bootstrapGlobalConfig();
    voxeloo = await loadVoxeloo();
    // The test bikkie tray doesn't ship hair wearables, so register one the
    // HairTransplantEvent handler will accept (it requires wearAsHair).
    BikkieRuntime.get().registerBiscuits(
      new Map([
        [
          HAIR_ID,
          {
            id: HAIR_ID,
            name: "test_hair",
            displayName: "Test Hair",
            wearAsHair: true,
            isWearable: true,
            stackable: 1n,
          } as any,
        ],
      ])
    );
  });

  function tableWithPlayer() {
    const table = createLogicTable();
    table.apply([
      {
        kind: "create",
        tick: 1,
        entity: {
          ...newPlayer(PLAYER_ID, "Alice"),
          position: { v: [0, 0, 0] },
        },
      },
    ]);
    return table;
  }

  async function processOne(
    table: ReturnType<typeof createLogicTable>,
    kind: keyof EventSet,
    handler: WorkByHandler[0],
    events: WorkByHandler[1]
  ) {
    const work = new Map<keyof EventSet, WorkByHandler>();
    work.set(kind, [handler, events]);
    const batchContext = new EventBatchContext(
      voxeloo,
      new LogicVersionedEntitySource(voxeloo, table),
      0
    );
    const [todo] = batchContext.prepareAll(work);
    const loan = new IdPoolLoan(idPool);
    return batchContext.processEvents(loan, todo);
  }

  it("AppearanceChangeEvent updates the player's appearance component", async () => {
    const table = tableWithPlayer();

    const appearance: Appearance = {
      skin_color_id: "skin_color_5",
      eye_color_id: "eye_color_3",
      hair_color_id: "hair_color_8",
      head_id: BikkieIds.androgenous,
    };

    const proposals = await processOne(
      table,
      "appearanceChangeEvent",
      appearanceChangeEventHandler,
      [new AppearanceChangeEvent({ id: PLAYER_ID, appearance })]
    );

    assert.equal(proposals.length, 1);
    const changes = proposals[0].transaction.changes as ProposedUpdate[];
    const playerChange = changes.find((c) => c.entity.id === PLAYER_ID);
    assert.ok(playerChange, "expected a change for the player");
    assert.deepEqual(
      playerChange!.entity.appearance_component?.appearance,
      appearance
    );
  });

  it("BiomesUI avatar editor events update the backend mesh inputs", async () => {
    const table = tableWithPlayer();
    const appearance: Appearance = {
      skin_color_id: "skin_color_7",
      eye_color_id: "eye_color_4",
      hair_color_id: "hair_color_10",
      head_id: BikkieIds.androgenous,
    };
    const { appearanceEvent, hairEvent } = buildAvatarMutationEventsV1(
      PLAYER_ID,
      { appearance, hairId: HAIR_ID }
    );

    const appearanceProposals = await processOne(
      table,
      "appearanceChangeEvent",
      appearanceChangeEventHandler,
      [appearanceEvent]
    );
    assert.equal(appearanceProposals.length, 1);
    table.apply(
      appearanceProposals[0].transaction.changes!.map((c) => ({
        ...c,
        tick: 2,
      }))
    );

    const hairProposals = await processOne(
      table,
      "hairTransplantEvent",
      hairTransplantEventHandler,
      [hairEvent]
    );
    assert.equal(hairProposals.length, 1);

    const appearanceChange = (
      appearanceProposals[0].transaction.changes as ProposedUpdate[]
    ).find((c) => c.entity.id === PLAYER_ID);
    assert.deepEqual(
      appearanceChange?.entity.appearance_component?.appearance,
      appearance
    );

    const hairChange = (
      hairProposals[0].transaction.changes as ProposedUpdate[]
    ).find((c) => c.entity.id === PLAYER_ID);
    assert.equal(
      hairChange?.entity.wearing?.items?.get(BikkieIds.hair)?.id,
      HAIR_ID
    );
  });

  it("HairTransplantEvent equips the selected hair wearable", async () => {
    const table = tableWithPlayer();
    assert.ok(anItem(HAIR_ID)?.wearAsHair, "test hair should be wearable");

    const proposals = await processOne(
      table,
      "hairTransplantEvent",
      hairTransplantEventHandler,
      [new HairTransplantEvent({ id: PLAYER_ID, newHairId: HAIR_ID })]
    );

    assert.equal(proposals.length, 1);
    const changes = proposals[0].transaction.changes as ProposedUpdate[];
    const playerChange = changes.find((c) => c.entity.id === PLAYER_ID);
    assert.ok(playerChange, "expected a change for the player");
    const equippedHair = playerChange!.entity.wearing?.items?.get(
      BikkieIds.hair
    );
    assert.equal(equippedHair?.id, HAIR_ID);
  });

  it("HairTransplantEvent with no hair clears an equipped hair wearable", async () => {
    const table = tableWithPlayer();

    // First equip a hair style, then commit it to the table.
    const equipProposals = await processOne(
      table,
      "hairTransplantEvent",
      hairTransplantEventHandler,
      [new HairTransplantEvent({ id: PLAYER_ID, newHairId: HAIR_ID })]
    );
    assert.equal(equipProposals.length, 1);
    table.apply(
      equipProposals[0].transaction.changes!.map((c) => ({ ...c, tick: 2 }))
    );

    // Now clear it.
    const proposals = await processOne(
      table,
      "hairTransplantEvent",
      hairTransplantEventHandler,
      [new HairTransplantEvent({ id: PLAYER_ID, newHairId: undefined })]
    );

    assert.equal(proposals.length, 1);
    const changes = proposals[0].transaction.changes as ProposedUpdate[];
    const playerChange = changes.find((c) => c.entity.id === PLAYER_ID);
    assert.ok(playerChange, "expected a change for the player");
    const equippedHair = playerChange!.entity.wearing?.items?.get(
      BikkieIds.hair
    );
    assert.equal(equippedHair, undefined);
  });
});
