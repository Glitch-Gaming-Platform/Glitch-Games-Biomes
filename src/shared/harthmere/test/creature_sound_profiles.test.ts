import { HARTHMERE_BOSS_VISUAL_ASSETS } from "@/shared/harthmere/boss_visual_assets";
import { CH1_DUNGEON_ENCOUNTER_NPCS } from "@/shared/harthmere/ch1_dungeon_encounters";
import {
  HARTHMERE_CREATURE_SOUND_PROFILES,
  harthmereCreatureAttackEventKey,
  harthmereCreatureAttackCadence,
  harthmereCreatureIdleDelayMs,
  harthmereCreatureShouldPlayAttackSound,
  harthmereCreatureSoundEffectId,
  harthmereCreatureSoundProfileForIdentity,
  type HarthmereCreatureSoundPhase,
} from "@/shared/harthmere/creature_sound_profiles";
import { HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS } from "@/shared/harthmere/live_entity_production_seed";
import { HARTHMERE_REMAINING_NPCS } from "@/shared/harthmere/npc_compendium";
import { getHarthmereSoundEffect } from "@/shared/harthmere/sound_effect_manifest";
import assert from "assert";

const PHASES: readonly HarthmereCreatureSoundPhase[] = [
  "idle",
  "attack",
  "hit",
  "death",
];

describe("Harthmere creature sound profiles", () => {
  it("assigns four globally unique manifested sounds to every archetype", () => {
    const profileIds = new Set<string>();
    const soundIds = new Set<string>();
    const paths = new Set<string>();

    for (const profile of HARTHMERE_CREATURE_SOUND_PROFILES) {
      assert.ok(!profileIds.has(profile.id), `duplicate profile ${profile.id}`);
      profileIds.add(profile.id);

      for (const phase of PHASES) {
        const soundId = harthmereCreatureSoundEffectId(profile, phase);
        assert.ok(!soundIds.has(soundId), `duplicate sound ${soundId}`);
        soundIds.add(soundId);

        const sound = getHarthmereSoundEffect(soundId);
        assert.ok(sound, `missing manifested sound ${soundId}`);
        assert.equal(sound.category, "creature", soundId);
        assert.equal(sound.source, "elevenlabs", soundId);
        assert.ok(!paths.has(sound.path), `duplicate audio path ${sound.path}`);
        paths.add(sound.path);
      }
    }

    assert.equal(soundIds.size, HARTHMERE_CREATURE_SOUND_PROFILES.length * 4);
  });

  it("covers every production ECS creature identity", () => {
    for (const seed of HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS) {
      assert.ok(
        harthmereCreatureSoundProfileForIdentity({
          entityId: Number(seed.entityId),
          text: seed.displayName,
        }),
        `${seed.seedId}:${seed.displayName}`
      );
    }
  });

  it("covers every authored boss and Chapter 1 dungeon hostile", () => {
    for (const boss of HARTHMERE_BOSS_VISUAL_ASSETS) {
      assert.ok(
        harthmereCreatureSoundProfileForIdentity({ text: boss.displayName }),
        boss.displayName
      );
    }
    for (const hostile of CH1_DUNGEON_ENCOUNTER_NPCS) {
      assert.ok(
        harthmereCreatureSoundProfileForIdentity({
          entityId: Number(hostile.entityId),
          text: hostile.displayName,
        }),
        hostile.displayName
      );
    }
  });

  it("covers every animal, undead, and forest monster in the compendium", () => {
    const creatureCategories = new Set([
      "animal",
      "undead_type",
      "forest_monster_type",
    ]);
    const creatures = HARTHMERE_REMAINING_NPCS.filter((npc) =>
      creatureCategories.has(npc.category)
    );
    assert.equal(creatures.length, 50);
    for (const creature of creatures) {
      assert.ok(
        harthmereCreatureSoundProfileForIdentity({ text: creature.name }),
        `${creature.category}:${creature.name}`
      );
    }
  });

  it("makes idle timing deterministic and keeps it inside the profile bounds", () => {
    for (const profile of HARTHMERE_CREATURE_SOUND_PROFILES) {
      const delay = harthmereCreatureIdleDelayMs(profile, 12345, 7);
      assert.equal(delay, harthmereCreatureIdleDelayMs(profile, 12345, 7));
      assert.ok(delay >= profile.idleIntervalSeconds[0] * 1000, profile.id);
      assert.ok(delay <= profile.idleIntervalSeconds[1] * 1000, profile.id);
    }
  });

  it("plays attacks periodically instead of on every attack", () => {
    for (const profile of HARTHMERE_CREATURE_SOUND_PROFILES) {
      const cadence = harthmereCreatureAttackCadence(profile, 12345);
      assert.ok(cadence >= profile.attackEvery[0], profile.id);
      assert.ok(cadence <= profile.attackEvery[1], profile.id);
      assert.equal(
        harthmereCreatureShouldPlayAttackSound(profile, 12345, 1),
        true,
        profile.id
      );
      assert.equal(
        harthmereCreatureShouldPlayAttackSound(profile, 12345, 2),
        false,
        profile.id
      );
      assert.equal(
        harthmereCreatureShouldPlayAttackSound(profile, 12345, cadence + 1),
        true,
        profile.id
      );
    }
  });

  it("deduplicates fresh authoritative attack timestamps with a stable key", () => {
    assert.equal(harthmereCreatureAttackEventKey(100, 100.1), 100_000);
    assert.equal(harthmereCreatureAttackEventKey(100, 100.9), 100_000);
    assert.equal(harthmereCreatureAttackEventKey(100, 102.01), undefined);
    assert.equal(harthmereCreatureAttackEventKey(undefined, 100), undefined);
  });
});
