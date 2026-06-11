/// <reference types="mocha" />
import { isHarthmereCombatCreatureNpcTypeV1 } from "@/client/components/challenges/dialogueObjectSemantics";
import {
  applyHarthmereDrowningDamageFromSystem,
  applyHarthmereFallDamageFromSystem,
  readHarthmereCombatState,
  resetHarthmereCombat,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import { setHarthmereLocalDevUserScope } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import {
  harthmereLiveModeCombatTargetIdForSeedV1,
  shouldBypassHarthmereKeyboardDrawGateForMousePrimaryAttackV1,
  shouldEngageHarthmereMousePrimaryAttackV1,
} from "@/client/components/challenges/harthmereMousePrimaryAttackRules";
import { fallDamageForBlocksV1 } from "@/shared/game/fall_damage_v1";
import { harthmerePvpPlayersInArcV1 } from "@/client/components/challenges/harthmerePvpHitRules";
import { BikkieIds } from "@/shared/bikkie/ids";
import { HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS_V1 } from "@/shared/harthmere/combat_reach_v1";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }
}

function installHarthmereCombatBrowserShimForTest() {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const dispatchEvent = () => true;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage,
      sessionStorage,
      dispatchEvent,
    },
  });
  if (typeof globalThis.CustomEvent === "undefined") {
    Object.defineProperty(globalThis, "CustomEvent", {
      configurable: true,
      value: class TestCustomEvent<T = unknown> extends Event {
        readonly detail: T | undefined;

        constructor(type: string, init?: CustomEventInit<T>) {
          super(type);
          this.detail = init?.detail;
        }
      },
    });
  }
  return { localStorage, sessionStorage };
}

describe("harthmere left-mouse primary attack routing", () => {
  const engaged = {
    button: 0,
    pointerLocked: true,
    typingTarget: false,
    hasAttackableTargetNearby: true,
  };

  it("engages on a left click in play with a target nearby", () => {
    assert.equal(shouldEngageHarthmereMousePrimaryAttackV1(engaged), true);
  });

  it("ignores non-left buttons (right/middle break placement/camera, never attack)", () => {
    assert.equal(
      shouldEngageHarthmereMousePrimaryAttackV1({ ...engaged, button: 2 }),
      false
    );
    assert.equal(
      shouldEngageHarthmereMousePrimaryAttackV1({ ...engaged, button: 1 }),
      false
    );
  });

  it("does not attack when the pointer is unlocked (player is in HUD/menus)", () => {
    assert.equal(
      shouldEngageHarthmereMousePrimaryAttackV1({
        ...engaged,
        pointerLocked: false,
      }),
      false
    );
  });

  it("engages on a game-canvas click even when pointer lock is unavailable in an embed", () => {
    assert.equal(
      shouldEngageHarthmereMousePrimaryAttackV1({
        ...engaged,
        pointerLocked: false,
        gameplayCanvasTarget: true,
      }),
      true
    );
  });

  it("does not attack when the click originated in a text field", () => {
    assert.equal(
      shouldEngageHarthmereMousePrimaryAttackV1({
        ...engaged,
        typingTarget: true,
      }),
      false
    );
  });

  it("does not engage combat when nothing attackable is in range (pure mining/building click)", () => {
    assert.equal(
      shouldEngageHarthmereMousePrimaryAttackV1({
        ...engaged,
        hasAttackableTargetNearby: false,
      }),
      false
    );
  });

  it("does not let keyboard-only weapon draw state swallow a mouse attack", () => {
    assert.equal(
      shouldBypassHarthmereKeyboardDrawGateForMousePrimaryAttackV1({
        source: "mouse_primary",
        hasPhysicalWeapon: true,
        weaponDrawn: false,
      }),
      true
    );
    assert.equal(
      shouldBypassHarthmereKeyboardDrawGateForMousePrimaryAttackV1({
        source: "keyboard_hotkey",
        hasPhysicalWeapon: true,
        weaponDrawn: false,
      }),
      false
    );
  });

  it("maps production seeded live entities to the combat target id the live backend owns", () => {
    assert.equal(
      harthmereLiveModeCombatTargetIdForSeedV1({
        seedId: "old-wood-mucker-8",
        idOffset: 1308,
      }),
      "server-muck-combat:old-wood-mucker-8:1308"
    );
    assert.equal(
      harthmereLiveModeCombatTargetIdForSeedV1({
        seedId: "",
        idOffset: 1308,
      }),
      undefined
    );
  });
});

describe("harthmere visible player fall damage", () => {
  const storage = installHarthmereCombatBrowserShimForTest();

  beforeEach(() => {
    storage.localStorage.clear();
    storage.sessionStorage.clear();
    setHarthmereLocalDevUserScope("fall-damage-test-user");
    resetHarthmereCombat();
  });

  it("drains the Harthmere combat HP that BiomesUI vitals render", () => {
    const before = readHarthmereCombatState().player;
    const fallBlocks = 20;
    const expectedDamage = Math.max(
      1,
      Math.round(
        (fallDamageForBlocksV1(fallBlocks) * Math.max(1, before.maxHp)) / 100
      )
    );

    applyHarthmereFallDamageFromSystem(fallBlocks);

    const after = readHarthmereCombatState().player;
    assert.equal(after.hp, before.hp - expectedDamage);
    assert.equal(after.combatState, "alert");
  });

  it("ignores falls below the damage threshold", () => {
    const before = readHarthmereCombatState().player;

    applyHarthmereFallDamageFromSystem(4);

    const after = readHarthmereCombatState().player;
    assert.equal(after.hp, before.hp);
    assert.equal(after.combatState, before.combatState);
  });
});

describe("harthmere visible player drowning damage", () => {
  const storage = installHarthmereCombatBrowserShimForTest();

  beforeEach(() => {
    storage.localStorage.clear();
    storage.sessionStorage.clear();
    setHarthmereLocalDevUserScope("drowning-damage-test-user");
    resetHarthmereCombat();
  });

  it("drains the Harthmere combat HP that BiomesUI vitals render", () => {
    const before = readHarthmereCombatState().player;

    applyHarthmereDrowningDamageFromSystem(7);

    const after = readHarthmereCombatState().player;
    assert.equal(after.hp, before.hp - 7);
    assert.equal(after.combatState, "alert");
  });

  it("ignores nonpositive drowning damage", () => {
    const before = readHarthmereCombatState().player;

    applyHarthmereDrowningDamageFromSystem(0);
    applyHarthmereDrowningDamageFromSystem(-5);

    const after = readHarthmereCombatState().player;
    assert.equal(after.hp, before.hp);
    assert.equal(after.combatState, before.combatState);
  });
});

describe("harthmere player-vs-player mouse swing reach", () => {
  it("hits players at voxel interaction reach but not beyond it", () => {
    const targetId = 42 as BiomesId;
    const cosHalfAngle = Math.cos((135 * Math.PI) / 360);
    assert.deepStrictEqual(
      harthmerePvpPlayersInArcV1({
        origin: [0, 0],
        forward: [1, 0],
        players: [
          {
            id: targetId,
            pos: [HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS_V1, 0],
          },
        ],
        range: HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS_V1,
        cosHalfAngle,
      }),
      [targetId]
    );
    assert.deepStrictEqual(
      harthmerePvpPlayersInArcV1({
        origin: [0, 0],
        forward: [1, 0],
        players: [
          {
            id: targetId,
            pos: [HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS_V1 + 0.01, 0],
          },
        ],
        range: HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS_V1,
        cosHalfAngle,
      }),
      []
    );
  });
});

describe("harthmere combat-creature talk gate", () => {
  it("classifies muckers/hexers/wildlife (shared dMucker type) as non-talkable creatures", () => {
    assert.equal(isHarthmereCombatCreatureNpcTypeV1(BikkieIds.dMucker), true);
  });

  it("does not classify other NPC types as combat creatures", () => {
    // An arbitrary non-dMucker npc type id stays talkable.
    assert.equal(
      isHarthmereCombatCreatureNpcTypeV1(123456789 as BiomesId),
      false
    );
  });

  it("treats missing npc type as not-a-creature (so genuine NPCs are never suppressed)", () => {
    assert.equal(isHarthmereCombatCreatureNpcTypeV1(undefined), false);
    assert.equal(isHarthmereCombatCreatureNpcTypeV1(null), false);
  });
});
