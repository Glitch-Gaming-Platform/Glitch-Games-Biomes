import assert from "assert";
import {
  harthmereServerCheckLineOfSight,
  registerHarthmereServerVoxelSolidSampler,
} from "../mmo_combat_authority";
import {
  harthmereMainHandWeaponType,
  harthmereOffHandWeaponType,
  harthmereWeaponTypeForEquippedItem,
} from "../harthmere_equipped_weapon_type";

describe("combat hardening fixes (C-2/C-3/C-4)", () => {
  // C-2: incoming line of sight is decided by the server voxel raycast, not a
  // client-supplied payload.
  describe("C-2: server line of sight for incoming NPC attacks", () => {
    afterEach(() => registerHarthmereServerVoxelSolidSampler(undefined));

    it("blocks sight through a solid wall between NPC and player", () => {
      // Wall at x=5 for all y/z.
      registerHarthmereServerVoxelSolidSampler((x) => x === 5);
      const clear = harthmereServerCheckLineOfSight(
        { x: 0, y: 64, z: 0 },
        { x: 4, y: 64, z: 0 }
      );
      assert.equal(clear, true, "no wall between: should see");
      const blocked = harthmereServerCheckLineOfSight(
        { x: 0, y: 64, z: 0 },
        { x: 10, y: 64, z: 0 }
      );
      assert.equal(blocked, false, "wall at x=5 should block sight");
    });

    it("refuses sight beyond the distance cap regardless of terrain", () => {
      registerHarthmereServerVoxelSolidSampler(() => false);
      const farAway = harthmereServerCheckLineOfSight(
        { x: 0, y: 64, z: 0 },
        { x: 400, y: 64, z: 0 }
      );
      assert.equal(farAway, false);
    });
  });

  // C-4: weapon type is derived from the equipped item, not hard-coded.
  describe("C-4: equipped weapon-type resolution", () => {
    it("maps catalogued weapons by subtype", () => {
      assert.equal(
        harthmereWeaponTypeForEquippedItem("harthmere_iron_longsword"),
        "sword"
      );
      assert.equal(
        harthmereWeaponTypeForEquippedItem("ashwood_hunting_bow"),
        "bow"
      );
      assert.equal(
        harthmereWeaponTypeForEquippedItem("apprentices_wand"),
        "wand"
      );
      assert.equal(
        harthmereWeaponTypeForEquippedItem("pilgrim_staff"),
        "staff"
      );
      assert.equal(
        harthmereWeaponTypeForEquippedItem("training_dagger"),
        "dagger"
      );
    });

    it("treats shields and armor as non-weapons", () => {
      assert.equal(
        harthmereWeaponTypeForEquippedItem("oaken_guard_shield"),
        undefined
      );
      assert.equal(
        harthmereWeaponTypeForEquippedItem("militia_chain_hauberk"),
        undefined
      );
    });

    it("falls back to name inference for uncatalogued mirror items", () => {
      assert.equal(harthmereWeaponTypeForEquippedItem("woodsman_axe"), "axe");
      assert.equal(
        harthmereWeaponTypeForEquippedItem("two_handed_sword"),
        "sword"
      );
      assert.equal(harthmereWeaponTypeForEquippedItem("muck_rake"), "axe");
      assert.equal(harthmereWeaponTypeForEquippedItem("repair_mallet"), "mace");
    });

    it("defaults an empty main-hand to unarmed (not the old hard-coded sword)", () => {
      assert.equal(harthmereMainHandWeaponType(undefined), "unarmed");
      assert.equal(harthmereMainHandWeaponType({}), "unarmed");
      assert.equal(
        harthmereMainHandWeaponType({ main_hand: "ashwood_hunting_bow" }),
        "bow"
      );
    });

    it("reports off-hand weapon type or none", () => {
      assert.equal(harthmereOffHandWeaponType({}), "none");
      assert.equal(
        harthmereOffHandWeaponType({ off_hand: "oaken_guard_shield" }),
        "none"
      );
      assert.equal(
        harthmereOffHandWeaponType({ off_hand: "training_dagger" }),
        "dagger"
      );
    });
  });
});
