import {
  getHarthmereSoundEffect,
  HARTHMERE_MAGIC_FAMILY_LIFECYCLE_SOUND_MAP,
  HARTHMERE_PROJECTILE_SOUND_MAP,
} from "@/shared/harthmere/sound_effect_manifest";
import {
  HARTHMERE_PROJECTILE_EXPLOSION_AUDIO_PROFILE,
  resolveHarthmereProjectileLifecycleSounds,
} from "@/shared/harthmere/projectile_sound_lifecycle";
import { HARTHMERE_PROJECTILE_VISUALS } from "@/shared/harthmere/projectile_visual_manifest";
import assert from "assert";
import fs from "fs";
import path from "path";

describe("projectile and explosion sound lifecycle", () => {
  it("covers every projectile without replacing existing launch or impact sounds", () => {
    for (const projectile of HARTHMERE_PROJECTILE_VISUALS) {
      const sounds = HARTHMERE_PROJECTILE_SOUND_MAP[projectile.id];
      assert.ok(sounds, `${projectile.id} has no sound mapping`);
      assert.ok(getHarthmereSoundEffect(sounds.launch), sounds.launch);
      assert.ok(getHarthmereSoundEffect(sounds.impact), sounds.impact);
      assert.ok(sounds.flight, `${projectile.id} has no flight sound`);
      assert.ok(getHarthmereSoundEffect(sounds.flight), sounds.flight);
    }
  });

  it("uses arrow and bolt whooshes for physical flights", () => {
    for (const id of [
      "hunter_bow_shot",
      "quick_shot",
      "aimed_shot",
      "multi_shot",
      "bandit_archer_shot",
    ]) {
      assert.equal(HARTHMERE_PROJECTILE_SOUND_MAP[id]?.flight, "arrow_flyby");
    }
    assert.equal(
      HARTHMERE_PROJECTILE_SOUND_MAP.ranged_shot?.flight,
      "bolt_flyby"
    );
  });

  it("uses newly authored lifecycle assets instead of casting or contact sounds", () => {
    for (const projectile of HARTHMERE_PROJECTILE_VISUALS.filter(
      ({ family }) => family !== "physical"
    )) {
      const sounds = HARTHMERE_PROJECTILE_SOUND_MAP[projectile.id]!;
      assert.ok(sounds.flight);
      assert.ok(sounds.explosion, `${projectile.id} has no explosion sound`);
      assert.notEqual(sounds.explosion, sounds.impact, projectile.id);
      assert.equal(
        getHarthmereSoundEffect(sounds.explosion)?.source,
        "elevenlabs",
        projectile.id
      );
      if (projectile.id !== "smoke_bomb_throw") {
        assert.notEqual(sounds.flight, sounds.launch, projectile.id);
        assert.equal(
          getHarthmereSoundEffect(sounds.flight)?.source,
          "elevenlabs",
          projectile.id
        );
      }
    }
  });

  it("uses damage-family lifecycle sounds when bosses reuse another projectile mesh", () => {
    const multiShot = HARTHMERE_PROJECTILE_VISUALS.find(
      ({ id }) => id === "multi_shot"
    )!;
    const helix = HARTHMERE_PROJECTILE_VISUALS.find(
      ({ id }) => id === "helix_projector_beam"
    )!;
    assert.deepEqual(
      resolveHarthmereProjectileLifecycleSounds({
        definition: multiShot,
        damageType: "nature",
      }),
      {
        ...HARTHMERE_PROJECTILE_SOUND_MAP.multi_shot,
        ...HARTHMERE_MAGIC_FAMILY_LIFECYCLE_SOUND_MAP.nature,
        effectiveFamily: "nature",
      }
    );
    assert.equal(
      resolveHarthmereProjectileLifecycleSounds({
        definition: multiShot,
        damageType: "sonic",
      })?.flight,
      "sonic_projectile_flight"
    );
    assert.equal(
      resolveHarthmereProjectileLifecycleSounds({
        definition: helix,
        damageType: "arcane",
      })?.explosion,
      "arcane_explosion"
    );
  });

  it("fits flight and explosion audio to visual duration with an end fade", () => {
    const runtime = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/client/game/renderers/local_dev/harthmere_projectiles.ts"
      ),
      "utf8"
    );
    assert.match(runtime, /emitProjectileLaunchAndFlightSound/);
    assert.match(runtime, /durationSeconds: input\.durationSeconds/);
    assert.match(runtime, /emitProjectileImpactSound/);
    assert.match(runtime, /input\.impact\.kind !== "magic_explosion"/);
    assert.match(runtime, /emitHarthmereSoundEffect\(contactSoundId/);
    assert.match(runtime, /emitHarthmereSoundEffect\(sounds\.explosion/);
    assert.match(runtime, /preloadHarthmereSoundEffect\(sounds\.explosion\)/);
    assert.match(runtime, /fadeOutSeconds/);
    assert.deepEqual(HARTHMERE_PROJECTILE_EXPLOSION_AUDIO_PROFILE, {
      volumeMultiplier: 1.15,
      refDistance: 7,
      maxDistance: 96,
      rolloffFactor: 0.65,
    });
  });

  it("ships desktop and iOS/mobile lifecycle assets in the production image", () => {
    const lifecycleIds = new Set(
      [
        ...Object.values(HARTHMERE_PROJECTILE_SOUND_MAP).flatMap(
          ({ flight, explosion }) => [flight, explosion]
        ),
        ...Object.values(HARTHMERE_MAGIC_FAMILY_LIFECYCLE_SOUND_MAP).flatMap(
          ({ flight, explosion }) => [flight, explosion]
        ),
      ].filter((id): id is string => Boolean(id))
    );
    for (const id of lifecycleIds) {
      const definition = getHarthmereSoundEffect(id);
      assert.ok(definition, id);
      if (definition.source !== "elevenlabs") continue;
      assert.ok(
        fs.existsSync(
          path.join(
            process.cwd(),
            "public/assets/harthmere/audio/sfx",
            `${id}.webm`
          )
        ),
        `${id}.webm`
      );
      assert.ok(
        fs.existsSync(
          path.join(
            process.cwd(),
            "public/assets/harthmere/audio/sfx",
            `${id}.m4a`
          )
        ),
        `${id}.m4a`
      );
    }

    const dockerfile = fs.readFileSync(
      path.join(process.cwd(), "Dockerfile.biomes"),
      "utf8"
    );
    const deployWorkflow = fs.readFileSync(
      path.join(process.cwd(), ".github/workflows/azure-production-deploy.yml"),
      "utf8"
    );
    assert.match(dockerfile, /COPY --chown=nextjs:nodejs public\/assets\//);
    assert.match(deployWorkflow, /include: public\/assets\/\*\*/);
  });
});
