import assert from "assert";
import {
  HARTHMERE_ENERGY_WEAPONS,
  HARTHMERE_ENERGY_WEAPON_VENDOR_ID,
  getHarthmereEnergyWeapon,
  harthmereEnergyWeaponDamageAtDistance,
  harthmereEnergyWeaponDamageMultiplier,
  validateHarthmereEnergyWeaponCatalog,
} from "@/shared/harthmere/energy_weapon_catalog";
import { harthmereBusinessStorefrontListingsForType } from "@/shared/harthmere/harthmere_business_storefront_goods";
import {
  harthmereNativeBiomesIdForItemId,
  harthmereNativeItemIdForBiomesId,
} from "@/shared/harthmere/harthmere_native_item_ids";
import { harthmereNativeItemCombatProfile } from "@/shared/harthmere/harthmere_native_combat";
import { ensureHarthmereProductionCraftingCatalogue } from "@/shared/harthmere/mmo_crafting_catalogue";
import {
  HARTHMERE_TERRAIN_MUTATING_PROJECTILE_VISUAL_IDS,
  getHarthmereProjectileVisual,
} from "@/shared/harthmere/projectile_visual_manifest";
import {
  HARTHMERE_PROJECTILE_SOUND_MAP,
  getHarthmereSoundEffect,
} from "@/shared/harthmere/sound_effect_manifest";

describe("Harthmere security energy weapons", () => {
  it("defines five increasingly powerful, expensive, slower-firing tiers", () => {
    assert.deepEqual(validateHarthmereEnergyWeaponCatalog(), []);
    assert.equal(HARTHMERE_ENERGY_WEAPONS.length, 5);
    assert.deepEqual(
      HARTHMERE_ENERGY_WEAPONS.map(({ priceGold }) => priceGold),
      [5_000, 12_500, 30_000, 75_000, 180_000]
    );
    assert.deepEqual(
      HARTHMERE_ENERGY_WEAPONS.map(({ cooldownMs }) => cooldownMs),
      [5_320, 5_500, 5_950, 6_800, 8_400]
    );
  });

  it("uses smooth per-tier coherence falloff and a bounded overreach zone", () => {
    for (const weapon of HARTHMERE_ENERGY_WEAPONS) {
      assert.equal(harthmereEnergyWeaponDamageMultiplier(weapon, 0), 1);
      assert.ok(
        Math.abs(
          harthmereEnergyWeaponDamageMultiplier(weapon, weapon.effectiveRange) -
            weapon.minimumDamageMultiplier
        ) < 1e-9
      );
      assert.equal(
        harthmereEnergyWeaponDamageMultiplier(weapon, weapon.hardMaxRange),
        weapon.beyondRangeDamageMultiplier
      );
      assert.equal(
        harthmereEnergyWeaponDamageAtDistance(weapon, 0),
        weapon.baseDamage
      );
    }
  });

  it("round-trips every native inventory id and exposes a ranged infinite-energy profile", () => {
    ensureHarthmereProductionCraftingCatalogue();
    for (const weapon of HARTHMERE_ENERGY_WEAPONS) {
      const nativeId = harthmereNativeBiomesIdForItemId(weapon.id);
      assert.ok(nativeId, weapon.id);
      assert.equal(harthmereNativeItemIdForBiomesId(nativeId), weapon.id);
      const profile = harthmereNativeItemCombatProfile({ id: nativeId! });
      assert.equal(profile?.energyWeaponId, weapon.id);
      assert.equal(profile?.kind, "ranged");
      assert.equal(profile?.reach, weapon.hardMaxRange);
      assert.equal(profile?.intervalSecs, weapon.cooldownMs / 1000);
      assert.equal(profile?.manaCost, 0);
      assert.equal(profile?.durabilityCostMs, 0);
    }
  });

  it("sells the guns only through the Security & Defense Contractor storefront", () => {
    const security = harthmereBusinessStorefrontListingsForType(
      HARTHMERE_ENERGY_WEAPON_VENDOR_ID
    ).filter(({ kind }) => kind === "weapon");
    assert.deepEqual(
      security.map(({ itemId, buyPrice }) => [itemId, buyPrice]),
      HARTHMERE_ENERGY_WEAPONS.map(({ id, priceGold }) => [id, priceGold])
    );
    for (const weapon of HARTHMERE_ENERGY_WEAPONS) {
      assert.ok(getHarthmereEnergyWeapon(weapon.id));
    }
  });

  it("resolves authored projectile and ElevenLabs sound identities without Gaia terrain writes", () => {
    const terrainMutations = new Set(
      HARTHMERE_TERRAIN_MUTATING_PROJECTILE_VISUAL_IDS as readonly string[]
    );
    for (const weapon of HARTHMERE_ENERGY_WEAPONS) {
      assert.equal(
        getHarthmereProjectileVisual(weapon.id)?.id,
        weapon.projectileId
      );
      assert.equal(
        HARTHMERE_PROJECTILE_SOUND_MAP[weapon.projectileId]?.launch,
        weapon.fireSoundId
      );
      assert.equal(
        HARTHMERE_PROJECTILE_SOUND_MAP[weapon.projectileId]?.impact,
        weapon.impactSoundId
      );
      assert.ok(getHarthmereSoundEffect(weapon.fireSoundId));
      assert.ok(getHarthmereSoundEffect(weapon.impactSoundId));
      assert.ok(getHarthmereSoundEffect(weapon.specialSoundId));
      assert.equal(terrainMutations.has(weapon.projectileId), false);
    }
  });
});
