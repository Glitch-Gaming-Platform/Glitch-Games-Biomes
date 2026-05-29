import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AbilitiesTab,
  activateBiomesAbilityForTest,
} from "../tabs/AbilitiesTab";
import {
  ClassesTab,
  activateBiomesClassCardForTest,
} from "../tabs/ClassesTab";
import {
  CollectionsTab,
  activateBiomesCollectionEntryForTest,
} from "../tabs/CollectionsTab";
import { SkillsTab } from "../tabs/SkillsTab";

describe("Biomes UI progression tabs", () => {
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
    assert.equal(html.includes("Front-line frame"), false);
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
