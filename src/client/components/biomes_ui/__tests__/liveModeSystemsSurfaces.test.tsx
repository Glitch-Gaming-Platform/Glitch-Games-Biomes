/// <reference types="mocha" />
import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HarthmereBusinessInterfacePanel } from "@/client/components/harthmere_business/HarthmereBusinessInterfacePanel";
import {
  HARTHMERE_BUSINESS_TYPE_ORDER,
  createHarthmereBusinessInterfaceAdapter,
  normalizeHarthmereBusinessEconomySnapshot,
  type HarthmereBusinessEconomySnapshot,
  type HarthmereBusinessTypeId,
} from "@/client/components/harthmere_business/businessInterfaceLiveAdapter";
import { DailyTodoTab } from "../tabs/DailyTodoTab";
import { GuildsTab } from "../tabs/GuildsTab";
import { InventoryTab } from "../tabs/InventoryTab";
import { LandTab } from "../tabs/LandTab";
import { LootTab } from "../tabs/LootTab";
import {
  MapQuestsTab,
  activeBiomesUIMapPinFromMarkerForTest,
  filterMapMissionStepsForTest,
  filterMapTrackableQuestsForTest,
} from "../tabs/MapQuestsTab";
import { SkillsTab } from "../tabs/SkillsTab";
import { biomesUIVitalsDisplayFromLiveStatusForTest } from "../adapters/playerStatusAdapter";

const FORBIDDEN_SYSTEM_COPY = [
  "server accepted",
  "server rejected",
  "server-authoritative",
  "building_state",
  "economy_production_state",
  "request_",
  "payload",
  "ledger",
];

function visibleText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function assertPlayerFacing(html: string) {
  const text = visibleText(html).toLowerCase();
  for (const token of FORBIDDEN_SYSTEM_COPY) {
    assert.equal(
      text.includes(token.toLowerCase()),
      false,
      `developer/system copy leaked into player UI: ${token}`
    );
  }
}

function businessType(typeId: HarthmereBusinessTypeId) {
  return {
    typeId,
    displayName: typeId.replace(/_/g, " "),
    category: "test",
    startCostGold: 100,
    materialNeed: "medium",
    baseStorageSlots: 12,
    baseUpkeepGoldPerDay: 5,
    requiredLicense: "basic_trade",
    minimumLicenseLevel: 1,
    serviceNeeds: ["food"],
    inputItemFamilies: [],
    outputItemFamilies: [],
    riskLevel: 1,
    civicImportance: 1,
  };
}

function business(
  businessId: string,
  typeId: HarthmereBusinessTypeId,
  ownerId = "systems_surface_player"
) {
  return {
    businessId,
    ownerKind: "player" as const,
    ownerId,
    typeId,
    name: `${typeId.replace(/_/g, " ")} Shop`,
    status: "open" as const,
    licenseClass: "basic_trade",
    licenseLevel: 2,
    propertyId: `property_${businessId}`,
    townId: "harthmere_grove",
    regionId: "harthmere_grove_region",
    inventory: {
      worker_meal: { itemId: "worker_meal", count: 6 },
      rare_seed: { itemId: "rare_seed", count: 2 },
    },
    storageMaxSlots: 12,
    employees: ["employee_1"],
    activeContracts: ["contract_2"],
    completedContracts: 3,
    reputation: 12,
    customerSatisfaction: 76,
    sanitationRating: 70,
    safetyRating: 68,
    serviceRadius: 2,
    priceModifiers: { worker_meal: 1.5 },
    balanceGold: 450,
    debtGold: 75,
    upkeepGoldPerDay: 5,
    rentGoldPerDay: 3,
    wageGoldPerDay: 12,
    salesTaxRate: 0.06,
    lastTickAtMs: 1_800_000_000_000,
    createdAtMs: 1_800_000_000_000,
    updatedAtMs: 1_800_000_000_000,
    flags: {},
  };
}

function businessSnapshot(): HarthmereBusinessEconomySnapshot {
  const businessTypes = Object.fromEntries(
    HARTHMERE_BUSINESS_TYPE_ORDER.map((typeId) => [
      typeId,
      businessType(typeId),
    ])
  );
  const owned = business("business_food", "food_service_restaurant");
  const clinic = business("business_clinic", "medical_doctor", "other_player");
  return normalizeHarthmereBusinessEconomySnapshot({
    version: "systems-surface-test",
    actorId: "systems_surface_player",
    businessTypes,
    businesses: {
      [owned.businessId]: owned,
      [clinic.businessId]: clinic,
    },
    myBusinesses: [owned],
    openContracts: [],
    activeContracts: [
      {
        contractId: "contract_2",
        issuerKind: "player",
        issuerId: "customer_2",
        title: "Active meal order",
        businessType: "food_service_restaurant",
        requirements: [{ itemId: "worker_meal", count: 1 }],
        rewardGold: 100,
        reputationDelta: 5,
        status: "active",
        acceptedByBusinessId: "business_food",
        acceptedByActorId: "systems_surface_player",
        regionId: "harthmere_grove_region",
        createdAtMs: 1,
        deadlineAtMs: 1_900_000_000_000,
        failurePenaltyGold: 10,
        escrowGold: 100,
        logs: [],
      },
    ],
    employees: {
      employee_1: {
        employeeId: "employee_1",
        businessId: "business_food",
        npcId: "npc_worker",
        role: "cook",
        skill: 3,
        wageGoldPerDay: 12,
        morale: 70,
        loyalty: 60,
        hiredAtMs: 1,
        lastPaidAtMs: 1,
      },
    },
    loans: {},
    insurancePolicies: {},
    tradeRoutes: {},
    failures: {},
    marketOrders: {
      order_1: {
        orderId: "order_1",
        kind: "sell",
        businessId: "business_food",
        itemId: "worker_meal",
        count: 2,
        unitPriceGold: 30,
        status: "open",
      },
    },
    towns: {},
    regions: {
      harthmere_grove_region: {
        regionId: "harthmere_grove_region",
        priceIndex: { worker_meal: 20, rare_seed: 7 },
      },
    },
    businessSystems: {
      permissions: {},
      bankAccounts: {},
    },
    balanceWarnings: [],
    ledger: [],
  });
}

describe("live mode systems frontend and SSR surfaces", () => {
  it("SSR-renders house buying and building surfaces without developer copy", () => {
    const html = renderToStaticMarkup(
      <LandTab
        initialStep="plots"
        adapter={
          {
            isHydrated: () => true,
            getOwnedPlotIds: () => ["grove_muckstead_cottage_lot"],
            getPlacedStructureIds: () => [
              "property_grove_muckstead_cottage_lot",
            ],
            getBuildingState: () => ({
              gold: 800,
              inventoryItems: { wood_plank: 12, stone_block: 8 },
              ownedPlotIds: ["grove_muckstead_cottage_lot"],
              placedStructureIds: ["property_grove_muckstead_cottage_lot"],
              completedProperties: {
                property_grove_muckstead_cottage_lot: {
                  propertyId: "property_grove_muckstead_cottage_lot",
                  plotId: "grove_muckstead_cottage_lot",
                  ownerId: "systems_surface_player",
                  use: "home",
                  accessMode: "private",
                  blueprintId: "grove_voxel_cottage_tier_1",
                  tier: 1,
                  condition: 95,
                  createdAtMs: 1,
                  updatedAtMs: 1,
                },
              },
              activeProjects: {},
              buildingProgress: {
                property_grove_muckstead_cottage_lot: 100,
              },
              safeZones: {},
              inWorldMarkers: {},
              storageContainers: {},
              doorLocks: {},
              businesses: {},
            }),
          } as any
        }
      />
    );

    assert.ok(html.includes("Buy Plot"));
    assert.ok(html.includes("Build"));
    assert.ok(html.includes("Manage"));
    assert.ok(html.includes("Choose another area and plot size"));
    assert.ok(html.includes("Harthmere East Estates"));
    assert.ok(html.includes("Additive town"));
    assertPlayerFacing(html);
  });

  it("SSR-renders guild, combat, law, likeability, farming, food, and loot surfaces", () => {
    const guildHtml = renderToStaticMarkup(
      <GuildsTab adapter={{ isHydrated: () => true } as any} />
    );
    assert.ok(guildHtml.includes("Create"));
    assert.ok(guildHtml.includes("Guild"));

    const skillsHtml = renderToStaticMarkup(
      <SkillsTab
        adapter={{
          isHydrated: () => true,
          getSkills: () => [
            {
              id: "combat",
              name: "Combat",
              category: "combat",
              level: 3,
              xp: 180,
              nextLevel: 300,
              title: "Ready",
            },
            {
              id: "farming",
              name: "Farming",
              category: "craft",
              level: 2,
              xp: 80,
              nextLevel: 160,
              title: "Planter",
            },
          ],
        }}
      />
    );
    assert.ok(skillsHtml.includes("Combat"));
    assert.ok(skillsHtml.includes("Farming"));

    const inventoryHtml = renderToStaticMarkup(
      <InventoryTab
        adapter={
          {
            getBackpack: () => ({
              maxSlots: 12,
              usedSlots: 3,
              items: [
                {
                  id: "grilled_meat",
                  label: "Grilled Meat",
                  icon: "🍖",
                  count: 1,
                  category: "consumables",
                  canUse: true,
                  ref: { kind: "item", key: "grilled_meat" },
                },
                {
                  id: "seed_carrot",
                  label: "Carrot Seed",
                  icon: "🥕",
                  count: 3,
                  category: "materials",
                  canMove: true,
                  ref: { kind: "item", key: "seed_carrot" },
                },
              ],
            }),
            getHotbar: () => ({ items: [], selectedIndex: 0 }),
            getEquipment: () => [],
            getCurrencies: () => [
              { id: "gold", name: "Gold", amount: 32, icon: "g" },
            ],
          } as any
        }
      />
    );
    assert.ok(inventoryHtml.includes("Grilled Meat"));
    assert.ok(inventoryHtml.includes("Carrot Seed"));

    const lootHtml = renderToStaticMarkup(
      <LootTab
        adapter={{
          isHydrated: () => true,
          getAvailable: () => [
            {
              id: "drop_1",
              itemName: "Mucker Trophy",
              quantity: 1,
              source: "Muck Bounty",
              quality: "rare",
              at: "just now",
              status: "available",
              dropId: "drop_1",
            },
          ],
          getRecent: () => [],
          claim: () => {},
        }}
      />
    );
    assert.ok(lootHtml.includes("Mucker Trophy"));

    const dailyHtml = renderToStaticMarkup(
      <DailyTodoTab
        adapter={{
          isHydrated: () => true,
          getStreak: () => 1,
          getProgress: () => ({ completed: 2, total: 4 }),
          getTasks: () => [
            {
              id: "talk",
              activityId: "talk_with_neighbor",
              title: "Talk with a neighbor",
              description: "Improve likeability around town.",
              category: "community",
              completed: true,
              claimed: false,
              claimable: true,
              actionLabel: "Claim reward",
              reward: { gold: 2, xp: 8, townCare: "Friendship" },
            },
            {
              id: "food",
              activityId: "eat_something",
              title: "Eat something",
              description: "Keep stamina steady before you wander far.",
              category: "home",
              completed: true,
              claimed: false,
              claimable: true,
              actionLabel: "Claim reward",
              reward: { xp: 5, townCare: "Food habit" },
            },
          ],
          claim: () => {},
        }}
      />
    );
    assert.ok(dailyHtml.includes("Talk with a neighbor"));
    assert.ok(dailyHtml.includes("Eat something"));

    const vitals = biomesUIVitalsDisplayFromLiveStatusForTest(
      {
        className: "Warrior",
        level: 4,
        xp: { current: 20, next: 100 },
        combat: {
          hp: 80,
          maxHp: 100,
          deathState: "alive",
          primaryResource: "mana",
          resource: 30,
          maxResource: 50,
        },
        standing: {
          scopeId: "harthmere",
          likeability: 12,
          legal: -4,
          notoriety: 2,
          notorietyFloor: 0,
        },
      },
      {
        hp: 100,
        maxHp: 100,
        combatState: "alive",
        resourceLabel: "Mana",
        resourceValue: 50,
        resourceMax: 50,
        standing: { likeability: 0, legal: 0, notoriety: 0 },
        gold: 0,
      }
    );
    assert.equal(vitals.standing?.likeability, 12);
    assert.equal(vitals.standing?.legal, -4);

    for (const html of [
      guildHtml,
      skillsHtml,
      inventoryHtml,
      lootHtml,
      dailyHtml,
    ]) {
      assertPlayerFacing(html);
    }
  });

  it("SSR-renders business, auction/market, and active quest guidance surfaces", () => {
    const snapshot = businessSnapshot();
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state: snapshot,
      hydrated: true,
      refresh: async () => snapshot,
      submit: async () => ({ ok: true, economyState: snapshot }),
    });
    const businessHtml = renderToStaticMarkup(
      <HarthmereBusinessInterfacePanel
        adapter={adapter}
        nearbyBusinessId="business_food"
        compact
        initialTab="market"
      />
    );
    assert.ok(
      businessHtml.includes("Marketplace"),
      `business market SSR should include Marketplace, got: ${visibleText(
        businessHtml
      ).slice(0, 300)}`
    );
    assert.ok(
      businessHtml.toLowerCase().includes("worker meal"),
      `business market SSR should include worker meal order copy, got: ${visibleText(
        businessHtml
      ).slice(0, 300)}`
    );

    const bountyMarker = {
      id: "bounty_target",
      label: "Bounty: Elite Mucker",
      x: 55,
      y: 44,
      kind: "objective" as const,
      active: true,
      description: "Marked bounty target in the Muck.",
      worldPosition: [521, 71, -152] as [number, number, number],
    };
    const missionSteps = [
      {
        id: "bounty",
        title: "Find the target",
        objective: "Follow the marker into the Muck.",
        done: false,
      },
    ];
    const trackableQuests = [
      {
        questId: "jobs_board:bounty",
        title: "Bounty: Elite Mucker",
        area: "The Muck",
        status: "active" as const,
        firstMarkerId: "bounty_target",
        reward: "Gold and XP",
      },
    ];
    const mapHtml = renderToStaticMarkup(
      <MapQuestsTab
        adapter={{
          getMarkers: () => [
            bountyMarker,
            {
              id: "player",
              label: "You",
              x: 50,
              y: 40,
              kind: "player",
              worldPosition: [500, 70, -130],
            },
          ],
          getPlayerMarker: () => ({
            id: "player",
            label: "You",
            x: 50,
            y: 40,
            kind: "player",
            worldPosition: [500, 70, -130],
          }),
          getMissionTitle: () => "Bounty: Elite Mucker",
          getMissionSteps: () => missionSteps,
          getTrackableQuests: () => trackableQuests,
          getActiveMapPin: () => ({
            markerId: "bounty_target",
            label: "Bounty: Elite Mucker",
            kind: "objective",
            worldPosition: [521, 71, -152],
            writtenAtMs: 1,
            setAtMs: 1,
          }),
          setActiveMapPin: () => {},
          clearActiveMapPin: () => {},
        }}
      />
    );
    assert.ok(
      mapHtml.includes("Map sections"),
      `map SSR should include the map section nav label, got: ${visibleText(
        mapHtml
      ).slice(0, 300)}`
    );
    assert.equal(
      filterMapMissionStepsForTest(missionSteps, "muck")[0]?.objective,
      "Follow the marker into the Muck."
    );
    assert.equal(
      filterMapTrackableQuestsForTest(trackableQuests, "elite")[0]?.title,
      "Bounty: Elite Mucker"
    );
    assert.equal(
      activeBiomesUIMapPinFromMarkerForTest(bountyMarker)?.markerId,
      "bounty_target"
    );

    assertPlayerFacing(businessHtml);
    assertPlayerFacing(mapHtml);
  });
});
