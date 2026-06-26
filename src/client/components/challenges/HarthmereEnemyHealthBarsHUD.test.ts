/// <reference types="mocha" />

import assert from "assert";
import { harthmereAttackableActorHealthBarRows } from "@/client/components/challenges/HarthmereUnifiedHUD";

const visibleScreen = {
  x: 640,
  y: 320,
  visible: true,
  depth: 0.4,
};

describe("Harthmere enemy health bars from visible actor snapshots", () => {
  it("shows a health bar for visible muckers when the live health HUD snapshot is missing", () => {
    const rows = harthmereAttackableActorHealthBarRows({
      actorHud: {
        "mucker-13": {
          label: "Gravewood Pale Muckling 13",
          behavior: "hostile",
          attackable: true,
          health: { hp: 13, maxHp: 20 },
          screen: visibleScreen,
        },
      },
      viewportWidth: 1280,
      viewportHeight: 720,
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].key, "actor-mucker-13");
    assert.equal(rows[0].label, "Gravewood Pale Muckling 13");
    assert.equal(rows[0].hp, 13);
    assert.equal(rows[0].maxHp, 20);
  });

  it("shows wildlife health bars even when an ECS NPC type does not mark the animal as explicitly attackable", () => {
    const rows = harthmereAttackableActorHealthBarRows({
      actorHud: {
        "cow-1": {
          label: "Muckmeadow Cow 1",
          socialRole: "wildlife",
          attackable: false,
          health: { hp: 9, maxHp: 10 },
          screen: visibleScreen,
        },
      },
      viewportWidth: 1280,
      viewportHeight: 720,
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].label, "Muckmeadow Cow 1");
    assert.equal(rows[0].hp, 9);
    assert.equal(rows[0].maxHp, 10);
  });

  it("shows hexer health bars from actor labels even when the attackable flag is stale", () => {
    const rows = harthmereAttackableActorHealthBarRows({
      actorHud: {
        "hexer-7": {
          label: "West Breach Hexer 7",
          behavior: "passive",
          attackable: false,
          health: { hp: 5, maxHp: 12 },
          screen: visibleScreen,
        },
      },
      viewportWidth: 1280,
      viewportHeight: 720,
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].label, "West Breach Hexer 7");
    assert.equal(rows[0].hp, 5);
    assert.equal(rows[0].maxHp, 12);
  });

  it("does not duplicate an actor when a live entity health row already covers the same target", () => {
    const rows = harthmereAttackableActorHealthBarRows({
      actorHud: {
        "cow-1": {
          targetId: "b:cow_1",
          label: "Muckmeadow Cow 1",
          socialRole: "wildlife",
          attackable: false,
          health: { hp: 9, maxHp: 10 },
          screen: visibleScreen,
        },
      },
      viewportWidth: 1280,
      viewportHeight: 720,
      excludedLiveTargetIds: ["b:cow_1"],
    });

    assert.equal(rows.length, 0);
  });

  it("keeps passive civilian labels from becoming combat health bars", () => {
    const rows = harthmereAttackableActorHealthBarRows({
      actorHud: {
        shopkeeper: {
          label: "Hingehall Clerk",
          behavior: "merchant",
          socialRole: "merchant",
          attackable: false,
          health: { hp: 10, maxHp: 10 },
          screen: visibleScreen,
        },
      },
      viewportWidth: 1280,
      viewportHeight: 720,
    });

    assert.equal(rows.length, 0);
  });

  it("keeps every visible attackable actor eligible for a health bar", () => {
    const actorHud = Object.fromEntries(
      Array.from({ length: 32 }, (_, index) => [
        `mucker-${index}`,
        {
          label: `Roads Head Mucker ${index}`,
          behavior: "hostile",
          attackable: true,
          health: { hp: 50 + index, maxHp: 100 },
          screen: {
            ...visibleScreen,
            x: 100 + index * 4,
            depth: 0.1 + index / 100,
          },
        },
      ])
    );

    const rows = harthmereAttackableActorHealthBarRows({
      actorHud,
      viewportWidth: 1280,
      viewportHeight: 720,
    });

    assert.equal(rows.length, 32);
  });
});
