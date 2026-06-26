import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AbilitiesTab,
  activateBiomesAbilityForTest,
  chunkBiomesAbilityRowsForTest,
} from "../tabs/AbilitiesTab";
import { BiomesUI } from "../BiomesUI";
import { TAB_DESCRIPTORS, TAB_ORDER } from "../BiomesUITypes";
import { abilityVisibleInBiomesLibraryForTest } from "../adapters/abilityLibraryVisibility";
import {
  DAILY_TODO_RULES,
  dailyTodoProgressForTest,
  dailyTodoTasksFromCareSnapshotForTest,
} from "../adapters/dailyTodoAdapter";
import { harthmereDailyTaskXpReward } from "@/shared/harthmere/mmo_care_loops";
import {
  mergeInventoryAndHotbarForBiomesBackpackForTest,
  mergeMirroredBiomesBackpackUiItemsForTest,
} from "../adapters/inventoryAdapterHelpers";
import { readableMapMarkerLabelForTest } from "../adapters/mapMarkerLabels";
import {
  ClassesTab,
  activateBiomesClassCardForTest,
  activateBiomesSpecializationForTest,
} from "../tabs/ClassesTab";
import {
  CollectionsTab,
  activateBiomesCollectionEntryForTest,
} from "../tabs/CollectionsTab";
import { BankingTab } from "../tabs/BankingTab";
import { InventoryTab } from "../tabs/InventoryTab";
import { DailyTodoTab } from "../tabs/DailyTodoTab";
import {
  LandTab,
  buildingSystemMapMarkerIdForPlotForTest,
  buildingSystemMaterialAvailabilityForStageForTest,
  buildingSystemMaterialSourcePinForTest,
  playerFacingBuildingWarningsForTest,
} from "../tabs/LandTab";
import { LootTab } from "../tabs/LootTab";
import { biomesPlayerSentence, biomesPlayerTitle } from "../playerFacingText";
import {
  MapQuestsTab,
  activeBiomesUIMapPinFromMarkerForTest,
  centeredPanForMapMarkerForTest,
  filterMapMarkersForTest,
  filterMapMissionStepsForTest,
  filterMapTrackableQuestsForTest,
  geographyTerrainFeaturesForMapMarkersForTest,
  mapMarkerForActivePinForTest,
  mapMarkerVisualStateForTest,
  mapPanelTabForMarkerForTest,
  nextMapZoomForWheelForTest,
  shouldRenderMapMarkerLabelForTest,
} from "../tabs/MapQuestsTab";
import { SkillsTab } from "../tabs/SkillsTab";
import { DEFAULT_TAB_SHORTCUTS } from "../shortcuts/BiomesShortcuts";
import { UI_IDS } from "../uniqueIds";
import {
  displayBiomesVitalsBarValueForTest,
  formatBiomesVitalsBarValueForTest,
  formatBiomesGoldForVitalsForTest,
  formatBiomesLevelForVitalsForTest,
} from "../BiomesUIVitalsPanel";
import {
  biomesInventoryItemIcon,
  humanizeBiomesInventoryItemId,
} from "../adapters/inventoryItemPresentation";
import {
  buildFarmingFoodInterfaceModelForTest,
  farmingFoodQuickActionForKey,
} from "../adapters/farmingFoodInterfaceAdapter";
import {
  biomesUIPlayerStatusEndpoint,
  biomesUIPlayerStatusGameplayActiveForTest,
  biomesUIVitalsCombatResourceDisplayForTest,
  biomesUIVitalsDisplayFromLiveStatusForTest,
  biomesUIVitalsStaminaDisplayForTest,
  fetchBiomesUIPlayerStatus,
  formatBiomesResourceLabelForVitalsForTest,
} from "../adapters/playerStatusAdapter";
import { shouldHydrateBiomesUILiveStateForTab } from "../adapters/liveStateHydrationPolicy";
import {
  fetchBuildingSystemState,
  submitBuildingSystemLiveModeAction,
} from "../adapters/useBiomesUILiveAdapters";
import {
  biomesUIActiveMapPinNavigationAidKindForTest,
  biomesUIActiveMapPinNavigationAidSpecForTest,
} from "../adapters/mapPinnedDestination";
import {
  buildingSystemBlueprintById,
  buildingSystemMaterialSourceForSymbol,
  buildingSystemPlotById,
  createBuildingSystemDoorLock,
  createBuildingSystemHomeConsoleMarker,
  createBuildingSystemPropertyRecord,
  createBuildingSystemStorageContainer,
} from "@/shared/harthmere/building_system";

const FORBIDDEN_PLAYER_COPY = [
  "backend",
  "server accepted",
  "server rejected",
  "server-authoritative",
  "read_state",
  "building_state",
  "payload",
  "ECS",
  "entity",
  "ledger",
  "server-authorized",
  "No backend",
];

function assertNoDeveloperCopy(html: string) {
  for (const forbidden of FORBIDDEN_PLAYER_COPY) {
    assert.equal(
      html.toLowerCase().includes(forbidden.toLowerCase()),
      false,
      `Developer copy leaked into BiomesUI: ${forbidden}`
    );
  }
}

function tagForDataAction(html: string, action: string): string {
  return (
    html.match(
      new RegExp(`<button[^>]*data-[^=]+-action="${action}"[^>]*>`)
    )?.[0] ?? ""
  );
}

describe("Biomes UI progression tabs", () => {
  it("lazy-hydrates hidden live state tabs while keeping world guidance eager", () => {
    for (const key of [
      "banking",
      "guild",
      "building",
      "inventoryLoot",
      "progression",
      "daily",
    ] as const) {
      assert.equal(shouldHydrateBiomesUILiveStateForTab(key, null), false);
    }
    assert.equal(
      shouldHydrateBiomesUILiveStateForTab("banking", "banking"),
      true
    );
    assert.equal(shouldHydrateBiomesUILiveStateForTab("guild", "guilds"), true);
    assert.equal(
      shouldHydrateBiomesUILiveStateForTab("building", "land"),
      true
    );
    assert.equal(
      shouldHydrateBiomesUILiveStateForTab("inventoryLoot", "inventory"),
      true
    );
    assert.equal(
      shouldHydrateBiomesUILiveStateForTab("inventoryLoot", "loot"),
      true
    );
    assert.equal(
      shouldHydrateBiomesUILiveStateForTab("progression", "abilities"),
      true
    );
    assert.equal(shouldHydrateBiomesUILiveStateForTab("daily", "daily"), true);
    assert.equal(
      shouldHydrateBiomesUILiveStateForTab("farmingFood", null),
      true
    );
    assert.equal(shouldHydrateBiomesUILiveStateForTab("jobsBoard", null), true);
    assert.equal(shouldHydrateBiomesUILiveStateForTab("quest", null), true);
  });

  it("opens with the daily checklist first", () => {
    assert.equal(TAB_ORDER[0], "daily");
    assert.equal(TAB_DESCRIPTORS.daily.shortcut, "R");
    assert.equal(
      DEFAULT_TAB_SHORTCUTS.some((shortcut) => shortcut.tab === "daily"),
      false
    );
    assert.equal(
      DEFAULT_TAB_SHORTCUTS.some((shortcut) =>
        ["W", "A", "S", "D"].includes(shortcut.label)
      ),
      false
    );
  });

  it("renders DailyTodoTab from live care-loop progress", () => {
    const tasks = dailyTodoTasksFromCareSnapshotForTest({
      streak: 2,
      claimedToday: { check_in: 123 },
      completedToday: { jobs_board: 124 },
    });
    const html = renderToStaticMarkup(
      <DailyTodoTab
        adapter={{
          isHydrated: () => true,
          getTasks: () => tasks,
          getStreak: () => 2,
          getProgress: () => dailyTodoProgressForTest(tasks),
          claim: () => {},
        }}
      />
    );
    assert.ok(html.includes("Today"));
    assert.ok(html.includes("Check in for the day"));
    assert.ok(html.includes("Read the jobs board"));
    assert.ok(html.includes("200 gold"));
    assert.ok(
      html.includes(`${harthmereDailyTaskXpReward({ actorLevel: 1 })} XP`)
    );
    assert.ok(html.includes("Done today"));
    assert.ok(html.includes("Claim reward"));
    assertNoDeveloperCopy(html);
  });

  it("routes daily checklist claims to the adapter", () => {
    const claimed: string[] = [];
    const task = dailyTodoTasksFromCareSnapshotForTest({
      completedToday: { jobs_board: 123 },
    }).find((entry) => entry.activityId === "jobs_board");
    assert.ok(task);
    if (task?.claimable && !task.claimed) {
      claimed.push(task.activityId);
    }
    assert.deepEqual(claimed, ["jobs_board"]);
  });

  it("makes every completed daily task claimable in the Today tab until its reward is claimed", () => {
    const completedToday = Object.fromEntries(
      DAILY_TODO_RULES.map((rule, index) => [rule.activityId, 1_000 + index])
    );
    const tasks = dailyTodoTasksFromCareSnapshotForTest({ completedToday });

    assert.deepEqual(
      tasks.map((task) => ({
        activityId: task.activityId,
        completed: task.completed,
        claimed: task.claimed,
        claimable: task.claimable,
        actionLabel: task.actionLabel,
      })),
      DAILY_TODO_RULES.map((rule) => ({
        activityId: rule.activityId,
        completed: true,
        claimed: false,
        claimable: true,
        actionLabel: "Claim reward",
      }))
    );
  });

  it("shows every claimed daily task as done and no longer needing another action", () => {
    const claimedToday = Object.fromEntries(
      DAILY_TODO_RULES.map((rule, index) => [rule.activityId, 2_000 + index])
    );
    const tasks = dailyTodoTasksFromCareSnapshotForTest({ claimedToday });

    assert.ok(tasks.every((task) => task.completed));
    assert.ok(tasks.every((task) => task.claimed));
    assert.ok(tasks.every((task) => task.claimable));
    assert.ok(tasks.every((task) => task.actionLabel === "Done today"));
  });

  it("keeps daily task rewards locked until the task is done", () => {
    const task = dailyTodoTasksFromCareSnapshotForTest(undefined).find(
      (entry) => entry.activityId === "jobs_board"
    );
    assert.equal(task?.completed, false);
    assert.equal(task?.claimable, false);
    assert.equal(task?.actionLabel, "Do this first");
  });

  it("uses player-facing item names and icons for food and seeds", () => {
    assert.equal(
      humanizeBiomesInventoryItemId("seed_carrot", "seed_carrot"),
      "Carrot Seed"
    );
    assert.ok(
      biomesInventoryItemIcon("seed_carrot").includes(
        "/buckets/biomes-static/asset_data/icons/items/seed_carrot"
      )
    );
    assert.equal(
      humanizeBiomesInventoryItemId("road_ration", "road_ration"),
      "Road Ration"
    );
  });

  it("shows gold as a player-facing HUD stat", () => {
    assert.equal(formatBiomesGoldForVitalsForTest(17.8), "17 gold");
    assert.equal(formatBiomesGoldForVitalsForTest(-5), "0 gold");
    assert.equal(formatBiomesLevelForVitalsForTest(2.9), "Level 2");
    assert.equal(formatBiomesLevelForVitalsForTest(undefined), "Level 1");
  });

  it("does not display a positive stamina bar value as zero", () => {
    assert.equal(displayBiomesVitalsBarValueForTest(0.1), 1);
    assert.equal(displayBiomesVitalsBarValueForTest(17.2), 18);
    assert.equal(displayBiomesVitalsBarValueForTest(0), 0);
    assert.equal(displayBiomesVitalsBarValueForTest(-5), 0);
    assert.equal(
      formatBiomesVitalsBarValueForTest(99.93, { showTenths: true }),
      "99.9"
    );
  });

  it("maps live player status into the vitals HUD display", () => {
    const display = biomesUIVitalsDisplayFromLiveStatusForTest(
      {
        className: "Mage",
        level: 2,
        xp: { current: 250, next: 1000 },
        combat: {
          hp: 44,
          maxHp: 120,
          deathState: "alive",
          primaryResource: "mana",
          resource: 7,
          maxResource: 130,
        },
        standing: {
          likeability: 30,
          legal: -15,
          notoriety: 24,
          notorietyFloor: 0,
        },
        gold: 33,
      },
      {
        hp: 100,
        maxHp: 100,
        combatState: "ready",
        resourceLabel: "Mana",
        resourceValue: 100,
        resourceMax: 100,
        standing: { likeability: 0, legal: 0, notoriety: 0 },
        gold: 0,
      }
    );
    assert.equal(display.hp, 44);
    assert.equal(display.resourceValue, 7);
    assert.equal(display.classLine, "Mage · Level 2");
    assert.equal(display.standing?.likeability, 30);
    assert.equal(display.gold, 33);
  });

  it("uses mana for the combat resource bar when survival stamina is also shown", () => {
    const liveStatus = {
      className: "Warrior",
      level: 1,
      combat: {
        hp: 100,
        maxHp: 100,
        deathState: "alive",
        primaryResource: "stamina",
        resource: 92,
        maxResource: 108,
        resources: { mana: 41, stamina: 92 },
        maxResources: { mana: 120, stamina: 108 },
      },
    };
    const display = biomesUIVitalsDisplayFromLiveStatusForTest(liveStatus, {
      hp: 100,
      maxHp: 100,
      combatState: "ready",
      resourceLabel: "Mana",
      resourceValue: 100,
      resourceMax: 100,
    });

    const resource = biomesUIVitalsCombatResourceDisplayForTest(liveStatus, {
      resourceLabel: display.resourceLabel,
      resourceValue: display.resourceValue,
      resourceMax: display.resourceMax,
    });

    assert.equal(resource.resourceLabel, "Mana");
    assert.equal(resource.resourceValue, 41);
    assert.equal(resource.resourceMax, 120);
  });

  it("uses live server stamina for the survival stamina bar", () => {
    const stamina = biomesUIVitalsStaminaDisplayForTest(
      {
        className: "Warrior",
        level: 1,
        combat: {
          hp: 100,
          maxHp: 100,
          deathState: "alive",
          primaryResource: "stamina",
          resource: 92,
          maxResource: 108,
          resources: { stamina: 73.4 },
          maxResources: { stamina: 108 },
        },
      },
      { staminaValue: 100, staminaMax: 100 }
    );

    assert.equal(stamina.staminaValue, 73.4);
    assert.equal(stamina.staminaMax, 108);
  });

  it("does not let a stale full-health live snapshot override local death vitals", () => {
    const display = biomesUIVitalsDisplayFromLiveStatusForTest(
      {
        className: "Warrior",
        level: 1,
        combat: {
          hp: 100,
          maxHp: 100,
          deathState: "alive",
          primaryResource: "mana",
          resource: 100,
          maxResource: 100,
        },
      },
      {
        hp: 0,
        maxHp: 100,
        combatState: "downed",
        resourceLabel: "Mana",
        resourceValue: 3,
        resourceMax: 100,
      }
    );

    assert.equal(display.hp, 0);
    assert.equal(display.maxHp, 100);
    assert.equal(display.combatState, "downed");
    assert.equal(display.resourceValue, 3);
  });

  it("does not let positive local vitals hide a server-dead live status", () => {
    const display = biomesUIVitalsDisplayFromLiveStatusForTest(
      {
        className: "Warrior",
        level: 1,
        combat: {
          hp: 0,
          maxHp: 100,
          deathState: "dead",
          primaryResource: "stamina",
          resource: 0,
          maxResource: 100,
        },
      },
      {
        hp: 61,
        maxHp: 240,
        combatState: "ready",
        resourceLabel: "Mana",
        resourceValue: 122,
        resourceMax: 122,
      }
    );

    assert.equal(display.hp, 0);
    assert.equal(display.maxHp, 100);
    assert.equal(display.combatState, "dead");
    assert.equal(display.resourceValue, 0);
  });

  it("does not let stale live death status hide a local full-health respawn", () => {
    const display = biomesUIVitalsDisplayFromLiveStatusForTest(
      {
        className: "Warrior",
        level: 1,
        combat: {
          hp: 0,
          maxHp: 100,
          deathState: "dead",
          primaryResource: "mana",
          resource: 0,
          maxResource: 100,
        },
      },
      {
        hp: 100,
        maxHp: 100,
        combatState: "protected_after_respawn",
        resourceLabel: "Mana",
        resourceValue: 122,
        resourceMax: 122,
      }
    );

    assert.equal(display.hp, 100);
    assert.equal(display.maxHp, 100);
    assert.equal(display.combatState, "protected_after_respawn");
    assert.equal(display.resourceValue, 122);
  });

  it("does not let stale live death metadata keep the HUD at full health", () => {
    const display = biomesUIVitalsDisplayFromLiveStatusForTest(
      {
        className: "Warrior",
        level: 1,
        combat: {
          hp: 100,
          maxHp: 100,
          deathState: "downed",
          primaryResource: "mana",
          resource: 100,
          maxResource: 100,
        },
      },
      {
        hp: 0,
        maxHp: 100,
        combatState: "downed",
        resourceLabel: "Mana",
        resourceValue: 0,
        resourceMax: 100,
      }
    );

    assert.equal(display.hp, 0);
    assert.equal(display.combatState, "downed");
    assert.equal(display.resourceValue, 0);
  });

  it("still trusts live status when the live combat state is actually damaged", () => {
    const display = biomesUIVitalsDisplayFromLiveStatusForTest(
      {
        combat: {
          hp: 44,
          maxHp: 100,
          deathState: "alive",
          primaryResource: "mana",
          resource: 18,
          maxResource: 100,
        },
      },
      {
        hp: 100,
        maxHp: 100,
        combatState: "ready",
        resourceLabel: "Mana",
        resourceValue: 100,
        resourceMax: 100,
      }
    );

    assert.equal(display.hp, 44);
    assert.equal(display.resourceValue, 18);
    assert.equal(display.combatState, "alive");
  });

  it("passes the embedded Glitch install id to player status reads", () => {
    assert.equal(
      biomesUIPlayerStatusEndpoint(
        "?install_id=5689c070-ac47-4333-9a12-76c10749cd78"
      ),
      "/api/harthmere/live_mode_player_status_state?install_id=5689c070-ac47-4333-9a12-76c10749cd78"
    );
    assert.equal(
      biomesUIPlayerStatusEndpoint("?installId=install with spaces"),
      "/api/harthmere/live_mode_player_status_state?install_id=install%20with%20spaces"
    );
  });

  it("bypasses HTTP cache for player status reads so HP-zero death states cannot be hidden by 304s", async () => {
    let capturedInit: RequestInit | undefined;
    const status = await fetchBiomesUIPlayerStatus((async (_input, init) => {
      capturedInit = init;
      return new Response(
        JSON.stringify({
          ok: true,
          playerStatusState: {
            combat: { hp: 0, maxHp: 100, deathState: "dead" },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch);

    assert.equal(capturedInit?.cache, "no-store");
    assert.equal(status?.combat?.hp, 0);
    assert.equal(status?.combat?.deathState, "dead");
  });

  it("treats visible Harthmere gameplay as active even when pointer lock is released", () => {
    const previousDocument = (globalThis as any).document;
    try {
      (globalThis as any).document = {
        visibilityState: "visible",
        pointerLockElement: null,
        documentElement: { dataset: {} },
      };
      assert.equal(biomesUIPlayerStatusGameplayActiveForTest(), true);

      (
        globalThis as any
      ).document.documentElement.dataset.harthmereWakeUpActive = "true";
      assert.equal(biomesUIPlayerStatusGameplayActiveForTest(), false);
    } finally {
      if (previousDocument === undefined) {
        delete (globalThis as any).document;
      } else {
        (globalThis as any).document = previousDocument;
      }
    }
  });

  it("formats non-mana class resources for the HUD", () => {
    assert.equal(
      formatBiomesResourceLabelForVitalsForTest("conviction"),
      "Conviction"
    );
    assert.equal(
      formatBiomesResourceLabelForVitalsForTest("shadow_power", "souls"),
      "Souls"
    );
  });

  it("renders ClassesTab from adapter data instead of fallback classes", () => {
    const html = renderToStaticMarkup(
      <ClassesTab
        adapter={{
          isHydrated: () => true,
          getCurrent: () => "merchant_guardian",
          getClasses: () => [
            {
              id: "merchant_guardian",
              name: "Merchant Guardian",
              tagline: "Protects owned businesses, staff, and supply routes.",
              resource: "Resolve",
              roles: ["tank", "support"],
              specializations: ["caravan_guard", "shop_watch"],
            },
          ],
          getSpecialization: () => "caravan_guard",
          hasClassChoice: () => true,
          classChoiceLocked: () => true,
        }}
      />
    );
    assert.ok(html.includes("Merchant Guardian"));
    assert.ok(html.includes("Current Class"));
    assert.ok(html.includes("Selected"));
    assert.ok(html.includes("Caravan Guard"));
    assert.ok(html.includes("requires a respec service"));
    assert.equal(html.includes("Front-line frame"), false);
  });

  it("renders ClassesTab with clear unselected state from adapter data", () => {
    const html = renderToStaticMarkup(
      <ClassesTab
        adapter={{
          isHydrated: () => true,
          getCurrent: () => null,
          getClasses: () => [
            {
              id: "grove_warden",
              name: "Grove Warden",
              tagline: "Keeps paths, neighbors, and harvest routes steady.",
              resource: "Stamina",
              roles: ["tank", "support"],
              specializations: ["path_guard"],
            },
          ],
          hasClassChoice: () => false,
          classChoiceLocked: () => false,
        }}
      />
    );
    assert.ok(html.includes("Grove Warden"));
    assert.ok(html.includes("None selected"));
  });

  it("renders AbilitiesTab from adapter data and exposes learnable state", () => {
    const html = renderToStaticMarkup(
      <AbilitiesTab
        adapter={{
          isHydrated: () => true,
          getEquipped: () => Array(8).fill(null),
          getLibrary: () => [
            {
              id: "business_courier_route_coordination",
              name: "Courier: Route Coordination",
              icon: "B9",
              known: false,
              unlocked: true,
              cooldown: 180,
              cost: 9,
              resource: "Focus",
              description: "Coordinate medicine and package delivery routes.",
            },
          ],
        }}
      />
    );
    assert.ok(html.includes("Courier: Route Coordination"));
    assert.ok(html.includes("Learnable"));
    assert.equal(html.includes("Rift Step"), false);
  });

  it("lays the ability library into readable keyboard rows", () => {
    assert.deepEqual(chunkBiomesAbilityRowsForTest([1, 2, 3, 4, 5, 6, 7], 3), [
      [1, 2, 3],
      [4, 5, 6],
      [7],
    ]);
    assert.deepEqual(chunkBiomesAbilityRowsForTest([1, 2], 0), [[1], [2]]);
  });

  it("hides business abilities until the matching business is actually available", () => {
    assert.equal(
      abilityVisibleInBiomesLibraryForTest({
        id: "business_courier_route_coordination",
        businessTypeId: "courier",
        known: false,
        unlocked: false,
        businessUnlocked: false,
      }),
      false
    );
    assert.equal(
      abilityVisibleInBiomesLibraryForTest({
        id: "business_courier_route_coordination",
        businessTypeId: "courier",
        known: false,
        unlocked: false,
        businessUnlocked: true,
      }),
      true
    );
    assert.equal(
      abilityVisibleInBiomesLibraryForTest({
        id: "power_strike",
        known: true,
        unlocked: true,
      }),
      true
    );
  });

  it("renders SkillsTab from adapter data instead of dummy skill rows", () => {
    const html = renderToStaticMarkup(
      <SkillsTab
        adapter={{
          isHydrated: () => true,
          getSkills: () => [
            {
              id: "business_operations",
              name: "Business Operations",
              category: "Business",
              level: 3,
              xp: 75,
              nextLevel: 400,
              title: "Novice",
            },
          ],
        }}
      />
    );
    assert.ok(html.includes("Business Operations"));
    assert.equal(html.includes("Sword"), false);
  });

  it("merges hotbar-only pickups into the inventory backpack display", () => {
    const stone = {
      item: { id: 101, name: "Muck Crystal", action: "block" },
      count: 1n,
    };
    const berries = {
      item: { id: 102, name: "Glow Berries", action: "food" },
      count: 3n,
    };
    const merged = mergeInventoryAndHotbarForBiomesBackpackForTest(
      [stone],
      [berries]
    );
    assert.equal(merged.length, 2);
    assert.equal(
      merged.some((slot) => slot.item.name === "Glow Berries"),
      true
    );
  });

  it("keeps the larger count when backpack and hotbar mirror the same item", () => {
    const backpack = [{ item: { id: 103, name: "Copper Sprig" }, count: 1n }];
    const hotbar = [{ item: { id: 103, name: "Copper Sprig" }, count: 5n }];
    const merged = mergeInventoryAndHotbarForBiomesBackpackForTest(
      backpack,
      hotbar
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0].count, 5n);
  });

  it("keeps ECS block pickups visible when live inventory also has items", () => {
    const merged = mergeMirroredBiomesBackpackUiItemsForTest(
      [
        {
          id: "iron_longsword",
          label: "Iron Longsword",
          icon: "◼",
          count: 1,
          ref: { kind: "item", idx: 0 },
          source: "backpack",
        },
      ],
      [
        {
          id: "b:7539420629350042",
          label: "Mined Dirt",
          icon: "◼",
          count: 1,
          ref: { kind: "item", idx: 1 },
          source: "backpack",
        },
      ]
    );

    assert.equal(merged.length, 2);
    assert.equal(
      merged.some((item) => item.id === "b:7539420629350042"),
      true
    );
  });

  it("renders live hotbar items in InventoryTab instead of empty quick slots", () => {
    const html = renderToStaticMarkup(
      <InventoryTab
        adapter={{
          getEquipment: () => [],
          getCurrencies: () => [],
          getBackpack: () => ({
            items: [
              {
                id: "muck_crystal",
                label: "Muck Crystal",
                icon: "◼",
                count: 1,
                category: "materials",
                ref: { kind: "item", idx: 0 },
                source: "backpack",
              },
            ],
            maxSlots: 8,
            usedSlots: 1,
            capacityLabel: "ECS inventory",
          }),
          getHotbar: () => ({
            items: [
              null,
              {
                id: "muck_crystal",
                label: "Muck Crystal",
                icon: "◼",
                count: 1,
                category: "materials",
                ref: { kind: "hotbar", idx: 1 },
                source: "hotbar",
              },
            ],
            selectedIndex: 1,
          }),
        }}
      />
    );
    assert.ok(html.includes("Hotbar 2: Muck Crystal"));
    assert.ok(html.includes('data-hotbar-sync-slot="2"'));
    assertNoDeveloperCopy(html);
  });

  it("registers backpack item slots as tutorial highlight targets", () => {
    const html = renderToStaticMarkup(
      <InventoryTab
        adapter={{
          getEquipment: () => [],
          getCurrencies: () => [],
          getBackpack: () => ({
            items: [
              {
                id: "road_ration",
                label: "Road Ration",
                icon: "□",
                count: 2,
                category: "consumables",
                ref: { kind: "item", idx: 0 },
                source: "backpack",
                canUse: true,
                useActionLabel: "Eat",
              },
            ],
            maxSlots: 8,
            usedSlots: 1,
            capacityLabel: "Backpack",
          }),
          getHotbar: () => ({ items: [], selectedIndex: -1 }),
        }}
      />
    );

    assert.ok(
      html.includes(`data-ui-id="${UI_IDS.INVENTORY_ITEM("road_ration")}"`)
    );
    assert.ok(html.includes('aria-label="Road Ration x2"'));
    assert.ok(tagForDataAction(html, "use").length > 0);
    assert.ok(html.includes(">Eat<"));
    assertNoDeveloperCopy(html);
  });

  it("shows material storage and overflow alongside backpack inventory", () => {
    const html = renderToStaticMarkup(
      <InventoryTab
        adapter={{
          getEquipment: () => [],
          getCurrencies: () => [
            { id: "gold", name: "Gold", amount: 0, icon: "◉" },
          ],
          getBackpack: () => ({
            items: [],
            maxSlots: 8,
            usedSlots: 0,
            capacityLabel: "Backpack",
            materialStorage: {
              items: [
                {
                  id: "iron_ore",
                  label: "Iron Ore",
                  icon: "◼",
                  count: 12,
                  category: "materials",
                  storageLocation: "material_storage",
                },
              ],
              maxSlots: 24,
              usedSlots: 1,
            },
            overflow: [
              {
                id: "health_potion_overflow",
                label: "Health Potion",
                icon: "◼",
                count: 1,
                category: "consumables",
                storageLocation: "overflow",
              },
            ],
          }),
          getHotbar: () => ({ items: [], selectedIndex: -1 }),
        }}
      />
    );

    assert.ok(html.includes("Material Storage"));
    assert.ok(html.includes("Iron Ore"));
    assert.ok(html.includes("Overflow"));
    assert.ok(html.includes("Health Potion"));
    assertNoDeveloperCopy(html);
  });

  it("renders farming food state as a compact BiomesUI inventory section", () => {
    const model = buildFarmingFoodInterfaceModelForTest({
      stamina: 44,
      maxStamina: 100,
      inventory: {
        road_ration: 1,
        raw_meat: 1,
        seed_carrot: 1,
        seed_wheat: 1,
        loaf_bread: 1,
        fresh_carrot: 1,
      },
      availableCookingStations: ["campfire", "cookpot"],
      plots: [
        { plotId: "farm_plot_001", ready: true },
        { plotId: "farm_plot_002", ready: false },
      ],
      livestock: [
        {
          livestockId: "cow_001",
          species: "cow",
          productItemId: "fresh_milk",
          productReady: true,
        },
      ],
      wildlife: [{ animalId: "deer_001", species: "deer", harvestable: true }],
      foodSpawns: [{ spawnId: "berries_001", itemId: "wild_berries" }],
      seedSpawns: [{ spawnId: "seed_001", seedItemId: "seed_carrot" }],
      updatedAtMs: 1_000,
    });

    const html = renderToStaticMarkup(
      <InventoryTab
        adapter={{
          getEquipment: () => [],
          getCurrencies: () => [],
          getBackpack: () => ({
            items: [],
            maxSlots: 8,
            usedSlots: 0,
            capacityLabel: "Backpack",
          }),
          getHotbar: () => ({ items: [], selectedIndex: -1 }),
          getFarmingFood: () => model,
        }}
      />
    );

    assert.ok(html.includes("Food &amp; Farm"));
    assert.ok(html.includes("Stamina 44 of 100"));
    assert.ok(tagForDataAction(html, "harvest_plot").length > 0);
    assert.ok(tagForDataAction(html, "hunt_animal").length > 0);
    assert.ok(tagForDataAction(html, "cook_worker_meal").length > 0);
    assert.ok(html.includes("Cook Worker Meal"));
    assert.ok(html.includes("Skin deer"));
    assertNoDeveloperCopy(html);
  });

  it("keeps normal farming food actions available through single-key world dispatch", () => {
    const model = buildFarmingFoodInterfaceModelForTest({
      stamina: 40,
      maxStamina: 100,
      inventory: {
        road_ration: 1,
        raw_meat: 1,
        seed_carrot: 1,
      },
      availableCookingStations: ["campfire"],
      plots: [{ plotId: "farm_plot_001", cropId: "wheat", ready: true }],
      livestock: [
        {
          livestockId: "cow_001",
          species: "cow",
          productItemId: "fresh_milk",
          productReady: true,
        },
      ],
      wildlife: [{ animalId: "deer_001", species: "deer", harvestable: true }],
      foodSpawns: [{ spawnId: "berries_001", itemId: "wild_berries" }],
      seedSpawns: [{ spawnId: "seed_001", seedItemId: "seed_carrot" }],
      updatedAtMs: 1_000,
    });

    assert.equal(
      farmingFoodQuickActionForKey(model, "KeyF")?.id,
      "harvest_plot"
    );
    assert.deepEqual(farmingFoodQuickActionForKey(model, "KeyF")?.payload, {
      plotId: "farm_plot_001",
    });
    assert.deepEqual(
      model.actions.find((action) => action.id === "water_plot")?.payload,
      { plotId: "farm_plot_001" }
    );
    assert.equal(
      farmingFoodQuickActionForKey(model, "KeyR")?.id,
      "eat_best_food"
    );
    assert.equal(
      farmingFoodQuickActionForKey(model, "KeyT")?.id,
      "cook_raw_meat"
    );
  });

  it("requires the right cooking station before exposing richer recipes", () => {
    const fieldOnly = buildFarmingFoodInterfaceModelForTest({
      inventory: {
        loaf_bread: 1,
        fresh_carrot: 1,
      },
      availableCookingStations: ["campfire"],
    });
    const workerMeal = fieldOnly.actions.find(
      (action) => action.id === "cook_worker_meal"
    );
    assert.equal(workerMeal?.disabled, true);
    assert.equal(workerMeal?.blockedReason, "Needs cookpot.");
    assert.equal(farmingFoodQuickActionForKey(fieldOnly, "KeyT"), undefined);

    const cookpot = buildFarmingFoodInterfaceModelForTest({
      inventory: {
        loaf_bread: 1,
        fresh_carrot: 1,
      },
      availableCookingStations: ["cookpot"],
    });
    const cookAction = farmingFoodQuickActionForKey(cookpot, "KeyT");
    assert.equal(cookAction?.id, "cook_worker_meal");
    assert.deepEqual(cookAction?.payload, {
      recipeId: "worker_meal",
      rawItemId: undefined,
      stationKind: "cookpot",
      count: 1,
    });
  });

  it("does not fire world farming food shortcuts before hydration or for disabled work", () => {
    const unhydrated = buildFarmingFoodInterfaceModelForTest(
      {
        inventory: { road_ration: 1 },
        plots: [{ plotId: "farm_plot_001", ready: true }],
      },
      false
    );
    assert.equal(farmingFoodQuickActionForKey(unhydrated, "KeyF"), undefined);

    const empty = buildFarmingFoodInterfaceModelForTest({
      stamina: 12,
      maxStamina: 100,
      inventory: {},
      plots: [],
      livestock: [],
      wildlife: [],
      updatedAtMs: 1_000,
    });
    assert.equal(farmingFoodQuickActionForKey(empty, "KeyF"), undefined);
    assert.equal(farmingFoodQuickActionForKey(empty, "KeyR"), undefined);
    assert.equal(farmingFoodQuickActionForKey(empty, "KeyT"), undefined);
  });

  it("disables destructive actions for protected inventory items", () => {
    const html = renderToStaticMarkup(
      <InventoryTab
        adapter={{
          getEquipment: () => [],
          getCurrencies: () => [],
          getBackpack: () => ({
            items: [],
            maxSlots: 8,
            usedSlots: 0,
            capacityLabel: "Backpack",
          }),
          getHotbar: () => ({ items: [], selectedIndex: -1 }),
          getSelectedItem: () => ({
            id: "quest_charm",
            label: "Quest Charm",
            icon: "◼",
            count: 1,
            quality: "quest",
            category: "quest",
            ref: { kind: "item", idx: 0 },
            source: "backpack",
            canDrop: false,
            canDestroy: false,
            protectedReason: "Quest items stay with your quest pouch.",
          }),
        }}
      />
    );

    assert.ok(tagForDataAction(html, "drop-one").includes("disabled"));
    assert.ok(tagForDataAction(html, "drop-all").includes("disabled"));
    assert.ok(tagForDataAction(html, "destroy").includes("disabled"));
    assert.ok(html.includes("Quest items stay with your quest pouch."));
    assertNoDeveloperCopy(html);
  });

  it("separates available loot from recent loot and shows storage routing", () => {
    const html = renderToStaticMarkup(
      <LootTab
        adapter={{
          isHydrated: () => true,
          getAvailable: () => [
            {
              id: "drop_iron_ore",
              dropId: "drop_1",
              itemName: "Iron Ore",
              quantity: 4,
              source: "Muckwad",
              quality: "common",
              at: "now",
              status: "available",
              route: "Unclaimed",
            },
          ],
          getRecent: () => [
            {
              id: "ledger_iron_ore",
              itemName: "Iron Ore",
              quantity: 4,
              source: "Muckwad",
              quality: "common",
              at: "recent",
              status: "material_storage",
              route: "Material Storage",
            },
          ],
          claim: () => {},
        }}
      />
    );

    assert.ok(html.includes("Available Loot"));
    assert.ok(html.includes("Recent Loot"));
    assert.ok(html.includes("Unclaimed"));
    assert.ok(html.includes("Material Storage"));
    assert.ok(html.includes('data-loot-action="claim"'));
    assertNoDeveloperCopy(html);
  });

  it("keeps common BiomesUI empty states player-facing", () => {
    const html = [
      renderToStaticMarkup(<LandTab />),
      renderToStaticMarkup(
        <LootTab adapter={{ isHydrated: () => true, getRecent: () => [] }} />
      ),
      renderToStaticMarkup(
        <BankingTab adapter={{ isHydrated: () => false }} />
      ),
      renderToStaticMarkup(
        <CollectionsTab
          adapter={{ isHydrated: () => false, getCategories: () => [] }}
        />
      ),
    ].join("\n");

    assert.ok(html.includes("Land Office"));
    assert.ok(html.includes("No new loot yet"));
    assert.ok(html.includes("Checking your vault"));
    assert.ok(html.includes("Finding your collections"));
    assertNoDeveloperCopy(html);
  });

  it("shows completed building access points as player-facing UI", () => {
    const nowMs = 1_800_000_000_000;
    const plot = buildingSystemPlotById("grove_muckstead_cottage_lot")!;
    const blueprint = buildingSystemBlueprintById(
      "grove_voxel_cottage_tier_1"
    )!;
    const property = createBuildingSystemPropertyRecord({
      propertyId: "property_grove_muckstead_cottage_lot",
      ownerId: "player",
      plot,
      blueprint,
      nowMs,
    });
    const storage = createBuildingSystemStorageContainer({
      property,
      plot,
      blueprint,
      nowMs,
    });
    const door = createBuildingSystemDoorLock({
      property,
      plot,
      blueprint,
      nowMs,
    });
    const consoleMarker = createBuildingSystemHomeConsoleMarker({
      property,
      plot,
      blueprint,
      nowMs,
    });
    const html = renderToStaticMarkup(
      <LandTab
        initialStep="property"
        adapter={{
          getBuildingState: () => ({
            gold: 100,
            ownedPlotIds: [plot.plotId],
            safeZones: {
              [plot.plotId]: {
                safeFromMuck: false,
                activatedAtMs: nowMs,
                area: plot.area,
              },
            },
            completedProperties: {
              [property.propertyId]: property,
            },
            inWorldMarkers: {
              [storage.containerId]: {
                markerId: storage.containerId,
                plotId: plot.plotId,
                kind: "storage_container",
                position: storage.position,
                label: "Voxel Cottage Storage",
                createdAtMs: nowMs,
              },
              [door.lockId]: {
                markerId: door.lockId,
                plotId: plot.plotId,
                kind: "door_lock",
                position: door.position,
                label: "Voxel Cottage Door",
                createdAtMs: nowMs,
              },
              [consoleMarker.markerId]: consoleMarker,
            },
            storageContainers: {
              [storage.containerId]: storage,
            },
            doorLocks: {
              [door.lockId]: door,
            },
          }),
        }}
      />
    );
    const visibleText = html.replace(/<[^>]*>/g, " ");

    assert.ok(html.includes('data-building-access-point-summary="production"'));
    assert.ok(html.includes("Front Door"));
    assert.ok(html.includes("Storage Chest"));
    assert.ok(html.includes("Home Console"));
    assert.ok(html.includes("At the front entrance."));
    assert.ok(html.includes("Inside your home."));
    assert.ok(html.includes("Open Door"));
    assert.ok(html.includes("Open Storage"));
    assert.ok(html.includes("Muck deed"));
    assert.ok(html.includes("Terraform Land"));
    assert.equal(visibleText.includes("_"), false, visibleText);
    assertNoDeveloperCopy(html);
  });

  it("shows the full in-progress building path with map id, blueprint visual, animation, and material blockers", () => {
    const nowMs = 1_800_000_000_000;
    const plot = buildingSystemPlotById("grove_muckstead_cottage_lot")!;
    const blueprint = buildingSystemBlueprintById(
      "grove_voxel_cottage_tier_1"
    )!;
    const project = {
      projectId: `project_${plot.plotId}`,
      actorId: "player",
      plotId: plot.plotId,
      blueprintId: blueprint.blueprintId,
      origin: { x: 249, y: 55, z: -197 },
      rotationDegrees: 0,
      currentStage: "site_preparation",
      completedStages: [],
      stageProgress: {},
      startedAtMs: nowMs,
      updatedAtMs: nowMs,
      status: "active",
      materializedStageRequestIds: [],
      storageUnlocked: false,
    };
    const state = {
      gold: 412,
      inventoryItems: {},
      materialStorage: { cloth_scrap: 2 },
      ownedPlotIds: [plot.plotId],
      safeZones: {
        [plot.plotId]: {
          safeFromMuck: true,
          activatedAtMs: nowMs,
          area: plot.area,
        },
      },
      activeProjects: {
        [project.projectId]: project,
      },
      completedProperties: {},
      placedStructureIds: [],
      buildingProgress: {
        [plot.plotId]: 0,
      },
      inWorldMarkers: {},
      storageContainers: {},
      doorLocks: {},
      businesses: {},
    };

    const materialLines = buildingSystemMaterialAvailabilityForStageForTest({
      blueprint,
      stage: "site_preparation",
      project: project as any,
      state,
    });
    assert.equal(materialLines[0].displayName, "Rough Stone");
    assert.equal(materialLines[0].missing, 4);
    assert.equal(
      buildingSystemMapMarkerIdForPlotForTest(plot, true),
      `property:${plot.plotId}`
    );
    assert.deepEqual(
      playerFacingBuildingWarningsForTest({
        ok: true,
        backendMutation: {
          warnings: [
            "client_request_missing_client_sent_time",
            "building_stage_rejected:insufficient_material:1534621126189850",
          ],
        },
      }),
      ["Missing Rough Stone. Bring it in your backpack or material storage."]
    );
    const roughStoneSource = buildingSystemMaterialSourceForSymbol(
      materialLines[0].material
    )!;
    const roughStonePin = buildingSystemMaterialSourcePinForTest(
      materialLines[0],
      roughStoneSource,
      nowMs
    );
    assert.equal(
      roughStonePin.markerId,
      "building_material_source:rough_stone:outpost_tools_cinderlane:business-counter"
    );
    assert.equal(
      roughStonePin.label,
      "Buy rough stone: Cinderlane Tool Forge counter"
    );
    assert.equal(roughStonePin.kind, "store");
    assert.deepEqual(roughStonePin.worldPosition, [1630, 43, -775]);

    const html = renderToStaticMarkup(
      <LandTab
        initialStep="construction"
        adapter={{
          getBuildingState: () => state,
          getOwnedPlotIds: () => [plot.plotId],
        }}
      />
    );

    assert.ok(html.includes('data-blueprint-visual="production"'));
    assert.ok(html.includes('data-building-current-stage="site_preparation"'));
    assert.ok(html.includes('data-building-animate-stage="true"'));
    assert.ok(html.includes('data-building-material-list="production"'));
    assert.ok(html.includes("Missing Rough Stone"));
    assert.ok(html.includes("Find"));
    assert.ok(
      html.includes("Find Rough Stone at Cinderlane Tool Forge counter")
    );
    assert.ok(html.includes("Show property on map"));
    assertNoDeveloperCopy(html);
  });

  it("reads Building System state through the dedicated no-store state route", async () => {
    const previousFetch = globalThis.fetch;
    let capturedInput: RequestInfo | URL | undefined;
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (input, init) => {
      capturedInput = input;
      capturedInit = init;
      return new Response(
        JSON.stringify({
          ok: true,
          buildingState: {
            actorId: "player",
            gold: 75,
            ownedPlotIds: ["grove_muckstead_cottage_lot"],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const state = await fetchBuildingSystemState();
      assert.equal(
        String(capturedInput),
        "/api/harthmere/live_mode_building_state"
      );
      assert.equal(capturedInit?.method, "GET");
      assert.equal(capturedInit?.cache, "no-store");
      assert.deepEqual(state?.ownedPlotIds, ["grove_muckstead_cottage_lot"]);
      const submitted = await submitBuildingSystemLiveModeAction(
        "read_state",
        {}
      );
      assert.equal(
        String(capturedInput),
        "/api/harthmere/live_mode_building_state"
      );
      assert.equal(capturedInit?.method, "GET");
      assert.equal(submitted?.buildingState?.gold, 75);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it("formats raw ids and backend messages before showing them to players", () => {
    assert.equal(biomesPlayerTitle("the_grove"), "The Grove");
    assert.equal(biomesPlayerTitle("general_trader"), "General Trader");
    assert.equal(
      biomesPlayerSentence("Server accepted read_state: building_state"),
      "Done checking your land: land records"
    );
  });

  it("renders MapQuestsTab as a contained tabbed map centered around live data", () => {
    const html = renderToStaticMarkup(
      <MapQuestsTab
        adapter={{
          getMissionTitle: () => "Road Work",
          getMissionSteps: () => [
            {
              id: "step_1",
              title: "Current step 1",
              objective: "Find the board.",
              done: false,
            },
          ],
          getPlayerMarker: () => ({
            id: "local_player",
            label: "You",
            x: 0.8,
            y: 0.2,
            kind: "player",
            worldPosition: [520, 70, -120],
          }),
          getMarkers: () => [
            {
              id: "quest_board",
              label: "Grove Jobs Board",
              x: 0.75,
              y: 0.25,
              kind: "quest",
              active: true,
              worldPosition: [518, 70, -122],
            },
            {
              id: "jackie",
              label: "Jackie",
              x: 0.7,
              y: 0.2,
              kind: "vendor",
              worldPosition: [516, 70, -120],
            },
          ],
          getTrackableQuests: () => [
            {
              questId: "road_work",
              title: "Road Work",
              area: "The Grove",
              status: "active",
              firstMarkerId: "quest_board",
            },
          ],
        }}
      />
    );
    assert.ok(html.includes("Quests"));
    assert.ok(html.includes("People"));
    assert.ok(html.includes("Buildings"));
    assert.ok(html.includes("My Properties"));
    assert.ok(html.includes("Geography"));
    assert.ok(html.includes("Grove Jobs Board"));
    assert.ok(html.includes("Center Player"));
    assert.ok(html.includes("Filter quests"));
    assert.ok(html.includes('aria-label="Filter quests list"'));
  });

  it("filters the active MapQuestsTab list by the selected tab data", () => {
    assert.deepEqual(
      filterMapTrackableQuestsForTest(
        [
          {
            questId: "road_work",
            title: "Road Work",
            area: "The Grove",
            status: "active",
            reward: "25 XP",
          },
          {
            questId: "parcel",
            title: "Kit's Parcel",
            area: "Old Grove Road",
            status: "available",
          },
        ],
        "active grove"
      ).map((quest) => quest.questId),
      ["road_work"]
    );
    assert.deepEqual(
      filterMapMissionStepsForTest(
        [
          {
            id: "step_1",
            title: "Completed step 1",
            objective: "Talk to Jackie",
            done: true,
          },
          {
            id: "step_2",
            title: "Current step 2",
            objective: "Find the board",
            done: false,
          },
        ],
        "current board"
      ).map((step) => step.id),
      ["step_2"]
    );
    assert.deepEqual(
      filterMapMarkersForTest(
        [
          { id: "jackie", label: "Jackie", kind: "vendor", x: 0.2, y: 0.3 },
          { id: "bank", label: "Grove Bank", kind: "bank", x: 0.4, y: 0.5 },
        ],
        "npc jack"
      ).map((marker) => marker.id),
      ["jackie"]
    );
  });

  it("renders an accepted Jackie quest in the BiomesUI quest section", () => {
    const html = renderToStaticMarkup(
      <MapQuestsTab
        adapter={{
          getMissionTitle: () => "Buttons Before the Road",
          getMissionSteps: () => [
            {
              id: "fountain_buttons_first:0",
              title: "Completed step 1",
              objective: "Talk to Jackie",
              done: true,
            },
            {
              id: "fountain_buttons_first:1",
              title: "Current step 2",
              objective: "Find the Jobs Board",
              done: false,
            },
          ],
          getMarkers: () => [
            {
              id: "jackie",
              label: "Jackie",
              x: 0.7,
              y: 0.2,
              kind: "vendor",
              active: true,
              worldPosition: [496, 70, -126],
            },
            {
              id: "harthmere_market_posting_board",
              label: "Grove Jobs Board",
              x: 0.75,
              y: 0.25,
              kind: "objective",
              active: true,
              worldPosition: [502, 71, -132],
            },
          ],
          getTrackableQuests: () => [
            {
              questId: "fountain_buttons_first",
              title: "Buttons Before the Road",
              area: "The Grove",
              status: "active",
              firstMarkerId: "harthmere_market_posting_board",
            },
          ],
        }}
      />
    );

    assert.ok(html.includes("Buttons Before the Road"));
    assert.ok(html.includes("Current step 2"));
    assert.ok(html.includes("Find the Jobs Board"));
    assert.ok(html.includes("active"));
    assert.ok(html.includes("biomes-map-quest-fountain_buttons_first"));
  });

  it("classifies map markers into the expected UX tabs", () => {
    assert.deepEqual(mapPanelTabForMarkerForTest({ kind: "vendor" }), [
      "people",
    ]);
    assert.deepEqual(mapPanelTabForMarkerForTest({ kind: "bank" }), [
      "buildings",
    ]);
    assert.deepEqual(mapPanelTabForMarkerForTest({ kind: "business" }), [
      "buildings",
    ]);
    assert.deepEqual(mapPanelTabForMarkerForTest({ kind: "property" }), [
      "properties",
    ]);
    assert.deepEqual(mapPanelTabForMarkerForTest({ kind: "route" }), [
      "geography",
    ]);
    assert.deepEqual(
      mapPanelTabForMarkerForTest({ kind: "objective", active: true }),
      ["quests"]
    );
  });

  it("computes player-centered map pan for reset and selected markers", () => {
    assert.deepEqual(centeredPanForMapMarkerForTest({ x: 0.8, y: 0.2 }), {
      x: -0.30000000000000004,
      y: 0.3,
    });
    assert.deepEqual(centeredPanForMapMarkerForTest({ x: 0.8, y: 0.2 }, 2), {
      x: -0.6000000000000001,
      y: 0.6,
    });
    const zoomedPan = centeredPanForMapMarkerForTest({ x: 0.93, y: 0.51 }, 2);
    assert.equal(((0.93 - 0.5) * 2 + 0.5 + zoomedPan.x).toFixed(5), "0.50000");
    assert.equal(((0.51 - 0.5) * 2 + 0.5 + zoomedPan.y).toFixed(5), "0.50000");
    assert.deepEqual(centeredPanForMapMarkerForTest({ x: 2, y: -1 }), {
      x: -0.5,
      y: 0.5,
    });
  });

  it("draws the active destination marker above the local player on the map", () => {
    const player = mapMarkerVisualStateForTest({
      id: "local_player",
      kind: "player",
    });
    const pinnedBusiness = mapMarkerVisualStateForTest(
      {
        id: "harthmere_business_outpost_repair_hingehall",
        kind: "business",
      },
      "harthmere_business_outpost_repair_hingehall"
    );

    assert.equal(pinnedBusiness.isPinnedDestination, true);
    assert.equal(pinnedBusiness.isActive, true);
    assert.equal(pinnedBusiness.size, 18);
    assert.ok(pinnedBusiness.zIndex > player.zIndex);
  });

  it("shows readable labels for named NPC and building map markers", () => {
    assert.equal(
      readableMapMarkerLabelForTest({
        id: "npc_gus_the_baker",
        displayName: "Gus the Baker",
      }),
      "Gus the Baker"
    );
    assert.equal(
      readableMapMarkerLabelForTest({ id: "grove_jobs_board" }),
      "Jobs Board"
    );
    assert.equal(
      shouldRenderMapMarkerLabelForTest({ label: "Gus the Baker" }),
      true
    );
    assert.equal(shouldRenderMapMarkerLabelForTest({ label: "   " }), false);
  });

  it("derives geography terrain swatches from live map markers", () => {
    const features = geographyTerrainFeaturesForMapMarkersForTest([
      {
        id: "muck_patch",
        label: "Muckwad Patch",
        kind: "danger",
        x: 0.4,
        y: 0.5,
      },
      {
        id: "bridge",
        label: "Harthmere Bridge Center",
        kind: "route",
        x: 0.7,
        y: 0.3,
      },
      { id: "berries", label: "Berry Patch", kind: "resource", x: 0.2, y: 0.7 },
    ]);

    assert.deepEqual(
      features.map((feature) => feature.kind),
      ["muck", "water", "resource"]
    );
    assert.ok(
      features.every((feature) => feature.width > 0 && feature.height > 0)
    );
  });

  it("computes wheel zoom bounds for the contained map viewport", () => {
    // Finer 12% steps over a wider 0.4..16 range (smoother, deeper zoom).
    assert.equal(nextMapZoomForWheelForTest(2, -120), 2.24);
    assert.equal(nextMapZoomForWheelForTest(2, 120), 1.76);
    assert.equal(nextMapZoomForWheelForTest(20, -120), 16);
    assert.equal(nextMapZoomForWheelForTest(0.1, 120), 0.4);
  });

  it("creates active minimap pins only from map markers with valid world positions", () => {
    assert.deepEqual(
      activeBiomesUIMapPinFromMarkerForTest(
        {
          id: "grove_jobs_board",
          label: "Grove Jobs Board",
          kind: "quest",
          worldPosition: [518, 70, -122],
          description: "Jobs / Quest Board",
        },
        1234
      ),
      {
        markerId: "grove_jobs_board",
        label: "Grove Jobs Board",
        kind: "quest",
        worldPosition: [518, 70, -122],
        description: "Jobs / Quest Board",
        setAtMs: 1234,
      }
    );
    assert.equal(
      activeBiomesUIMapPinFromMarkerForTest({
        id: "missing_position",
        label: "Missing Position",
        kind: "store",
      }),
      undefined
    );
    assert.equal(
      activeBiomesUIMapPinFromMarkerForTest({
        id: "bad_position",
        label: "Bad Position",
        kind: "resource",
        worldPosition: [Number.NaN, 70, -122],
      }),
      undefined
    );
    assert.equal(
      biomesUIActiveMapPinNavigationAidSpecForTest(undefined),
      undefined
    );
    const marker = mapMarkerForActivePinForTest(
      {
        markerId:
          "building_material_source:rough_stone:outpost_tools_cinderlane:business-counter",
        label: "Buy rough stone: Cinderlane Tool Forge counter",
        kind: "store",
        worldPosition: [1630, 43, -775],
        description: "Rough Stone source.",
        setAtMs: 1234,
      },
      { minX: 1500, maxX: 1740, minZ: -850, maxZ: -680 }
    );
    assert.equal(
      marker?.id,
      "building_material_source:rough_stone:outpost_tools_cinderlane:business-counter"
    );
    assert.equal(marker?.kind, "store");
    assert.equal(marker?.active, true);
    assert.deepEqual(marker?.worldPosition, [1630, 43, -775]);
    assert.equal(marker?.x, 130 / 240);
    assert.equal(marker?.y, 75 / 170);
  });

  it("maps active BiomesUI destinations onto differently colored navigation marker families", () => {
    assert.equal(
      biomesUIActiveMapPinNavigationAidKindForTest("objective"),
      "map_pin"
    );
    assert.equal(
      biomesUIActiveMapPinNavigationAidKindForTest("quest"),
      "map_pin"
    );
    assert.equal(
      biomesUIActiveMapPinNavigationAidKindForTest("resource"),
      "map_pin"
    );
    assert.equal(
      biomesUIActiveMapPinNavigationAidKindForTest("safe_zone"),
      "map_pin"
    );
    assert.equal(
      biomesUIActiveMapPinNavigationAidKindForTest("danger"),
      "map_pin"
    );
    assert.equal(
      biomesUIActiveMapPinNavigationAidKindForTest("route"),
      "map_pin"
    );
    assert.equal(
      biomesUIActiveMapPinNavigationAidKindForTest("business"),
      "map_pin"
    );
    assert.equal(
      biomesUIActiveMapPinNavigationAidKindForTest("property"),
      "map_pin"
    );

    const spec = biomesUIActiveMapPinNavigationAidSpecForTest({
      markerId: "grove_jobs_board",
      label: "Grove Jobs Board",
      kind: "quest",
      worldPosition: [518, 70, -122],
      setAtMs: 1234,
    });
    assert.deepEqual(spec, {
      target: {
        kind: "position",
        position: [518, 70, -122],
      },
      kind: "map_pin",
      autoremoveWhenNear: false,
    });
  });

  it("shows the Escape close affordance while the Biomes UI overlay is open", () => {
    const html = renderToStaticMarkup(
      <BiomesUI
        activeTab="map"
        onActiveTabChange={() => {}}
        hotbar={{
          slots: Array(9).fill(null),
          selectedIndex: 0,
          onSelect: () => {},
        }}
      />
    );
    assert.ok(html.includes("Esc"));
    assert.ok(html.includes("Close"));
    assert.ok(html.includes("Close Biomes UI"));
    assert.equal(
      html.includes(`data-ui-id="${UI_IDS.HUD_PROMPT_OPEN_MENU}"`),
      false
    );
    assert.equal(html.includes("Open Menu"), false);
  });

  it("renders CollectionsTab from canonical collection categories", () => {
    const html = renderToStaticMarkup(
      <CollectionsTab
        adapter={{
          isHydrated: () => true,
          getCategories: () => [
            {
              id: "grove_people",
              name: "Grove People",
              entries: [
                {
                  id: "npc:jackie",
                  name: "Jackie",
                  icon: "NP",
                  discovered: true,
                },
              ],
            },
          ],
        }}
      />
    );
    assert.ok(html.includes("Grove People"));
    assert.equal(html.includes("Snapped"), false);
  });

  it("does not discover locked collection entries from direct UI activation", () => {
    const discovered: string[] = [];
    const adapter = { discover: (id: string) => discovered.push(id) };

    activateBiomesCollectionEntryForTest(adapter, "locked", {
      id: "locked",
      name: "Locked Relic",
      icon: "LR",
      discovered: false,
      claimable: false,
    });
    activateBiomesCollectionEntryForTest(adapter, "claimed", {
      id: "claimed",
      name: "Claimed Relic",
      icon: "CR",
      discovered: true,
      claimable: true,
    });
    activateBiomesCollectionEntryForTest(adapter, "ready", {
      id: "ready",
      name: "Ready Relic",
      icon: "RR",
      discovered: false,
      claimable: true,
    });

    assert.deepEqual(discovered, ["ready"]);
  });

  it("renders discovered collection provenance without exposing locked entries", () => {
    const html = renderToStaticMarkup(
      <CollectionsTab
        adapter={{
          isHydrated: () => true,
          getCategories: () => [
            {
              id: "grove_people",
              name: "Grove People",
              entries: [
                {
                  id: "npc:jackie",
                  name: "Jackie",
                  icon: "NP",
                  discovered: true,
                  source: "Grove Jobs Board",
                  discoveredAtMs: Date.UTC(2026, 0, 2),
                },
                {
                  id: "npc:hidden",
                  name: "Hidden",
                  icon: "HD",
                  discovered: false,
                  claimable: false,
                },
              ],
            },
          ],
        }}
      />
    );

    assert.ok(html.includes("found from Grove Jobs Board"));
    assert.ok(html.includes("Undiscovered entry"));
    assert.equal(html.includes("Hidden ready to claim"), false);
    assertNoDeveloperCopy(html);
  });

  it("routes class activation from click or keyboard through choose", () => {
    const chosen: string[] = [];
    activateBiomesClassCardForTest({ choose: (id) => chosen.push(id) }, "mage");
    assert.deepEqual(chosen, ["mage"]);
  });

  it("does not route locked class changes without a respec", () => {
    const chosen: string[] = [];
    activateBiomesClassCardForTest(
      {
        getCurrent: () => "warrior",
        classChoiceLocked: () => true,
        choose: (id) => chosen.push(id),
      },
      "mage"
    );
    assert.deepEqual(chosen, []);
  });

  it("routes specialization activation through the class adapter", () => {
    const selected: string[] = [];
    activateBiomesSpecializationForTest(
      {
        chooseSpecialization: (id) => selected.push(id),
      },
      "protection"
    );
    assert.deepEqual(selected, ["protection"]);
  });

  it("routes ability activation through learn for learnable unknown abilities", () => {
    const learned: string[] = [];
    const assigned: string[] = [];
    activateBiomesAbilityForTest({
      ability: {
        id: "business_courier_route_coordination",
        name: "Courier: Route Coordination",
        icon: "B9",
        known: false,
        unlocked: true,
        cooldown: 180,
        cost: 9,
        resource: "Focus",
        description: "Coordinate package delivery routes.",
      },
      equipped: Array(8).fill(null),
      adapter: {
        learn: (id) => learned.push(id),
        assign: (_slot, id) => assigned.push(id),
      },
    });
    assert.deepEqual(learned, ["business_courier_route_coordination"]);
    assert.deepEqual(assigned, []);
  });

  it("routes known ability activation to the first open loadout slot", () => {
    const assigned: Array<[number, string]> = [];
    activateBiomesAbilityForTest({
      ability: {
        id: "power_strike",
        name: "Power Strike",
        icon: "PS",
        known: true,
        unlocked: true,
        cooldown: 4,
        cost: 18,
        resource: "Stamina",
        description: "Heavy strike.",
      },
      equipped: [
        { id: "basic_strike" } as any,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
      adapter: {
        assign: (slot, id) => assigned.push([slot, id]),
      },
    });
    assert.deepEqual(assigned, [[1, "power_strike"]]);
  });

  it("does not activate locked abilities", () => {
    const calls: string[] = [];
    activateBiomesAbilityForTest({
      ability: {
        id: "locked_business_ability",
        name: "Locked Business Ability",
        icon: "B1",
        known: false,
        unlocked: false,
        cooldown: 60,
        cost: 8,
        resource: "Focus",
        description: "Locked.",
      },
      equipped: Array(8).fill(null),
      adapter: {
        learn: (id) => calls.push(`learn:${id}`),
        assign: (_slot, id) => calls.push(`assign:${id}`),
      },
    });
    assert.deepEqual(calls, []);
  });

  it("routes collection activation from click or keyboard through discover", () => {
    const discovered: string[] = [];
    activateBiomesCollectionEntryForTest(
      { discover: (id) => discovered.push(id) },
      "npc:jackie"
    );
    assert.deepEqual(discovered, ["npc:jackie"]);
  });
});
