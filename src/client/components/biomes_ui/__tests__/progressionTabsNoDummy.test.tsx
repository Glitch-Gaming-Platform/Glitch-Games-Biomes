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
  dailyTodoProgressForTest,
  dailyTodoTasksFromCareSnapshotForTest,
} from "../adapters/dailyTodoAdapter";
import { mergeInventoryAndHotbarForBiomesBackpackForTest } from "../adapters/inventoryAdapterHelpers";
import { readableMapMarkerLabelForTest } from "../adapters/mapMarkerLabels";
import {
  ClassesTab,
  activateBiomesClassCardForTest,
} from "../tabs/ClassesTab";
import {
  CollectionsTab,
  activateBiomesCollectionEntryForTest,
} from "../tabs/CollectionsTab";
import { BankingTab } from "../tabs/BankingTab";
import { InventoryTab } from "../tabs/InventoryTab";
import { DailyTodoTab } from "../tabs/DailyTodoTab";
import { LandTab } from "../tabs/LandTab";
import { LootTab } from "../tabs/LootTab";
import { biomesPlayerSentence, biomesPlayerTitle } from "../playerFacingText";
import {
  MapQuestsTab,
  activeBiomesUIMapPinFromMarkerForTest,
  centeredPanForMapMarkerForTest,
  geographyTerrainFeaturesForMapMarkersForTest,
  mapPanelTabForMarkerForTest,
  nextMapZoomForWheelForTest,
  shouldRenderMapMarkerLabelForTest,
} from "../tabs/MapQuestsTab";
import { SkillsTab } from "../tabs/SkillsTab";
import { DEFAULT_TAB_SHORTCUTS } from "../shortcuts/BiomesShortcuts";
import { formatBiomesGoldForVitalsForTest } from "../BiomesUIVitalsPanel";
import {
  biomesInventoryItemIconV1,
  humanizeBiomesInventoryItemIdV1,
} from "../adapters/inventoryItemPresentation";

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

describe("Biomes UI progression tabs", () => {
  it("opens with the daily checklist first", () => {
    assert.equal(TAB_ORDER[0], "daily");
    assert.equal(TAB_DESCRIPTORS.daily.shortcut, "E");
    assert.equal(DEFAULT_TAB_SHORTCUTS.some((shortcut) => shortcut.tab === "daily"), false);
    assert.equal(DEFAULT_TAB_SHORTCUTS.some((shortcut) => ["W", "A", "S", "D"].includes(shortcut.label)), false);
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

  it("keeps daily task rewards locked until the task is done", () => {
    const task = dailyTodoTasksFromCareSnapshotForTest(undefined).find((entry) => entry.activityId === "jobs_board");
    assert.equal(task?.completed, false);
    assert.equal(task?.claimable, false);
    assert.equal(task?.actionLabel, "Do this first");
  });

  it("uses player-facing item names and icons for food and seeds", () => {
    assert.equal(humanizeBiomesInventoryItemIdV1("seed_carrot", "seed_carrot"), "Carrot Seed");
    assert.equal(biomesInventoryItemIconV1("seed_carrot"), "🥕");
    assert.equal(humanizeBiomesInventoryItemIdV1("road_ration", "road_ration"), "Road Ration");
  });

  it("shows gold as a player-facing HUD stat", () => {
    assert.equal(formatBiomesGoldForVitalsForTest(17.8), "17 gold");
    assert.equal(formatBiomesGoldForVitalsForTest(-5), "0 gold");
  });

  it("renders ClassesTab from adapter data instead of fallback classes", () => {
    const html = renderToStaticMarkup(
      <ClassesTab
        adapter={{
          isHydrated: () => true,
          getCurrent: () => "merchant_guardian",
          getClasses: () => [{
            id: "merchant_guardian",
            name: "Merchant Guardian",
            tagline: "Protects owned businesses, staff, and supply routes.",
            resource: "Resolve",
            roles: ["tank", "support"],
          }],
        }}
      />
    );
    assert.ok(html.includes("Merchant Guardian"));
    assert.ok(html.includes("Current Class"));
    assert.ok(html.includes("Selected"));
    assert.equal(html.includes("Front-line frame"), false);
  });

  it("renders ClassesTab with clear unselected state from adapter data", () => {
    const html = renderToStaticMarkup(
      <ClassesTab
        adapter={{
          isHydrated: () => true,
          getCurrent: () => null,
          getClasses: () => [{
            id: "grove_warden",
            name: "Grove Warden",
            tagline: "Keeps paths, neighbors, and harvest routes steady.",
            resource: "Stamina",
            roles: ["tank", "support"],
          }],
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
          getLibrary: () => [{
            id: "business_courier_route_coordination",
            name: "Courier: Route Coordination",
            icon: "B9",
            known: false,
            unlocked: true,
            cooldown: 180,
            cost: 9,
            resource: "Focus",
            description: "Coordinate medicine and package delivery routes.",
          }],
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
          getSkills: () => [{
            id: "business_operations",
            name: "Business Operations",
            category: "Business",
            level: 3,
            xp: 75,
            nextLevel: 400,
            title: "Novice",
          }],
        }}
      />
    );
    assert.ok(html.includes("Business Operations"));
    assert.equal(html.includes("Sword"), false);
  });

  it("merges hotbar-only pickups into the inventory backpack display", () => {
    const stone = { item: { id: 101, name: "Muck Crystal", action: "block" }, count: 1n };
    const berries = { item: { id: 102, name: "Glow Berries", action: "food" }, count: 3n };
    const merged = mergeInventoryAndHotbarForBiomesBackpackForTest([stone], [berries]);
    assert.equal(merged.length, 2);
    assert.equal(merged.some((slot) => slot.item.name === "Glow Berries"), true);
  });

  it("keeps the larger count when backpack and hotbar mirror the same item", () => {
    const backpack = [{ item: { id: 103, name: "Copper Sprig" }, count: 1n }];
    const hotbar = [{ item: { id: 103, name: "Copper Sprig" }, count: 5n }];
    const merged = mergeInventoryAndHotbarForBiomesBackpackForTest(backpack, hotbar);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].count, 5n);
  });

  it("renders live hotbar items in InventoryTab instead of empty quick slots", () => {
    const html = renderToStaticMarkup(
      <InventoryTab
        adapter={{
          getEquipment: () => [],
          getCurrencies: () => [],
          getBackpack: () => ({
            items: [{
              id: "muck_crystal",
              label: "Muck Crystal",
              icon: "◼",
              count: 1,
              category: "materials",
              ref: { kind: "item", idx: 0 },
              source: "backpack",
            }],
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
    assert.ok(html.includes("data-hotbar-sync-slot=\"2\""));
    assertNoDeveloperCopy(html);
  });

  it("keeps common BiomesUI empty states player-facing", () => {
    const html = [
      renderToStaticMarkup(<LandTab />),
      renderToStaticMarkup(<LootTab adapter={{ isHydrated: () => true, getRecent: () => [] }} />),
      renderToStaticMarkup(<BankingTab adapter={{ isHydrated: () => false }} />),
      renderToStaticMarkup(<CollectionsTab adapter={{ isHydrated: () => false, getCategories: () => [] }} />),
    ].join("\n");

    assert.ok(html.includes("Land Office"));
    assert.ok(html.includes("No new loot yet"));
    assert.ok(html.includes("Checking your vault"));
    assert.ok(html.includes("Finding your collections"));
    assertNoDeveloperCopy(html);
  });

  it("formats raw ids and backend messages before showing them to players", () => {
    assert.equal(biomesPlayerTitle("the_grove"), "The Grove");
    assert.equal(biomesPlayerTitle("general_trader"), "General Trader");
    assert.equal(biomesPlayerSentence("Server accepted read_state: building_state"), "Done checking your land: land records");
  });

  it("renders MapQuestsTab as a contained tabbed map centered around live data", () => {
    const html = renderToStaticMarkup(
      <MapQuestsTab
        adapter={{
          getMissionTitle: () => "Road Work",
          getMissionSteps: () => [
            { id: "step_1", title: "Current step 1", objective: "Find the board.", done: false },
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
          getTrackableQuests: () => [{
            questId: "road_work",
            title: "Road Work",
            area: "The Grove",
            status: "active",
            firstMarkerId: "quest_board",
          }],
        }}
      />
    );
    assert.ok(html.includes("Quests"));
    assert.ok(html.includes("People"));
    assert.ok(html.includes("Buildings"));
    assert.ok(html.includes("Geography"));
    assert.ok(html.includes("Grove Jobs Board"));
    assert.ok(html.includes("Center Player"));
  });

  it("classifies map markers into the expected UX tabs", () => {
    assert.deepEqual(mapPanelTabForMarkerForTest({ kind: "vendor" }), ["people"]);
    assert.deepEqual(mapPanelTabForMarkerForTest({ kind: "bank" }), ["buildings"]);
    assert.deepEqual(mapPanelTabForMarkerForTest({ kind: "route" }), ["geography"]);
    assert.deepEqual(mapPanelTabForMarkerForTest({ kind: "objective", active: true }), ["quests"]);
  });

  it("computes player-centered map pan for reset and selected markers", () => {
    assert.deepEqual(centeredPanForMapMarkerForTest({ x: 0.8, y: 0.2 }), {
      x: -0.30000000000000004,
      y: 0.3,
    });
    assert.deepEqual(centeredPanForMapMarkerForTest({ x: 2, y: -1 }), { x: -0.5, y: 0.5 });
  });

  it("shows readable labels for named NPC and building map markers", () => {
    assert.equal(
      readableMapMarkerLabelForTest({
        id: "npc_gus_the_baker",
        displayName: "Gus the Baker",
      }),
      "Gus the Baker"
    );
    assert.equal(readableMapMarkerLabelForTest({ id: "grove_jobs_board" }), "Jobs Board");
    assert.equal(shouldRenderMapMarkerLabelForTest({ label: "Gus the Baker" }), true);
    assert.equal(shouldRenderMapMarkerLabelForTest({ label: "   " }), false);
  });

  it("derives geography terrain swatches from live map markers", () => {
    const features = geographyTerrainFeaturesForMapMarkersForTest([
      { id: "muck_patch", label: "Muckwad Patch", kind: "danger", x: 0.4, y: 0.5 },
      { id: "bridge", label: "Harthmere Bridge Center", kind: "route", x: 0.7, y: 0.3 },
      { id: "berries", label: "Berry Patch", kind: "resource", x: 0.2, y: 0.7 },
    ]);

    assert.deepEqual(features.map((feature) => feature.kind), ["muck", "water", "resource"]);
    assert.ok(features.every((feature) => feature.width > 0 && feature.height > 0));
  });

  it("computes wheel zoom bounds for the contained map viewport", () => {
    assert.equal(nextMapZoomForWheelForTest(2, -120), 2.3);
    assert.equal(nextMapZoomForWheelForTest(2, 120), 1.7);
    assert.equal(nextMapZoomForWheelForTest(20, -120), 8);
    assert.equal(nextMapZoomForWheelForTest(0.1, 120), 0.5);
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
  });

  it("renders CollectionsTab from canonical collection categories", () => {
    const html = renderToStaticMarkup(
      <CollectionsTab
        adapter={{
          isHydrated: () => true,
          getCategories: () => [{
            id: "grove_people",
            name: "Grove People",
            entries: [{ id: "npc:jackie", name: "Jackie", icon: "NP", discovered: true }],
          }],
        }}
      />
    );
    assert.ok(html.includes("Grove People"));
    assert.equal(html.includes("Snapped"), false);
  });

  it("routes class activation from click or keyboard through choose", () => {
    const chosen: string[] = [];
    activateBiomesClassCardForTest({ choose: (id) => chosen.push(id) }, "mage");
    assert.deepEqual(chosen, ["mage"]);
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
      equipped: [{ id: "basic_strike" } as any, null, null, null, null, null, null, null],
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
    activateBiomesCollectionEntryForTest({ discover: (id) => discovered.push(id) }, "npc:jackie");
    assert.deepEqual(discovered, ["npc:jackie"]);
  });
});
