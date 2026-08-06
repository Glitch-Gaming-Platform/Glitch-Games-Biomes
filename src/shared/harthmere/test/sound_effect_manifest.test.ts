import { HARTHMERE_ABILITY_CATALOG } from "@/shared/harthmere/complete_combat_progression";
import { HARTHMERE_PROJECTILE_VISUALS } from "@/shared/harthmere/projectile_visual_manifest";
import {
  getHarthmereSoundEffect,
  HARTHMERE_ABILITY_SOUND_MAP,
  HARTHMERE_CAMPFIRE_AMBIENCE_RADIUS_METERS,
  HARTHMERE_CAMPFIRE_AMBIENCE_SOUND_ID,
  HARTHMERE_CH1_PORTAL_AMBIENCE_RADIUS_METERS,
  HARTHMERE_CH1_PORTAL_AMBIENCE_SOUND_ID,
  HARTHMERE_OBJECT_INTERACTION_SOUND_MAP,
  HARTHMERE_PROJECTILE_SOUND_MAP,
  HARTHMERE_SOUND_EFFECT_MANIFEST,
  harthmereProximityAmbienceIsAudible,
  shouldPlayHarthmereWaterEntrySplash,
} from "@/shared/harthmere/sound_effect_manifest";
import assert from "assert";

describe("Harthmere sound-effect manifest", () => {
  it("has unique, described, duration-bounded entries", () => {
    const ids = new Set<string>();
    for (const definition of HARTHMERE_SOUND_EFFECT_MANIFEST) {
      assert.ok(!ids.has(definition.id), `duplicate sound id ${definition.id}`);
      ids.add(definition.id);
      assert.ok(definition.label.trim().length > 0, definition.id);
      assert.ok(definition.description.trim().length > 0, definition.id);
      assert.ok(definition.trigger.trim().length > 0, definition.id);
      assert.ok(definition.durationSeconds > 0, definition.id);
      assert.ok(definition.path.length > 0, definition.id);
      if (definition.source === "elevenlabs") {
        assert.ok(definition.prompt, `missing prompt for ${definition.id}`);
        assert.ok(
          definition.prompt.length <= 450,
          `prompt too long for ${definition.id}`
        );
        assert.ok(
          definition.durationSeconds >= 0.05 &&
            definition.durationSeconds <= 30,
          `unsupported ElevenLabs duration for ${definition.id}`
        );
        assert.equal(
          definition.path,
          `/assets/harthmere/audio/sfx/${definition.id}.webm`
        );
      }
    }
  });

  it("keeps pre-existing action sounds out of ElevenLabs generation", () => {
    for (const id of [
      "melee_swing",
      "terrain_break",
      "plant_hit",
      "place_block",
      "fishing_cast",
      "fishing_lure_water",
      "fishing_reel",
      "eat",
      "drink",
      "spoiled_food",
      "craft_success",
      "blueprint_complete",
      "player_warp",
      "splash",
    ]) {
      assert.equal(getHarthmereSoundEffect(id)?.source, "existing", id);
    }
  });

  it("covers every projectile launch and impact", () => {
    for (const projectile of HARTHMERE_PROJECTILE_VISUALS) {
      const sounds = HARTHMERE_PROJECTILE_SOUND_MAP[projectile.id];
      assert.ok(sounds, `missing projectile sound map for ${projectile.id}`);
      assert.ok(getHarthmereSoundEffect(sounds.launch), sounds.launch);
      assert.ok(getHarthmereSoundEffect(sounds.impact), sounds.impact);
    }
  });

  it("covers every complete active ability with an existing, direct, or projectile sound", () => {
    const existingAbilitySounds: Readonly<Record<string, string>> = {
      basic_strike: "melee_swing",
      power_strike: "melee_swing",
      quick_shot: "bow_release",
      aimed_shot: "bow_release_heavy",
      multi_shot: "bow_release_multi",
      hunter_mark: "hunters_mark",
      spark: "spark_launch",
      fireball: "fireball_launch",
      lightning_bolt: "lightning_bolt_launch",
      teleport: "player_warp",
      polymorph: "polymorph_launch",
      holy_light: "holy_light_launch",
      smite: "smite_launch",
      judgment: "judgment_launch",
      consecrate: "consecrate_launch",
      life_drain: "life_drain_launch",
      curse_of_weakness: "curse_of_weakness_launch",
      fear: "fear_launch",
      entangling_roots: "entangling_roots_launch",
      mocking_verse: "mocking_verse_launch",
      charm: "charm_launch",
    };
    for (const ability of Object.values(HARTHMERE_ABILITY_CATALOG)) {
      const soundId =
        HARTHMERE_ABILITY_SOUND_MAP[ability.id] ??
        existingAbilitySounds[ability.id];
      assert.ok(soundId, `missing ability sound for ${ability.id}`);
      assert.ok(
        getHarthmereSoundEffect(soundId),
        `unknown sound ${soundId} for ${ability.id}`
      );
    }
  });

  it("covers every authored object interaction kind", () => {
    for (const kind of [
      "open_container",
      "open_door",
      "open_gate",
      "open_jobs_board",
      "open_wanted_board",
      "read",
      "craft",
      "cook",
      "use",
      "gather",
      "repair",
      "recover",
      "tend",
      "practice",
      "check_outfit",
      "take_photo",
      "inspect",
    ]) {
      const soundId = HARTHMERE_OBJECT_INTERACTION_SOUND_MAP[kind];
      assert.ok(soundId, `missing object interaction sound for ${kind}`);
      assert.ok(getHarthmereSoundEffect(soundId), soundId);
    }
  });

  it("plays one splash on every non-flying transition into swimming", () => {
    assert.equal(
      shouldPlayHarthmereWaterEntrySplash({
        swimming: true,
        wasSwimming: false,
        flying: false,
      }),
      true
    );
    assert.equal(
      shouldPlayHarthmereWaterEntrySplash({
        swimming: true,
        wasSwimming: true,
        flying: false,
      }),
      false
    );
    assert.equal(
      shouldPlayHarthmereWaterEntrySplash({
        swimming: true,
        wasSwimming: false,
        flying: true,
      }),
      false
    );
  });

  it("defines bounded campfire and Chapter 1 portal proximity loops", () => {
    const campfire = getHarthmereSoundEffect(
      HARTHMERE_CAMPFIRE_AMBIENCE_SOUND_ID
    );
    const portal = getHarthmereSoundEffect(
      HARTHMERE_CH1_PORTAL_AMBIENCE_SOUND_ID
    );
    assert.equal(campfire?.source, "existing");
    assert.equal(campfire?.loop, true);
    assert.equal(campfire?.path, "audio/campfire");
    assert.equal(portal?.source, "elevenlabs");
    assert.equal(portal?.loop, true);
    assert.equal(
      harthmereProximityAmbienceIsAudible(
        HARTHMERE_CAMPFIRE_AMBIENCE_RADIUS_METERS,
        HARTHMERE_CAMPFIRE_AMBIENCE_RADIUS_METERS
      ),
      true
    );
    assert.equal(
      harthmereProximityAmbienceIsAudible(
        HARTHMERE_CH1_PORTAL_AMBIENCE_RADIUS_METERS + 0.01,
        HARTHMERE_CH1_PORTAL_AMBIENCE_RADIUS_METERS
      ),
      false
    );
  });
});
