import assert from "assert";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  HARTHMERE_BOSS_MINIMUM_TELEGRAPH_SECS,
  harthmereBossAttackForAbility,
  harthmereBossAttacksForLabel,
  validateHarthmereBossAttackCatalog,
} from "@/shared/harthmere/boss_attack_catalog";
import { getHarthmereBossAttackShapeVisual } from "@/shared/harthmere/boss_attack_shape_visuals";
import { harthmereBossVisualForLabel } from "@/shared/harthmere/boss_visual_assets";
import { harthmereNativeNpcCombatProfileForEntity } from "@/shared/harthmere/harthmere_native_combat_catalog";
import { getHarthmereProjectileVisual } from "@/shared/harthmere/projectile_visual_manifest";
import type { BiomesId } from "@/shared/ids";
import fs from "fs";
import path from "path";

const BOSSES = [
  "Muck-Scarred Helix",
  "The Gilded Bull",
  "The Ninth Winter",
  "The Failed Apprentice",
  "The First Choir",
  "The Echo-Singer",
  "Vyrahel, the Vein-Keeper",
  "Thaedryn the Bellbound",
  "Hex Wraith",
  "Alpha Mucker",
  "The Root-Crowned Dead",
] as const;

const MAGIC_DAMAGE_TYPES = new Set([
  "fire",
  "ice",
  "lightning",
  "holy",
  "dark",
  "arcane",
  "nature",
  "sonic",
  "gravity",
]);

describe("Harthmere boss attack catalog", () => {
  it("gives every requested boss exactly five unique lore attacks including magic", () => {
    const allAbilityIds = new Set<string>();
    for (const boss of BOSSES) {
      const attacks = harthmereBossAttacksForLabel(boss);
      assert.ok(attacks, boss);
      assert.equal(attacks.length, 5, boss);
      assert.equal(new Set(attacks.map(({ abilityId }) => abilityId)).size, 5);
      assert.ok(
        attacks.some(({ damageType }) => MAGIC_DAMAGE_TYPES.has(damageType)),
        `${boss} needs a magical attack`
      );
      assert.ok(
        attacks.every(
          ({ displayName, lore, animationClip, projectileVisualId }) =>
            Boolean(displayName && lore && animationClip && projectileVisualId)
        ),
        `${boss} has incomplete attack presentation`
      );
      for (const attack of attacks) {
        assert.equal(
          allAbilityIds.has(attack.abilityId),
          false,
          attack.abilityId
        );
        allAbilityIds.add(attack.abilityId);
        assert.equal(
          harthmereBossAttackForAbility(boss, attack.abilityId),
          attack
        );
        assert.ok(
          attack.castTimeSecs >=
            HARTHMERE_BOSS_MINIMUM_TELEGRAPH_SECS[attack.attackShape],
          `${boss} ${attack.displayName} needs a readable dodge window`
        );
      }
    }
    assert.equal(allAbilityIds.size, BOSSES.length * 5);
    assert.deepEqual(validateHarthmereBossAttackCatalog(), {
      ok: true,
      failures: [],
    });
  });

  it("gives all 55 attacks an exported body clip and shape-correct graphic", () => {
    let attackCount = 0;
    let bespokeBodyClipCount = 0;
    for (const boss of BOSSES) {
      const attacks = harthmereBossAttacksForLabel(boss);
      const visual = harthmereBossVisualForLabel(boss);
      assert.ok(attacks, boss);
      assert.ok(visual, boss);
      const glb = fs.readFileSync(
        path.join(process.cwd(), "public", visual.assetUrl)
      );
      const jsonLength = glb.readUInt32LE(12);
      const gltf = JSON.parse(
        glb
          .subarray(20, 20 + jsonLength)
          .toString("utf8")
          .replace(/\u0000/g, "")
      ) as { animations?: Array<{ name?: string }> };
      const animationNames = new Set(
        gltf.animations?.map(({ name }) => name).filter(Boolean)
      );
      for (const attack of attacks) {
        attackCount += 1;
        const bodyClip = attack.specialAnimationClip ?? attack.animationClip;
        if (attack.specialAnimationClip) bespokeBodyClipCount += 1;
        assert.ok(
          animationNames.has(bodyClip),
          `${boss} ${attack.displayName} is missing body clip ${bodyClip}`
        );
        assert.ok(
          getHarthmereProjectileVisual(attack.projectileVisualId),
          `${boss} ${attack.displayName} is missing its damage-family graphic`
        );
        if (attack.attackShape !== "projectile") {
          assert.ok(
            getHarthmereBossAttackShapeVisual(attack.attackShape),
            `${boss} ${attack.displayName} is missing its ${attack.attackShape} graphic`
          );
        }
      }
    }
    assert.equal(attackCount, 55);
    assert.equal(bespokeBodyClipCount, 46);
  });

  it("projects label-only legacy boss entities into authoritative native profiles", () => {
    for (const boss of BOSSES) {
      const profile = harthmereNativeNpcCombatProfileForEntity({
        typeId: BikkieIds.dMucker,
        displayName: boss,
        maxHp: 999,
      });
      assert.ok(profile, boss);
      assert.equal(profile.isBoss, true, boss);
      assert.equal(profile.maxHp, 999, boss);
      assert.equal(profile.rangedAttacks?.length, 5, boss);
      assert.deepEqual(
        profile.rangedAttacks?.map(({ abilityId }) => abilityId),
        harthmereBossAttacksForLabel(boss)?.map(({ abilityId }) => abilityId),
        boss
      );
    }
  });

  it("uses stable entity ids when production boss labels are generic", () => {
    const fixedIdBosses = [
      {
        entityId: 8_810_000_000_019_509 as BiomesId,
        displayName: "Old Wood Mucker 1",
        key: "boss_alpha_mucker",
      },
      {
        entityId: 8_810_000_000_019_543 as BiomesId,
        displayName: "Gravewood Pale Hexer 7",
        key: "boss_hex_wraith",
      },
    ] as const;
    for (const expected of fixedIdBosses) {
      const profile = harthmereNativeNpcCombatProfileForEntity({
        entityId: expected.entityId,
        typeId: BikkieIds.dMucker,
        displayName: expected.displayName,
      });
      assert.ok(profile, expected.displayName);
      assert.equal(profile.key, expected.key);
      assert.equal(profile.isBoss, true);
      assert.equal(profile.rangedAttacks?.length, 5);
    }
  });

  it("matches the individual First Choir spirit labels used by encounter actors", () => {
    for (const label of [
      "First Choir Crone",
      "First Choir Stonemason",
      "First Choir Apprentice",
    ]) {
      assert.equal(harthmereBossAttacksForLabel(label)?.length, 5, label);
    }
  });
});
