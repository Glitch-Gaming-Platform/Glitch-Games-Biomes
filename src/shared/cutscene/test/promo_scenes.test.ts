/// <reference types="mocha" />
/// <reference types="node" />
//
// Promo stills are the one cutscene class whose output can only be judged in a
// browser with a GPU. That makes everything ELSE about them worth checking
// here, so a broken still fails in 1 second instead of after a stack boot.

import assert from "assert";
import fs from "fs";
import path from "path";
import {
  CH1_DUNGEON_SECTOR_PROOFS,
  HARTHMERE_BOSS_PROMO_SPECS,
  PROMO_SCENES,
  harthmereBossPromoAssetUrl,
  isHarthmereBossPromoGhostAsset,
  promoBatchCaptureAuthUrl,
  promoCaptureAt,
  promoCaptureAuthUrl,
  promoCaptureUrl,
  promoSceneById,
  promoSceneWithBossCameraPreset,
  promoSceneWithRecommendedBossCamera,
  promoScenesInGroup,
  validatePromoScenes,
} from "../promo_scenes";
import { validateCutsceneDef } from "../schema";
import { HARTHMERE_BOSS_VISUAL_ASSETS } from "@/shared/harthmere/boss_visual_assets";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

describe("promo scenes - registry", () => {
  it("passes structural validation", async () => {
    assert.deepEqual(await validatePromoScenes(), []);
  });

  it("registers the dungeon portal still", () => {
    const scene = promoSceneById("dungeon-portal");
    assert.ok(scene, "the dungeon portal promo still is not registered");
    assert.equal(scene!.brand.title, "Biomes");
    assert.equal(scene!.brand.headline, "Biomes");
    assert.equal(scene!.filename, "biomes-gate-traversal.png");
  });

  it("builds a valid cutscene for every registered still", async () => {
    for (const scene of PROMO_SCENES) {
      const def = await scene.build();
      const result = validateCutsceneDef(def);
      assert.ok(
        result.ok,
        `${scene.id}: ${
          result.ok
            ? ""
            : result.issues.map((i) => `${i.path}: ${i.message}`).join("; ")
        }`
      );
      for (const member of def.cast) {
        if (member.binding.kind !== "ghost") {
          continue;
        }
        assert.ok(
          scene.groups?.includes("boss-marketing") &&
            member.binding.family === "quest_creature" &&
            isHarthmereBossPromoGhostAsset(member.binding.asset),
          `${scene.id}: only canonical world-scale boss puppets may use promo ghosts`
        );
      }
    }
  });

  it("registers all eleven Harthmere bosses as one warm marketing batch", async () => {
    const scenes = promoScenesInGroup("boss-marketing");
    assert.equal(HARTHMERE_BOSS_PROMO_SPECS.length, 11);
    assert.equal(scenes.length, 11);
    assert.equal(new Set(scenes.map((scene) => scene.id)).size, 11);
    assert.equal(new Set(scenes.map((scene) => scene.filename)).size, 11);

    for (const [index, scene] of scenes.entries()) {
      const spec = HARTHMERE_BOSS_PROMO_SPECS[index]!;
      const def = await scene.build();
      const boss = def.cast.find((member) => member.binding.kind === "ghost");
      assert.ok(boss, `${scene.id}: missing cinematic boss puppet`);
      assert.equal(boss!.binding.kind, "ghost");
      if (boss!.binding.kind === "ghost") {
        assert.equal(boss!.binding.asset, harthmereBossPromoAssetUrl(spec.id));
        assert.equal(boss!.binding.family, "quest_creature");
        assert.deepEqual(boss!.binding.spawnAt, spec.stage);
      }
      assert.deepEqual(scene.observer.position, spec.cameraFar);
      assert.equal(
        scene.streamingFocus,
        undefined,
        `${scene.id}: boss capture must keep the already-bootstrapped camera interest set instead of reconnecting at the actor stage`
      );
      assert.deepEqual(scene.terrainProofs, spec.terrainProofs);
      assert.ok(scene.terrainView, `${scene.id}: missing camera view corridor`);
      assert.equal(scene.terrainView?.verticalFov, spec.fov);
      assert.deepEqual(scene.terrainView?.camera, spec.cameraFar);
      assert.ok(scene.filename.endsWith(`${spec.id.replaceAll("_", "-")}.png`));
    }
  });

  it("keeps Underways boss staging in the running stack's unshifted authored space", () => {
    const expectedX: Readonly<
      Partial<Record<(typeof HARTHMERE_BOSS_PROMO_SPECS)[number]["id"], number>>
    > = {
      failed_apprentice: 354,
      first_choir: 356,
      echo_singer: 632,
      vyrahel_vein_keeper: 642,
      thaedryn_bellbound: 640,
    };
    for (const spec of HARTHMERE_BOSS_PROMO_SPECS) {
      const x = expectedX[spec.id];
      if (x !== undefined) {
        assert.equal(
          spec.stage[0],
          x,
          `${spec.id}: do not apply the optional +1600 town offset when the capture stack disables it`
        );
      }
    }
  });

  it("requires multi-shard native terrain proofs for ordinary-map boss landscapes", () => {
    for (const id of [
      "muck_scarred_helix",
      "hex_wraith",
      "alpha_mucker",
      "root_crowned_dead",
    ] as const) {
      const spec = HARTHMERE_BOSS_PROMO_SPECS.find(
        (candidate) => candidate.id === id
      );
      assert.ok(spec?.terrainProofs && spec.terrainProofs.length >= 5, id);
    }
  });

  it("keeps every boss camera outside the authored body and captures before combat motion", async () => {
    const scenes = promoScenesInGroup("boss-marketing");
    for (const [index, spec] of HARTHMERE_BOSS_PROMO_SPECS.entries()) {
      const visual = HARTHMERE_BOSS_VISUAL_ASSETS.find(
        (candidate) => candidate.id === spec.id
      );
      assert.ok(visual, `${spec.id}: missing boss visual bounds`);
      const distance = Math.hypot(
        spec.cameraNear[0] - spec.stage[0],
        spec.cameraNear[1] - spec.stage[1],
        spec.cameraNear[2] - spec.stage[2]
      );
      const bodyRadius = Math.hypot(...visual!.worldSize) / 2;
      assert.ok(
        distance > bodyRadius * 1.35,
        `${spec.id}: near camera intersects the authored boss envelope`
      );

      const scene = scenes[index]!;
      const def = await scene.build();
      const teleport = def.shots[0]!.actions.find(
        (action) => action.kind === "teleport"
      );
      assert.equal(
        teleport?.kind === "teleport" ? teleport.faceYaw : undefined,
        spec.yaw,
        `${spec.id}: turntable-selected yaw must reach the puppet`
      );
      assert.equal(
        def.shots[0]!.actions.some((action) => action.kind === "face"),
        false,
        `${spec.id}: generic auto-facing must not overwrite the authored angle`
      );
      const emote = def.shots[0]!.actions.find(
        (action) => action.kind === "emote"
      );
      assert.ok(
        emote?.kind === "emote" && emote.at > scene.captureAt,
        `${spec.id}: combat animation must begin after the marketing still`
      );
    }
  });

  it("builds deterministic boss camera presets through the same registry path", async () => {
    const base = promoSceneById("boss-gilded-bull")!;
    const left = promoSceneWithBossCameraPreset(base, "three-quarter-left");
    const repeated = promoSceneWithBossCameraPreset(base, "three-quarter-left");
    assert.equal(left.id, base.id);
    assert.equal(left.cameraPreset, "three-quarter-left");
    assert.deepEqual(left.observer, repeated.observer);
    assert.notDeepEqual(left.observer.position, base.observer.position);
    const definition = await left.build();
    const shot = definition.shots[0]!;
    assert.equal(shot.camera.kind, "dolly");
    if (shot.camera.kind === "dolly") {
      assert.deepEqual(
        shot.camera.waypoints[0]!.position,
        left.observer.position
      );
    }
    const fov = shot.actions.find((action) => action.kind === "fov");
    assert.equal(fov?.kind === "fov" ? fov.fov : undefined, 35);
  });

  it("applies the logged first-attempt camera to a warm boss batch", () => {
    const base = promoSceneById("boss-muck-scarred-helix")!;
    const recommended = promoSceneWithRecommendedBossCamera(base);
    assert.equal(recommended.cameraPreset, "reverse-inward");
    assert.notDeepEqual(recommended.observer.position, base.observer.position);
  });

  it("rejects camera presets for non-boss stills and unknown names", () => {
    assert.throws(
      () =>
        promoSceneWithBossCameraPreset(
          promoSceneById("dungeon-portal")!,
          "three-quarter-left"
        ),
      /only available for boss marketing stills/
    );
    assert.throws(
      () =>
        promoSceneWithBossCameraPreset(
          promoSceneById("boss-gilded-bull")!,
          "sideways"
        ),
      /unknown boss promo camera preset/
    );
  });

  it("registers one warm-batch proof for every authored Chapter 1 sector", () => {
    assert.equal(CH1_DUNGEON_SECTOR_PROOFS.length, 14);
    assert.equal(promoScenesInGroup("chapter1-sectors").length, 14);
    assert.equal(promoScenesInGroup("chapter1-marketing").length, 3);
    assert.equal(promoScenesInGroup("chapter1-finish").length, 16);
    assert.equal(promoScenesInGroup("chapter1-all").length, 17);
    assert.equal(promoScenesInGroup("chapter1-visual-repair").length, 15);
    assert.equal(promoScenesInGroup("chapter1-winter-final-resume").length, 3);
    assert.ok(
      !promoScenesInGroup("chapter1-visual-repair").some(
        (scene) =>
          scene.id === "dungeon-portal" ||
          scene.id === "sector-d1-dune-threshold"
      ),
      "repair batches must not re-test the already-passed gate or dune proof"
    );
    assert.deepEqual(
      promoScenesInGroup("chapter1-winter-final-resume").map(
        (scene) => scene.id
      ),
      [
        "sector-d2-sorrels-camp",
        "sector-d2-ash-hall",
        "sector-d2-breaking-year",
      ],
      "the final resume batch must contain only the three unfinished shots"
    );
  });

  it("returns undefined for an unknown id rather than throwing", () => {
    assert.equal(promoSceneById("nope"), undefined);
  });

  it("moves the live streaming observer before each warm-page capture", () => {
    const captureSource = fs.readFileSync(
      path.join(REPO_ROOT, "src/client/game/cutscene/promo_capture.ts"),
      "utf8"
    );
    const ioSource = fs.readFileSync(
      path.join(REPO_ROOT, "src/client/game/context_managers/client_io.ts"),
      "utf8"
    );
    const playerSource = fs.readFileSync(
      path.join(REPO_ROOT, "src/client/game/scripts/player.ts"),
      "utf8"
    );
    assert.match(captureSource, /stagePromoStreamingObserver/);
    assert.match(
      captureSource,
      /scene\.streamingFocus \?\? scene\.observer\.position/,
      "a cinematic camera alone does not move the terrain/ECS interest set"
    );
    assert.match(
      captureSource,
      /restorePromoStreamingObserver\(initialStreamingObserver\)/,
      "capture must restore the route's starting streaming position"
    );
    assert.match(captureSource, /promoObserverStreamingDebug/);
    assert.match(captureSource, /waitForPromoStreamingHook/);
    assert.doesNotMatch(
      captureSource,
      /performance\.now\(\) \+ 30_000/,
      "streaming readiness must not be inferred from a fixed timeout"
    );
    assert.match(ioSource, /__biomesObserverStreamingDebug/);
    assert.match(
      ioSource,
      /await this\.swapSyncTarget\(target\)/,
      "authenticated /at pages are observers and must move their sync target"
    );
    assert.match(ioSource, /biomes:promo-streaming-ready/);
    assert.match(playerSource, /biomes:promo-streaming-ready/);
  });
});

describe("promo scenes - captureAt bracketing", () => {
  const scene = promoSceneById("dungeon-portal")!;

  it("uses the authored default when no override is given", () => {
    assert.equal(promoCaptureAt(scene, null), scene.captureAt);
    assert.equal(promoCaptureAt(scene, ""), scene.captureAt);
    assert.equal(promoCaptureAt(scene, "   "), scene.captureAt);
  });

  it("honours an explicit zero — art direction may want frame one", () => {
    // Number(null) is 0, which is why the blank/omitted case must be checked
    // BEFORE parsing. A regression here silently ignores captureAt=0.
    assert.equal(promoCaptureAt(scene, "0"), 0);
  });

  it("clamps to the scene's own window, not a global constant", () => {
    assert.equal(promoCaptureAt(scene, "999"), scene.captureAtMax);
    assert.equal(promoCaptureAt(scene, "-5"), 0);
  });

  it("falls back to the default for garbage input", () => {
    assert.equal(promoCaptureAt(scene, "abc"), scene.captureAt);
  });
});

describe("promo scenes - capture URL", () => {
  const scene = promoSceneById("dungeon-portal")!;

  it("emits an observer deep link that selects this still", () => {
    const url = promoCaptureUrl(scene);
    assert.ok(url.includes("/at/"), "must use the observer route");
    assert.ok(url.includes("cutscenePromo=dungeon-portal"));
    assert.ok(url.includes("hideChrome=1"));
    assert.ok(
      url.includes("allowSoftwareWebGL=1"),
      "software WebGL is required on headless capture hosts"
    );
    assert.ok(url.includes("captureRun=1"));
  });

  it("supports bracketing without editing code", () => {
    const url = promoCaptureUrl(scene, "http://localhost:3000", {
      captureAt: "3.8",
      captureRun: "2",
    });
    assert.ok(url.includes("captureAt=3.8"));
    assert.ok(url.includes("captureRun=2"));
  });

  it("does not double a trailing slash on the origin", () => {
    assert.ok(
      promoCaptureUrl(scene, "http://localhost:3000/").includes("3000/at/")
    );
  });

  it("wraps new browser sessions in the gated visual-auth bridge", () => {
    const url = new URL(promoCaptureAuthUrl(scene));
    assert.equal(url.pathname, "/dev/harthmere-visual-auth");
    assert.equal(url.searchParams.get("username"), "Chapter1Marketing");
    const next = url.searchParams.get("next") ?? "";
    assert.ok(next.startsWith("/at/"));
    assert.ok(next.includes("cutscenePromo=dungeon-portal"));
  });

  it("generates an authenticated warm-batch URL with no single-scene selector", () => {
    const url = new URL(
      promoBatchCaptureAuthUrl("chapter1-visual-repair", undefined, {
        captureRun: "9",
      })
    );
    assert.equal(url.pathname, "/dev/harthmere-visual-auth");
    const next = url.searchParams.get("next") ?? "";
    assert.ok(next.includes("cutscenePromoBatch=chapter1-visual-repair"));
    assert.ok(next.includes("captureRun=9"));
    assert.ok(!next.includes("cutscenePromo="));
  });
});

describe("promo scenes - framing contract", () => {
  it("keeps every sector-proof camera inside its authored zone instead of shooting across void", () => {
    const volumeBounds: Record<
      string,
      readonly [number, number, number, number]
    > = {
      "d1-dune-threshold": [32, 96, -80, -24],
      "d1-salt-market": [148, 208, -84, -24],
      "d1-cistern-stair": [224, 276, -80, -32],
      "d1-hall-of-weights": [276, 316, -72, -40],
      "d1-sun-court": [316, 368, -80, -32],
      "d1-seed-vault": [368, 404, -70, -42],
      "d1-long-walk": [416, 504, -80, -24],
      "d2-ice-shelf": [24, 80, -112, -64],
      "d2-drowned-longhouse": [80, 132, -104, -72],
      "d2-hanged-wood": [132, 204, -120, -56],
      "d2-whale-road": [204, 292, -108, -68],
      "d2-sorrels-camp": [292, 324, -100, -76],
      "d2-ash-hall": [356, 416, -112, -64],
      "d2-breaking-year": [416, 476, -104, -72],
    } as const;
    for (const proof of CH1_DUNGEON_SECTOR_PROOFS) {
      const bounds = volumeBounds[proof.id];
      assert.ok(bounds, `${proof.id} has no authored volume framing contract`);
      const [x0, x1, z0, z1] = bounds;
      for (const [label, point] of [
        ["far", proof.cameraFar],
        ["near", proof.cameraNear],
      ] as const) {
        assert.ok(
          point[0] >= x0 && point[0] <= x1,
          `${proof.id} ${label} camera x=${point[0]} leaves [${x0}, ${x1}]`
        );
        assert.ok(
          point[2] >= z0 && point[2] <= z1,
          `${proof.id} ${label} camera z=${point[2]} leaves [${z0}, ${z1}]`
        );
      }
    }
  });

  it("captures repaired sector proofs after the live actor has settled", () => {
    for (const scene of promoScenesInGroup("chapter1-visual-repair").filter(
      (candidate) => candidate.id.startsWith("sector-")
    )) {
      assert.ok(
        scene.captureAt >= 2.5,
        `${scene.id} captures too early for a real streamed player body`
      );
    }
  });

  it("keeps the portal still framed the way a portal reads", async () => {
    const def = await promoSceneById("dungeon-portal")!.build();
    const shot = def.shots.find((s) => s.id === "portal-crossing")!;

    // Narrow FOV: at 70+ the player drifts off the aperture and the shot
    // stops reading as "standing before a portal".
    const fov = shot.actions.find((a) => a.kind === "fov") as
      { fov: number } | undefined;
    assert.ok(fov && fov.fov <= 45, "promo portal FOV must stay compressed");

    // The camera must look at the gate, not at the player.
    assert.equal(shot.camera.kind, "dolly");
    if (shot.camera.kind === "dolly") {
      assert.equal(shot.camera.lookAtRole, "gate");
      assert.equal(
        shot.camera.waypoints.length,
        2,
        "a push-in keeps every bracketed frame composed"
      );
    }

    // Camera below the gate's centre so it looks slightly UP. Looking down at
    // a portal makes it read as a puddle.
    const gate = def.cast.find((c) => c.role === "gate")!;
    assert.equal(gate.binding.kind, "anchor");
    if (gate.binding.kind === "anchor" && shot.camera.kind === "dolly") {
      const gateY = gate.binding.position[1];
      for (const waypoint of shot.camera.waypoints) {
        assert.ok(
          waypoint.position[1] < gateY,
          "camera must sit below the aperture centre and look up"
        );
      }
    }

    // Dusk: the gate is the only strong light source in frame.
    assert.ok(
      (def.settings.timeOfDay ?? 0.5) > 0.7,
      "promo portal wants a dark sky so the emissive shader carries the frame"
    );
    assert.ok(
      shot.actions.some(
        (action) => action.kind === "moveTo" && action.role === "player"
      ),
      "the gate marketing frame must show traversal, not a static pose"
    );
  });

  it("never risks the live world for a screenshot", async () => {
    for (const scene of PROMO_SCENES) {
      const def = await scene.build();
      assert.equal(def.settings.mode, "clientPuppet");
      assert.deepEqual(def.settings.commitOn, []);
      assert.deepEqual(def.onEnd.placements, []);
      assert.deepEqual(def.onEnd.commits, []);
      assert.ok(
        def.priority >= 100_000,
        "a promo still must preempt ambient scenes"
      );
    }
  });

  it("stages the Chapter 1 stills with the real cast and restrained off-axis action", async () => {
    for (const id of ["ch1-sand-that-remembers", "ch1-long-winter-mouth"]) {
      const scene = promoSceneById(id)!;
      const def = await scene.build();
      const shot = def.shots.find(
        (candidate) => candidate.id === scene.shotId
      )!;
      assert.ok(
        def.cast.some((member) => member.binding.kind === "player"),
        `${id}: action still must use the real authenticated player`
      );
      assert.ok(
        !def.cast.some((member) => member.binding.kind === "ghost"),
        `${id}: never substitute a generic humanoid when a distant ECS NPC is not streamed`
      );
      assert.ok(
        shot.actions.some(
          (action) => action.kind === "vfx" && action.scale >= 2
        ),
        `${id}: action still needs one readable environmental impact`
      );
      assert.ok(
        !shot.actions.some(
          (action) =>
            action.kind === "vfx" && action.effect === "exoticMatterCreation"
        ),
        `${id}: do not cover every landscape with centre-frame sparkling dust`
      );
    }
  });

  it("keeps the requested marketing lockups exact", () => {
    assert.equal(
      promoSceneById("ch1-sand-that-remembers")!.brand.headline,
      "The Sand That Remembers | Biomes"
    );
    assert.equal(
      promoSceneById("ch1-long-winter-mouth")!.brand.headline,
      "The Long Winter Mouth | Biomes"
    );
  });
});
