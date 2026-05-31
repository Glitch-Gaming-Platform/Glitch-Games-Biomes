import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildingSystemBlueprintByIdV1,
  buildingSystemPlotByIdV1,
  createBuildingSystemHomeConsoleMarkerV1,
  type BuildingSystemPropertyRecordV1,
} from "@/shared/harthmere/building_system_v1";
import {
  defaultHarthmereHomeDecorationStateV1,
  reduceHarthmereHomeDecorationMutationV1,
  type HarthmereHomeDecorationStateV1,
} from "@/shared/harthmere/home_decoration_authority_v1";
import {
  HARTHMERE_CRAFTING_STATIONS_V1,
  HARTHMERE_CRAFTING_TOOLS_V1,
  HARTHMERE_HOME_DECORATION_ITEM_IDS_V1,
  ensureHarthmereProductionCraftingCatalogueV1,
} from "@/shared/harthmere/mmo_crafting_catalogue_v1";
import {
  HarthmereHomeConsoleLiveContainer,
  HarthmereHomeConsolePanel,
  HarthmereHomeConsolePrompt,
  createHarthmereHomeConsoleAdapterV1,
  fetchHarthmereHomeConsoleBuildingStateV1,
  formatHarthmereHomeConsolePlayerErrorV1,
  getHarthmereHomeConsolePanelV1,
  listHarthmereHomeConsoleMarkersV1,
  nearestHarthmereHomeConsoleWorldContextV1,
  normalizeHarthmereHomeConsoleClientSnapshotV1,
  submitHarthmereHomeDecorationMutationV1,
  type HarthmereHomeConsoleClientSnapshotV1,
  type HarthmereHomeConsoleSubmitPayloadV1,
} from "../";

const ACTOR = "home_console_actor";
const OTHER = "home_console_other";
const NOW = 1_770_000_000_000;

function property(
  overrides: Partial<BuildingSystemPropertyRecordV1> = {}
): BuildingSystemPropertyRecordV1 {
  return {
    propertyId: "property_grove_muckstead_cottage_lot",
    plotId: "grove_muckstead_cottage_lot",
    blueprintId: "grove_voxel_cottage_tier_1",
    ownerId: ACTOR,
    status: "owned",
    use: "home",
    value: 100,
    tier: 1,
    accessMode: "private",
    permissions: {
      owner: {
        storage_access: true,
        build_edit: true,
        demolition: true,
        transfer_sale: true,
      },
      friends_guests: {
        storage_access: false,
        build_edit: false,
        demolition: false,
        transfer_sale: false,
      },
      guild_members: {
        storage_access: false,
        build_edit: false,
        demolition: false,
        transfer_sale: false,
      },
      public: {
        storage_access: false,
        build_edit: false,
        demolition: false,
        transfer_sale: false,
      },
    },
    guestActorIds: [],
    storageSlots: 8,
    storageItemCount: 0,
    storageContainerId: "storage_property_grove_muckstead_cottage_lot",
    doorLockId: "door_property_grove_muckstead_cottage_lot",
    visualDamageApplied: false,
    upgradedVoxelTier: 1,
    condition: 100,
    repairDebtGold: 0,
    lastRepairDecayAtMs: NOW,
    taxRate: 0,
    businessTaxRate: 0,
    guildTaxRate: 0,
    taxBalanceGold: 0,
    lastTaxAssessedAtMs: NOW,
    abandoned: false,
    listedForSale: false,
    createdAtMs: NOW,
    updatedAtMs: NOW,
    ...overrides,
  };
}

function place(
  state: HarthmereHomeDecorationStateV1,
  prop: BuildingSystemPropertyRecordV1,
  itemId: string,
  requestId: string
) {
  const result = reduceHarthmereHomeDecorationMutationV1(
    state,
    {
      requestId,
      actorId: ACTOR,
      operation: "place_decoration",
      propertyId: prop.propertyId,
      itemId,
      nowMs: NOW,
    },
    {
      properties: { [prop.propertyId]: prop },
      actorInventoryItems: { [itemId]: 1 },
    }
  );
  assert.ok(result.ok, JSON.stringify(result.errors));
  return result.state;
}

function snapshot(
  actorId = ACTOR,
  prop = property()
): HarthmereHomeConsoleClientSnapshotV1 {
  ensureHarthmereProductionCraftingCatalogueV1();
  let homeDecoration = defaultHarthmereHomeDecorationStateV1();
  homeDecoration = place(
    homeDecoration,
    prop,
    HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.gardenPlanterBox,
    "place-garden"
  );
  homeDecoration = place(
    homeDecoration,
    prop,
    HARTHMERE_CRAFTING_STATIONS_V1.workbench,
    "place-workbench"
  );
  const plot = buildingSystemPlotByIdV1(prop.plotId)!;
  const blueprint = buildingSystemBlueprintByIdV1(prop.blueprintId)!;
  const marker = createBuildingSystemHomeConsoleMarkerV1({
    property: prop,
    plot,
    blueprint,
    nowMs: NOW,
  });
  return normalizeHarthmereHomeConsoleClientSnapshotV1({
    actorId,
    gold: 75,
    inventoryItems: {
      [HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.storageCabinet]: 1,
      [HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.hearthLamp]: 1,
      grain_seed: 2,
      [HARTHMERE_CRAFTING_TOOLS_V1.wateringCan]: 1,
    },
    completedProperties: { [prop.propertyId]: prop },
    homeDecoration,
    inWorldMarkers: { [marker.markerId]: marker },
    nowMs: NOW,
  });
}

describe("HarthmereHomeConsolePanel", () => {
  it("renders a BiomesUI owner-only home management interface with Bikkie visuals", () => {
    const state = snapshot();
    const marker = listHarthmereHomeConsoleMarkersV1(state)[0];
    const adapter = createHarthmereHomeConsoleAdapterV1({
      state,
      context: {
        insideHome: true,
        nearbyPropertyId: property().propertyId,
        nearbyConsoleId: marker.markerId,
      },
    });
    const html = renderToStaticMarkup(
      React.createElement(HarthmereHomeConsolePanel, {
        adapter,
        context: {
          insideHome: true,
          nearbyPropertyId: property().propertyId,
          nearbyConsoleId: marker.markerId,
        },
      })
    );
    assert.ok(html.includes('data-harthmere-home-console-interface="true"'));
    assert.ok(html.includes('data-home-console-access="owner-only"'));
    assert.ok(html.includes('data-pointer-lock-policy="unlock-while-open"'));
    assert.ok(html.includes('data-mouse-policy="show-while-open"'));
    assert.ok(html.includes('aria-label="Home console sections"'));
    assert.ok(html.includes("Home Console"));
    assert.ok(html.includes("Private owner access"));
    assert.ok(html.includes("Close home console"));
    const furnitureHtml = renderToStaticMarkup(
      React.createElement(HarthmereHomeConsolePanel, {
        adapter,
        context: {
          insideHome: true,
          nearbyPropertyId: property().propertyId,
          nearbyConsoleId: marker.markerId,
        },
        compact: true,
        initialTab: "furniture",
      })
    );
    assert.ok(furnitureHtml.includes('data-home-console-visual="true"'));
    assert.ok(furnitureHtml.includes("Storage Cabinet"));
    assert.ok(furnitureHtml.includes("Owned 1"));
    const decorateHtml = renderToStaticMarkup(
      React.createElement(HarthmereHomeConsolePanel, {
        adapter,
        context: {
          insideHome: true,
          nearbyPropertyId: property().propertyId,
          nearbyConsoleId: marker.markerId,
        },
        compact: true,
        initialTab: "decorate",
      })
    );
    assert.ok(decorateHtml.includes("X-"));
    assert.ok(decorateHtml.includes("Z+"));
    assert.ok(decorateHtml.includes("Remove"));
    const visibleText = `${html} ${furnitureHtml} ${decorateHtml}`.replace(
      /<[^>]*>/g,
      " "
    );
    assert.ok(!visibleText.includes("_"), visibleText);
    assert.ok(!/\b[a-z]+[A-Z][A-Za-z]*\b/.test(visibleText), visibleText);
  });

  it("shows a discoverable prompt only for the home owner inside the home", () => {
    const state = snapshot();
    const marker = listHarthmereHomeConsoleMarkersV1(state)[0];
    const adapter = createHarthmereHomeConsoleAdapterV1({ state });
    const html = renderToStaticMarkup(
      React.createElement(HarthmereHomeConsolePrompt, {
        adapter,
        context: {
          insideHome: true,
          nearbyConsoleId: marker.markerId,
          interactionKeyLabel: "E",
        },
      })
    );
    assert.ok(html.includes('data-harthmere-home-console-prompt="true"'));
    assert.ok(html.includes('data-harthmere-interface-access-point="true"'));
    assert.ok(html.includes('data-access-point-polish="production"'));
    assert.ok(html.includes('data-access-point-visible-target="bottom-center"'));
    assert.ok(html.includes('data-access-point-min-height="82"'));
    assert.ok(html.includes('data-access-point-key-size="46"'));
    assert.ok(html.includes('data-home-console-marker-kind="home_console"'));
    assert.ok(html.includes("Home owner access"));
    assert.ok(html.includes("Home Console"));
    assert.ok(html.includes("Press E to manage"));
    assert.ok(html.includes("furniture, decorating, storage, gardens"));
    assert.ok(html.includes("min-height:82px"));
    assert.ok(html.includes("width:min(calc(100vw - 24px), 590px)"));

    const outsider = createHarthmereHomeConsoleAdapterV1({
      state: snapshot(OTHER),
    });
    assert.equal(
      renderToStaticMarkup(
        React.createElement(HarthmereHomeConsolePrompt, {
          adapter: outsider,
          context: {
            insideHome: true,
            nearbyConsoleId: marker.markerId,
            interactionKeyLabel: "E",
          },
        })
      ),
      ""
    );
    assert.equal(
      renderToStaticMarkup(
        React.createElement(HarthmereHomeConsolePanel, {
          adapter: outsider,
          context: {
            insideHome: true,
            nearbyConsoleId: marker.markerId,
          },
        })
      ),
      ""
    );
    assert.equal(
      getHarthmereHomeConsolePanelV1(snapshot(OTHER), {
        insideHome: true,
        nearbyConsoleId: marker.markerId,
      }).accessReason,
      "not_owner"
    );
    assert.equal(
      getHarthmereHomeConsolePanelV1(state, {
        insideHome: true,
        nearbyPropertyId: property().propertyId,
      }).accessReason,
      "console_not_nearby"
    );
  });

  it("resolves the nearby in-world console from player position", () => {
    const state = snapshot();
    const marker = listHarthmereHomeConsoleMarkersV1(state)[0];
    const context = nearestHarthmereHomeConsoleWorldContextV1(state, {
      x: marker.position[0],
      y: marker.position[1],
      z: marker.position[2],
    });
    assert.equal(context.insideHome, true);
    assert.equal(context.nearbyConsoleId, marker.markerId);
    assert.equal(context.nearbyPropertyId, property().propertyId);

    const farContext = nearestHarthmereHomeConsoleWorldContextV1(state, {
      x: marker.position[0] + 100,
      y: marker.position[1],
      z: marker.position[2],
    });
    assert.equal(farContext.insideHome, false);
    assert.equal(farContext.nearbyConsoleId, undefined);
  });

  it("maps console actions to home decoration live-mode payloads", async () => {
    const state = snapshot();
    const marker = listHarthmereHomeConsoleMarkersV1(state)[0];
    const payloads: HarthmereHomeConsoleSubmitPayloadV1[] = [];
    const adapter = createHarthmereHomeConsoleAdapterV1({
      state,
      context: {
        insideHome: true,
        nearbyConsoleId: marker.markerId,
      },
      submit: async (payload) => {
        payloads.push(payload);
        return { ok: true, buildingState: state };
      },
    });
    await adapter.placeDecoration(HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.storageCabinet);
    await adapter.moveDecoration("decor_property_grove_muckstead_cottage_lot_1", { x: 1, y: 0, z: 2 }, 90);
    await adapter.useDecoration("decor_property_grove_muckstead_cottage_lot_2");
    await adapter.removeDecoration("decor_property_grove_muckstead_cottage_lot_1");
    await adapter.plantGarden("decor_property_grove_muckstead_cottage_lot_1", "grain_seed");
    await adapter.waterGarden("decor_property_grove_muckstead_cottage_lot_1");
    await adapter.harvestGarden("decor_property_grove_muckstead_cottage_lot_1");
    assert.deepStrictEqual(
      payloads.map((payload) => payload.operation),
      [
        "place_decoration",
        "move_decoration",
        "use_decoration",
        "remove_decoration",
        "plant_garden",
        "water_garden",
        "harvest_garden",
      ]
    );
    assert.equal(payloads[0].propertyId, property().propertyId);
    assert.equal(
      payloads[0].itemId,
      HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.storageCabinet
    );
    assert.equal(payloads[1].rotationDegrees, 90);
    assert.equal(payloads[4].seedItemId, "grain_seed");
  });

  it("posts home console writes through request_home_decoration", async () => {
    const calls: any[] = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({ ok: true, buildingState: snapshot() }),
      };
    }) as any;
    await submitHarthmereHomeDecorationMutationV1(
      {
        operation: "place_decoration",
        propertyId: property().propertyId,
        itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.storageCabinet,
      },
      { fetchImpl, requestId: "fixed_home_console_request" }
    );
    assert.equal(calls[0].url, "/api/harthmere/live_mode");
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.credentials, "same-origin");
    const envelope = JSON.parse(calls[0].init.body);
    assert.equal(envelope.requestId, "fixed_home_console_request");
    assert.equal(envelope.idempotencyKey, "fixed_home_console_request");
    assert.equal(envelope.actionKind, "request_home_decoration");
    assert.equal(envelope.subsystem, "home_decoration");
    assert.equal(envelope.actorEntityVersion, 1);
    assert.equal(envelope.zoneId, "the_grove");
    assert.deepStrictEqual(envelope.clientClaims, {});
    assert.equal(envelope.payload.operation, "place_decoration");
  });

  it("fetches the live building state used by the home console", async () => {
    const calls: any[] = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({ ok: true, buildingState: snapshot() }),
      };
    }) as any;
    const state = await fetchHarthmereHomeConsoleBuildingStateV1(fetchImpl);
    assert.equal(calls[0].url, "/api/harthmere/live_mode_building_state");
    assert.equal(calls[0].init.method, "GET");
    assert.equal(calls[0].init.credentials, "same-origin");
    assert.equal(state?.actorId, ACTOR);
    assert.ok(
      Object.values(state?.inWorldMarkers ?? {}).some(
        (marker) => marker.kind === "home_console"
      )
    );
  });

  it("renders the live container prompt and panel from an initial building snapshot", () => {
    const state = snapshot();
    const marker = listHarthmereHomeConsoleMarkersV1(state)[0];
    const playerPosition = {
      x: marker.position[0],
      y: marker.position[1],
      z: marker.position[2],
    };
    const promptHtml = renderToStaticMarkup(
      React.createElement(HarthmereHomeConsoleLiveContainer, {
        initialState: state,
        playerPosition,
        open: false,
      })
    );
    assert.ok(promptHtml.includes('data-harthmere-home-console-prompt="true"'));
    assert.ok(promptHtml.includes('data-harthmere-interface-access-point="true"'));
    assert.ok(promptHtml.includes("Press F to manage"));

    const panelHtml = renderToStaticMarkup(
      React.createElement(HarthmereHomeConsoleLiveContainer, {
        initialState: state,
        playerPosition,
        open: true,
      })
    );
    assert.ok(
      panelHtml.includes('data-harthmere-home-console-interface="true"')
    );
    assert.ok(panelHtml.includes('data-home-console-access="owner-only"'));
  });

  it("formats home console warnings without exposing backend codes", () => {
    const message = formatHarthmereHomeConsolePlayerErrorV1([
      "home_decoration_rejected:property_not_owned",
      "home_decoration_rejected:missing_watering_can",
      "home_decoration_rejected:console_proximity_required",
    ]);
    assert.equal(message.includes("_"), false);
    assert.equal(message.includes(":"), false);
    assert.ok(message.includes("Only the home owner"));
    assert.ok(message.includes("watering can"));
    assert.ok(message.includes("Move closer"));
  });
});
